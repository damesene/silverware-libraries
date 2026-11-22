# Formulas: their language and engine (`shared/formulas/`)

Shared by the plugins (docs/silverware-formulas-shared.md): what a formula says and how it is calculated, on tables of
the model (`shared/table/`), whoever's rows they are. `index.ts` is the API. The engine is pure: how a cell holds a
formula and its names is given (`FormulaCells`), and so is what else a formula reads (`TableSource`: other tables,
pages, sources). It imports nothing of a plugin (`shared/imports.test.ts`); Silverware Table keeps its formulas in its
cells and calculates them in its module (silverware-table/src/formulas/CLAUDE.md), `outside.test.ts` shows another
plugin's rows calculated.

## References

- `A1` is the first body row (header not counted, as MdTableSheet). `[name]` a whole column, without its total rows (cells whose formula reads that whole column), so a table's columns line up for XLOOKUP. `[@name]` this row, `[@[a]:[b]]` this row from a to b (Excel's table form), `[name:2]` a duplicate name.
- Column references use **SilverBullet's column key** (`[unit_price]`, what a query uses); any spelling with the same key matches.
- `$` (`$A$1`, `A$1`, `$A1`) matters only when a formula is filled elsewhere (AutoFill); table edits move fixed references with their cells and keep the `$`, as Excel. F4 cycles the reference at the caret (in a formula only).
- Other tables by name (`<meta core.table core.name='prices'>`): `prices!B2`, `prices![price]`, `prices![@price]` (that table's row of the same number), another page `[[Page]]prices!B2`. Excel's `Table1[@…]` without `!` is not read: it would be a row's name (`pear[price]`).
- **Sources of the space** (`@tasks`, `@tasks[due]`; docs/silverware-table-views-plan.md, *Step 4: decided*): a token of kind `source` and a `SourceRef` beside `TableRef`, so nothing that follows the page's tables (renames, `Affected`, `references()`, Excel's references) takes one for a table. `@tasks!A1` and `@tasks[@due]` refused: a query's rows have no fixed order. A source's cells are read as data (`PLAIN_CELLS`); a source not read keeps results as a page not read does; no source of the name `#REF!`. In the Excel file a formula reading one is its value.

## Names

- Names are the model's (`shared/table/names.ts`: `core.n`, `core.cn`), the formulas get them through `FormulaCells` (Silverware Table writes them in one tag, `<meta core.n='…' core.cn='…'>`). They move with their cells, so references by name never need rewriting.
- `core.n` in a header names the column apart from its header text; in a body cell it names the row (`pear[price]`; bare `pear` is the row's cells as a range). A formula in that row reading its own row's range is `#CYCLE!` (decided 2026-10-24: leaving the formula's own cell out gave one result in its row and another elsewhere).
- `core.cn` names a cell, unique in its table (since 2026-10-22; before, on the page). Another table's cell is `prices!vat`, so that table must be named. A bare name of another table's cell, or `[[Page]]vat` (old formulas), is `#NAME?` saying how to write it (`namedElsewhere`); saving the formula qualifies it (`qualifyCellNames`) where one named table has it. Nothing rewrites formulas not edited. A bare name is no reference to another table for recalculation.

## Functions

- **Built in only where nothing covers it already**: no VLOOKUP/HLOOKUP/MATCH/INDEX (XLOOKUP), no CONCATENATE (CONCAT, `&`), no SUMIF/COUNTIF/AVERAGEIF (the -IFS ones), no compatibility duplicates. Plain names with the modern behaviour: RANK is RANK.EQ, STDEV is STDEV.S, CEILING/FLOOR are the .MATH ones (significance optional, its sign ignored), NETWORKDAYS/WORKDAY without .INTL. `ROW(reference)` left out on purpose (in a spreadsheet it mostly works around what table-relative rows give here).
- One function per file in `builtin/` (nothing else there). A test requires each one's syntax and description in the library page's Functions table, and a `category` and `example` that parses. A new one also needs a decision in `excel/functions.ts` (a test requires it in `SAME_IN_EXCEL` or `EXCEL_FUNCTIONS`).
- `call(args, context)`: a result depends on the arguments and the context (`row`, `column`) only. The evaluator is synchronous; errors are values (`FormulaError`).
- **A part of a formula reading nothing of its row is calculated once in a calculation** (`Sheet.rowFree`: no `[@column]`, no function declaring `readsPlace` (ROW()), no custom function), kept by its node of the parsed formula: `=[@hours]/SUM([hours])` sums the column once, not once a row (50,000 rows: 63 s before, 0.4 s; measured 2026-11-22). A part calculated while a cycle was met is not kept. A function whose result depends on the cell it is in declares `readsPlace: true`.
- -IFS conditions are Excel's (`criteria.ts`), not the filter row's syntax, so formulas copied from a spreadsheet work.
- Operators on ranges work cell by cell (`cellByCell`): `SUM([qty] * [price])`, `TEXTJOIN(", ", TRUE, "**" & [name] & "**")` as in Excel 365. A cell's result is one value; several are `#SPILL!` (shown by Show result, never written).
- **A function of one value given a range is called for each of its values** (`lifted` in evaluate.ts, docs/silverware-formulas-lifting.md), as Excel 365 calls it: `UPPER([name])` a list. Each function says what its arguments take (`argument(at, count)`: `value`, lifted; `range`, read whole; `branch`, chosen among: IF's results, placed only where what decides is a list), built-in and the user's alike; `arguments.test.ts` checks every built-in one's against its `call`. A grid of several rows and columns where one value is expected is `#VALUE!` whole; an area of several columns (`A1:B2`) its cells row by row, as an operator reads it. A reference to one cell is a list of one wherever it is given (an empty cell told from an argument left out).
- **No spilling, decided**: spilled cells would be values in the markdown needing a mark of their source (else typed data is overwritten), lists of varying length (FILTER, SORT, UNIQUE) would add and remove rows among the records (sorting, filters, pins, references, undo), and Excel refuses spills in its tables too. A value per row is a calculated column; a table made whole from one formula is a view (below).
- An argument left out between others (`XLOOKUP(a, b, c, , -1)`) is a null literal, taken as not given (an empty cell is a one-cell list, so told apart); a trailing one (`SUM(A1,)`) is not read, so autofix does not complete `=SUM(A1,` to it.
- Rounding takes binary noise off first (`tidy` in arguments.ts: 0.29 * 100 rounds down to 29 otherwise). MOD, CEILING, FLOOR, MROUND of a time give a time (`MOD([@end] - [@start], 1)` past midnight).

## Dates

- **ISO text** (`2025-11-06`, `2025-11-06 14:30[:15]`), not serial numbers: results are written into the markdown, where a serial would be unreadable, invisible to queries and no `#date`. Arithmetic in UTC on the written fields (no time zone). `+`/`-` as a spreadsheet (days; date − date = days). Times of day are text too (`14:30`); date + time is that date at that time.

## Custom functions (a plugin's, from Space Lua)

- **JS, not Lua**: a space module (`export default [ … ]`, or a function given HELPERS returning the list), given with `silverware.table.defineFunctions(js.importFromSpace(…))`. A Lua function called from JS returns a Promise as soon as it uses SilverBullet's standard library (`ipairs`, `table.insert`, `table.concat`, verified), and formulas are calculated synchronously (every view, the write step). Verified: JS objects passed through Lua come back the same objects; `js.importFromSpace` gives the same module for the same path and unwraps a sole default export.
- Definitions are replaced each time Space Lua loads; the old ones stay until the first new call (a function no script defines any more stays until a reload). A mistake is a notification, not Lua's `error` (no level: it would point at the library page and stop the user's script).
- On a change of definitions (`tablesChanged`, not on render) tables calling custom or unknown functions are checked again (`callsCustomFunctions`): one not defined keeps its result, Recalculate highlighted. A throw or a wrong result is the formula's error. Names that read as a cell (`LOG2`, `CELL_RE`) or TRUE/FALSE are refused.
