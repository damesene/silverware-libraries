# Silverware Table: changelog

## 2.0.0 (2026-11-22)

- **Breaking:** a custom function that reads a range (a sum or a lookup of your own) has to say so: `argument: ALL_RANGES`, or by the argument's place, `argument: (at) => (at === 1 ? "range" : "value")`. Without it, a function given a range is now called once for each of its values, as a built-in one is. Add `argument` to such functions in the files you load with `silverware.table.defineFunctions`.
- Functions of one value given a range are calculated for each of its values, as in Excel 365: `TEXTJOIN(", ", TRUE, UPPER([name]))` joins the names in capitals, `IF([qty] > 10, "bulk", "single")` decides for each row. Left alone in a cell, such a result is `#SPILL!` (Show result shows its values); a table's data where one value is expected is `#VALUE!`. In an Excel file such formulas are written as array formulas.
- New functions: `IFS` and `SWITCH`, as in Excel.
- Faster formulas: a part that reads nothing of its row (`SUM([hours])` in `=[@hours]/SUM([hours])`) is calculated once, not once per row.

## 1.4.0 (2026-11-21)

- **Changed:** `silverware.table.tables(text)` (and the table custom menu entries get) gives each row's cells by the table's columns: a cell past the header, in a row longer than its header, is left out. A column's name with repeated spaces is given with one (`Unit  price` is `Unit price`); its key is the same as before.
- Deleting a column no longer removes the rows' names: a row's name stays with its row whichever column is deleted. Cells' names in that column still go with it, as Silverware Table says before.
- Faster saving in large tables: a table drawn anew after an edit keeps its look from the start instead of being restyled whole.
- Large tables with Silverware Layout installed: the rows out of view are taken out before the table is laid out again, as without it, so saving no longer lays out every row.
- Many small fixes to how cells, headers, names and metadata are written, found while rebuilding how tables are read and stored.

## 1.3.1 (2026-11-19)

- Fixed: letting go of something dragged in a dialog (a column's options), or cancelling the drag with Esc, no longer counts as a click on what lies under the pointer.
- Its thin scrollbar is now shared with every Silverware plugin; it looks as before.

## 1.3.0 (2026-11-17)

- Works with SilverBullet's next version (3.0) as well as 2.12.1: settings are saved in `Library/Config` there; a table scrolls sideways in its box, scrolls up and down again where it has a maximum height, and keeps its look at full screen where SilverBullet draws tables as cards. Your own functions, types, series, menu entries, conditions and themes go in a block on a page under `Library/` there.
- With Silverware Layout: a table placed at the left, in the middle or at the right of the text, from the menu of the bar beside it.
- Fixed: after a touch, a selection's handles no longer lie under the held header, and stay inside the table's edges in the middle of a whole row or column.
- Menus line up their icons and words, and a row of buttons wraps onto further lines on a narrow screen instead of running out of the menu; a page with tables opens faster.

## 1.2.0 (2026-11-12)

- Inserting rows and columns with +: a small dot marks each border while a cell of the table is selected or edited, and turns into a + as the pointer reaches it. Hovering a table shows none, so they stay out of the way while you write.
- Fixed: the header of a table with a maximum height no longer stays at the top of the page after the table has scrolled away.

## 1.1.0 (2026-11-12)

- With Silverware Layout: a table wider or narrower than the text, by the bar beside it; its width kept in its metadata (it needs *Store table metadata*).
- A table with a maximum height scrolls with a thin scrollbar, hidden while its header is held at the top of the page.
- Fixed: the + to add a row no longer shows over another plugin's full screen or panel (a database's peek).

## 1.0.0 (2026-11-11)

First versioned release.

- Markdown tables edited in place: cells, sorting, filtering, adding, moving and deleting rows and columns, copying and pasting with spreadsheets, column widths.
- Formulas (Excel's functions, arrays), column types, conditional formatting and themes.
- Views and pivot tables kept up to date, tables from Space Lua queries.
- Full screen and sheet view, pinned rows and columns, export to Excel.
