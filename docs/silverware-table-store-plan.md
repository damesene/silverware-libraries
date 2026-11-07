# Silverware Table: tables apart from where they are kept

Status (2026-11-06, branch `refactor/table-store`): planned, nothing done.
Starts once the views plan (docs/silverware-table-views-plan.md) is done
through its step 5: its sources (`@tasks`) are the first tables kept nowhere
in a page, and this plan takes them as its second store. The branch is on
`main`; once the views are merged into `main`, it is rebased onto it before
the first step here.

## Why

Silverware Table is apart from SilverBullet's rendering already
(docs/silverware-table-isolation.md: modules in model terms, the rendering
behind `TableAdapter`). It is not apart from where a table is kept:

- **The model is markdown.** `Table` (markdown.ts) is the markdown's rows: a
  cell is its markdown text with `|` escaped and its hidden `<meta>` tags in
  it, the row's `source` line, `padded`, `delimiterSource`; the table's and its
  columns' data a flat record of the metadata row's attributes
  (`core.-c-qty.sort`); a column's type a hashtag in its header's text.
- **Modules find tables in the page's text themselves.** 18 modules, 4 of the
  adapter's and `drawn.ts` call `parseTable`, `findTables`, `locateBySource`
  or `pageTablesOf`; modules read `host.pageText` or `bridge.getText()`, keep
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
  `confirm`…): 35 files use it, 17 modules among them.

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
2. **Dependencies go one way**: model ← domains ← modules ← core ← stores ←
   host bindings, each importing only what is left of it (and the
   platform, the stores and the bindings). `isolation.test.ts` checks it by
   folder.
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

```text
model/        TableModel, attributes, pure operations (ops, pins, structure)
   ▲
domains       formulas/, pivot/, calculated/, conditions/, columntypes/, excel/, export/, sheet/
   ▲
features/     modules: ModelHost and TableModel only
   ▲
core          controller, write pipeline, view, editor; TableStore (the interface)
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
- a column's type is an attribute of the column, its value the type's name
  with its parameters as written (`currency-usd`, `stars-10`): the type
  registry reads the parameters as now (`readParams`);
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
below; docs/silverware-database.md on `feat/database`, *Layers*, *Shared with
Silverware Table and Silverware Tags*, its *Decided* 18 to 25): the database
is built first, in these shapes, and puts them into `shared/`; this plan takes
them from there, so that tables and pages are written one way. A change of
either is made for both plugins.

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
  `evaluate(formula, page)`, `errors(page)`, implemented over the store and
  the model, names kept.

The playground is a binding of its own over the same interfaces.

## Order

Each step is commits that leave `npm run verify` and the UI tests (both
targets) passing; an old host function stays until no module uses it. Each
step tightens `isolation.test.ts` so that what it moved cannot come back.

1. **The platform.** `Bridge` split into the platform (`shared/platform.ts`,
   see *The platform and the page writer*); `host.notify`, `host.ask`,
   `host.navigate` for modules; no module reads `host.bridge` (removed from
   `ModelHost`). Test: no `bridge` in `features/`.
2. **Tables through the host.** The store interface and the markdown store
   as a façade over today's code (the model still `Table`): `host.tables`,
   `host.table`, `revision`, transactions in place of `also`. Offsets stay,
   inside the core and the store only. Modules stop calling `parseTable`,
   `findTables`, `locateBySource`, `pageTablesOf`, `cellSourceOffset` and
   reading `pageText`, `hint`, `source`. The big modules one commit each
   (formulas, sheets, the sheet, views, pivot, names, lazy, metadata). The
   contract tests start here. Test: `features/` import nothing of markdown.ts
   but types.
3. **The neutral model.** `TableModel` and the markdown codec; the attribute
   API; domains on the model; the hooks' signatures of the table above. In
   parts, each its commits: table attributes; column attributes (following
   becomes the model's); a column's type; rows' attributes (a row's name);
   cells' attributes (formulas, a cell's name; `unique`; kept on edit;
   `boundToContent` and its rule in the core's write step, tested for every
   way of the table under *An attribute bound to its content*); content
   unescaped. Test: nothing outside `store/markdown/` imports
   markdown.ts; no `escapeCell`/`unescapeCell` in domains.
4. **Outside tables.** Places through the store, `reveal`, `InsertPlace`;
   `TextPosition`, `TextWritten`, `WritePage` gone from the interfaces, the
   offsets left only in the markdown store.
4b. **Through the page writer.** The markdown store writes through the page
    writer (`shared/pages/`, built by then for Silverware Database): its codec
    registered as the writer's part `tables`, a transaction a batch of the
    writer's changes, its undo the writer's report where the document is not
    the open one. Test: nothing in `store/markdown/` calls `Editor.replace` or
    `Space.write`.
5. **The other stores.** The memory store and the views plan's sources on the
   store interface, both passing the contract tests; a few module tests over
   the memory store as the proof that modules need no text (the rest keep the
   markdown store: they check the markdown written).
6. **The SilverBullet binding.** The adapter, its pairing with the markdown
   store, history markers, Lua places and the Lua API into
   `host/silverbullet/`; the dependency rule checked by folder.
7. **Docs.** CLAUDE.md (Layout, Architecture), docs/silverware-table-isolation.md
   extended by the store's boundary.

Rough size, not measured: step 1 a day or two; step 2 the largest by files
(about 25), a week or more; step 3 the deepest (every domain), a week or more;
steps 4 to 7 a few days each.

## Risks

- **Byte for byte**: an untouched row, the metadata row, padding must be
  written as they were. The codec keeps what it read beside the model; its
  tests read and write every table of the repo's tests and samples unchanged.
- **Performance**: models are made per view on large tables. The codec keeps
  the last models by text; the playground's benchmark before and after steps
  2 and 3.
- **The sheet** (core/silverbullet/modules/sheet.ts, about 1800 lines) reads
  the page's text in many places: it moves in step 2 on its own, with its
  UI tests (`ui-tests/sheet/`).
- **One undo step**: a transaction is one edit of the text in the markdown
  store, as each write is now; the contract tests check it.
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
    it back. Another store keeps it as it likes.
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
  row" in the interfaces, the numbers of rows unchanged; a type's attribute
  its name with parameters as written.
- **Silverware Chart onto the codec: a follow-up** (*After this plan*).

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

## Open (2026-11-07)

- **What other plugins write with a write.** `onWrite(fn(text))` keeps its
  name in *The SilverBullet binding*, and with it its form: a listener gets
  the text and gives text edits, so the chart knows how its data are written
  in a page. Joined to the page writer, a plugin would give changes in its
  model (a part of its own, once the writer's registry is opened) and the
  writer would write them in the same edit. To decide with step 6.
