# Views: tables made by one formula (plan)

Talked through with the user on 2026-11-05.

**Status** (2026-11-06): step 1 built (grids in formulas, the seven array functions, `#SPILL!` and `#CALC!`, Show result and Copy result). What it settled beyond this plan:

* **Where the shape is kept**: references keep their shape only as arguments of a function taking grids (`GridFunction`, `grids: true`: `shaped` in evaluate.ts): `A1:C5` a grid of three columns, `[qty]` a grid of one column named by its header, `[@[a]:[b]]` one row. Everywhere else they evaluate as before (a list), so no existing formula changed. A grid reaching a function that takes none is its cells, row by row (`asValue`); an operator takes a grid of one row or column as a list (`operand`), one of several rows and columns is `#VALUE!` saying to pick a column.
* **A cell's result** (`cellValue` in values.ts): a list of several values left as a cell's result is `#SPILL!` too, where it was `#VALUE!` (`=[qty] * 2`, `=pear*2`); one of none an empty cell.
* **Excel**: the seven functions are written as their values (Excel 365's only; how a file without spill metadata has them calculated is not verified), `[#Data]` as `Table1[#Data]`, `#SPILL!` and `#CALC!` as `#VALUE!` (an Excel before 365 does not know them).
* **Not done in step 1**: `tasks![[a]:[c]]` (a table's columns from a to b as a grid; `CHOOSECOLS(tasks![#Data], …)` does it meanwhile): its tokens need edits.ts, references and the Excel writer to follow both ends, as `[@[a]:[b]]` does. `silverware.table.evaluate` gives a grid's cells as one list, row by row, and a formula calling a function that takes grids a list even of one value (`TAKE(…, 1)`), as `givesList` tells it by the formula (a grid as rows, a `${…}` showing a table, is open).
* **Show result**: the core's dialog as large as the window, the core's preview table (`previewTable`) in it, in SilverBullet's colors (not the table's theme).

**Step 2 done** (2026-11-06): `src/calculated/table.ts` (pure: `Calculated` and its columns by id, `calculatedTable` the result written with its totals pinned through the host's `pinsOf`/`withPins`, the renamed headers read, stored, followed in an edit and moved by id, `sameCells` for out of date), the pivot module calling it (its `Pivot` a `Calculated`); `src/formulafield.ts` (`formulaField(doc, helpers, value, changed, { label, focus, placeholder })`, `FormulaHelpers`), its classes made its own (`swt-formulafield-*`, the `swt-cf-formula*` ones gone; not `swt-formula-*`, the formulas module's hint under a cell edited) and styled on their own, so a dialog other than the conditions' needs no CSS for it. What stays in each module, as planned: the hooks (the badge, Refresh in the toolbar, `editRefused`, `readOnly`, `fixedShape`) and the attribute holding the renamed headers (`pivot.headers`, a view's own).

**Step 3 done** (2026-11-06): 3a (views in the formulas: the `Book` reads a view as calculated now, a write calculates the views and tables reading the table written in one edit, a view's formula follows its sources) and 3b (the view module, registered as `view` for its attributes `view.formula` and `view.headers`; its dialog; *Insert view…*, the command, `/view`, *View settings…*, *Refresh view*; the library page's *Views*). What it settled beyond this plan, as it is now (after the pivot's gap was closed, below): the view module offers `CalculatedOffer` (`calculated(table)`: its formula as what it reads, `calculate` its result over its body with its renamed headers, which are the view module's, `follow` its formula and those headers' ids following its sources), not decision 12's `viewFormula` / `withViewFormula`; the formulas offer `calculated` (a calculated table as they would write it now: *Out of date*), `view` (a formula calculated as a view on the page shown: the dialog's preview) and `functions` (fx: the Functions dialog opens over the view's, the shared dialogs stacking with `above`); the formula field's helpers offered by the formulas module (`fieldHelpers`), the conditions dialog's and the view's alike; a source's column renamed moves a renamed header's id with it (`name:Assignee` → `name:Owner`, as the pivot's `movedRenames`); an empty result is the header alone, but `TAKE(…, 0)` is `#CALC!` (as in Excel, step 1), so an empty result comes from an empty table (`SORT(none![#Data])`). Known limits (reviewed 2026-11-06, left for later): *Find formula errors* does not list a view that cannot be calculated (its tab says so); a view reading another view is checked for *Out of date* only when what it reads directly is shown anew, and every shown view is checked again on `tablesChanged`; each view calculated builds a `Book` of its own, so a chain of views is calculated again for each of them (slow only for long chains or large `FILTER`s); a column's id is its source column's name (decision 3), so a header the user renamed follows its source column's rename made with Silverware Table, not one typed in the markdown nor one through another view.

**The pivot's gap closed** (2026-11-06, decided with the user: *A view is calculated by the formulas, in their order*): the pivot is calculated by the formulas as a view is. The view module's offer became a generic one, `CalculatedOffer` (`calculated(table)`: what a table reads, how it is calculated from what it reads as the formulas have it now, how its definition follows its sources), which the view and pivot modules both give; a table or view reading a pivot follows its source in the same edit, a pivot may read a view. A pivot that cannot be calculated keeps its numbers, the formulas reading it get the error (as for a view). The last pivots calculated are kept (a table reading a pivot calculates it each time it is calculated).

**Step 4 done** (2026-11-06): `defineChoices` made `silverware.table.defineSource` (src/host/sources.ts `LuaSources` behind `SourceProvider`, src/sources.ts), the `sources` module offering them, `@tasks`, `@tasks[col]`, `@tasks[#Data]` in any formula (cells, views, conditions), completion after `@`, `pivot.source='@tasks'` with the pivot dialog's group *Sources of the space*, the playground's fixed sources `tasks` and `projects`; `columntypes/spacelists.ts`, spacechoices.ts, the Choices dialog's *Space list* and the library page's *Lists of the space* gone. Verified in a local SilverBullet 2.12.1 (Docker, 2026-11-06): a query's source, `@tasks` typed and offered, a view and a pivot of it, a task added on another page making all three *Out of date* until refreshed. What it settled beyond this plan: a source's cells are data (a hidden tag in a value is no formula nor name: a source of `index.tag "table"` rows reads their values); a source giving no rows keeps the columns it read before (`columns` in the definition for one that may be empty from the start); after a load of Space Lua a source not defined again yet is unread (results kept), not gone, until REFRESH_MS. Known limits: a `${silverware.table.evaluate(…)}` reading a source is not rendered anew as it changes; a source's change makes every module check the tables shown once per change (a script defining N sources: N checks as it loads); the Recalculate and Refresh titles say "changed outside Silverware Table", not which source. **Step 5 follows at once**: between steps 4 and 5 a `#choice-projects` column finds no list of the space (step 5 writes it as `=@projects`).

**Step 5 done** (2026-11-06): a choice list may be a formula (`columntypes.choice.projects='=@projects'`), calculated through the formulas module's offer `list` (formulas/evaluate.ts `listResult`) as the column shows, never written; its values made a list by `listOfValues` (columntypes/choicelists.ts) as *Step 5: decided* 2 says. Its formula follows the page's tables it reads through a new contract, `HeldFormulas` (formulas/cell.ts: formulas a module keeps in a table's metadata row that calculate none of its cells; `HeldFormulasOffer`, the column types module's, asked by the formulas module as it asks `CALCULATING`), which `forFormulas` goes through, so pageLinks reads a list's pages and `Affected` sees what it reads. The Choices dialog has three ways: *Column's values*, *Own list* and *Formula* (the formula field, where `@` offers the sources), the values shown as typed. (Decided with the user the same day, after building it otherwise: a source is typed as its formula, `=@projects`; neither a fourth way *Source* nor a picker of sources over the formula's field, which wrote nothing a formula cannot.) In the Type menu a formula list shows its formula in its hint. What it settled beyond this plan: a list reads plain cells as written where a number would lose what they show (`2024 Roadmap`, `007`, `2,5`: the `Book`'s `asWritten`), a number it calculates written with its table's decimal comma; an error among its values is left out (no value to pick); no way or picker for a source (the plan's *Space list*): it is typed as a formula. Known limits: a list's formula error is shown in its column's type icon and the dialog only, not by *Find formula errors*; a list calling `TODAY()` is calculated again only as the page's text changes or what formulas read elsewhere does; every source read anew makes each table shown with a formula list look anew, not only those reading that source; a formula typed in the dialog is saved as typed (no autofix of a missing `)`, as a cell's is); deleting a table a list reads warns of "the formulas of" the list's table showing `#REF!`, the list then checking nothing.

**Released together with the choices** (decided the same day): the choice lists from Space Lua (`silverware.table.defineChoices`) are not released on their own: their commits are on this branch (`feat/views`, its first ones, the branch `feat/choices-from-lua` merged into it and deleted on 2026-11-06), and both go to main as one, once views are done. Until then neither is anyone's to rely on, so their API and what they write (the `#choice-…` header, `columntypes.choice.…`, `defineChoices`' arguments) may change in any refactor here, with no care for what was written before.

## What a view is

A table whose body is the result of one formula, written into the page as an ordinary markdown table, as a pivot is. The formula uses Excel's dynamic array functions (`FILTER`, `SORT`, `UNIQUE`, `CHOOSECOLS`…), so a view is what Excel spills, kept apart in a table of its own:

```markdown
| Assignee | Open |
|---|--:|
| anna | 3 |
| petr | 1 |
| <meta core.table core.name='open_by_person' view.formula='=SORT(GROUPBY(tasks![assignee], tasks![assignee], COUNTA))'> |
```

* **Its cells are the formula's.** Read-only and of a fixed shape, as a pivot's (`readOnly`, `fixedShape`): a press on a cell does not edit it, it says why and opens the view's settings (`editRefused`). Its headers may be renamed, the names kept when it is calculated again.
* **It shows anywhere**: the numbers are written in the markdown; only the last row holds the definition.
* **It follows its sources** as a pivot does: written anew with each write of a source on its page (same edit, one Ctrl+Z), *Out of date* in its tab and *Refresh* in its toolbar where a source changed otherwise (typed in the markdown, another page, a Lua source).
* **A named view is a table like any other** for formulas elsewhere (`=SUM(open_by_person![open])`), charts and exports.
* **Why not spilling in cells**: the decision against spilling stays (a spill would overwrite cells it does not own and add or remove rows among the records). A view owns all its cells, so none of that happens. A formula in a cell that gives an array is an error, `#SPILL!` (as Excel says where a spill cannot go), its reason pointing at views.

## Making and changing one

* *Insert view…* in a table's ⋯ menu, the command *Silverware Table: Insert view*, and `/view` in the page, as *Insert pivot table* and `/pivot`.
* The dialog:
  * A formula field with the help formulas have while typed: the names offered (functions, tables, columns), the help of the function the caret is in with its argument marked, a slip fixed (a missing `)`), *fx* for the Functions dialog. The conditional formatting dialog has such a field already (`formulaField` in features/conditionsdialog.ts, over the formulas module's `complete` / `help` / `problem`): it moves to `src/formulafield.ts`, beside src/menu.ts, its helpers given to it (a module may import from the core only feature.ts, structure.ts and press.ts, and no other module: the isolation test), not copied.
  * A preview of the result under it, as the pivot dialog's: calculated on each change, its size, the reason of an error.
  * The view's name.
* *Insert* writes it where the cursor is, or under the table the dialog was opened from.
* *View settings…* in a view's toolbar opens the same dialog with its formula. Editing `view.formula` in the markdown works too: the view shows *Out of date* until refreshed.

## Formulas: values with a shape

Today a range is a flat list (`Value = Scalar | readonly Scalar[]` in formulas/values.ts): `A1:C5` is fifteen values, its rows and columns lost. The array functions need the shape.

* **A new value, `Grid`**: rows × columns of scalars, and for each column where it came from (a table's column, or none), so a view's headers can be named after the source's columns. Beside today's values, not in place of the flat list.
* **One boundary**: a function says it takes grids (a flag in `FormulaFunction`); every other one, the user's custom functions too, gets a grid flattened by the evaluator into today's list before the call. So no existing function, nor its tests, changes. Where the flattening happens is one place: where evaluate.ts calls a function (`case "call"`, its arguments mapped).
* **Operators on a grid** (`tasks![#Data] * 2`, `A1:C5 > 5`): `#VALUE!` with its reason in the first step; element by element as Excel does later, if wanted. A column is a list as today, so `FILTER(tasks![#Data], tasks![due] < TODAY())` works as `cellByCell` does now.
* **Reading them**: `[#Data]` a new item in a table's brackets, `@name` a new kind of token (apart from `[@column]`, this row's), both in tokens.ts and parser.ts.
* **What gives a grid**: a reference of several rows and columns (`A1:C5`, `tasks![[a]:[c]]`), a whole table's body as Excel's tables write it, `tasks![#Data]` (decided 2026-11-05: a bare name is a named cell's or row's already, and the Excel file takes it as it is), and the array functions. A column (`tasks![due]`) stays a list as today, taken as a grid of one column where a function wants one.
* **A cell's result is one value**, as now: a grid or list of two values or more there is `#SPILL!`. A new error code in `ERROR_CODES`, and in the Excel file's errors (Excel has it). A result of one cell is that value, as in Excel (decided 2026-11-06), so `=TAKE(SORTBY(people![name], people![score], -1), 1)` picks one; none (an empty result) is an empty cell.
* **`FILTER` keeping nothing** is `#CALC!` (a new error code too, Excel's), unless its third argument says what to give then (`FILTER(…, …, 0)`, `""`), as in Excel (decided 2026-11-06): `=SUM(FILTER(…, …, 0))` stays a number where nothing matches.
* **A `#SPILL!` cell's result can be seen** (decided 2026-11-06), until views make tables of it:
  * *Show result* opens it over the window as a table read only: the result made a markdown table (its header the columns' origins, else A, B, C…), drawn by `drawTable` (core/silverbullet/drawn.ts, as the sheet draws its tables: SilverBullet's look, the theme of the setting) into a floating element laid over the window with the full screen's classes and CSS (its header held, scrolled in its box). The core leaves a table in its floating elements alone (`ownTable` in the controller), so it is no table of the page: no key, no metadata, nothing written, no sorting, filtering or selecting (a preview, nothing more is wanted of it). A bar over it: the cell's formula (cut with an ellipsis, whole in its title), the result's size (`1 284 × 3`), *Copy* (⧉) and ×; Esc closes it. At most 2,000 rows drawn, the bar then saying so (`2,000 of 51,230 shown`); *Copy* copies the whole result.
  * Where: a floating icon (⤢) at the cell's top right corner while the cell is hovered or selected, made by the formulas module through the core (`host.floating`, `cellHovered`, `selectionChanged`) as the expand button of a cut cell is: nothing added to the cell, so a narrow cell does not matter; in the cell menu *Show result* and *Copy result* (the result copied whole, as text and an HTML table, without opening it); a key on the cell selected (Ctrl+Shift+Enter). One icon only: copying without looking is the rarer case, which the menu serves. Ctrl+C on the cell copies what it shows (`#SPILL!`), as for any cell: a thousand rows copied by it would surprise.
  * Calculated as it is asked for (the cell's formula, as `evaluate` for Lua calculates one), never on viewing: the markdown holds `\#SPILL!` alone, and nothing large is kept in memory while no one looks.
  * Showing it on the sheet's board beside the page's tables was weighed and set aside: the board draws only tables standing for a page's table by its key (selection, the cell editor, `addressFrame`, writes rest on it), so a table of no key would be a new kind in the core, for what a view (step 3) gives anyway, being a table of the page the sheet can hold.

### A view is calculated by the formulas, in their order

A view's formula is a formula, so the formulas' domain calculates it, as a table its `Book` knows: a table whose body is its formula's result, in the same graph of what refers to what as the cells' formulas. So a write recalculates, in one edit and in order, a view of the table written, a table whose formulas read that view, a view of that table… (`Affected` transitively, as today for tables). Were the views module to calculate them after the formulas (`otherTablesWritten` after theirs, as the pivot is), a table reading a view would not follow it in the same edit: the pivot has that gap today (a table reading a pivot is recalculated only by its own next write), noted here, not mended by this plan.

So the views module holds the definition, the dialog and the table's protection; the formulas module offers what it needs (calculate a view's formula to a grid, the views a write changes, references followed through renames and moves of what the formula reads: `followTable` and edits.ts, as for any formula), and writes the views it recalculates with the other tables, as it does today.

First functions (one file each in formulas/builtin/, each with its syntax and description in the library page's Functions table, as the test requires): `FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, `DROP`. Later: `VSTACK`, `HSTACK`, `SEQUENCE`, `GROUPBY`, `PIVOTBY` (Excel 365's: a pivot as a formula). Each one's Excel form decided in excel/functions.ts, as the test there requires.

## The views module and what it shares with the pivot

* `features/views.ts` (the module, ModelHost only) and `features/viewdialog.ts`; its attributes `view.formula`, `view.headers` through its host, as every module's.
* **Shared with the pivot, not copied**: what a table calculated from sources needs, whoever calculates it: the cells read-only and the shape fixed, the press that opens the settings instead, *Out of date* (`tableBadges` with `attention`) and *Refresh* in the toolbar, headers renamed and kept by what each column stands for (the pivot's `pivot.headers` by `PivotColumn.id`; a view's by the grid's column origin, else its place), the result written over the table's body with its pins. Where: what is pure (headers kept by id, the result made a table with its pins, staleness compared) in `src/calculated/`, a domain both modules import (modules import no module, nor a file of features/ that is none); what is a hook (the badge, the toolbar's button, `editRefused`) stays a few lines in each module, calling it. The pivot moved onto it first, its tests passing before the view is added. This refactor is the plan's main risk. What is not shared: when they are calculated (the pivot after the formulas, the view by them, above) and how a source's renames are followed (the pivot rewrites its `pivot.source`, a view's formula follows as formulas do).
* The core gets nothing that names either module (the isolation test holds).

## Sources from Space Lua

Builds on `silverware.table.defineChoices` (this branch's base, released with views). Its src/spacechoices.ts has what a source needs as well: the Lua functions by name, each called (a Promise) as it is defined and again REFRESH_MS after the last `page:index`, the definitions of before reading after Space Lua loads again until its first new one (`stale`), what each read last kept where it fails (`lastRead`), a problem said once until it changes (`said`). What differs is only what a function gives (values for a column's type; rows of objects for formulas) and whom it tells (the column types' space lists; the formulas' tables).

So a source does not copy it: **`defineChoices` becomes `defineSource`** (decided 2026-11-05; both unreleased, above). A list of the space is a source of one column, so there is one thing defined from Lua, one meaning of `@`, and no names shared between lists and sources that could clash. spacechoices.ts's way of reading (its Lua functions by name, refreshed, `stale`, `lastRead`, `said`) is the sources', what a function gives made rows instead of values. A source may give a plain list of values too (`select p.name`, as `defineChoices` takes today), read as one column named `value`:

```lua
silverware.table.defineSource({
  name = "projects",
  data = function() return query[[from p = index.tag "project" select p.name]] end,
})
```

A choice column uses it through its table's list, written as a formula (below): what a column checks against is always in its table, never found by a name alone.

```lua
silverware.table.defineSource({
  name = "tasks",
  columns = { "name", "page", "due", "done" },
  data = function() return query[[from t = index.tag "task" select { name = t.name, page = t.page, due = t.due, done = t.done }]] end,
})
```

(Written as one table, its function `data`, decided with the user on 2026-11-06 after step 4, in place of `defineSource(name, [options,] fn)`: options after a function read badly, and one table takes more keys as they come, as SilverBullet's `command.define` does. Not `query`: Space Lua reads `query = …` as its query syntax, a syntax error, seen in the local SilverBullet.)

* A list of objects, each a row; its columns in the order the function gives them: the first row's keys, then the keys new in later rows, as SilverBullet lays out a `${…}` of records (Space Lua keeps a table's keys in the order they were set, unlike C Lua: verified in 2.12.1, 2026-11-06, *Step 4: decided* 4); `columns` another order, or some of them. Values as text: numbers, text, dates as ISO text; booleans as `TRUE`/`FALSE` as formulas read them; `nil` empty; a list its values joined by a comma and a space (tags, people: read and filtered so); an object left out, the cell empty (it has no form a cell could show) (decided 2026-11-05).
* In formulas a table of the space: `@tasks`, `@tasks[due]`, `@tasks[#Data]` (decided 2026-11-05: `@` is in no table's name, so it cannot clash, and it shows the table is no table of the page). Offered by a module to the formulas' `TableSource`; until the function has run once it is `unread`, so formulas and views keep what they show.
* A pivot gets them too: `pivot.source='@tasks'`.
* **Any formula** reads them, a source being one of the formulas' tables: a cell's (`=XLOOKUP([@id], @users[id], @users[email])`), a condition of conditional formatting, a view, a choice list's (below). As formulas reading another page do: the results written stay until written again (*Recalculate* highlighted where a source changed; viewing writes nothing), and until a source's function has run once it is `unread`, the results kept. In the Excel file a formula reading a source is its value, listed with why, as a custom function's without a template.

### SilverBullet kept apart (decided 2026-11-06)

A source is a direct dependency on SilverBullet (a Lua function, its Promise, Lua tables, `page:index`), and spacechoices.ts as its commits on this branch have it does not keep it apart: it lies in `src/` as no module (it cannot be turned off), keeps its state in the file (`sources`, `lastRead`, timers) and fills the column types' domain through module-level state set from outside (`setSpaceLists`, `setSpaceListNames` in columntypes/spacelists.ts), which the rules of *Modules and their data* forbid. So step 4 splits it in three:

* **The host's side**, `src/host/sources.ts` (beside `host/lua.ts`, the host's sides apart from the rest): what is SilverBullet's alone. It keeps the functions `defineSource` was given, calls them and awaits them, makes their Lua tables plain data (`listOf`), reads them again REFRESH_MS after the last `page:index` and as Space Lua loads (`stale`, `lastRead`, `said`, as spacechoices.ts does now), and gives out plain data only, through an interface the rest knows: `SourceProvider { names(), read(name): { columns, rows } | undefined, changed(listener) }` (`undefined`: not read yet). Nothing else in `src/` calls a Lua function nor knows of `page:index` for sources.
* **The `sources` module** (`features/sources.ts`, `silverware.table.modules.sources.enabled`, a module of the data kind in the settings): handed the provider by the core as a module is handed its host, it offers the sources (`offer`) to the formulas module, which makes them `@name` tables of its `TableSource`, and to the column types module, which takes a choice list's values from a formula through the formulas (step 5) and no longer from a list of the space by name. Turned off, every source is `unread`: formulas, views and pivots keep what they show, a choice list made of a source checks nothing.
* **The domains know none of it**: the formulas' domain gets tables named `@…` in its `TableSource` (read or `unread`), as it gets another page's; `columntypes/spacelists.ts` and its module-level state go (the column types' domain gets a list's values in the context its module passes, as every domain does).

So the playground and the unit tests give a provider in memory, with no Lua (a playground's sources beside its pages), and another host, or Silverware Database later, could give sources through the same interface without Lua in between.

### A choice list made by a formula

A table's choice list (`columntypes.choice.<name>`, today a JSON list of texts) may be a formula, told by its leading `=` (a JSON list never starts so): its result, a list or a column of a grid, is the list, calculated as the column shows, never written.

```markdown
| Assignee #choice-assignee | Task |
|---|---|
| <meta core.table columntypes.choice.assignee='=FILTER(@users[name], @users[active])'> |
```

* What a hashtag cannot say (no `@` nor brackets in it) the list's value says: the header stays `#choice-<name>`.
* `=@users[name]`, `=people![name]` (another table of the page), `=SORT(UNIQUE(tasks![status]))`, `=FILTER(…)`: whatever the formulas read, one way of referring for all of it.
* The column types module asks the formulas module for it through an offer, as conditional formatting asks for a formula condition's values; with the formulas off, or a source not read yet, the column checks nothing, as a Lua list before its first reading.
* **A list from Space Lua is written into the table as a formula** (decided 2026-11-05): `columntypes.choice.projects='=@projects'`. A header `#choice-projects` alone no longer finds a list of the space by its name, as `defineChoices` does on its branch: the table says where its values come from, read in its markdown with no script known, and a table's list and the space's can no longer share a name. It needs the *Store table metadata* setting, as any list kept in a table and every new formula do.
* The Choices dialog writes it: the space's sources offered by name (*Space list: projects*), the one picked written as `=@projects` (its column asked where it has several: `=@users[name]`), so no one types it. Beside them the column's values, a list of its own, and a formula of one's own (the formula field shared with the view's dialog).
* The result must be a list, or a grid of one column; one of several columns checks nothing, the dialog saying which column to pick.

## Excel

The file gets a view's values, as written (a reader without the formulas sees them). Its formula as Excel's dynamic array formula needs the file's metadata for spills: later, if wanted.

## Steps

Each a branch's worth, with its tests (unit tests of the evaluation, UI scenarios of the dialog and the view), each useful on its own:

1. **Grids in formulas**: the `Grid` value and its one boundary, `#SPILL!` in a cell (a result of one cell its value), `#CALC!` and `FILTER`'s third argument, the references that give grids, `FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, `DROP`, *Show result* and *Copy result* of a `#SPILL!` cell. Visible to users as the functions inside formulas that reduce a grid to one value (`=COUNTA(UNIQUE(tasks![assignee]))`, `=TEXTJOIN(", ", TRUE, FILTER(tasks![name], tasks![assignee]=[@name]))` in a calculated column), and a `#SPILL!` cell's result shown over the window.
2. **The shared part of calculated tables** (`src/calculated/`), the pivot moved onto it, and the formula field moved to `src/formulafield.ts` for the conditional formatting dialog; nothing changed for users.
3. **Views**, in two commits (decided 2026-11-06, *Step 3: decided* below):
   * **3a**: a view in the formulas: its formula read through the views module's offer, a `Book`'s table made by a formula, the order a write recalculates in (`Affected`), its formula following its sources' renames and moves; unit tests, no UI.
   * **3b**: the module, the dialog, *Insert view…*, the command, `/view`, *View settings…*, the library page's section, UI scenarios.
   * **Once views are done**: tell the user about the pivot's gap (a table reading a pivot is recalculated only by its own next write, *A view is calculated by the formulas, in their order*), for them to decide whether to mend it (the pivot calculated by the formulas as a view is).
4. **Sources from Space Lua**: `defineChoices` made `defineSource` (spacechoices.ts's reading moved to `host/sources.ts` behind `SourceProvider`, rows instead of values, a plain list one column `value`), the `sources` module offering them, `columntypes/spacelists.ts` gone, `@name` in formulas, the pivot's source.
5. **A choice list made by a formula**: `columntypes.choice.<name>='=…'`, a list from Space Lua written so by the Choices dialog, the space's lists no longer found by a header's name alone.
6. **More functions**: `VSTACK`, `HSTACK`, `SEQUENCE` first (*Step 6: before it starts*); `GROUPBY`, `PIVOTBY` later, on a branch of their own.

## Step 4: before it starts (written 2026-11-06, for a session starting afresh)

**State**: branch `feat/views`, steps 1 to 3 done and committed (nothing pushed; released with the choices, *Released together with the choices* above). `npm run verify` passes; `npm run test:ui` passes but for a few tests that fail now and then under the machine's load, a different one each run, as on the branch's base (run a failing spec alone with `--retries=0` to tell). Everything below is in CLAUDE.md (Layout, *Views* under *Design decisions*) and in the code; this section is what a session starting step 4 needs besides.

**What step 3 left that step 4 builds on**:
* A source is read by the formulas as a table of their `TableSource` (formulas/page.ts `pageTables`, formulas/evaluate.ts `Book.sheet`): `@tasks` is a table there (read, or `unread` until its function has run once, as another page not read: `Book.keepsResult` keeps the results written). The sources module offers them to the formulas module, which adds them to the `TableSource` it builds (`tableSource()`, `writeStep`, `otherTablesWritten`, `viewOf`, `evaluate`, `errors` in features/formulas.ts).
* Views and pivots are calculated tables (`CalculatedOffer`, `CalculatedBy` in formulas/cell.ts): a view of a source is `=FILTER(@tasks[#Data], …)`, nothing to add for it; a pivot of a source needs `pivot.source='@tasks'` read by pivot/definition.ts `sourceRef` and its `calculatedBy` (features/pivot.ts) giving the formulas `=@tasks[#Data]` as what it reads and reading it through `read.table` (which takes a name and a page: a source needs its own way in, `CalculatedRead`).
* A source changed (read again): the formulas module's `tablesChanged` checks the tables shown again, the view and pivot modules theirs (their `tablesChanged`); nothing is written.
* The formula field (formulafield.ts) and the cell editor's list complete names through the formulas module (`formulaChoices`, `fieldHelpers`): sources to be offered there.

**Working notes for this machine**: write files with the editor tool, or with a Python script written by the editor tool, never through a shell heredoc or a `python -c` with backslashes: the shell mangles them (`\u0000` in a string became a NUL byte three times, `\r` vanished). Python's `open(..., "w")` writes CRLF on Windows unless `newline=""`; the repository is LF, so take `\r` off the files touched before a commit. A local SilverBullet for checks is in the memory (`local-silverbullet-podman`); a page there is changed through `client.editorView` in a Playwright script (import playwright by a `file:///` URL), never on disk.

**Open questions** (decided with the user on 2026-11-06: *Step 4: decided*, at the end of this plan):
1. Choice lists of the space between steps 4 and 5: step 4 takes away `columntypes/spacelists.ts`, so `#choice-projects` stops finding a list of the space by its name until step 5 writes it as a formula (`=@projects`).
2. What `@tasks` alone is (step 5's `=@projects` uses it bare), and which references a source has: `@tasks[due]`, `@tasks[#Data]`; cells (`@tasks!A1`), `[@due]`, named rows and cells?
3. A source's name: the rules of a table's name (letters, digits, `_`), compared ignoring case?
4. A source given objects without `columns`: the order of its columns.
5. Where sources are offered: the names typed in a formula (cell editor, the view's and conditions' fields), the pivot dialog's Source list, the Functions dialog?
6. The playground: its sources in memory beside its pages (decided), shown and edited how (a panel as the Benchmark's, or fixed sample sources)?

## Decided (2026-11-05, with the user)

1. A whole table as a grid: `tasks![#Data]`, as Excel's tables write it.
2. A Lua source in formulas: `@tasks`.
3. Lua values: a list joined by a comma and a space, an object left out.
4. A view has no totals row of its own for now: a formula can `VSTACK` one, or another table's formula sum it; Excel's Total Row as a setting can come later.
5. (2026-11-06) Sources keep SilverBullet apart: the Lua side in `host/sources.ts` behind a `SourceProvider` of plain data, a `sources` module that can be turned off offering them to the formulas and the column types, no module-level state in a domain.
6. (2026-11-06) A result of one cell is its value; `FILTER` keeping nothing `#CALC!` unless its third argument; a `#SPILL!` cell's result shown read only over the window (*Show result*: a floating icon, the cell menu, Ctrl+Shift+Enter) and copied (*Copy result*), not on the sheet.

## Step 3: decided (2026-11-06, with the user)

1. **A result that is no grid**: one value is a table of one cell, a list one column. An error (`#CALC!` of a FILTER without its third argument, `#REF!`, `#CYCLE!`) writes nothing: the view stays as it was, its badge *Cannot be calculated* with the reason, as a pivot's. An empty result (`TAKE(…, 0)`) is the header alone, no body rows.
2. **Headers**: a column's name in its source (the grid's `names`), else its letter (A, B, C), as *Show result* has them. A header may be renamed as any table's (only the body is read-only); the name is kept by the column's id through every recalculation; emptied or given its made name back, it follows the source again.
3. **Columns' ids** (for the renamed headers): `name:<source column>`, a second column of the same source column `name:<column>:2`, a column of no origin `at:<place>`. A rename of a column the formula no longer gives goes (`storedRenames`).
4. **Types are not taken from the source**: a header carries the column's name only (a grid's names are without hashtags). A type typed into a view's header (`#euro`) is a rename like any other: kept, changed or removed by renaming again, never overwritten by the source, and a source's type changed does not reach the view. Taking the source's type (a header not renamed following the source's, a renamed one the user's, as the pivot's *Sum of Revenue #euro*) would need a grid to carry its columns' types: later, if wanted.
5. **Alignment**: a column right-aligned where all its values not empty are numbers.
6. **A cycle** (a view reading itself, two views reading each other) is `#CYCLE!`: an error as in 1.
7. **The formula it starts with**: from a table's ⋯ menu `=<name>![#Data]` (a table without a name named in the same edit, as *Insert pivot table…* does); from the command or `/view` the page's first named table's, else an empty field.
8. **Its name**: offered free (`view1`, `view2`… not taken by any table of the page, as the pivot's `table1`), may be emptied (a view without a name shows, no formula reads it). A name another table of the page has is refused by the dialog, as naming refuses it.
9. **A large result**: no limit; the dialog warns past 1,000 rows that each is written into the markdown; its preview shows the first rows (about 50) and the whole size.
10. **The formulas module off**: views keep their values; *Insert view…* and the dialog say formulas are needed and insert nothing, as the pivot's.
11. **Out of date**: calculated as a view is shown (nothing written), *Out of date* in its badge and *Refresh* in its toolbar; a source on another page checked again as SilverBullet indexes it, as the pivot's.
12. **Who knows `view.formula`**: the attribute is the views module's; the module offers `viewFormula(table)` (and `withViewFormula(table, formula)`) and the formulas module uses it for its `Book`, `Affected` and following edits. With the views module off the formulas see no view: views keep their values, as any module's data does when it is off. (Set aside: an attribute of the formulas' own, `formulas.view`, which would make a view half another module's.)
13. **Following its sources**: a view's formula, in its metadata row, is followed by the formulas module as another table's formulas are (`followTable` in `otherTablesWritten`: its source's columns renamed or moved, the source renamed) and written through the views module's offer, in the same edit.
14. Two commits, 3a and 3b (*Steps*).
15. The pivot's gap stays out of step 3; told to the user once views are done (*Steps*, 3).

## Step 4: decided (2026-11-06, with the user)

Binding for step 4, as *Step 3: decided* was for step 3; not to be opened again.

1. **Choice lists of the space between steps 4 and 5**: the gap is accepted. Step 4 takes away the lists of the space found by a header's name (`#choice-projects` with `columntypes/spacelists.ts`), their code and their tests (ui-tests/spacechoices.spec.ts and the unit tests of spacechoices.ts: rewritten for sources, or gone), and the library page's *Lists of the space* section; step 5 brings them back as a formula (`columntypes.choice.projects='=@projects'`, written by the Choices dialog), right after it. No code kept for the commits in between: neither is released, and both go to main together.
2. **References to a source**: `@tasks` alone is its whole body, as `@tasks[#Data]` (step 5's `=@projects`); `@tasks[due]` a column; `@tasks[#Data]` the body. Nothing else: no cells (`@tasks!A1`: a query's rows have no fixed order), no `[@due]` (a source is no table of the page, no formula is in its rows), no named rows or cells.
3. **A source's name**: the rules of a table's name (`tableNameProblem` in namerules.ts: letters, digits and `_`, not starting with a digit, not reading as a cell or a value), compared ignoring case. `defineSource` refuses another, said in a notification as a definition's mistake is.
4. **The order of a source's columns**: as the function gives them, the first row's keys then the keys new in later rows, as SilverBullet lays out a `${…}` of records. Verified in the local SilverBullet 2.12.1 (2026-11-06) by `${…}` of Lua tables: a constructor's keys (`{zeta, alpha, mid}`), keys set one after another, fourteen keys in no order, and a query's `select {zname = …, alpha = …, mid = …}` all came in the order written. `columns` stays, optional: another order, or some of the columns. (Space Lua is JavaScript: it keeps insertion order where C Lua keeps none; a SilverBullet release changing that would show in the sources' tests.)
5. **Where sources are offered**: as a name is typed in a formula (the cell editor's list, the formula fields of the view's and the conditional formatting dialogs, through the formulas module's `formulaChoices` / `fieldHelpers`), and in the pivot dialog's Source list as a group of their own (the space's sources, beside the page's tables and *Another page…*). Not in the Functions dialog (functions only).
6. **The playground**: fixed sample sources in its code (`tasks`, `projects`), given through the same `SourceProvider` as SilverBullet's, beside its pages; no panel to edit them.

## Step 5: before it starts (written 2026-11-06, for a session starting afresh)

**State**: branch `feat/views`, steps 1 to 4 done and committed (nothing pushed; released with the choices). `npm run verify` and `npm run test:ui` pass. Step 4 as built: *Step 4 done* in the status at the top, CLAUDE.md (Layout: src/sources.ts, src/host/sources.ts, features/sources.ts; *Sources of the space* under *Design decisions*). The Lua API as it is now: `silverware.table.defineSource({ name = "tasks", columns = { … }, data = fn })` (one table, its function `data`: `query = …` is a syntax error in Space Lua), written with parentheses in every example.

**What step 4 left that step 5 builds on**:
* A source is a table of the formulas' `TableSource` (`spaceSource`), so a list's formula `=@projects`, `=@users[name]`, `=FILTER(@users[name], @users[active])` calculates as any formula does; one reading a source not read yet keeps nothing to keep, so the column checks nothing then (`Book.notRead` gives why).
* The column types module asks the formulas module through an offer, as the conditions module asks for a formula condition's values (`rowValues` in `FormulasOffer`); the choice type gets its list's values in the context its module passes (`TypeTable`), no module-level state (columntypes/spacelists.ts is gone).
* A source changed: `tablesChanged` on every module; the column types module's `tablesChanged` today only hides the type hashtags anew: it must make the tables with a formula list look again (`looksChanged`).
* Following renames: the formulas module follows a view's formula through the view module's `CalculatedOffer.follow`; a list's formula needs the column types module to offer its lists' formulas and write them back, the same way (in `otherTablesWritten` for other tables, the write step for the table's own).
* The Choices dialog (features/choicesdialog.ts) has two ways today, *Column's values* and *Own list*; the formula field is src/formulafield.ts (its helpers the formulas' offer `fieldHelpers`, as the view's and the conditions' dialogs use them); the space's sources the sources module's offer (`SourcesOffer.names`, `columns`).
* `ui-tests/spacechoices.spec.ts` was deleted in step 4: its scenario (a query's list, read anew once a page of the tag is indexed) comes back for a formula list of a source, SilverBullet only, through `defineSources` in ui-tests/helpers.ts.

**Working notes for this machine**:
* Shell heredocs mangle `\n` and backslashes (a `\u0000` became a NUL byte, `\n` in a test's string a line break): write scripts to a file with the editor tool and run them. Python writes LF only with `newline=""`.
* A local SilverBullet: Docker inside WSL (`wsl -e docker …`, no Docker on Windows), image `ghcr.io/silverbulletmd/silverbullet:2.12.1-slim`, port 3010; see the memory `local-silverbullet-wsl`.
* Node's locale here is cs-CZ: a `localeCompare` without a locale sorts CH after H (a test failed so: 11143a7).

## Step 5: decided (2026-11-06, with the user)

Binding for step 5, as *Step 4: decided* was for step 4; not to be opened again.

1. **A list's formula follows its tables**: renames and moves of the page's tables and columns it reads (`people![name]` → `people![full_name]`, `people!` renamed), as a cell's or a view's formula follows them, in the same edit; a source (`@users`) is renamed by no edit, and another page's tables are followed nowhere. The column types module offers its lists' formulas and writes them back, as the view module offers its formula (`follow`): else a column renamed would leave the list checking nothing, unseen.
2. **What a list is made of its result**: the values in the result's order (the user sorts with `SORT(…)`; the column sorts in the list's order, as an own list's), empty ones left out, duplicates left out whatever their case (the first kept), as values are matched; numbers and logical values as a cell shows them (`TRUE`, `FALSE`). A result that is an error: the column checks nothing, its header's title and the Choices dialog saying why.
3. **In the Type menu**: a formula list is under *Choice* as an own list is (*Choice: projects*, taken for the column, deleted, asked first where columns take it), its hint showing the formula (`=@projects · Used by Project`), so lists are one kind that differ only in where their values come from.

## Step 6: before it starts (written 2026-11-06, for a session starting afresh)

**State**: branch `feat/views`, steps 1 to 5 done and committed (nothing pushed; released with the choices). `npm run verify` and `npm run test:ui` pass. Step 5 as built: *Step 5 done* in the status at the top, CLAUDE.md (Layout: features/choicesdialog.ts, columntypes/choicelists.ts, formulas/cell.ts `HeldFormulas`; *A choice list made by a formula* under *Design decisions*).

**Scope, decided with the user on 2026-11-06**: `HSTACK`, `VSTACK` and `SEQUENCE` now; `GROUPBY` and `PIVOTBY` later, on a branch of their own. They take a function as an argument (`GROUPBY(…, …, COUNTA)`, Excel's `LAMBDA`), which the formulas have no value for (the parser and the evaluator would need one), and how they stand to the pivot module is to be decided: a round of decisions of their own. Once the three are done, `feat/views` goes to main with the choices.

**Why these three first**: a view's body is one formula's result, so a column calculated beside a source's columns needs `HSTACK`. The user's case, a view of open tasks whose page is a link:

```
=HSTACK(CHOOSECOLS(FILTER(@tasks[#Data], @tasks[done] = "FALSE"), 1), "[[" & FILTER(@tasks[page], @tasks[done] = "FALSE") & "]]")
```

A view writes its cells as markdown (`calculatedTable` escapes `|` alone), so `[[Projects/Atlas]]` shows as a link in SilverBullet.

**What each needs** (tests require the first three):
* One file in formulas/builtin/, listed in builtin/index.ts, a `GridFunction` (`grids: true`) as `TAKE`, `CHOOSECOLS`, `SORTBY` are (what they share is in formulas/grids.ts); its `syntax`, `description`, `category` and `example` (read by the parser).
* A row in the library page's Functions table.
* Its Excel form decided in excel/functions.ts (`SAME_IN_EXCEL` or `EXCEL_FUNCTIONS`): the seven functions of step 1 are written as their values (Excel 365's only, *Status*), so these as well.
* Excel 365's behaviour: `HSTACK` and `VSTACK` pad a shorter array with `#N/A`; `SEQUENCE(rows, [columns], [start], [step])`. The columns' names (`Grid.names`, what a view's headers are named after): `HSTACK` keeps each part's, `VSTACK` the first part's, `SEQUENCE` none (letters).
* Tests: unit tests of the functions and of a view of them (formulas/views.test.ts); a UI scenario in ui-tests/views.spec.ts (a view of `HSTACK`, its headers by its parts' columns).

**Open questions** (to ask the user, not to decide alone): anything Excel and this plan leave open, e.g. a part of `VSTACK` with other columns' names than the first's, `SEQUENCE` of 0 rows (Excel: `#CALC!`), `#N/A` padding shown in a view.

**Checks by hand**: in the local SilverBullet (the memory `local-silverbullet-wsl`: one instance only, container `sw-step4`, port 3010; deploy with it stopped; pages changed only through its editor): the view above on SourcesTest (links clickable, headers by the source), a `VSTACK` of two tables, `SEQUENCE` in a cell (`#SPILL!`, Show result) and in a view.

**Working notes for this machine**: shell heredocs mangle `\n` and backslashes, so write scripts to a file with the editor tool; Python writes LF only with `newline=""`; run vitest from `D:\` (not `d:\`); Node's locale is cs-CZ (a `localeCompare` without a locale sorts CH after H); Playwright imported by `file:///D:/git/silverbullet-libraries/node_modules/playwright/index.mjs`, SilverBullet at `http://127.0.0.1:3010/`; WSL sleeps when idle: keep `wsl -e sleep 86400` running in the background.
