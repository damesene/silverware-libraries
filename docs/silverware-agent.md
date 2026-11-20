# Silverware for AI agents: the `model` API

Plan, agreed 2026-11-20. Nothing is built yet. **Starts after Silverware Table's store refactor** (docs/silverware-table-store-plan.md) is done whole: the table goes first, and its writes need the refactor (*Order*).

## Why

SilverBullet's edge gets an MCP server (<https://edge.silverbullet.md/MCP>, read 2026-11-20). An agent connected to it gets fixed tools: `help`, `read`, `write`, `edit`, `search`, `lua` (Space Lua in the live space, needs the space's Runtime API) and `screenshot` (also needs the Runtime API). It cannot be given tools of a plugin's own. What it can be given are **skills**: pages tagged `meta/skill`, plus library pages tagged `meta/library` outside `Library/Std`, which `help` lists with their descriptions (a library without one: its first sentence) and an agent loads by reading the page.

So our library pages already are skills (`meta/library` in `Library/damesene/`), but they are user documentation, and long: about 45,000 tokens for Silverware Table's (179 kB), 14,000 for Database's, 7,500 for Toolbar's, 5,000 or less for the others (at about 4 characters a token). An agent loading one spends its context mostly on menus, keys and pointer gestures it cannot use.

And a skill alone does not make an agent reliable with Silverware: our markdown (formulas in `<meta formulas.f=…>`, a pivot's metadata row, Layout's grids, Assets' embeds with metadata) written by hand is the most fragile part, and a mistake shows only when the page is drawn. So the agent does not write our syntax at all: it reads a page's content as data and changes it by operations that our code writes, previewing them first.

## Decisions

1. **Operations, not text.** An agent changes what a plugin owns by operations (`addColumn`, `addPivot`, …), written by the plugin as its UI writes them: valid by construction, results of formulas, pivots and views written in the same edit.
2. **Reading as data.** The agent reads a plugin's content as values (numbers, not `12,99 €`), with formulas, types and computed results (a pivot's rows), so it checks a result without a screenshot.
3. **Preview first.** Every change can be a dry run: the diff of the page, the problems, a preview of the computed values, nothing written.
4. **Operations are data, applied in a batch.** `apply(page, ops, options)` takes a list of operations, all or none: one preview, one recalculation, one write, one undo step. A problem's `fix` is itself an operation, the schema of an operation maps 1:1 onto an MCP tool's, and the shared layer handles every plugin's batches alike. No function per operation for now; thin wrappers (`addColumn(page, params, options)` calling `apply`) may come later if scripts want them.
5. **Self-description.** `describe()` gives the operations with their parameters' schemas, the column types, the functions; generated from the same registry as the operations and their validation, so it cannot drift from the code. The skill page stays short: call `describe`, read with `read`, compute with `evaluate`, write with `apply` and `dryRun`, check with `problems`.
6. **No separate plugin.** Everything a plugin knows (its operations, its model API, its skill page) is in the plugin, in a module of its own its core does not depend on; releasing the table releases its agent support. What is generic and knows no plugin by name (the operation and problem formats, the registry behind `describe`, operations turned into the page writer's changes) goes into `shared/`. A separate plugin is reconsidered only if work across plugins needs orchestration (so far Chart reads Table through its API, which covers it).
7. **Namespace `silverware.<name>.model`.** `model.describe`, `model.read`, `model.problems`, `model.apply` (and, where a plugin computes, `model.evaluate`), the same in every plugin that has it, so the shared layer and the skill find them without knowing the plugin. Not `.api`: that already is the JS object a plugin hands other plugins (Assets, Editor, Icons, Layout). Not `.agent`: the model is useful to users' scripts too. What is in `model` is a contract: a breaking change of it is a MAJOR release. The module's folder is not `model/`: the store refactor gives that name to the table's pure `TableModel` (e.g. `src/modelapi/`).
8. **Context is a budget.** What the agent gets is sized for it: a skill page of 1,000 to 3,000 tokens; `read` takes the columns wanted, a limit and an offset (a large table is thousands of rows), and says how many rows there are; `describe` is filtered (`describe({ functions = "XLOOKUP" })`, a search) rather than every function with its description at once. A question over the data goes to `evaluate`, not to reading every row.
9. **The table first, after its store refactor.** The table is where an agent gains most (formulas, pivots, views) and where hand-written markdown is most fragile. Its writes today are bound to a rendered table and the editor (`write(widget, change, …)`, one `editor.replaceRange`), and its modules read the page's text and call SilverBullet through `bridge`; a write of a page not open (as MCP's are) needs the refactor's model, stores and page writer (its steps 2, 3 and 4b). A second write path beside it would duplicate the write pipeline's logic (recalculation, references followed, column metadata, calculated columns), so the agent waits for the refactor, done whole. Read-only support before it (over `tables(text)`, `evaluate`, `errors`) was weighed and not taken: the table's `model` comes in one piece, on the refactor's model.

## The API, by Silverware Table's example

The agent calls it through MCP's `lua` tool. Tables are named by their name (`orders`) or their place on the page (`#1`), columns by their key (`unit_price`, as references and queries name them), rows by number or by values (`{ fruit = "Pear" }`) or by a formula of one row (as `pivot.where`). Cell letters (`B2`) only inside formulas. Values below (versions, a pivot's column keys) are illustrative.

### `read`

```lua
return silverware.table.model.read("Shop/Orders", { columns = { "fruit", "total" }, limit = 50 })
```

```lua
{
  tables = {
    {
      name = "orders", index = 1, line = 5, rowCount = 2,
      columns = {
        { key = "fruit",  header = "Fruit" },
        { key = "qty",    header = "Qty",   type = "number" },
        { key = "price",  header = "Price", type = "currency-usd" },
        { key = "total",  header = "Total", type = "currency-usd",
          formula = "=[@qty]*[@price]" },          -- a calculated column
        { key = "status", header = "Status", type = "choice-status" },
      },
      choices = { status = { "open", "shipped", "paid" } },
      rows = {
        { fruit = "Pear",  total = 38.97 },
        { fruit = "Apple", total = 15 },
      },
      totals = {
        { fruit = "Total", total = { value = 53.97, formula = "=SUM([total])" } },
      },
    },
    {
      name = "by_status", index = 2, line = 14, rowCount = 2,
      pivot = { source = "orders", rows = "status", values = "SUM([total])" },
      rows = { { status = "open", sum_of_total = 38.97 }, { status = "paid", sum_of_total = 15 } },
    },
  },
}
```

* Every column is described; `rows` hold the columns asked for (all where none are), up to `limit` from `offset`.
* A formula is on its column where the whole column holds it (a calculated column), else on its cell.
* `read(page, { markdown = true })` adds each table's text.

### `evaluate`

Today's `silverware.table.evaluate(formula, text, page)` as the model's: any formula over the page's named tables, other pages' (`[[Prices]]fruit![price]`) and the space's sources (`@tasks`), nothing written. The page is named, not taken from the editor: through MCP no page may be open.

```lua
return silverware.table.model.evaluate("Shop/Orders", '=SUMIFS(orders![total], orders![status], "open")')
-- 38.97, or nil and { code = "#REF!", detail = "…" }
```

A formula reaches only named tables (`A1` alone is `#REF!` outside a table). Whether `evaluate` takes a table by its place (`#1`) as `read` does is open.

### `apply` with a dry run

```lua
return silverware.table.model.apply("Shop/Orders", {
  { op = "addColumn", table = "orders", header = "VAT", after = "total",
    type = "currency-usd", formula = "=[@total]*0.21" },
}, { dryRun = true })
```

```lua
{
  ok = true,
  diff = "…",                       -- the page writer's preview of the lines changed
  problems = {},
  preview = { { fruit = "Pear", vat = 8.18 }, { fruit = "Apple", vat = 3.15 } },
}
```

Without `dryRun` the same writes the page and gives back what undoes it (`undo`, for `model.undo(undo)`): a page written through the space has no Ctrl+Z.

### A problem, with its fix

```lua
return silverware.table.model.apply("Shop/Orders", {
  { op = "setFormula", table = "orders", column = "vat", formula = "=[@totl]*0.21" },
}, { dryRun = true })
```

```lua
{
  ok = false,
  problems = {
    { code = "#REF!", table = "orders", column = "vat", at = "[@totl]",
      message = "No column totl in orders",
      fix = "[@total]",
      columns = { "fruit", "qty", "price", "total", "vat", "status" } },
  },
}
```

* Nothing is written when a problem stops an operation: all or none.
* `fix` only where the fix is the only one; otherwise what exists (`columns`, `functions`).

### Rows by key

```lua
return silverware.table.model.apply("Shop/Orders", {
  { op = "addRows",    table = "orders", rows = { { fruit = "Plum", qty = 4, price = 2.2, status = "open" } } },
  { op = "updateRows", table = "orders", where = { fruit = "Pear" }, set = { status = "shipped" } },
  { op = "deleteRows", table = "orders", where = '[@status] = "paid"' },
})
```

* A calculated column fills its cell of a new row.
* A value outside a `#choice` list is a problem (`code = "choice"`, with the values allowed), not text kept silently.

### Pivots and views

```lua
return silverware.table.model.apply("Shop/Orders", {
  { op = "addPivot", name = "by_month", after = "orders",
    source = "orders", rows = 'TEXT([@date], "yyyy-mm")', columns = "status",
    values = { "SUM([total])", 'SHARE(SUM([total]), "row")' }, totals = "both" },
  { op = "addView", name = "open_orders", after = "orders",
    formula = '=SORT(FILTER(orders![#Data], orders![status] = "open"), 4, -1)' },
}, { dryRun = true })
```

The parameters are the `pivot.*` attributes and `view.formula` as the dialogs write them: the agent and the user speak one language.

### Types and names

```lua
{ op = "setType", table = "orders", column = "status", type = "choice-status",
  choices = { "open", "shipped", "paid" } }
{ op = "setType", table = "orders", column = "due", type = "date" }
{ op = "renameColumn", table = "orders", column = "qty", header = "Quantity" }  -- references follow
{ op = "renameTable", table = "orders", name = "sales" }                        -- references follow
```

### `problems`

For a page changed outside Silverware (by hand, by MCP's `write`):

```lua
return silverware.table.model.problems("Shop/Orders")
```

```lua
{
  { code = "stale", table = "orders", message = "Results out of date",
    fix = { op = "recalculate", table = "orders" } },
  { code = "#DIV/0!", table = "orders", row = 3, column = "margin", formula = "=[@profit]/[@qty]" },
  { code = "duplicateName", table = "orders", message = "Two tables named orders" },
}
```

A `fix` that is an operation goes to `apply` as it is.

### `describe`

```lua
return silverware.table.model.describe({ functions = "XLOOKUP" })
```

```lua
{
  plugin = "table", version = "2.0.0",
  ops = {
    addColumn = { summary = "Add a column, optionally typed and calculated",
      params = { table = "table ref", header = "string", after = "column key?",
                 type = "column type?", formula = "formula?" } },
    addPivot = { … },
  },
  types = { "currency", "number", "percent", "unit", "stars", "check", "choice",
            "date", "time", "trend", "progress", "link" },
  functions = { XLOOKUP = { syntax = "XLOOKUP(value, lookup_range, result_range)", summary = "…" } },
  errors = { "#REF!", "#NAME?", … },
}
```

The operations' schemas are JSON Schema, one per operation (`oneOf` by `op`), so an MCP tool's `inputSchema` can be made of them as they are.

## The shared layer

`shared/pages/` has most of what a batch needs already: `plan` (pages read, new texts made in memory, a preview of the lines changed, nothing written), `apply` (the page open in the editor through the editor, one undo step there, another through the space; a page changed since it was read left and reported) and `planUndo`. The shared part of this plan is what is on top of it: the operation and problem formats, the registry that validates operations and gives `describe`, and an `apply` that turns a plugin's operations into the writer's changes (a dry run is the writer's `plan`, the write its `apply`, the undo its `planUndo`). The table's store writes through the writer after the refactor's step 4b, so its operations need nothing else.

## Skill pages

Each plugin with a `model` installs a page for agents beside its others (`silverware-table-agent.md`, `tags: meta/skill`, in the library page's `files:`), within the budget of decision 8: the workflow above, the plugin's concepts in a few lines, minimal examples, the mistakes to avoid. The rules of installed pages hold (no mentions: `\@`; examples fenced `lua`, never `space-lua`). It reaches a space with the plugin's next release.

While SilverBullet lists library pages as skills too, an agent may load the long library page instead: each library page's `description` ends by naming its agent page (e.g. "For agents: Library/damesene/silverware-table-agent"), until SilverBullet takes only pages marked `meta/skill` (*Upstream*).

## Measuring

A set of tasks for an agent (add a calculated column, a pivot by month, a question answered by `evaluate`, …) run through MCP against a test space on edge, each result checked by `model.read` and `model.problems`, not by eye. It needs an agent and its API key and costs money per run, so it runs by hand or locally (before a release of the model API), not in every CI run. Only its numbers say how reliable this is; until then it is an estimate.

## Order

0. **Silverware Table's store refactor, whole** (docs/silverware-table-store-plan.md, its steps 1 to 7): the model, the stores, the platform, the table written through the page writer.
1. **Shared layer** (*The shared layer*).
2. **Table**: `read`, `evaluate`, `problems`, `describe`, and the operations `addColumn`, `setFormula`, `addRows`, `updateRows`, `addPivot`; its skill page.
3. **Measuring** against it; the API corrected by what it shows.
4. **The rest of the table** (`deleteRows`, `addView`, `setType`, renames, `recalculate`, …).
5. **Other plugins** by the same pattern, likely Layout and Assets next (their syntax is the most fragile by hand), then Chart, Database, Tags.

## Upstream

Proposed on SilverBullet's forum (2026-11-20):

* **Only pages marked `meta/skill` as skills**: library pages are user docs, often long; a library ships a short page for agents, and a small library whose page is enough tags it `meta/skill` too.
* **MCP tools from Space Lua**, in the style of `command.define`:

  ```lua
  mcp.defineTool {
    name = "table_apply",
    description = "Apply operations to the tables on a page. Use dryRun to preview.",
    inputSchema = { type = "object", properties = { … }, required = { "page", "ops" } },
    annotations = { readOnlyHint = false, destructiveHint = true }, -- it can delete rows
    run = function(args) return { ok = true, diff = "…", problems = {} } end,
  }
  ```

  With it each plugin registers its operations as tools from `describe`, and the agent calls them without the generic `lua` tool.

## Open questions

1. **Where `lua` runs.** MCP's `lua` runs in the space's runtime, likely not the user's browser: the page writer's "page open in the editor" is the runtime's then. To verify on edge how SilverBullet reconciles a page written by the runtime while the user has it open elsewhere (a sync conflict was seen in CONFIG.md, written on disk while open).
2. **Settings that stop a write.** With *Store table metadata* off a formula cannot be stored: a `problem` saying so (proposed), or `apply` refusing such operations up front.
3. **Names of a pivot's columns in `read`**: the keys a query gives them, so `read` and queries agree.
4. **What `help` shows as a skill's description**: the MCP page says "their descriptions" without naming the frontmatter key; our library pages have `description:`. To verify on edge.
5. **Tables without a name in formulas**: `evaluate` and `where` reach only named tables; whether the model takes `#1` there too, or an operation names a table first.
