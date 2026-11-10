# Formulas of Silverware Table: the domain (`formulas/`), its module (`features/formulas.ts`), views calculated by it, formulas from Space Lua

`index.ts` is the domain's API for the rest of Silverware Table. The domain is pure: it reads no metadata, the module hands it what it needs (`FormulaCells`: a cell's formula, row and cell names; `TableSource`: other tables, pages, sources).

## Storage

- A formula is stored in its cell as **the result plus a hidden `<meta formulas.f='=…'>`**: every renderer and SilverBullet's index see a value; `<meta>` is not shown (verified). Not in the metadata row: a formula addressed by cell position there could, after an edit outside Silverware Table, overwrite a value typed by hand.
- **New formulas need the Store table metadata setting** (they are metadata); with it off a typed formula is saved as text, existing ones keep working (calculated columns too).
- Errors are written escaped (`\#REF!`, `cellResult` in cell.ts) and read in either form (`errorCodeIn`): unescaped, SilverBullet reads `#REF!` as the tag `REF` (verified 2.12.1).
- Stale results are offered as *Recalculate*, never rewritten on view. `TODAY()`/`NOW()` are written when calculated and show as stale once out of date.

## References

- `A1` is the first body row (header not counted, as MdTableSheet). `[name]` a whole column, without its total rows (cells whose formula reads that whole column), so a table's columns line up for XLOOKUP. `[@name]` this row, `[@[a]:[b]]` this row from a to b (Excel's table form), `[name:2]` a duplicate name.
- Column references use **SilverBullet's column key** (`[unit_price]`, what a query uses); any spelling with the same key matches.
- `$` (`$A$1`, `A$1`, `$A1`) matters only when a formula is filled elsewhere (AutoFill); table edits move fixed references with their cells and keep the `$`, as Excel. F4 cycles the reference at the caret (in a formula only).
- Other tables by name (`<meta core.table core.name='prices'>`): `prices!B2`, `prices![price]`, `prices![@price]` (that table's row of the same number), another page `[[Page]]prices!B2`. Excel's `Table1[@…]` without `!` is not read: it would be a row's name (`pear[price]`).
- **Edits made with Silverware Table shift references** (rows/columns inserted, deleted, moved, sorted into the markdown, renamed; `#REF!` for deleted cells), and in the same edit the tables of the page that refer to the edited one by name, transitively (`Affected`, `followTable`). Edits in the markdown do not; references from other pages do not follow.
- Other pages are read by the pageLinks module (`space.readPage`, again on each write that recalculates and as the page is indexed). A page not read (module off, not read yet): `TableSource.unread`, and `Book.notRead` keeps the stored results of formulas reading it.
- **Sources of the space** (`@tasks`, `@tasks[due]`; docs/silverware-table-views-plan.md, *Step 4: decided*): a token of kind `source` and a `SourceRef` beside `TableRef`, so nothing that follows the page's tables (renames, `Affected`, `references()`, Excel's references) takes one for a table. `@tasks!A1` and `@tasks[@due]` refused: a query's rows have no fixed order. A source's cells are read as data (`PLAIN_CELLS`); a source not read keeps results as a page not read does; no source of the name `#REF!`. In the Excel file a formula reading one is its value.

## Names

- Names are the core's (`names.ts`; one tag `<meta core.n='…' core.cn='…'>`), the formulas get them through `FormulaCells`. They move with their cells, so references by name never need rewriting.
- `core.n` in a header names the column apart from its header text; in a body cell it names the row (`pear[price]`; bare `pear` is the row's cells as a range). A formula in that row reading its own row's range is `#CYCLE!` (decided 2026-10-24: leaving the formula's own cell out gave one result in its row and another elsewhere).
- `core.cn` names a cell, unique in its table (since 2026-10-22; before, on the page). Another table's cell is `prices!vat`, so that table must be named. A bare name of another table's cell, or `[[Page]]vat` (old formulas), is `#NAME?` saying how to write it (`namedElsewhere`); saving the formula qualifies it (`qualifyCellNames`) where one named table has it. Nothing rewrites formulas not edited. A bare name is no reference to another table for recalculation.

## Functions

- **Built in only where nothing covers it already**: no VLOOKUP/HLOOKUP/MATCH/INDEX (XLOOKUP), no CONCATENATE (CONCAT, `&`), no SUMIF/COUNTIF/AVERAGEIF (the -IFS ones), no compatibility duplicates. Plain names with the modern behaviour: RANK is RANK.EQ, STDEV is STDEV.S, CEILING/FLOOR are the .MATH ones (significance optional, its sign ignored), NETWORKDAYS/WORKDAY without .INTL. `ROW(reference)` left out on purpose (in a spreadsheet it mostly works around what table-relative rows give here).
- One function per file in `builtin/` (nothing else there). A test requires each one's syntax and description in the library page's Functions table, and a `category` and `example` that parses. A new one also needs a decision in `excel/functions.ts` (a test requires it in `SAME_IN_EXCEL` or `EXCEL_FUNCTIONS`).
- `call(args, context)`: a result depends on the arguments and the context (`row`, `column`) only. The evaluator is synchronous; errors are values (`FormulaError`).
- -IFS conditions are Excel's (`criteria.ts`), not the filter row's syntax, so formulas copied from a spreadsheet work.
- Operators on ranges work cell by cell (`cellByCell`): `SUM([qty] * [price])`, `TEXTJOIN(", ", TRUE, "**" & [name] & "**")` as in Excel 365. A cell's result is one value; several are `#SPILL!` (shown by Show result, never written).
- **No spilling, decided**: spilled cells would be values in the markdown needing a mark of their source (else typed data is overwritten), lists of varying length (FILTER, SORT, UNIQUE) would add and remove rows among the records (sorting, filters, pins, references, undo), and Excel refuses spills in its tables too. A value per row is a calculated column; a table made whole from one formula is a view (below).
- An argument left out between others (`XLOOKUP(a, b, c, , -1)`) is a null literal, taken as not given (an empty cell is a one-cell list, so told apart); a trailing one (`SUM(A1,)`) is not read, so autofix does not complete `=SUM(A1,` to it.
- Rounding takes binary noise off first (`tidy` in arguments.ts: 0.29 * 100 rounds down to 29 otherwise). MOD, CEILING, FLOOR, MROUND of a time give a time (`MOD([@end] - [@start], 1)` past midnight).

## Dates

- **ISO text** (`2025-11-06`, `2025-11-06 14:30[:15]`), not serial numbers: results are written into the markdown, where a serial would be unreadable, invisible to queries and no `#date`. Arithmetic in UTC on the written fields (no time zone). `+`/`-` as a spreadsheet (days; date − date = days). Times of day are text too (`14:30`); date + time is that date at that time.

## Custom functions (from Space Lua)

- **JS, not Lua**: a space module (`export default [ … ]`, or a function given HELPERS returning the list), given with `silverware.table.defineFunctions(js.importFromSpace(…))`. A Lua function called from JS returns a Promise as soon as it uses SilverBullet's standard library (`ipairs`, `table.insert`, `table.concat`, verified), and formulas are calculated synchronously (every view, the write step). Verified: JS objects passed through Lua come back the same objects; `js.importFromSpace` gives the same module for the same path and unwraps a sole default export.
- Definitions are replaced each time Space Lua loads; the old ones stay until the first new call (a function no script defines any more stays until a reload). A mistake is a notification, not Lua's `error` (no level: it would point at the library page and stop the user's script).
- On a change of definitions (`tablesChanged`, not on render) tables calling custom or unknown functions are checked again (`callsCustomFunctions`): one not defined keeps its result, Recalculate highlighted. A throw or a wrong result is the formula's error. Names that read as a cell (`LOG2`, `CELL_RE`) or TRUE/FALSE are refused.

## Views and pivots: calculated by the formulas (decided 2026-11-06, docs/silverware-table-views-plan.md)

- A table calculated from others (a view, a pivot) is read by the `Book` as calculated now, as its module would write it, so a table reading it follows its sources in the same calculation. The formulas module asks the modules in its `CALCULATING` list (`view`, `pivot`) for a `CalculatedOffer`; a new kind of calculated table is one more name there. Likewise `HOLDING` (`columnTypes`) for formulas kept in a metadata row that calculate no cell (a choice list's): what the table reads, followed through edits as a cell's formula.
- What it reads comes through `CalculatedRead` in the same book, so cycles are seen: one reached again while calculated is `#CYCLE!` (`calculatedKey`: page and name, whichever object of the table a caller holds), its formula reading its own cells too. One that cannot be calculated is its error for its readers and writes nothing.
- On a write, `otherTablesWritten` first finds every affected table and follows all references to the edited table (a calculated table's definition through its `follow`), then calculates each over the page as followed. Calculated one by one, bottom up, a table below a view whose formula followed a rename read `#REF!`. A view's own write (Refresh, settings) is calculated in `writeStep`.
- The pivot was moved onto this on 2026-11-06 (a table reading a pivot was written only on the pivot's next write).

## Formulas from Space Lua (decided 2026-11-05)

- **Values for Lua, text for a page: two functions each**: a `${…}` renders what it gets as markdown (a list a block, records a table, `nil` the word, `#REF!` a hashtag), a script wants values. So `evaluate` / `evaluateText`, `errors` / `errorsText`; one function with an option set aside.
- **An error is `nil, { code, detail }`**, Lua's way: no text starting with `#` is taken for an error. In a list a cell's error is that record in its place; `""` for an empty cell in a list (a `nil` would end it for `ipairs` and `#`), `nil` for one empty value.
- `evaluateText` escapes errors only (`\#REF!`), as cells write them; a text a formula makes (`="#"&"tag"`) stays as typed text would.
- Aliases (`evaluateAlias`, `evaluateTextAlias`) are more than short names: their calls' formulas are followed through edits (`places.ts`) and completed, which a `local` name is not.
- A page is named as SilverBullet's Lua API names one (`"Budget"`), not `[[Budget]]` nor `[Budget]`.
- The index and pages' texts are the Lua's (the JS has no query, and a `${…}` refreshes on what its Lua read); whether a cell holds a formula is the formulas module's (no one else knows its attribute).
- `errorsText` with none is *No formula errors*: an empty result would not tell no errors from nothing calculated.
- Verified 2026-11-05 (2.12.1): `_CTX.currentPage` is nil in a function defined on another page, so `evaluate` takes the editor's page; opening a page from another, the editor's text is still the old page's for a moment, so the page is read as saved where the text does not hold the formula.
