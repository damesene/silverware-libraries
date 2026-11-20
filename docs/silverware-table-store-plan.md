# Silverware Table: tables apart from where they are kept

Status (2026-11-20): steps 1 and 2 done in branch `refactor/table-store`
(*Decided*; what step 2 left to later steps is under it), the rest planned;
the plan is in `main`. What it waited for is
in `main`: the views plan
(docs/silverware-table-views-plan.md), whose sources (`@tasks`) are the first
tables kept nowhere in a page and this plan's second store; the platform
(`shared/platform.ts`) and the page writer (`shared/pages/`), built for
Silverware Database. The first step here can start.

The model API for AI agents (docs/silverware-agent.md) starts after this plan,
on its model and its store.

**Scope** (2026-11-20, with the user): the aim is that **no plugin depends on
where it runs**, not the table alone (docs/silverware-database.md, *What
next*). It is reached one plugin at a time: **this plan is Silverware Table
alone, done whole first**; Silverware Toolbar and Chart (small bridges of
their own) and Silverware Tags (pages read through a `Space` of its own,
docs/silverware-database.md, *Left open after step 2b*) move onto the platform
after it, each by a plan and a branch of its own, started only when the user
says so. Nothing here waits for them or is done for them.

## Why

Silverware Table is apart from SilverBullet's rendering already
(docs/silverware-table-isolation.md: modules in model terms, the rendering
behind `TableAdapter`). It is not apart from where a table is kept:

- **The model is markdown.** `Table` (markdown.ts) is the markdown's rows: a
  cell is its markdown text with `|` escaped and its hidden `<meta>` tags in
  it, the row's `source` line, `padded`, `delimiterSource`; the table's and its
  columns' data a flat record of the metadata row's attributes
  (`core.-c-qty.sort`); a column's type a hashtag in its header's text.
- **Modules find tables in the page's text themselves.** 28 files of
  `features/` and `core/` (2026-11-20; 23 at the plan's start) call
  `parseTable`, `findTables`, `locateBySource`, `pageTablesOf` or
  `cellSourceOffset`, or read `pageText`; modules read `host.pageText` or `bridge.getText()`, keep
  offsets (`TableInfo.hint`, `cellSourceOffset`, `TextPosition`,
  `TextWritten`, `WritePage.from`) and compare a table's markdown
  (`TableInfo.source`).
- **The modules' API passes markdown.** Hooks and host functions take a cell
  as its markdown with its tags (`keepsCell(cell: string)`, `fillCell`,
  `getCellTag(cell, …)`, `keepTags(value, from)`), a header's name escaped
  (`headerRenamed`), hashtags to hide (`hideHeaderTags`).
- **Modules call SilverBullet.** `ModelHost.bridge` is SilverBullet's API
  handed over by the init page (`getText`, `replaceRange`, `readPage`,
  `writePage`, `getCursor`, `evalExpression`, `markdownToHtml`, `flash`,
  `confirm`…): 17 modules use it (2026-11-20).

So a table kept anywhere else (a code block holding a view's definition, a
source of Space Lua, a file, a database) means touching every module, and so
does a change of how markdown keeps data (an attribute's syntax, where a
row's name is).

## Goal

Modules and domains work on a table **in memory**: its columns, rows and
cells, each with its content and its attributes, by the table's key. Where it
came from and how it is written back is a **store**'s; what the platform
offers (a document's text, other documents, settings, notifications) is the
**platform**'s, how a document is written the **page writer**'s. Moving tables
to a new place is a new store, and running outside SilverBullet is a new
platform and a new adapter, with no module changed.

Not a goal: changing what users have. Pages keep their tables as they are
now, byte for byte where nothing changed; settings and the Lua API keep their
names.

## Principles

What the design below follows, and what decides a case it does not name:

1. **The model says what a thing is; a store says how it is kept.** A store
   writes the model as its form allows and is the only one reading that form
   back. Nothing of one store's form (escapes, tags, hashtags, lines,
   offsets) is in the model or the modules' API.
2. **Dependencies go one way**, as they do now (CLAUDE.md of the table,
   *Layers*): domains import the model; modules import the model, domains
   (through their index) and the core's interfaces (`core/feature.ts`:
   `ModelHost`, the hooks); **the core imports no module** (the controller's
   own `features/metadata.ts` the one exception, as now), the modules being
   put together by `modules.ts`; stores implement the core's `TableStore`
   and import the model and the platform; host bindings import all of it and
   put it together. Nothing imports a binding. `isolation.test.ts` checks it
   by folder.
3. **What can be derived is not kept.** An attribute follows its column
   because it is on the column, not because a step moves it; a column's
   attributes survive its header renamed because the name is not where they
   are.
4. **One mechanism, not one per case.** One attribute API for a table, a
   column, a row and a cell; one transaction for every write, whichever
   document and however many tables.
5. **An interface is proven by its implementations.** Every store passes the
   same contract tests.

## Layers

Each layer imports only the layers above it (an arrow points at what is
imported); the core's interfaces sit above the modules, its code beside them
knowing none:

```text
model/        TableModel, attributes, pure operations (ops, pins, structure)
   ▲
domains       formulas/, pivot/, calculated/, conditions/, columntypes/, autofill/, excel/, export/, sheet/
   ▲
core/feature.ts and the store's interface: ModelHost, hooks, TableStore
   ▲
features/     modules: ModelHost and TableModel only        core: controller, write pipeline,
                                                                  view, editor (no module)
   ▲
store/        markdown/ (codec, register), memory.ts, sources; over the
              platform and the page writer
   ▲
host/         renderer.ts (the interface); silverbullet/ (the platform, the adapter,
              the Lua API, places in Lua calls, history markers); playground/
```

### The model (`model/`, pure)

`TableModel`, immutable, as `Table` is now:

- `columns`: each `{ header, align, attributes }`; `header` the name alone.
- `rows`: each `{ cells, attributes }`; a cell `{ content, attributes }`.
- `attributes` of the table.
- No `source`, `padded`, `indent`, escapes or offsets: those are the codec's,
  kept beside the model it made, so an untouched row is written back as it
  was.

**A cell's content is the cell language**: inline markdown, unescaped (a link,
a hashtag, `${…}`, `\#REF!`). That is what a cell holds wherever it is kept;
`|` escaped in a row is the markdown codec's.

**Attributes** are keyed by owner and key, as `metanames.ts` makes them now,
but kept as a pair, on what they are about. Their flat names
(`<owner>.-c-<column>.<key>`) are the markdown codec's. So:

- a column's attributes go with the column through moves, renames and
  deletes by the model's own operations (`followColumnMeta` goes);
- a column's type is in an attribute of the column: the header's hashtags,
  of which the type registry takes its type (`currency-usd`, `stars-10`) and
  reads the parameters as now (`readParams`); see *Decided (2026-11-20)* 6;
- a row's name is an attribute of the row;
- an attribute may be declared `unique` (a name: one per table), so a copied
  row or cell leaves it out (`uniqueTags` goes);
- editing a cell's content keeps its attributes, but an attribute may be
  declared `boundToContent` (the formulas' formula): the core's write step
  drops it from a cell whose content the edit changed without setting or
  changing that attribute (*An attribute bound to its content*, below).
  `takesTags` and `keepTags` go.

**An attribute bound to its content.** A formula is the cell's content's
source: a value typed, pasted or cleared over it ends it, its result written
by a recalculation does not. That is decided by the state before the whole
edit, so it is the core's write step (CLAUDE.md, *Modules and their data*),
in one place for every way a cell is changed:

- the rule runs after the edit (`change`) and before the modules' write
  steps: for each cell whose content differs from the table before, an
  attribute declared `boundToContent` that the edit did not set or change is
  taken off;
- a recalculation runs in the formulas' write step, after the rule, so a
  result written keeps its formula;
- the declaration is the owner's (an attribute's property, as `unique`), so
  the core names no module and a new module with such an attribute needs no
  rule of its own.

Not a rule in the formulas' write step: it would have to tell a value typed
from the formula's result by comparing them, keeping the formula where the
value typed is the result, and each module with such an attribute would
repeat it.

What every way of changing a cell does, which the tests of step 3 cover:

| Way | Formula |
| --- | --- |
| A value typed over it (the editor) | dropped: content changed, attribute not set |
| `=…` typed (the editor) | kept: the edit sets it |
| Clear, Delete | dropped: content changed |
| Paste over it | kept: paste leaves cells a feature keeps (`keepsCell`), content unchanged |
| AutoFill | kept: `fillCell` copies the attribute with the content |
| Cells moved (cut and paste, dragged) | kept: attributes go with their cells |
| A recalculation | kept: after the rule |
| The markdown edited by hand | no write, no rule: the next recalculation writes the result, as now |

**Rows** are counted as now (the header 0, the body from 1) and called the
model's rows, not the markdown's: the numbers stay, what they mean is the
model's.

**A table's revision**: the store gives each table's model with a revision,
which changes whenever its model does; what compared `TableInfo.source` to
tell a table changed compares the revision. The markdown codec keeps the last
models by text (as `parseTable` does), so reading the same text again gives
the same model and revision.

**A model made once, kept from our own writes** (decided 2026-11-20, with the
user):

- **Our writes fill the cache.** A write makes the new model from the old by
  the change (a new version: unchanged rows shared, so it costs the rows
  changed), the codec writes its text, and the model goes into the cache by
  that text. The table rendered anew after our write finds its model there:
  nothing is parsed again. Today `parseTable` parses every table we wrote,
  its text being new.
- **A change from outside is found by comparing, not by an event.** On each
  read the table's text is compared with the text its cached model is of;
  equal, the model is used. A table's text changed outside Silverware Table
  (typed in the markdown, Ctrl+Z, a sync, MCP's `write`) misses the cache and
  is built anew when something needs it, not when the text changes. No event
  is relied on, so none missed (an undo, a sync) leaves a stale model. The
  store's `changed(listener)` stays, for another purpose: it tells the UI
  that something is out of date (*Recalculate* highlighted, a pivot's
  *Out of date*); the comparison keeps the cache right. Neither does the
  other's work.
- **Built when needed.** A table shown is built as it is rendered (its looks,
  types, formulas' marks need the model); one holding the cursor is markdown
  in SilverBullet, no widget, so typing in it builds nothing until the cursor
  leaves; one far out of view (CodeMirror keeps only blocks near the
  viewport) is built once it is drawn; one on another page once a formula or
  the model API reads it.
- **Immutable versions**: a write, an undo and a module may each hold a
  version; none changes under them.

So for the UI the model should cost no more than `Table` now (one build per
change from outside, as `parseTable` now; none after our writes, where
`parseTable` parses now), which the benchmark checks (*Risks*). The model API
for agents (docs/silverware-agent.md) reads and writes through the same
cache.

### The modules' API (`core/feature.ts`)

What changes for the modules, so that nothing of a store's form is in it:

| Now | After |
| --- | --- |
| `Table` everywhere (hooks, host, write steps) | `TableModel` |
| `getMeta`, `setMeta`, `columnsMeta`, `setColumnsMeta`, `getCellTag`, `withCellTag`, `canStoreMeta`, `canStoreCellTag` | one owner-scoped API: `attribute(table, key, at?)`, `withAttribute(table, key, value, at?)`, `attributes(table, key)`, `canStore(table, key, at?)`; `at` a column, a row or a cell |
| `keepsCell(cell: string)`, `cellKeptBy(cell)` | `keepsCell(cell: Cell)` |
| `fillCell(…, cell: string, …)` | `fillCell(…, cell: Cell, …): Cell` |
| `takesTags`, `keepTags`, `uniqueTags` | gone (attributes kept on edit; `unique` and `boundToContent` declared, the core's write step applying them) |
| `headerRenamed` | gone (a header's name holds nothing else) |
| `hideHeaderTags` | gone (the binding hides what the codec writes into headers) |
| `TableInfo.source`, `hint`, `metaRow` | gone (`revision`; the place is the store's; the metadata row the adapter's) |
| `pageText`, `otherPages()`, `PageTable` | `host.tables(document)`, `host.table(key)`, other documents through the store |
| `WritePage`, `TextWritten`, `TextPosition` | `WriteEdit.document` (its tables by key), places by key, `InsertPlace` |
| `bridge` | `notify`, `ask`, `navigate`; nothing else of the platform |

### The store (`core/store.ts`, the interface)

What the core asks; modules never see it (they get tables through the host):

- `tables(document)`: a document's tables in order, each `{ key, revision,
  model }`; `table(key)`; `documentOf(key)`. A document is named by a string
  (a page's name in SilverBullet, as formulas write `[[Page]]`).
- `transaction(document, changes)`: tables changed, inserted or deleted and
  places written, **as one step** (one undo step where the platform has
  undo), whether the document is open or not (lazy saving writes into a page
  left: the store reads and writes it through the platform's `space` then). What a
  write needs today of `also`, `otherTablesWritten`, `otherTextWritten`,
  `insertTable`, `deleteTable`, and lazy saving's `writePage`.
- `places(document)`: content kept outside tables that formulas are in, each
  by a key of its own, read and written as a cell's content. Which places a
  document has is told to the store by the binding (the formulas of
  `silverware.table.evaluate(…)` calls: `defineFormulaPlaces`, as now).
- `reveal(key, cell)`: the cell shown to the user (*Find formula errors*,
  `errorsText`'s links).
- `InsertPlace`: where a new table goes, opaque (after a table, at the
  cursor); the core gets the cursor's from the store, not as an offset.
- `changed(listener)`: a document's tables changed outside a write (the
  markdown edited by hand, undo, another document indexed).
- `writable(key)`: what of a table may be written (all; header and
  attributes only: a view kept as its definition; nothing: a source).

Which table is which (`TableRegister`, matching a page's tables to keys as its
text changes) is the markdown store's: keys stay the core's kind of value, the
register moves behind the store.

**What a store keeps is the store's setting.** The metadata setting (whether
new attributes are stored) is every store's and stays the core's;
`autoFormat` (padded columns, `FormatRule`) is the markdown codec's, read by
it under the path it has now.

### Stores

- **Markdown in a page** (`store/markdown/`): the codec (markdown.ts, meta.ts,
  tags.ts, tagvalues.ts, names.ts' storage, columns.ts' keys, a type as a
  header's hashtag, a row's name in a cell, escapes), the register, through the
  page writer (its part `tables`), over the platform's `editor` for the open
  page and its `space` for others. Nothing of
  SilverBullet in it: it is markdown in a text.
- **Memory** (`store/memory.ts`): tables in memory, for tests and the
  playground's benchmark.
- **Sources** (the views plan's `@tasks`): read only, through the same
  interface.

**Contract tests** (`store/contract.ts`): one suite every store's test runs
against itself: tables read in order with stable keys, a transaction of
several tables and places as one step, insert and delete, revisions, changes
from outside told, `writable` respected. A store that passes it is a store.

### The platform (`shared/platform.ts`) and the page writer (`shared/pages/`)

Shared with Silverware Database (decided 2026-11-07, *Decided (2026-11-07)*
below; docs/silverware-database.md, *Layers*, *Shared with Silverware Table
and Silverware Tags*, its *Decided* 18 to 25): the database was built first,
in these shapes, and put them into `shared/` (now in `main`); this
plan takes them from there, so that tables and pages are written one way. A
change of either is made for both plugins.

`Bridge` split by what it is for. What the bridge has optional stays optional:
a member the platform marks so (the editor's undo, a rename), or a part of the
platform the table takes as optional where it can do without it (a bridge
without `readPage` gives no `space`):

- `Platform = { editor, space, index, ui, settings }` (interfaces only, plain
  names in place of ports): `Editor` (the open document's text, an edit
  applied, cursor and selection, undo/redo, a document opened, told as it is
  edited or another is opened), `Space` (documents read, written, listed,
  renamed), `Index` (the index's objects and its changes, reading only),
  `UserInterface` (notify, ask, pick, reload), `Settings` (read, saved).

- `Renderer` (`host/renderer.ts`, the table's own): markdown to HTML, `${…}`
  evaluated (the adapter's).

Modules get none of them: what they need is a host function in model terms.

**One writer per document.** The database writes pages through the page
writer: changes made by a builder in the model's terms (a section per part of
a page's content, `properties` and `tags`; a page's `rename`), `plan` (pages
read, new texts in memory, a preview, nothing written) and `apply` (page by
page where still as read, reported), `PageHistory` for undo; the writer alone
writes documents (`Editor.replace`, `Space.write`). The markdown store's codec
of tables (the metadata row, hidden tags, escapes, *Stores*) stays the
store's, the one place that reads that form back (Principle 1), and is
registered with the writer as its part `tables` (step 4b): a transaction of
this plan becomes a batch of the writer's changes, so a table's edit and a
page's properties or tags are written in one edit of one document. The
writer's parts are built in only until a plugin needs its own; the registry
they go through is the one the table's part is registered with.

### The SilverBullet binding (`host/silverbullet/`)

Everything that is SilverBullet's and not markdown's, in one place:

- the platform, made of what the init page hands over;
- the adapter (`core/silverbullet/` now) and its pairing with the markdown
  store: which key a rendered table is (`data-pos`, shape, source; moved out
  of the controller), the type hashtags hidden in headers (the codec tells
  which part of a header it wrote);
- the history markers (the cursor put outside a table around each write, for
  SilverBullet's undo): the binding's `Editor` places them, as it knows
  the edit's range;
- the places in Lua calls (host/lua.ts, formulas/places.ts' finding);
- the Lua API: `silverware.table.tables(text)`, `onWrite(fn(text))`,
  `evaluate(formula, text, page)`, `evaluateText`, `errors(page)`,
  `errorsText`, the aliases and the `define…` functions, implemented over the
  store and the model, names and arguments kept.

The playground is a binding of its own over the same interfaces.

## Order

Each step is commits that leave `npm run verify` and the UI tests (both
targets) passing; an old host function stays until no module uses it. Each
step tightens `isolation.test.ts` so that what it moved cannot come back.

1. **The platform.** `Bridge` split into the platform (`shared/platform.ts`,
   see *The platform and the page writer*); `host.notify`, `host.ask`,
   `host.navigate` for modules; no module reads `host.bridge` (removed from
   `ModelHost`). Test: no `bridge` in `features/`.
   **Done (2026-11-20)**: `core/platform.ts` (`TablePlatform`: `editor`,
   `space` where pages are read, `ui`, `settings` of the shared platform, and
   the table's `Renderer`), made of the bridge by the binding
   (`host/silverbullet/platform.ts`; the init page unchanged), held by the
   controller, the settings dialog and the adapter (`TableHost.platform`).
   What modules read of the bridge besides notifying became host functions
   that step 2 and 4 take away: `pageTextNow`, `pageNameNow`,
   `replacePageText` (Remove metadata), `cursorNow`, `undoEdit`, `pages`
   (other pages read, written, listed) and `configured` (a setting by path,
   Excel's functions).
2. **Tables through the host.** (Steps 2 and 3 both go through every module:
   first where tables come from, then what a table is. Done at once, no step
   between would pass the tests; apart, each leaves the table working.) The
   store interface and the markdown store as a façade over today's code (the
   model still `Table`): `host.tables`,
   `host.table`, `revision`, transactions in place of `also`. Offsets stay,
   inside the core and the store only. Modules stop calling `parseTable`,
   `findTables`, `locateBySource`, `pageTablesOf`, `cellSourceOffset` and
   reading `pageText`, `hint`, `source`. The big modules one commit each
   (formulas, sheets, the sheet, views, pivot, names, lazy, metadata, the
   choices dialog, sources, custom menus, Silverware Layout's provider). The
   contract tests start here. Test: `features/` import nothing of markdown.ts
   but types.
   **First part done (2026-11-20)**: the store's read side (`core/store.ts`:
   `TableStore`, `StoredTable`, `TableRevision`), the markdown store as a
   façade over the register and `parseTable` (`store/markdown/store.ts`,
   `MarkdownStore`, the controller's), the contract tests begun
   (`store/contract.ts`, run by the markdown store's test); `host.tables`;
   `TableInfo.model` and `.revision`, so no module parses a shown table's
   markdown any more (`isolation.test.ts`) and the filters' and widths'
   state is kept by revision.
   **Done (2026-11-20)**: the rest. `host.pageTables()` (the open page's
   tables as last read, the same list while its text is) and
   `host.tables(document)` (null: no such document; the store's contract
   says so); a table of the page told apart by its key everywhere a module
   compared places or text. The write hooks by key: `WritePage` holds the
   page's tables as `KeyedTable`s (key and model; `read` as read, `key` the
   written one's), `otherTablesWritten` gives `KeyedTable`s, `AlsoChanged`
   is gone for `TableChange` by key, the core alone turning keys into places. The
   formulas' domain tells tables apart by an `id` (the module gives the key;
   `replace`, `tablesWritten`), the sheet's domain takes tables with whatever
   tells them apart (`sheetTablesOf<T>`, layout ids), the formulas offer
   takes a page's tables, not its text (the Lua API's text made into tables
   by the entry, `tablesOfText`; an error's place given as table, row and
   column, its offset the entry's). `host.replaceTables(document, changes)`:
   a document's tables changed in one edit by key, written as every write
   writes tables (autoFormat), no module's write step (Remove metadata, lazy
   saving into a page left; decided 2026-11-20 with the user: the page's
   Remove metadata aligned as one table's always was, no option of the
   markdown's form in the interface). `host.tableData(info)`:
   a table as `silverware.table.tables` gives it, made by the core, so the
   custom menus' context is unchanged (the check below is for when the core
   no longer has offsets, step 4 or 6). Modules read no markdown, no page
   text and no table's place (`isolation.test.ts`); `pageText`,
   `pageTextNow` and `tableKeys` are the adapter's (`TableHost`).
   Left to later steps, as planned: a cell's escapes, `sameTable` and Copy
   as Markdown's `serializeTable` (step 3: content unescaped, the codec);
   formulas written outside tables (`WritePage.text`, `TextWritten`) and an
   insert's place at the cursor (`cursorNow`, step 4); the transaction in the
   store with its contract tests (`replaceTables` is the core's now: step
   4b, where a transaction becomes a batch of the page writer's).
   **A check before custom menus move**: what `defineMenuEntries` hands a
   user's entry (`silverware.table.defineMenuEntries`, menus/custom.ts). Data
   of the table stays; a text or an offset in it would be gone after this
   plan, a breaking change of the Lua API, so it is put to the user before
   it is changed.
3. **The neutral model.** `TableModel` and the markdown codec; the attribute
   API; domains on the model; the hooks' signatures of the table above. In
   parts, each its commits: table attributes; column attributes (following
   becomes the model's); a column's type; rows' attributes (a row's name);
   cells' attributes (formulas, a cell's name; `unique`; kept on edit;
   `boundToContent` and its rule in the core's write step, tested for every
   way of the table under *An attribute bound to its content*); content
   unescaped. Test: nothing outside `store/markdown/` imports
   markdown.ts; no `escapeCell`/`unescapeCell` in domains.
   - **The formulas' interface to tables is designed once, for the table and
     for Silverware Database** (docs/silverware-database.md, *What next* 5:
     formulas in a database come after this step): `TableSource`, the
     metadata and names it reads (about 6,100 lines tied to the table) go onto
     the model so that a database's items can be such a source without a
     second interface.
   - **The attribute API, first part (2026-11-20)**: a table's and its
     columns' attributes by one set of names, `attribute`, `withAttribute`,
     `canStore` (each with `at`: a column), `attributes(table)` (the owner's
     of the table, by key), `columnAttributes(table, key)` and
     `withColumnAttributes` (one key over the columns), in place of
     `getMeta`, `setMeta`, `canStoreMeta`, `metaOf`, `columnsMeta`,
     `setColumnsMeta`. The plan's `attributes(table, key)` was split so a
     name says one thing: the owner's attributes of a table, and one key's
     over its columns. A cell's (`getCellTag`, `withCellTag`,
     `canStoreCellTag`) join with the cells' part, `at` a cell.
   - **Table attributes (2026-11-20)**: `model/model.ts` (the model's
     types, `Attributes` by owner and key, ahead of the rest); a table's own
     attributes are `Table.attributes` (optional while `Table` becomes the
     model), its columns' still the metadata row's names in `meta` (the
     next part). The markdown codec splits the metadata row as it reads it
     (`tableMetaOf`) and writes it back (`writtenMeta`): a row unchanged as
     it was read, a row changed in the order it was read, attributes set
     since after them (a new row: the table's own, then its columns'). An
     attribute's name is split and made in one place (`metanames.ts`,
     `splitAttributeName`, `attributeName`, no owner's a key alone).
   - **Choice lists by a formula** (`columntypes.choice.<list>='=@projects'`):
     the column types' domain gets a list's values from the formulas module
     through an offer (`host.offer` / `host.offered`), as modules share data
     now, never by importing `formulas/`: the domains stay side by side.
4. **Outside tables.** Places through the store, `reveal`, `InsertPlace`;
   `TextPosition`, `TextWritten`, `WritePage` gone from the interfaces, the
   offsets left only in the markdown store.
4b. **Through the page writer.** The markdown store writes through the page
    writer (`shared/pages/`, built for Silverware Database): its codec
    registered as the writer's part `tables`, a transaction a batch of the
    writer's changes, its undo the writer's report where the document is not
    the open one. Test: nothing in `store/markdown/` calls `Editor.replace` or
    `Space.write`. Two things this step does that the writer does not do now:
    - **The registry opened to a part from outside.** The writer's parts are
      built in (`shared/pages/parts.ts`: "Built in only for now"), but the
      tables' codec stays the table's (*Principles* 1), so a plugin registers
      a part of its own, its changes' types with it. A change of `shared/`:
      every plugin writing through the writer (Silverware Database, Tags,
      Layout, Assets) is built and tested with it, and released by its own
      number when it ships (root CLAUDE.md, *Versions and changelogs*).
    - **A table's write on the open page is never left as "changed since it
      was read".** The writer leaves such a page, which is right for a review
      of many pages (Silverware Tags, Database). The table writes quickly one
      after another (Enter, Tab, typing) and builds each write on the one
      before (`writtenAs`, `writeTarget` now); a write left would lose an
      edit. So a table's transaction on the open page is planned anew on the
      text as it is when the writer finds it changed, as `write` reads the
      table anew now: from the writer, as an option of the batch (a part may
      be planned again), not a path of the table's around it. Pages not open
      (lazy saving, another page's table) keep the writer's check. The
      contract tests have a write meeting a change of the page between its
      read and its write.
5. **The other stores.** The memory store and the views plan's sources on the
   store interface, both passing the contract tests; a few module tests over
   the memory store as the proof that modules need no text (the rest keep the
   markdown store: they check the markdown written). A source is a named
   table, not a document's: the sources' store gives each as a document of
   its name (`@tasks`) holding that one table, read only (`writable`:
   nothing), so the interface needs nothing of its own for them.
6. **The SilverBullet binding.** The adapter, its pairing with the markdown
   store, history markers, Lua places and the Lua API into
   `host/silverbullet/`; the dependency rule checked by folder.
   **Silverware Layout's provider** (core/layoutprovider.ts, after the plan
   was first written) is the binding's: it registers tables with
   `silverware.layout.api` and reads their `layout.width` from the table as
   rendered (`renderedMeta`, synchronously, for the widget's size before the
   model is at hand). The attribute is the model's (owner `layout`, written
   by a transaction as any); reading it off SilverBullet's DOM is the
   adapter's, as the rendered table is. The core keeps no provider.
7. **Docs.** CLAUDE.md (Layout, Architecture), docs/silverware-table-isolation.md
   extended by the store's boundary.

Rough size, not measured, **as estimated on 2026-11-06**: step 1 a day or
two; step 2 the largest by files (about 25), a week or more; step 3 the
deepest (every domain), a week or more; steps 4 to 7 a few days each. The
table has had about 435 commits since (views, sources, choice lists by
formula, Silverware Layout's provider, custom menus; about 41,000 lines of
code without tests now), so this is likely low: estimated anew once step 1
is done, by what it took.

## Risks

- **Byte for byte**: an untouched row, the metadata row, padding must be
  written as they were. The codec keeps what it read beside the model; its
  tests read and write every table of the repo's tests and samples unchanged.
- **Performance**: a model is built from markdown where a table changed
  outside Silverware Table and is rendered, a step beyond `parseTable` on
  large tables; after our own writes none is built (*A model made once, kept
  from our own writes*). The playground's benchmark before and after steps 2
  and 3.
- **The sheet** (core/silverbullet/modules/sheet.ts, about 1800 lines) reads
  the page's text in many places: it moves in step 2 on its own, with its
  UI tests (`ui-tests/sheet/`).
- **One undo step**: a transaction is one edit of the text in the markdown
  store, as each write is now; the contract tests check it.
- **Edits lost on the open page**: the page writer leaves a page changed
  since it was read; quick writes of a table would be lost by it (step 4b
  plans them anew; the contract tests meet a change between read and write).
- **The long branch** (*Decided*): the table changes fast in `main` (about
  435 commits between 2026-11-06 and 2026-11-20), and the refactor touches
  most of its files, so a rebase meets conflicts in code, not only in docs.
  Rebased often (at each step's end at least), each step's tests passing
  after it.
- **`shared/pages/` changed for every plugin** (step 4b's registry and its
  planning anew): Silverware Database, Tags, Layout and Assets built and
  tested with it.
- **Data of a module turned off**: attributes on columns, rows and cells must
  go through every edit as they do now; the tests of `followColumnMeta` and
  of hidden tags run against the codec before and after step 3.

## Decided (2026-11-06, with the user)

- **One branch, merged at the end**: the work goes on in
  `refactor/table-store`, committed part by part, each part tested on its own
  (`npm run verify`, the UI tests of both targets). The branch is rebased onto
  `main` regularly, so it does not drift.
- **The model says what things are; how a store keeps them is the store's**
  (*Principles* 1), the markdown written exactly as now:
  - **A column's type is an attribute of the column.** The markdown codec
    writes it as the header's hashtag (`| Price #currency-usd |`) and reads
    it back. Another store keeps it as it likes. (Refined 2026-11-20: the
    attribute holds all of a header's hashtags, the type among them;
    *Decided (2026-11-20)* 6.)
  - **A row's name is an attribute of the row.** The markdown codec keeps it
    in one of the row's cells' hidden tag, as now, only because a markdown
    row has no place of its own for it.
- **Derived from the principles, the same day** (to be reopened only by the
  user): one attribute API for every level; attributes kept when content is
  edited, `unique` and `boundToContent` declared (the latter's rule in the
  core's write step, chosen over one in the formulas' write step), so
  `takesTags`, `keepTags`, `uniqueTags`,
  `headerRenamed` and `hideHeaderTags` go; a revision per table in place of
  `source`; a transaction whether the document is open or not; contract tests
  for every store; `autoFormat` the markdown codec's, its path kept; history
  markers and Lua places the SilverBullet binding's; "document" and "model
  row" in the interfaces, the numbers of rows unchanged; a type written as
  its name with parameters (in the header's hashtags since 2026-11-20, 6).
- **Silverware Chart onto the codec: a follow-up** (*After this plan*).

## Decided (2026-11-20, with the user)

- **One long branch for the table stays** (`refactor/table-store`, merged at
  the end), weighed against merging step by step: the table is done whole on
  it. The other plugins (the platform for Silverware Toolbar, Chart, Tags) are
  not started on it nor alongside: each later, on a branch of its own, only
  when the user says so (*Scope*).
- **The table first, whole** (*Scope*); the model API for agents after it
  (docs/silverware-agent.md); a CSV store not part of it (*After this plan*).
- **Our own writes keep the model** (*A model made once, kept from our own
  writes*).
- **Step 3's design, ahead of it** (so the step runs without stopping on
  these):
  1. **An attribute's value is text**, as `TableMeta` is now: what it means
     is its owner's (the choice lists' JSON read by the column types). Data
     of a module turned off passes untouched, the core and the codec knowing
     no attribute's form, and every store keeps text alike.
  2. **Columns and rows are their place in the model, no stable ids**: a
     markdown table has nowhere to keep one (made anew on each outside edit,
     it would only look stable), and formulas refer by place (`A1`) anyway.
     Attributes are on the column or row, so a move takes them (*Principles*
     3). `rowMap` and `columnMap` stay, **given by the model's operations**
     (insert, move, delete, sort), no longer made by hand in modules.
  3. **The header is no row of the model**: a column has its `header` (the
     name's text) and its attributes; everything a header cell holds besides
     (the column's own name `core.n`, its type, any other hidden tag) is an
     attribute of the column, read from and written into the header cell by
     the codec. Body rows are counted from 1, as decided.
  4. **`TableSource` gives `TableModel`** (with its name and page), no
     interface of the formulas' own: what `FormulaCells` reads off a cell's
     text now (`formulaOf`, cell and row names) reads the model's attributes
     (`formulas.f` on a cell). Silverware Database gives its items to
     formulas as a `TableModel` (properties as columns, items as rows), as
     its plan's *Room for Silverware Table* has it: one implementation of
     formulas for tables, sources and databases.
  5. **Every hidden tag is an attribute, whoever's**: the codec makes an
     attribute (owner, key, text) of whatever it reads in a `<meta>`, its
     owner's module loaded or not; a name without an owner (a tag typed by
     hand, `<meta foo='x'>`) gets the empty owner and passes alike. The core
     drops none unless an operation says so (`boundToContent`, *Remove
     metadata*), as every tag is kept now.
  6. **A header's hashtags are one attribute of the column**: the codec
     takes **every** hashtag out of a header cell into one column attribute
     (owner `core`, the hashtags in their order, as text), `header` the name
     alone. Which of them is a type is not the codec's to know: only the
     type registry knows (custom types from Space Lua among them), and a
     codec asking it would import a domain and give another model of the
     same text whenever types were defined anew, which the cache by text
     cannot have. The column types' module reads its type from that
     attribute and writes it there; other hashtags stay in it and are
     written back. SilverBullet leaves hashtags out of a column's key and
     tags nothing by them, so they are no part of the name. The binding still
     hides only the hashtags the registry takes for a type. This refines the
     decision of 2026-11-06 (a column's type an attribute of the column,
     written by the codec as the header's hashtag): the type is in that
     attribute, kept by its owner.

## Decided (2026-11-07, with the user)

- **The platform and the page writer, shared with Silverware Database**: the
  ports are the platform (`shared/platform.ts`, plain names), and every
  document is written by the page writer (`shared/pages/`), the table's codec
  its part `tables`, staying the markdown store's (*The platform and the page
  writer*, step 4b). What other plugins write with a write stays open
  (*Open*).

## After this plan

- **Silverware Chart reads tables through the codec.** It reads markdown
  tables itself (`silverware-chart/src/sources/markdown.ts`) so that a chart
  works without Silverware Table installed, and so repeats what the codec
  knows (hidden tags out of cells, the metadata row left out, escapes). The
  codec, pure, moved into `shared/` is bundled into each plugin (nothing is
  shared at run time), so the chart can use it and still need no Silverware
  Table: one reader of markdown tables instead of two. Its `numberOf` and
  `plainNumberOf` stay the chart's (what it draws), only the reading of
  tables moves.
- **A CSV file as a table** (noted 2026-11-20, with the user; not part of
  this plan, nothing of it built here): a `.csv` of the space shown in a page
  by an embed (`![[data.csv]]`) as a table with everything Silverware Table
  does, its edits written back into the file. It would be a CSV store (read
  and written through the platform's `space`) and the table drawn as the sheet
  view draws tables it places (the model through the codec to markdown,
  rendered by SilverBullet into a widget of ours, enhanced as any table), or
  by the core's own preview table (the page's tables' look, drawn by us: the
  formulas' *Show result*, features/resultview.ts).
  Where this plan has a choice that costs nothing either way, it keeps that
  open, and changes nothing of its scope or order for it:
  - a document is a name, not a page: nothing in the store interface assumes
    a markdown page (`.csv` is a document too);
  - a store says what it can keep (`canStore`): a CSV keeps values only, so
    formulas, types, names and the rest are refused there and said, as with
    *Store table metadata* off; where they would go (a file beside it,
    formulas in cells) is that store's decision later;
  - a cell's content stays the cell language in every store (*The model*):
    how a CSV's plain text maps into it (a `**x**` escaped or read as bold) is
    its codec's, as `\|` is the markdown codec's, so the model needs nothing
    for it;
  - the sheet's drawing of a table from its model into a widget of ours, and
    its pairing of that widget with the model without `data-pos`, kept
    generic in step 6 (the binding), not the sheet's own, so an embed can
    use it.

## Open (2026-11-07)

- **What other plugins write with a write.** `onWrite(fn(text))` keeps its
  name in *The SilverBullet binding*, and with it its form: a listener gets
  the text and gives text edits, so the chart knows how its data are written
  in a page. Joined to the page writer, a plugin would give changes in its
  model (a part of its own, once the writer's registry is opened) and the
  writer would write them in the same edit. To decide with step 6.
