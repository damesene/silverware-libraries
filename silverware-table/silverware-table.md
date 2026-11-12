---
name: Library/damesene/silverware-table
tags: meta/library
version: 1.1.0
description: "Silverware Table: sort, filter and edit markdown tables in place, and move, add or delete rows and columns."
files:
- silverware-table.js
- silverware-table-init.md
- silverware-table-api.md
- silverware-table-style.md
---
# Silverware Table

Makes the markdown tables in your pages interactive: edit cells in place, sort, filter, and add, move or delete rows and columns. The tables stay plain markdown, and every change is an ordinary edit you can undo.

## At a glance

* **Edit a cell**: click it and type (or click it again, or double-click it), press Enter. The *Edit mode* button (✎, left of ⋯ in the toolbar) edits on the first click. See [[#Editing cells]].
* **Move between cells**: Tab / Shift+Tab, or Ctrl+arrows while editing; Ctrl+Alt+arrows move the row or column (with cells selected, all their rows or columns). See [[#Keyboard]].
* **See the markdown**: hover the table and click *Edit markdown* in the toolbar's ⋯ menu, or Alt+click a cell. See [[#Showing the markdown]].
* **Delete a table**: *Delete table*, last in its ⋯ menu, removes the whole table from the page. It asks first and says what goes with it (formulas in other tables that refer to it show `#REF!`, or use another table of the same name from then on; a sheet whose only table it is); Ctrl+Z brings it back.
* **Sort**: click ⇅ in a column header. See [[#Sorting]].
* **Filter**: hover the table and click *Filter*; `>10`, `/regex/`, `=text` and `!text` work too. See [[#Filtering]].
* **Add, move or delete rows and columns**: click the ⠿ grip next to a row or above a column. See [[#Rows and columns]].
* **Copy or empty cells**: drag across cells to select them; Ctrl+C copies them for Excel or Google Sheets, Delete empties them. See [[#Copying cells]].
* **Paste from a spreadsheet**: copy cells in Excel or Google Sheets, click a cell, Ctrl+V; Ctrl+Shift+V adds them as new rows. See [[#Pasting from a spreadsheet]].
* **Column types**: `| Price #currency |` shows `12.99` as `€12.99`, `#stars` a rating as stars, `#check` yes / no as ☑ / ☐, `#choice` one of a list of values (a status: open, in progress, done). See [[#Column types]] and [[#Choices]].
* **Formulas**: type `=SUM(B1:B3)` or `=SUM([qty])` into a cell; the result is written into the markdown. See [[#Formulas]].
* **Arrays in formulas**: `FILTER`, `SORT`, `UNIQUE`, `HSTACK`, `SEQUENCE` and more, as in Excel 365: `=COUNTA(UNIQUE([assignee]))`. See [[#Arrays]].
* **Views**: a table made by one formula (`=FILTER(tasks![#Data], tasks![done] = FALSE)`), written anew as what it reads changes; *Insert view…* in a table's ⋯ menu, or `/view`. See [[#Views]].
* **Pivot tables**: a table's rows grouped and summed, kept up to date; *Insert pivot table…* in its ⋯ menu, or `/pivot`. See [[#Pivot tables]].
* **Tables from Space Lua**: a query of your space as a table formulas, views and pivots read as `@tasks`, given by `silverware.table.defineSource`; a `#choice` column can take its list from one too. See [[#Sources of the space]].
* **The table's names**: the title of a table's ⋯ menu is its name (the pencil after it names it); under *Full screen* and *Sheet view*, the row *Sheet* says the sheet it is on (*Sheet: Budget*), its pencil to type another sheet's name, its × to take the table off it. Hold Shift and the toolbar shows both names too, left of its icons (above them where both do not fit); the *Names in the toolbar* setting shows them always, or never.
* **Sheet view** (in a table's ⋯ menu) shows the table like a spreadsheet over the whole window, with empty rows and columns around it; type into one to grow the table. See [[#Sheet view]].
* **Pin rows and columns** to the edges, where they stay in view (needs *Store table metadata*). See [[#Pinning]].
* **Conditional formatting**: cells in colors by their values (over a limit, a color scale, data bars, keywords), from a column's menu or the table's ⋯ menu. See [[#Conditional formatting]].
* **Themes**: how tables look (header, lines, stripes, spacing), for all tables in the settings or for one in its ⋯ menu; your own in a `space-style` block. See [[#Themes]].
* **Change how Enter or filters work**: *Configuration: Open*, category *Silverware Table*. See [[#Settings]].

## Editing cells

* A click selects a cell, as in a spreadsheet: then **type** to replace its text, or click it again, double-click it, press **Enter** or **F2** to edit its text. **Backspace** empties it for typing. Arrows move to the cell beside.
* **Edit mode** (the ✎ button in the table's toolbar, left of ⋯; off by default): a click edits the cell right away. This browser remembers the choice.
* In the editor, Enter or clicking elsewhere saves; Esc cancels and leaves the cell selected (a second Esc ends that).
* A click puts the cursor at the end of the cell's text; with the *Click selects the cell's text* setting it selects the whole text, to type over it, and so do Enter, Tab and Ctrl+arrows moving to the next cell. See [[#Settings]].
* Shift+click selects cells, as in a spreadsheet: see [[#Copying cells]].
* Links, tasks and buttons in cells work as before: clicking them does not start editing.
* A column always needs a name: emptying a header cell keeps the old name.

### Keyboard

| Key | While editing a cell |
|---|---|
| Enter | Save, edit the cell below; on the last row, add a row and edit it (with the `save` setting: only save) |
| Ctrl+Enter | Save, add a row below, edit it |
| Esc | Cancel; the cell stays selected (marked) for the keys of [[#Copying cells]], a second Esc ends that |
| F4 | In a formula: the cell or range reference at the cursor cycles its `$`: `A1`, `$A$1`, `A$1`, `$A1`, see [[#References]] |
| Shift+F3 | In a formula: the *Functions* dialog, to find a function and insert it, see [[#Functions]] |
| F2 | Go on in the cell's popup: the whole text wrapped (a long text or formula), see [[#Long text in cells (`silverware.table.modules.longText`)]]. In the popup Ctrl+arrows, Ctrl+Home / End and Ctrl+Alt+arrows work in the text only (by words, to its start or end), not on the table; Ctrl+Enter saves as Enter does. |
| Tab | Save, edit the next cell |
| Shift+Tab | Save, edit the previous cell |
| Ctrl+arrows | Save, edit the cell beside |
| Ctrl+Home | Save, edit the row's first cell |
| Ctrl+End | Save, edit the row's last cell |
| Ctrl+PageUp / PageDown | Save, edit the cell 10 rows up / down |
| Ctrl+Shift+arrows | Save, select the cells from this one on (see [[#Copying cells]]) |
| Ctrl+Alt+↑ / ↓ | Move the row up / down |
| Ctrl+Alt+← / → | Move the column left / right |
| Ctrl+Alt+Home / End | Move the column to the start / end |
| Ctrl+Alt+PageUp / PageDown | Move the row 10 places up / down |

* Tab on the last cell adds a row; so does Enter on the last row (not with the `save` setting).
* While a name is typed in a formula, its list takes ↑ / ↓, Tab and Esc; Enter saves the formula as typed. See [[#References]].
* Shift+Enter opens the cell below the other way round: with its whole text selected, or with the cursor at the end when the *Click selects the cell's text* setting is on. See [[#Settings]].
* Ctrl+Alt+arrows save the cell and move it with its row or column, and keep editing it. Rows cannot move while sorted or filtered, nor the header row.
* Enter (and Shift+Enter) also moves to the cell below; with the `save` setting it only saves. See [[#Settings]].
* Browsers use Ctrl+PageUp / PageDown to switch tabs and do not pass them to the page. They work where SilverBullet runs without tabs (installed as an app).
* While Ctrl is held, the pointer shows a move cursor. Without Ctrl, arrows, Home and End move within the cell's text as usual.

## Copying cells

* Press on a cell and drag across others, the header included if you like: the cells in between are selected. A click selects one cell (in *Edit mode* it edits it, see [[#Editing cells]]). On a touch screen, drag the dots at the selection's corners, see [[#Touch screens]].
* **Shift+click** a cell: the cells from the one being edited (it is saved) to this one are selected; with cells selected already, from the first of them; else just this cell.
* **Shift+arrows** (Ctrl+Shift+arrows too) move the selection's far corner by a cell; in a cell editor, Ctrl+Shift+arrows start a selection there.
* With cells selected, **arrows** (and Ctrl+arrows) go to the cell beside, **Home / End** to the row's first / last cell, **Ctrl+Home / End** to the table's first / last cell, **PageUp / PageDown** 10 rows up / down (PageUp stops at the first row under the header). The selection is then that cell; with Shift it extends to it. **Tab / Shift+Tab** select the next / previous cell, along the row and on to the next, as they do in a cell editor; Tab on the table's last cell adds a row and edits its first cell.
* **Ctrl+C** copies them as a spreadsheet does, so Excel, Google Sheets or LibreOffice paste them into cells, and other editors as text (a tab between cells, a line break between rows). The cells copied are outlined with a dashed line, as in a spreadsheet, until they are pasted, or Esc, another copy or a change of them; they can be pasted again after that too (the clipboard keeps them). **Ctrl+X** cuts them: see [[#Cut and paste]].
* Cells copy what they show: a formula's result, a link's text.
* The selection follows the rows as shown: in a sorted or filtered table it takes the rows in their order on the screen, without the hidden ones.
* **Delete** empties the selected cells, formulas included, as one edit (Ctrl+Z brings them back). Header cells keep their names: a column needs one. Names of rows and cells stay with their cells.
* **Delete whole rows or columns**: select them (click a row's or column's grip; for more, Shift+click another grip, see [[#Rows and columns]]), then Delete: the first press empties them, a second deletes the rows (columns) once they are empty. A column is deleted only when it is empty in every row, also the rows a filter hides. *Delete N rows* and *Delete N columns* in the cell menu or the grip menu delete them right away. Deleted, the row (column) that took their place is selected whole, so the keyboard goes on from there.
* **Delete a whole table**: select all of it (its header and every row; on a sheet, click the handle at its top left corner), then Delete: the first press empties it, a second deletes the table from the page once its rows are empty, without asking, unless something goes with it (formulas referring to it, a sheet whose only table it is); on a sheet its cell stays selected where the table was. Ctrl+Z brings it back.
* **Ctrl+Alt+arrows** move the rows of the selection up / down (PageUp / PageDown: 10 places) or its columns left / right (Home / End: to the start / end), together, as one edit; the selection goes with them. Rows do not move while the table is sorted or filtered, nor with the header selected; pinned and unpinned rows (columns) do not move together.
* Typing, Enter or F2 edits the first cell selected (see [[#Editing cells]]). **Ctrl+Enter** adds a row under the cell selected and edits it in the same column, as in a cell editor (with the *Ctrl+Enter adds a row* setting; off, it edits the cell, as Enter does).
* Esc or a click elsewhere ends the selection.
* **Copy as CSV** in the ⋯ menu of the table's toolbar (the `export` module) copies the whole table as CSV (commas between cells, quotes where a cell needs them): its header and its rows as shown, sorted and filtered, cells as Ctrl+C copies them. **Copy as Markdown** beside it copies the same rows as a plain markdown table: each cell as written (links, formatting, a formula's result), without formulas, names and the table's other hidden data, so it can go into any page or tool as an ordinary table.
* **Export to Excel…** in the same menu: see [[#Excel]].

## Excel

**Export to Excel…** in the ⋯ menu of a table's toolbar (the `excel` module) opens a dialog with two ways, what each keeps and loses; after one is taken, the dialog says how it went (*Close* or Esc closes it):

* **Copy for Excel** copies the table for pasting into Excel: its header and its rows as shown, sorted and filtered. Numbers (`12,50 €`, `15 %`), dates (`2025-11-06`), times (`14:30`) and `TRUE` / `FALSE` paste as Excel's numbers, dates and logical values, whatever the language of your Excel; other cells as text. A number only when nothing written would be lost: `007`, `+420 777 123 456`, `3 kg` and numbers of more than 15 digits stay text. Values only: formulas paste as their results.
* **Download .xlsx** downloads the whole table as an Excel file of one sheet, named after the table (its name, else the page; the file's name can be changed in the dialog, Enter downloads too): an Excel table (as *Insert > Table* makes one): named as the table (else `Table1`), its columns named as its header (a name twice gets a number, `Qty2`; an empty one is `Column3`), filters in its header, banded rows, its last row its totals row where that is the table's only total row; the header in row 1 (kept in view), every row under it in the order of the markdown (not as sorted or filtered: formulas refer to rows by their place), values as above, and the formulas as Excel writes them (with the `formulas` module off, the cells' values only). A calculated column stays one: a row added in Excel gets its formula. The file is made in the browser; nothing is sent anywhere.

Formulas in the file:

* References become Excel's: `[qty]` the table's column (`Table1[Qty]`, Excel's totals row not among its rows; with a total row elsewhere in the table, the column's rows as cells, such as `B2:B9`), `[@qty]` the cell in the formula's row (`[@Qty]`), `[@[jan]:[mar]]` the row's columns (`Table1[@[Jan]:[Mar]]`), `A1` (the first row under the header) Excel's `A2`, a named cell or row its cells. Functions are written as Excel has them: `CEILING` as `CEILING.MATH`, `ROW()` counting from the first row under the header, `DATEADD` with `+` or `EDATE`, `DATEDIF`'s units with Excel's.
* A formula Excel cannot have is written as its value: one that refers to another table or page, a whole column with total rows between its rows, `TEXT` (Excel reads its format codes in its own language), `DATEADD` or `DATEDIF` whose unit comes from a cell, the array functions (`FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, `DROP`, `HSTACK`, `VSTACK`, `SEQUENCE`: Excel 365's only), a custom function without an Excel form. `[#Data]` is the table's `Table1[#Data]`; `#SPILL!` and `#CALC!`, which only Excel 365 knows, are written `#VALUE!`. The dialog lists them under *Download .xlsx* before the file is made, each with its cell (as Excel names it) and why, or says that every formula will be an Excel formula.
* In Excel, dates, times, percentages and amounts are numbers: a formula that takes them as text (`[@due] & " due"`, `LEN`, `CONCAT`) gives Excel's number there (`45967 due`), where Silverware Table gives the text as written.
* Excel calculates the formulas again when it opens the file. Formulas with operators on whole ranges (`SUM([qty] * [price])`) are written as array formulas, so older versions of Excel calculate them too; `XLOOKUP`, `TEXTJOIN`, `MAXIFS` and the like need Excel 2019, 2021 or 365.
* Your custom functions are written as Excel formulas by templates in the setting `silverware.table.modules.excel.functions`: `{1}`, `{2}`… are the function's arguments (as Excel writes them), `false` writes the function's cells as their values. Write the template as Excel's English formulas are, with commas:

```lua
config.set("silverware.table.modules.excel.functions", {
  VAT = "ROUND(({1})*1.21,2)",
  MARGIN = "({1}-{2})/{1}",
  SLUG = false,
})
```

Conditional formatting in the file (with the `conditions` module, see [[#Conditional formatting]]): the table's rules become Excel's, on the same cells (the header and pinned rows and columns left out), in the same order: the conditions as Excel's own (greater than, between, text contains, duplicates, top values, above average, dates), fills, text colors, bold, italic, underline and strikethrough as Excel's formats, color scales, data bars, *Arrows* and *Traffic light dots* as Excel's, *By keywords* and *By number ranges* as a rule for each row. A pattern of *Matches* or *By keywords* is Excel's "contains" where it is plain words, else a formula (`=a|b`, `>10`, `!…`); a regular expression is Excel's `REGEXTEST`, which only Microsoft 365 has: an older Excel leaves those cells as they are, and the dialog says which rules need it. Excel has no form of a *Formula* condition (it reads columns by name), of *Levels*, *Heat map* and *Traffic light*, nor of a scale, bar or icons over the cells a condition picks; your own conditions and formats are written as they say (their `excel`, see [[#Custom conditions and formats]]), a format of a style always: the dialog lists the rules not written, with why, under *Download .xlsx*; they are not in the file. Colors are the palette's light ones, or yours written `#rrggbb`. One difference stays: the table ignores diacritics when it compares text (*kun* finds *kůň*, as filters do), Excel does not, so a text condition may pick fewer cells there. Otherwise the file picks the cells the table does: compared rule by rule with Excel 16 (numbers only for number conditions, wildcards taken as themselves, duplicates of numbers by their value, percents of the cells with numbers, a color scale's ends and a midpoint at an end as Excel colors them). A data bar runs from 0 (or the smallest number below 0) in both.

## AutoFill

Select cells and drag the small square at the bottom right corner of the selection (the fill handle) down, up, right or left: the cells you drag over go on from the selected ones, as in a spreadsheet. While you drag, the cells are outlined and the value the last one will get shows by the pointer; let go to fill them (one edit, one Ctrl+Z), Esc cancels. Double-click the square to fill down as far as the column beside the selection (left, else right) has values.

Without dragging (on a touch screen, or for a long way): **AutoFill to…** in the menu of the cells selected (right-click them; on a touch screen tap them, see [[#Touch screens]]), then click (tap) the last cell to fill: the cells up to it are filled as dragging there would fill them, written over whatever they hold. Meanwhile the page and the table scroll as usual (swipe on a touch screen, the wheel), so the last cell can be far away. Hovering a cell first outlines what a click fills; Esc, or a press outside the table, cancels.

| Selected | Goes on with |
|---|---|
| `1`, `2` | `3`, `4`, `5` … (the step between them; several uneven numbers: their trend; written as they are: `1,5`, `2,5` → `3,5`, `001`, `002` → `003`) |
| `1` | `1`, `1` … (one number repeats, as in a spreadsheet, `9.99` and `-3` too; select two for a series. Numbers of more than 15 digits always repeat: they would not be kept exactly) |
| `Item 1` | `Item 2`, `Item 3` … (text with a number; `A-01` → `A-02`, `Q1`, `Q3` → `Q5`) |
| `Mon`, `Tue` | `Wed`, `Thu` … (days and months, long and short, English and Czech: `Po`, `Út` → `St`; typed without diacritics, `Po`, `Ut` → `St`, `Ct`; their case kept. The short Czech ones, also everyday words (`ne`, `po`, `so`, `pro`), need two selected: one repeats) |
| `2025-11-06` | `2025-11-07` … (dates day by day, also written `6.11.2025` or `06. 11. 2025`, kept so; `2025-01-31`, `2025-02-28` → `2025-03-31` month by month; any other step between them) |
| `14:30` | `15:30` … (times hour by hour, or by the step between them) |
| a formula | the formula in each cell, its references moved as far as the cell is from the formula's: `=B1*2` filled down gives `=B2*2`; a reference with `$` keeps that part (`=$B$1*2`, see [[#References]]); one moved off the table is `#REF!` (references to another table move without that check). `[@column]` and `[column]` need no moving. A new formula needs *Store table metadata*: without it, the formulas' results are filled as values (as a series where they make one). |
| anything else | the selected cells over again |

* Each column of the selection (each row, filling right or left) is filled on its own: numbers in one column, days in the next.
* It fills within the table: dragging past its last row or column adds none. Rows pinned to the top or bottom (totals) and pinned columns are filled only from cells of their own: a fill from the other rows stops before them.
* It needs the `selection` module (the cells selected are what it fills from).
* Not while the table is sorted or filtered: the rows shown are not where the cells would go (the square does not show).
* Cells filled over keep the hidden tags they had (a cell's name).

### Custom series

Your own series, for words AutoFill should go round (quarters, statuses, sprints) or values it should go on with in a way of your own, are written in JavaScript, in a file of your space, and given to Silverware Table from Space Lua, as [[#Custom functions]] are. For example `Library/me/series.js`:

```js
export default () => [
  { name: "quarters", words: ["Q1", "Q2", "Q3", "Q4"] },
  { name: "status", words: ["todo", "doing", "review", "done"], alone: false },
  {
    name: "fiscal weeks",
    // FW52 → FW1: the year's weeks round, by the step between the weeks selected
    match: (values) => {
      const weeks = values.map((v) => Number(/^FW(\d+)$/.exec(v)?.[1]));
      if (!weeks.every((w) => w >= 1 && w <= 52)) return undefined;
      const step = weeks.length > 1 ? weeks[1] - weeks[0] : 1;
      return (i) => `FW${((((weeks[0] - 1 + i * step) % 52) + 52) % 52) + 1}`;
    },
  },
];
```

and in a `space-lua` block of any page (with a priority of its own, one below 50):

```lua
silverware.table.defineSeries(js.importFromSpace("Library/me/series.js"))
```

Then `Q3` filled down gives `Q4`, `Q1`, `Q2` (not `Q5`), and `todo`, `doing` gives `review`, `done`.

* The file's default export is the list of series, or a function that gets Silverware Table's helpers (below) and returns the list. Each has a `name` (letters, digits, `_` and spaces, starting with a letter) and either:
  * `words`: a list of two or more words to go round, matched as the built-in days and months are (any case, with or without diacritics; several selected a step apart go on by that step). Typed as your list writes them, the words are written so (`iPhone` → `iPad`, `L` → `XL`); typed otherwise, in the case of the first selected (`to do` → `in progress`). One word selected starts the series too, unless `alone: false`: then two are needed, and one is copied (for words also used otherwise, as `ne`, `po` are in Czech);
  * or `match(values)`: given the selected cells' texts (in their order, empty cells `""`), a function giving the text of each cell filled, or nothing when the values are not the series'. The function gets the cell's index: `0` to one less than the number of values are the values themselves, the cells after them (filling down or right) are counted on, those before them (up or left) are `-1`, `-2` … A number it gives is written as text. `alone` is for `words` only and is ignored with `match`, which decides itself how many values it takes (`if (values.length < 2) return undefined`).
* Your series are tried before the built-in ones (`dates`, `times`, `numbers`, `lists`, `numbered text`, in this order), so they can take values a built-in one would. One with a built-in series' name (in any case) replaces it, in its place (`lists`: your words instead of the days and months). Of two series of one name, the last defined counts.
* They must give their results at once. A `match` that throws, or gives something else, is no match (the next series is tried); a result that is not a text or a number gives that cell the value repeated. Both are logged in the browser's console.
* The helpers are `parseDate` (a date written as `2025-11-06` as `{ ms, time }`) and `formatDate` (written back).
* Series are defined again whenever SilverBullet loads Space Lua again; a change of the file shows after reloading the page. A mistake in a definition is shown in a notification until you close it, with the pages whose `space-lua` blocks call `silverware.table.defineSeries` and a button opening each; the other series are defined.

## Cell menu

Right-click a cell (on a touch screen: press and hold it; in the cell editor: the Menu key or Shift+F10) for its menu: the cell is selected (marked, not edited), and stays so afterwards for Ctrl+C and Delete. Right-click a cell of a selection for the selection's menu. A header (right-click or press and hold it, or the Menu key while its name is edited) gives its column's menu, the column selected, as its ⠿ grip does; with other cells selected along with it, the selection's menu. Shift+right-click, and a right click in the cell editor, give the browser's menu.

| Item | What it does |
|---|---|
| *Copy* | Copies the cell (the cells selected) as Ctrl+C does. |
| *Cut* | Cuts the cells as Ctrl+X does: copied and outlined, they move where they are pasted, see [[#Cut and paste]]. Not with a header among the cells selected (a column's name stays). |
| *Paste*, *Paste as new rows* | Pastes the clipboard from the cell (the top left one selected) as Ctrl+V (Ctrl+Shift+V) does, see [[#Pasting from a spreadsheet]]; with cells cut, *Paste (move N cells)* moves them. Greyed out where the page cannot read the clipboard or it holds nothing (cells cut move all the same). |
| *Clear* | Empties the cell (the cells selected) as Delete does; a header keeps its name. |
| *Move to…* | Moves the cells selected to the cell you click (tap) next, see [[#Moving cells]]. |
| *Insert function…* | Edits the cell (its formula, or a new one) with the *Functions* dialog, see [[#Functions]]. Needs *Store table metadata* for a new formula. |
| *AutoFill to…* | Fills from the cells selected to the cell you click (tap) next, see [[#AutoFill]]. |
| *Filter: = value* | Shows only the rows with this value in this column (with the values of the cells selected in one column: any of them). A column filtered by values already gets this one added: `=open\|blocked`. |
| *Filter: ≠ value* | Hides the rows with this value in this column. |
| *Delete N rows*, *Delete N columns* | On a selection: deletes the rows (columns) its cells are in. A table keeps at least one column. |

The menu of one cell is titled with the cell's name (*Cell: vat*), else its column and row; the pencil after the title names the cell, see [[#Named cells]]. A row is named in its row menu, see [[#Named rows]].

The menus of a cell, of a row and of a column keep one order, so the same actions are in the same place: first a bar of icons for the clipboard (*Copy*, *Cut*, *Paste* and, for rows, *+ Rows*: paste as new rows; their full names show on hover), then *Clear*, then inserting, moving and pinning, the column's type, sorting and filtering, and deleting last. Pairs of actions sit in one row of icon buttons after their name (*Insert* above / below, *Move* up / down, *Pin* top / bottom, *Sort*, *Filter* and its ×, *Align*); a button that cannot be used now is greyed out, and hovering it says why. The × at the title's right closes a menu, as Esc or a press beside it do.

Each comes from a module (`formulas`, `names`, `selection`, `paste`, `autofill`, `filters`, see [[#Settings]]): a module turned off leaves its items out, and with none left the right click gives the browser's menu.

## Pasting from a spreadsheet

Copy cells in Excel, Google Sheets or LibreOffice, click a cell of a table (selected or edited) and paste:

* **Ctrl+V** pastes them from that cell to the right and down, over the cells there. Where the table ends, rows and columns are added (before the rows and columns pinned to the bottom and right).
* **Ctrl+Shift+V** overwrites nothing: the pasted rows are added as new rows at the cell's row (under the header when pasted there). Columns are added where the rows are wider than the table.
* Cells with a formula keep it; the values pasted onto them are left out (the message says how many). In new rows, a calculated column's cell gets its formula unless a value is pasted into it, see [[#Formulas]]. Names of rows and cells stay with their cells.
* Pasted onto the header, the first row names the columns; an empty value keeps the old name.
* Spreadsheets copy values as they show them (`1 234,50 Kč`), not their formulas. A line break inside a cell becomes a space, as a markdown table cell has one line.
* A single value (no tab, no line break) is pasted into the cell's editor as usual.
* **Paste** and **Paste as new rows** in the cell menu (right click, or a long press or a tap on cells selected on a touch screen) do the same as Ctrl+V and Ctrl+Shift+V from the first cell selected; a single value goes straight into that cell. They read the clipboard, whatever application filled it: the browser may ask first, or show its own *Paste* button. In Chrome, once reading is allowed, *Paste* is greyed out while the clipboard holds no text (checked when you come back to the page and on each click). A page opened over plain http (SilverBullet on a phone in your network, without https) may not read the clipboard at all: there *Paste* is greyed out, and Ctrl+V or the keyboard's paste in a cell's editor still work.
* The paste is one edit: one Ctrl+Z undoes it. It is not possible while the table is sorted or filtered, as the rows shown are not where the cells would go.
* Ctrl+V and *Paste* paste from the top left cell selected, as a spreadsheet does.

## Moving cells

**Drag them by their edge**: with a mouse, point at the edge of the cells selected (the pointer becomes a move cross), press and drag: the cells where they would go are outlined, with their address (`B4:C5`); let go to move them there. Hold **Ctrl** while letting go to copy them instead, as in a spreadsheet (`+` shows before the address). Esc cancels.

**Move to…** in the menu of the cells selected (on a touch screen: tap them, or press and hold), then click (tap) the cell where the first of them goes: they move there. With a mouse, where they would go is outlined under the pointer, with its address, as while dragging them. Meanwhile the page scrolls as usual; Esc, or a press outside the table, cancels.

* They move as with cut and paste (below): with their formulas, over what the cells there held, names staying where they are; one edit, one Ctrl+Z.
* A copy writes a formula with its references moved as far as the cell is (`=A1*2` copied a row down is `=A2*2`), as AutoFill does; the cells written over keep their names.
* They stay within the table: no rows or columns are added, and they go under the header. Not while the table is sorted or filtered, nor with the header among them.
* Formulas elsewhere that refer to the cells moved are not changed, and a formula moved keeps its references as written (a spreadsheet would follow them).

### Cut and paste

Select cells and press **Ctrl+X** (or *Cut* in their menu): they are copied, as Ctrl+C copies them, and outlined with a dashed line; nothing changes yet. Paste into the same table, with Ctrl+V on a cell or *Paste (move N cells)* in its menu: the cells move there, as in a spreadsheet, as one edit (one Ctrl+Z).

* They move with their formulas, written over what the cells there held (formulas there too); where they were, the cells are left empty. Names stay where they are: a row's name with its row, a cell's name with its place, at both ends, so formulas using them still find them. Where the table ends, rows and columns are added, as for any paste.
* A formula that moves keeps its references as written (`=A1*2` still refers to A1); formulas elsewhere that refer to the cells moved are not changed.
* The cut ends with Esc, another copy, a change of the cells cut, or rows or columns added or deleted: what is pasted then is a copy. If the clipboard holds something else when you paste (copied in another application), that is pasted, and the cells cut stay.
* Within one table: pasted into another table, the cells are copied, not moved.
* Header cells are not cut (a column keeps its name), and cells cut move under the header, not into it: with the header in the selection, Ctrl+X only copies. Sorted or filtered, cells are copied, not cut.
* Ctrl+V in a cell being typed in pastes the text into it, as usual; a move needs the cell selected (Ctrl+V then opens it for the paste) or *Paste (move N cells)* in the menu.
* On a touch screen, *Cut* and *Paste (move N cells)* work also where the page cannot read the clipboard (SilverBullet over plain http): moving needs no reading.

## Showing the markdown

A plain click edits a cell and no longer switches the table to its markdown. To see or edit the markdown:
* hover the table and click *Edit markdown* in the ⋯ menu of the toolbar above it, or
* Alt+click a cell: the cursor lands in that cell (at the clicked character, for plain text).

## Sorting

* Click the ⇅ control that appears in a column header on hover (on a touch screen it is always shown): ascending, descending, then back to the order as written. The column menu (see [[#Rows and columns]]) has the same options.
* Sorting only changes what you see, never the markdown, unless the *Store table metadata* setting is on: then the sorting is also stored in the table, see [[#Table metadata]].
* While sorted, the toolbar shows *Sorted by …*; its × shows the rows as written again, and its ✓ sorts the rows in the markdown that way (after asking) and ends the sorting view. Rows a filter hides are sorted too, pinned rows stay where they are, and one Ctrl+Z undoes it.
* Numbers sort as numbers (`1 000`, `2,5`, `-3`, `15 %`, `12,99 €`, `$5`, `3 kg` included); empty cells always come last.
* A row you are editing (or have just added) stays where it is while you type and Tab through its cells; it moves to its place once you leave it (Escape, Enter, another row, a click elsewhere).

## Filtering

* **One column**: the filter icon after *Filter* in its column menu opens its filter in a bubble under the header, nothing in the table moves; the × beside it removes the column's filter (greyed out while the column has none). In the bubble, the × in the field clears what is typed, the × beside the field closes the bubble (as Esc does), the filter kept. While a column filters, its header shows a filter icon: click it to change the filter.
* **All columns**: the filter icon in the table's toolbar shows a filter field under each header; click it again to hide them. Hidden, the filters still apply.
* While filtered, the toolbar shows *3 of 10 rows*; its × clears all filters. A field's × clears that one.
* Under the field you type in, a bubble shows what it understands (click one to put it in the field) and, for a column with up to 12 different values, those values with how many rows have each: tick them to show only those rows (`=open|blocked`).
* A row you are editing (or have just added) stays shown until you leave it, even when the filters do not match it.
* With *Store table metadata* on, the filters are stored in the table once you leave their field, so it shows filtered next time too (see [[#Table metadata]]). Filtering is a module: see [[#Settings]] to turn it off.

Plain text is found anywhere in a cell, ignoring case and diacritics (`cesky` finds `Český`). With *Smart filters* (on by default, see [[#Settings]]) a field also understands:

| Filter | Shows cells that |
|---|---|
| `>10` `>=10` | are numbers above 10 |
| `<10` `<=10` | are numbers below 10 |
| `/pattern/` | match a regular expression |
| `/pattern/c` | match it, with case |
| `=text` | are exactly `text` |
| `a\|b` | match `a` or `b` (each may be any filter: `<2\|>10`) |
| `=a\|b` | are exactly `a` or `b` (`=\|a`: also empty cells) |
| `!filter` | do **not** match `filter` |

* Number filters hide cells that are not numbers. Numbers are read as for sorting.
* Regular expressions ignore case unless flagged `c` (other flags: `m`, `s`, `u`), and see the cell text as shown, e.g. the alias of a link. Example: `/^item 1[0-9]$/`.
* `=text` ignores case and diacritics, like plain text.
* `!` works in front of any filter: `!done`, `!>10`, `!/^$/` (cells that are not empty), `!=open|done` (neither).
* A filter that is still being typed (only `>`, or a regular expression without its closing `/`) does not filter yet.
* An invalid regular expression filters nothing; its field turns red and its tooltip says why.

## Formulas

With the *Store table metadata* setting on (see [[#Settings]]), type a formula into a body cell, starting with `=`: `=B1*2`, `=SUM(B1:B3)`, `=SUM([qty])`. Silverware Table writes the result into the cell, followed by the formula in a hidden `<meta>` tag:

```
| Name  | Qty |
| ----- | --: |
| Pear  |   3 |
| Apple |  10 |
| Total |  13 <meta formulas.f='=SUM([qty])'> |
```

* Formulas are metadata, as the sorting stored in a table is: with the setting off, a typed formula is saved as text (Silverware Table says so, and shows it while it is typed). Formulas already in a table keep working: they can be edited, are recalculated, and fill new rows of calculated columns.
* SilverBullet and browsers show only the result, other renderers (GitHub, Obsidian) drop the tag. Queries over the table (`index.tag "table"`) see the cell's text with the tag, e.g. `13 <meta formulas.f='=SUM([qty])'>`.
* Hidden tags are written with their values in apostrophes, so the quotes of a formula's texts stay as typed (`<meta formulas.f='=IF([@status]="done", "✓", "")'>`); an apostrophe in a value is written `&#39;`, a `>` `&gt;` (SilverBullet ends a tag at its first `>`). Tags written by hand with quotes (`formulas.f="…"`) are read too.
* Saving a formula fixes mistakes that have only one possible fix, and says what it changed: missing `)` at the end are added (`=SUM(A1:A3` becomes `=SUM(A1:A3)`), a text in quotes or a `[column]` left open at the end is closed, and extra `)` at the very end are dropped. Anything else stays as typed and shows `#ERROR!`.
* **Calculated columns**: when every row of a column holds the same formula, such as `=[@qty]*[@price]`, a new row (the **+** on a border, Ctrl+Enter, Tab on the last cell, *Insert row*) gets it too. Total rows (with a formula over a whole column, such as `=SUM([qty])`) do not count.
* Click the cell to edit its formula. Typing a plain value removes the formula. To type a text that starts with `=`, start it with `'=`; such a text opens with the `'` again, so it stays text.
* Results are written whenever Silverware Table edits the table, in the same edit (one Ctrl+Z undoes both). Viewing a table never changes it. The toolbar of a table with formulas has *Recalculate* (the ↻ icon), which writes the current results; it is highlighted when some are out of date, e.g. after the table was changed outside Silverware Table (by typing in the markdown), and the table's tab says *Out of date* without hovering it (with the `tableLabels` module).
* A formula's result has a dotted underline; hover it to see its formula, or why it shows an error.
* Numbers are read as for sorting (`12,99 €`, `1 000`, `15 %`). Results use a decimal comma when most numbers in the table do. A text that is not read as a number (e.g. `1,234.50`, with a thousands comma) is skipped by `SUM` and the other number functions.

### References

| Reference | Means |
|---|---|
| `B1` | Column B, the first row under the header |
| `A1:B3` | The range from A1 to B3 |
| `$A$1`, `A$1`, `$A1` | A1 with its column, its row or both kept where they are when the formula is filled into other cells (in ranges too: `$A$1:B3`); F4 in a formula cycles them |
| `[qty]` | The whole column named Qty (written by its key, see below), without the table's total rows: rows with a cell whose formula refers to its own whole column (a total or an average under it) |
| `[qty:2]` | The second column named Qty, when several share the name |
| `[@qty]` | The Qty cell in the formula's own row, e.g. `=[@price]*[@qty]` |
| `[@[jan]:[mar]]` | The formula's own row from the column Jan to Mar, e.g. `=SUM([@[jan]:[mar]])`, as Excel's tables write it; the formula's own column outside it, else `#CYCLE!` |
| `prices![@price]`, `prices![@[jan]:[mar]]` | The same of a table by its name: of its own, its row; of another table, that table's row of the same number (the formula in the third row reads prices' third row; a row prices does not have is `#REF!`) |
| `[#Data]`, `prices![#Data]` | The table's whole body, every row and column, as Excel's tables write it, without its total rows (as `[qty]`; a row with a formula using its own table's `[#Data]` is one too): for the array functions, e.g. `=TEXTJOIN(", ", TRUE, CHOOSECOLS(FILTER(prices![#Data], prices![price] > 10, ""), 1))` (see [[#Arrays]]) |

* Edits made with Silverware Table keep references on their cells, as in a spreadsheet: inserting, deleting, moving and sorting rows (*Sort the rows in the markdown*), and inserting, deleting and moving columns. A row inserted inside a range widens it, a deleted one narrows it, and a reference to deleted cells becomes `#REF!`. Renaming a column renames its `[Name]` references.
* Edits made in the markdown do not change references. `[qty]` and `[@qty]` are not affected by added or moved rows at all, so they are the safest choice for totals.
* `A1` counts rows in the markdown, not as a sorting or filter shows them.
* Column names match as SilverBullet's queries name columns: in lower case, with every run of other characters than `A-Z`, `a-z` and `0-9` as one `_`. So `[Unit price]`, `[unit price]` and `[unit_price]` are the same column, the one a query reads as `unit_price`. Letters with diacritics count as other characters there too (`Množství` is `mno_stv_`), so names that differ only in them are the same name; `[Name:2]` tells them apart. Silverware Table writes column references by that key, as a query names the column: a formula saved as `=[@Unit price]*2` is stored as `=[@unit_price]*2`, and clicking a header inserts `[unit_price]`. References to a column the table does not have stay as typed (and show `#REF!`).
* A `$` only matters where a formula is filled into other cells: edits made with Silverware Table move `$A$1` with its cell as they move `A1`, as a spreadsheet does.
* **Point instead of typing**: where the formula expects a reference (after `=`, `(`, `,` or an operator, not inside a text in quotes), the pointer over the table becomes a move cursor: click a cell to insert it, drag across cells for a range, or click a column's header for `[Name]`. Pointing again right away replaces that reference, Shift+click extends its range. After a typed reference or another complete operand, a click ends editing as usual.
* While you edit a formula, each reference is outlined in the table in its own color. Drag an outline's edge to move the reference, a range's corner to resize it; Esc while dragging puts it back.
* Under the cell, the formula shows with its references in the same colors, and help for the function the cursor is in: its syntax, with the argument being typed underlined (`ROUND(number, `**`[digits]`**`)` after `=ROUND(A1, `), and what it does.
* **Functions and names as you type them**: `=A` lists the functions whose names start so (`ABS`, `AND`, `AVERAGE`; your custom functions too) and the names of the page that do: named cells, named rows of the table and named tables, marked as such. After `[` or `[@` it lists the table's columns (`=[@Qu` offers `Qty`), and puts one in with its `]`. A name typed in full comes first, the page's names before the functions. Under the list is the picked one's syntax and description. ↑ / ↓ pick another, Tab or a click inserts it: a function with its `(` (`=AVERAGE(`), a row with its `[` (`=pear[`), a table with its `!` (`=prices!`), a cell as its name. Enter always saves the formula as typed, as in a spreadsheet, so `=day` saves a reference to a cell named `day` even though `DAY` is a function. Esc closes the list and leaves what is typed. Elsewhere Tab moves to the next cell, as usual.

### Named columns

A column can have a name of its own, by which formulas and the stored sorting name it whatever its header says: renaming the header (also in the markdown) breaks nothing, nor references to the column from other pages. Open the column's menu (the ⠿ grip above the column, or right-click its header), click the pencil after its title, type the name (letters, digits and `_`) and press Enter (Esc leaves it as it was); an empty name removes it. A name that cannot be used is refused with why, under the field. Named, the menu's title is the name.

* It is stored in the header cell as a hidden `<meta core.n='price'>`: `| Unit price <meta core.n='price'> |`. SilverBullet does not show it, and a query still reads the column as `unit_price`. The header has a mark in its corner; hover it for the name.
* `[price]` is the column with that name before any column whose header is Price, which is then `[price:2]`.
* Setting or removing it rewrites the references to the column on the page: `[unit_price]` becomes `[price]`.
* Editing the header changes only the header's text: the column's name stays. It needs the *Store table metadata* setting, as formulas do; *Remove metadata* removes it.

### Named cells

A cell can have a name, by which formulas use it: in its own table by the name alone (`=[@price]*(1+vat)`), in another table with its table's name (`=[@price]*(1+rates!vat)`), on another page with the page's too (`[[Prices]]rates!vat`). The name stays with the cell wherever it is moved (also in the markdown), so such references never need to change. Open the cell's menu (right-click it, see [[#Cell menu]]), click the pencil after its title, type the name (letters, digits and `_`) and press Enter; an empty name removes it.

* It is stored in the cell as a hidden `<meta core.cn='vat'>`: `| VAT | 0.21 <meta core.cn='vat'> |`. A named cell has a mark in its corner; hover it for the name.
* A name is its table's: two cells of a table cannot have the same one, cells of different tables can. It cannot be a function's name or read as a cell (`A1`). A name alone is always the formula's own table's; another table's cell needs that table to have a name (the pencil in the title of its toolbar's ⋯ menu).
* A formula written with another table's cell name alone (as written before a cell's name was its table's) keeps its result until the table is recalculated (its *Recalculate* is highlighted), then shows `#NAME?` saying how to write it; saving the formula writes it so itself (`vat` becomes `rates!vat`, also `[[Prices]]vat`) where one named table of the page has that name.
* When a table with named cells is edited, the tables that use them get their new results in the same edit. When the cell is changed in the markdown, *Recalculate* is highlighted.
* Editing the cell changes its value only: the name stays. It needs the *Store table metadata* setting; *Remove metadata* removes it.

### Named rows

A row can have a name, by which formulas use its cells: `pear[price]` is the Price cell of the row named pear, `prices!pear[price]` of the table named prices, `[[Shop]]prices!pear[price]` on another page. The name stays with the row wherever it is moved or sorted (also in the markdown), and does not depend on what the row's cells say. Open the row's menu (the ⠿ grip left of the row), click the pencil after its title (*Row 3*, or the row's name), type the name and press Enter; an empty name removes it.

* It is stored in the row's first cell as a hidden `<meta core.n='pear'>`: `| Pear <meta core.n='pear'> | 12 |`, as a column's name is in its header. A named row has a mark in the top left corner of its first cell; hover it for the name. A first cell that is also a named cell holds both in one tag: `<meta core.n='pear' core.cn='first'>`.
* The name alone is the row's cells as a range, as `[price]` is a column's: `=SUM(pear)`, `=MAX(prices!pear)`. It is every cell of the row: a formula in that row is in its own range, `#CYCLE!` (put a row's total in another row, or another table). Left as a cell's result (`=pear*2`), it is `#SPILL!` (several values). A cell named as the row (see [[#Named cells]]) goes first. In an Excel file it is the row's cells (`SUM(A2:D2)`).
* A row's name is its table's: two rows of a table cannot have the same one. The column after it is written as any column reference (`[price]`, a column's name, `[price:2]`) and follows the column when it is renamed or moved.
* `XLOOKUP("Pear", prices![name], prices![price])` does the same by a key column's value; a row's name works without one, and is not changed by editing the row's cells.
* Deleting the column that holds rows' or cells' names removes the names with it: Silverware Table says which and asks first, as the formulas that use them then show `#REF!` or `#NAME?`.

### Other tables

A formula can use the cells of another table on the same page, once that table has a name (see [[#Table names]]): the name and `!` go before the reference.

| Reference | Means |
|---|---|
| `prices!B2` | Cell B2 of the table named prices |
| `prices!A1:B3` | A range of it |
| `prices![price]` | Its column Price, without its total rows (as `[price]` in its own table) |

```
| Fruit | Qty | Total                                                  |
| ----- | --: | -----------------------------------------------------: |
| Pear  |   3 | 38.97 <meta formulas.f='=[@qty]*XLOOKUP([@fruit], prices![name], prices![price])'> |
```

* `XLOOKUP(value, lookup_range, result_range)` finds a value in one column and gives the one beside it in another: the usual way to take a price, a rate or a name from another table, whatever its order. See [[#Functions]].
* The other table's formulas are calculated too, so a total over its column is up to date, and tables can refer to each other in turn (not in a circle: that is `#CYCLE!`).
* When Silverware Table edits a table, the tables that refer to it get their new results in the same edit (one Ctrl+Z undoes both). When the other table is changed in the markdown, *Recalculate* in the toolbar is highlighted.
* `[@column]` is always the formula's own row: another table's rows are reached with `XLOOKUP` or by cell.
* References to another table follow its edits made with Silverware Table, as references in a table do (see [[#References]]): `prices!B2` follows its rows and columns when they are inserted, deleted, moved or sorted into the markdown, `prices![price]` a renamed or moved column, and a reference to deleted cells becomes `prices!#REF!`. Renaming the table (the pencil in its ⋯ menu's title) renames the references to it on the page; an empty name removes it. Edits made in the markdown do not change references.
* **Two tables of one name** (a table copied in the markdown with its metadata row): formulas use the first of them on the page, and edits of the others do not move references. A message at the top says so until you close it, and each such table's name shows in red in its toolbar, whether the toolbar shows names or not: click it to rename the table.

### Tables on other pages

The page's name in double brackets goes before the table's name: `[[Prices]]fruit!B2`, `[[Shop/Prices]]fruit![price]`, `XLOOKUP([@name], [[Prices]]fruit![name], [[Prices]]fruit![price])`.

* Silverware Table reads the other page when a table that refers to it shows, and again each time it writes that table (or one it refers to), so the results written are up to date. When the other page is changed (SilverBullet indexes it again), *Recalculate* in the toolbar is highlighted.
* The other page's formulas are calculated too, and references there without a page are to tables on that page.
* Edits on the other page do not change the references to it here, and renaming that page or its table leaves them showing `#REF!`. Column references (`[[Prices]]fruit![price]`) and `XLOOKUP` keep working when its rows are moved.
* The page is the name as SilverBullet writes it in links, without `#` or `|`.
* With the `pageLinks` module off (see [[#Settings]]) Silverware Table reads no other page: formulas that refer to one keep the results they have, and a new one shows `#REF!`.

### Sources of the space

A script can give formulas a table of the space, built from a query: `silverware.table.defineSource({ name, data, columns })` in a `space-lua` block of yours names it and the function that gives its rows, and formulas read it as `@name`:

```lua
local function tasks()
  return query[[from t = index.tag "task" select { name = t.name, page = t.page, due = t.due, done = t.done }]]
end

silverware.table.defineSource({
  name = "tasks",
  columns = { "name", "page", "due", "done" },
  data = tasks,
})
```

* `@tasks[due]` is a column of it, `@tasks` (or `@tasks[#Data]`) all its rows: `=COUNTIFS(@tasks[done], "FALSE")`, `=XLOOKUP([@id], @users[id], @users[email])`, a view `=FILTER(@tasks[#Data], @tasks[done] = "FALSE")`, a pivot of it (`pivot.source='@tasks'`, or *Sources of the space* in the pivot dialog's *Source*). A source has no cells to refer to (`@tasks!A1`) and no row of the formula's (`@tasks[@due]`): a query's rows have no fixed order.
* `data` is a function returning a list of records, each a row: its columns are the first record's keys, then the keys new in later ones, in the order the script sets them. `columns` (optional) gives another order, or some of them only; give it where the query may return nothing, so the columns are known then too. A list of plain values (`select p.name`) is one column, `value`.
* Values are written as text: numbers and texts as they are, `true` and `false` as `TRUE` and `FALSE`, a list as its values joined by a comma (`money, review`), `nil` and an object as an empty cell.
* Its name is a table's (letters, digits and `_`, not starting with a digit), compared ignoring case; `@` keeps it apart from the page's tables.
* The function runs when Space Lua loads, and again a moment after SilverBullet indexes a page, so the source follows the space. Nothing is written by it: a table whose formulas read a source that changed has *Recalculate* highlighted, a view or pivot of it *Out of date*; click to write the new results. A function that fails, or returns no list, is shown in a notification (once, until the problem changes); the source keeps the rows it had.
* While a source has not run yet (or with the `sources` module off), formulas reading it keep the results they have; a source no script defines is `#REF!`.
* `@` typed in a formula offers the sources, and `@tasks[` their columns. In an Excel file a formula reading a source is written as its value.
* A `#choice` column can take its values from a source: see [[#Choices]].
* `silverware.table.evaluate` reads sources too, but a `${…}` is not shown anew as a source changes (it follows the pages it read): it shows the source as it was when it was rendered.

### Operators and values

* `+ - * / ^` (power), `%` after a number (`50%` is 0.5), `&` joins text, `= <> < > <= >=` compare (numbers as numbers, text ignoring case).
* Numbers with a decimal point (`1.5`), text in double quotes (`"a ""quoted"" word"`), `TRUE`, `FALSE`.
* Function arguments are separated by `,` or `;`. Function names may be in any case.

### Arrays

`FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, `DROP`, `HSTACK` and `VSTACK` work on arrays, as Excel 365's do: a range of several rows and columns (`A1:C9`), a column (`[qty]`, `prices![price]`), a whole table (`prices![#Data]`), or the result of another of them. They keep the rows and columns of what they get, so `SORT(prices![#Data], 2, -1)` sorts whole rows by the second column. `SEQUENCE` makes one of numbers (at most 1,048,576 of them).

* **A cell holds one value**, so use them inside a function that makes one of the array: `=COUNTA(UNIQUE([assignee]))` (how many people), `=SUM(FILTER(orders![amount], orders![status] = "paid"))`, `=TEXTJOIN(", ", TRUE, SORT(UNIQUE([tag])))` (a sorted list in one cell), `=SUM(TAKE(SORT([score], 1, -1), 3))` (the three highest). In a calculated column, per row: `=TEXTJOIN(", ", TRUE, FILTER(tasks![name], tasks![assignee] = [@name], ""))` (the names of their tasks), `=SUM(FILTER(tasks![hours], tasks![assignee] = [@name], 0))`.
* An array of one value is that value: `=TAKE(SORTBY(people![name], people![score], -1), 1)` is who scored most.
* A table made of an array, kept up to date, is a view: see [[#Views]].
* An array of several values left as a cell's result is `#SPILL!` (Excel would spill it into the cells around; here a cell keeps one value). Its values can still be seen: hover the cell (or select it) and click ⤢ at its corner, or pick *Show result* in its menu (Ctrl+Shift+Enter on the cell selected). The result shows over the window as a table, read only: the formula and its size above it, ⧉ copying it all (for Excel, or to paste as a new table), × or Esc closing it. At most 2,000 rows are drawn; the copy has every one. *Copy result* in the cell's menu copies it without showing it. Ctrl+C copies what the cell shows, `#SPILL!`.
* `FILTER` keeping nothing is `#CALC!`; its third argument says what to give then: `=SUM(FILTER([amount], [paid], 0))` is 0, not an error. `COUNTA` counts an error as a value (as in Excel), so to count what a condition keeps use `COUNTIFS` (`=COUNTIFS(tasks![assignee], [@name])`), not `COUNTA(FILTER(…))`.
* `HSTACK` puts arrays side by side, `VSTACK` one under another; one shorter (or narrower) than the others is padded with `#N/A`, as in Excel, and an argument that is an error (a `FILTER` keeping nothing) makes the whole result that error. In a view, `HSTACK` adds a calculated column beside a table's: `=HSTACK(CHOOSECOLS(FILTER(tasks![#Data], tasks![done] = FALSE), 1), "[[" & FILTER(tasks![page], tasks![done] = FALSE) & "]]")` (each open task and a link to its page).
* Operators work on a column or a row cell by cell, as on ranges (`FILTER([name], [qty] * [price] > 100)`); on an array of several rows and columns they are `#VALUE!` for now: pick a column first (`CHOOSECOLS`).

### Dates

* A date is written as cells write it: `2025-11-06`, with a time `2025-11-06 14:30` (or `14:30:15`). Formulas read dates written so, in cells and in quotes (`"2025-11-06"`), and write the dates they give the same way, so the markdown stays readable and a `#date` column shows them as the locale writes dates (see [[#Column types]]).
* As in a spreadsheet, a number added to a date is days, a fraction of a day a time: `=[@start]+7` is a week later, `=[@start]+0.5` twelve hours later. A date minus a date is the days between them, with a fraction for the time: `=[@end]-[@start]`.
* A time is written `14:30` (or `9:05:30`), a length of time the same way with as many hours as it has (`40:00`). Formulas compute with times and write time results so: `=[@end]-[@start]` of `17:30` and `9:00` is `08:30`, `=SUM([hours])` of `14:00` and `20:00` is `34:00`, a time times or divided by a number is a time. Times compare by length (`9:05` is before `14:30`). Where a number is expected, a time is a fraction of a day, as in spreadsheets (`12:00` is 0.5). The hours of a time as a number are the time divided by an hour, `=[@total]/"1:00"` (minutes: `/"0:01"`); unlike in a spreadsheet, `*24` gives a time 24 times as long. So a text such as `3:15` is a time in formulas too.
* A time added to a date gives the date at that time: `=DATE(2025, 11, 6) + TIME(14, 30)` or `=[@day] + [@at]` is `2025-11-06 14:30`. A `#time` column shows times of day as the locale writes them.
* `TEXT` writes a date or a time in another format: `=TEXT([@due], "dd.mm.yyyy")`, `=TEXT([@total], "[h]:mm")`. For days and hours of a length of time: `=INT([@total]) & " d " & HOUR([@total]) & " h"` gives `1 d 10 h` for `34:00`.
* `DATEADD` adds seconds, minutes, hours, days, weeks, months or years: `=DATEADD([@start], 90, "min")`, `=DATEADD(A1, -1, "y")`. Months and years go by the calendar: a month after January 31 is February 28 (29 in a leap year).
* `DATEDIF` counts whole units between two dates: `=DATEDIF([@born], TODAY(), "y")` is an age in years.
* Dates and times are taken as written, with no time zone: an hour added across the change to summer time is an hour on the clock.
* `TODAY()` and `NOW()` give the date (and time) when the table is calculated, and the result is written into the cell. It does not change by itself: when it is out of date, *Recalculate* in the toolbar is highlighted.

### Functions

The *Functions* dialog shows them all: **Functions…** (fx) under a formula being edited, Shift+F3 in it, or *Insert function…* in a cell's menu. Search by a name or by what a function does (`date`, `decimal places`), or pick a group (*Math*, *Logic*, *Text*, *Date & time*, *Lookup & table*, *Custom* for your own); each shows its syntax, what it does and an example. ↑ / ↓ pick one, Enter (or *Insert*, or a double click) puts it into the formula where the cursor was, in place of a name typed there (after a `+` where it would follow a value: `=A1` gives `=A1+SUM(`); Esc leaves the formula as it was. The cell's editor stays open behind the dialog.

| Function | Description |
|---|---|
| `SUM(number1, [number2], …)` | Adds numbers, cells and ranges; times add up to a time (14:00 and 20:00 are 34:00). |
| `AVERAGE(number1, [number2], …)` | The arithmetic mean of the numbers, or of the times. |
| `MIN(number1, [number2], …)` | The smallest of the numbers (0 if there are none), the shortest of the times, or the earliest of the dates. |
| `MAX(number1, [number2], …)` | The largest of the numbers (0 if there are none), the longest of the times, or the latest of the dates. |
| `PRODUCT(number1, [number2], …)` | Multiplies the numbers. |
| `COUNT(value1, [value2], …)` | How many of the values are numbers. |
| `COUNTA(value1, [value2], …)` | How many of the values are not empty. |
| `SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2, criteria2], …)` | Adds the cells of sum_range in the places whose cells meet every condition: a value, ">10", "<>done", "app*" (* any text, ? one character), "" (empty) or "<>" (not empty). |
| `COUNTIFS(criteria_range1, criteria1, [criteria_range2, criteria2], …)` | How many places of the ranges have cells that meet every condition: a value, ">10", "<>done", "app*" (* any text, ? one character), "" (empty) or "<>" (not empty). |
| `AVERAGEIFS(average_range, criteria_range1, criteria1, [criteria_range2, criteria2], …)` | The arithmetic mean of the cells of average_range in the places whose cells meet every condition: a value, ">10", "<>done", "app*" (* any text, ? one character), "" (empty) or "<>" (not empty). None: `#DIV/0!`. |
| `MAXIFS(max_range, criteria_range1, criteria1, [criteria_range2, criteria2], …)` | The largest of the cells of max_range in the places whose cells meet every condition: a value, ">10", "<>done", "app*" (* any text, ? one character), "" (empty) or "<>" (not empty). None: 0. |
| `MINIFS(min_range, criteria_range1, criteria1, [criteria_range2, criteria2], …)` | The smallest of the cells of min_range in the places whose cells meet every condition: a value, ">10", "<>done", "app*" (* any text, ? one character), "" (empty) or "<>" (not empty). None: 0. |
| `SUMPRODUCT(array1, [array2], …)` | Multiplies the ranges' cells in the same places and adds the products; a cell that is not a number counts as 0. |
| `MEDIAN(number1, [number2], …)` | The middle of the numbers (or of the times) in order; of an even count, the mean of the two in the middle. |
| `LARGE(array, k)` | The k-th largest of the numbers (or of the times): LARGE(A1:A9, 1) is the largest. |
| `SMALL(array, k)` | The k-th smallest of the numbers (or of the times): SMALL(A1:A9, 1) is the smallest. |
| `RANK(number, ref, [order])` | The number's place among the numbers of ref: 1 for the largest (order 0, the default), or for the smallest (order 1); equal numbers share a place. |
| `STDEV(number1, [number2], …)` | The standard deviation of the numbers as a sample (divided by their count less one); of times, a time. |
| `INT(number)` | The number rounded down to a whole number; for a time, its whole days (INT(SUM(A1:A2)) of 14:00 and 20:00 is 1). |
| `ROUND(number, [digits])` | Rounds to the given number of decimal places (default 0), halves away from zero. |
| `ROUNDUP(number, [digits])` | Rounds away from zero to the given number of decimal places (default 0; negative: tens, hundreds…). |
| `ROUNDDOWN(number, [digits])` | Rounds toward zero to the given number of decimal places (default 0; negative: tens, hundreds…). |
| `MROUND(number, multiple)` | Rounds to the nearest multiple, halves away from zero. Of a time, a time: MROUND("9:08", "0:15") is 09:15. |
| `CEILING(number, [significance])` | Rounds up to a multiple of the significance (default 1). Of a time, a time: CEILING("9:07", "0:15") is 09:15. |
| `FLOOR(number, [significance])` | Rounds down to a multiple of the significance (default 1). Of a time, a time: FLOOR("9:07", "0:15") is 09:00. |
| `MOD(number, divisor)` | The remainder after dividing the number by the divisor, with the divisor's sign. Of a time, a time: MOD([\@end] - [\@start], 1) is the length of a shift past midnight. |
| `ABS(number)` | The number without its sign. |
| `IF(condition, value_if_true, [value_if_false])` | One value if the condition is true, another if it is false (default FALSE). |
| `IFERROR(value, value_if_error)` | The value, or the second value if the first is an error. |
| `AND(logical1, [logical2], …)` | TRUE if all of the values are true. |
| `OR(logical1, [logical2], …)` | TRUE if any of the values is true. |
| `NOT(logical)` | TRUE if the value is false, FALSE if it is true. |
| `ISNUMBER(value)` | TRUE if the value is a number, a time or text that reads as a number (12.5, 12,99 €, 15 %), as COUNT counts them; FALSE otherwise. |
| `CONCAT(text1, [text2], …)` | Joins the values into one text. |
| `TEXTJOIN(delimiter, ignore_empty, text1, [text2], …)` | Joins the values (ranges too) into one text with the delimiter between them; with ignore_empty TRUE, empty ones are left out: TEXTJOIN(", ", TRUE, [name]). |
| `LEN(text)` | How many characters the text has. |
| `MID(text, start, count)` | The given count of characters of the text, from the start (1 is the first character). |
| `SEARCH(find_text, within_text, [start])` | Where find_text first is in within_text, from the start (default 1, the first character), ignoring case; * any text, ? one character, ~ before either for itself. Not found: `#VALUE!`. |
| `REGEXTEST(text, pattern, [case_sensitivity])` | Whether text matches the regular expression pattern anywhere in it (^ and $ for its start and end), as Excel 365's: TRUE or FALSE; case_sensitivity 0 (the default) tells upper and lower case apart, 1 does not. A pattern that is no regular expression: `#VALUE!`. |
| `SUBSTITUTE(text, old_text, new_text, [instance])` | The text with old_text (matching case) replaced by new_text: everywhere, or only its instance-th occurrence. |
| `UPPER(text)` | The text in capital letters. |
| `LOWER(text)` | The text in small letters. |
| `PROPER(text)` | The text with each word's first letter capital and the others small. |
| `TRIM(text)` | The text without spaces at its start and end, and with one space where there were several. |
| `ROW()` | The row of the cell the formula is in, counted in the table as written: 1 is the first row under the header. =ROW() in every row of a column numbers the rows. |
| `XLOOKUP(value, lookup_range, result_range, [if_not_found], [match_mode], [search_mode])` | Finds the value in one range or column and gives the value in the same place of another, e.g. XLOOKUP("Pear", prices![Name], prices![Price]); text is found ignoring case. Not found: if_not_found, else `#N/A`. match_mode: 0 the same value (the default), -1 or else the next smaller, 1 or else the next larger, 2 with wildcards (* any text, ? one character). search_mode: 1 from the first (the default), -1 from the last. |
| `FILTER(array, include, [if_empty])` | The rows of the array (a range, a column, a whole table) for which include is TRUE, e.g. FILTER(tasks![name], tasks![done] = FALSE); include as long as the array's rows, or a row as wide as its columns to keep columns. Nothing kept: if_empty, else `#CALC!`. |
| `SORT(array, [sort_index], [sort_order], [by_col])` | The array's rows sorted by one of its columns, sort_index (1, the first, by default): sort_order 1 ascending (the default) or -1 descending; numbers, then text ignoring case, then logical values, empty cells last. by_col TRUE sorts its columns by a row. |
| `SORTBY(array, by_array1, [sort_order1], …)` | The array's rows sorted by other columns of as many rows, the first by_array first, each with its sort_order: 1 ascending (the default) or -1 descending, e.g. SORTBY(people![name], people![score], -1). Rows as wide as the array's columns sort its columns. |
| `UNIQUE(array, [by_col], [exactly_once])` | The array's rows, each once, in their order (text compared ignoring case), e.g. UNIQUE(tasks![assignee]). by_col TRUE compares its columns; exactly_once TRUE keeps only those that occur once. |
| `CHOOSECOLS(array, col_num1, [col_num2], …)` | The columns of the array at these places, in this order: 1 the first, -1 the last, e.g. CHOOSECOLS(A1:D9, 1, 3). |
| `TAKE(array, rows, [columns])` | The first rows of the array (the last where rows is negative), and with columns its first (or last) columns, e.g. TAKE(SORT([score], 1, -1), 3) the three highest; rows left empty takes all of them. |
| `DROP(array, rows, [columns])` | The array without its first rows (its last where rows is negative), and with columns without its first (or last) columns, e.g. DROP(SORT([score], 1, -1), 1) all but the highest; rows left empty drops none. |
| `HSTACK(array1, [array2], …)` | The arrays side by side, each keeping its columns' names; a shorter one padded with `#N/A`, e.g. HSTACK(tasks![name], tasks![due]) or a column calculated beside a table's. |
| `VSTACK(array1, [array2], …)` | The arrays one under another, their columns named as the first one's; a narrower one padded with `#N/A`, e.g. VSTACK(people![#Data], staff![#Data]) or a total row under a table's rows. |
| `SEQUENCE(rows, [columns], [start], [step])` | Numbers in rows and columns, along each row first: from start (1) by step (1), e.g. SEQUENCE(5) 1 to 5 in a column, SEQUENCE(1, 3, 0, 10) 0, 10, 20 in a row. |
| `TEXT(value, format)` | A number, a date or a time as text in a format: TEXT(A1, "#,##0.00"), TEXT(A1, "0%"), TEXT(A1, "dd.mm.yyyy hh:mm"), TEXT(A1, "[h]:mm") for all the hours of a length of time. Number codes: 0 (a digit), # (a digit where it counts), , (thousands), . (decimals), %, and ; between formats of positive;negative;zero numbers ("0.00;(0.00)"); date codes: yyyy, yy, m, mm, d, dd, h, hh, m, mm (minutes), s, ss, [h], [m], [s]; text in quotes as it is. |
| `TODAY()` | Today's date, e.g. 2025-11-06. The result is written when the table is calculated: the next day, Recalculate updates it. |
| `NOW()` | The date and time now, e.g. 2025-11-06 14:30:15. The result is written when the table is calculated: Recalculate updates it. |
| `DATE(year, month, day)` | The date of a year, month and day; a month or day past its end carries over (DATE(2025, 13, 1) is 2026-01-01). |
| `TIME(hour, [minute], [second])` | A time of day, e.g. 14:30; past midnight it starts again (TIME(25, 0) is 01:00). Added to a date it gives the date with that time: DATE(2025, 11, 6) + TIME(14, 30) is 2025-11-06 14:30. |
| `DATEADD(date, amount, unit)` | The date plus an amount of a unit: "s", "min", "h", "d", "w", "m" (months) or "y" (or their names, "hours"). A negative amount goes back. Months and years keep the day or take the month's last. |
| `DATEDIF(start, end, unit)` | How many whole units lie from one date to another, in "s", "min", "h", "d", "w", "m" (months) or "y"; negative when the end is earlier. "md", "ym" and "yd" leave out the larger units: the days past the whole months, the months past the whole years, the days past the whole years. For days with a fraction, subtract the dates: end - start. |
| `YEAR(date)` | The year of a date. |
| `MONTH(date)` | The month of a date, 1 to 12. |
| `DAY(date)` | The day of a date's month, 1 to 31. |
| `HOUR(time)` | The hour of a time, or of a date's time, 0 to 23 (0 for a date without a time). |
| `MINUTE(time)` | The minute of a time, or of a date's time, 0 to 59. |
| `SECOND(time)` | The second of a time, or of a date's time, 0 to 59. |
| `WEEKDAY(date, [type])` | The day of the week as a number: Sunday 1 to Saturday 7 (type 1, the default, and 17), Monday 1 to Sunday 7 (type 2 and 11), Monday 0 to Sunday 6 (type 3), or 1 from Tuesday (12), Wednesday (13), Thursday (14), Friday (15) or Saturday (16). |
| `ISOWEEKNUM(date)` | The week of the year by ISO 8601, 1 to 53: weeks start on Monday, and week 1 is the one with the year's first Thursday. |
| `EOMONTH(start, months)` | The last day of the month the given count of months after the start's (0: its own month; negative: before). |
| `NETWORKDAYS(start, end, [holidays])` | How many working days (Monday to Friday) there are from the start to the end, both counted, without the holidays (dates, a range of them); negative when the end is earlier. |
| `WORKDAY(start, days, [holidays])` | The date the given count of working days (Monday to Friday) after the start, leaving out the holidays (dates, a range of them); a negative count goes back. |

In ranges, empty cells and text that is not a number are skipped by the number functions.

Operators work on a range cell by cell, for a function to take the result: `TEXTJOIN(", ", TRUE, "**" & [name] & "**")` joins the names in bold, `SUM([qty] * [price])` adds the products of each row, `SUMPRODUCT(([status] = "open") * [qty])` the quantities of open rows. Two ranges must be the same size. A cell shows one value, so `=[qty] * 2` alone is `#VALUE!`. Number functions skip TRUE and FALSE in a range: count with `COUNTIFS`, or multiply the comparison (`* 1`) first.

Conditions of `SUMIFS`, `COUNTIFS`, `AVERAGEIFS`, `MAXIFS` and `MINIFS` are written as in spreadsheets, in quotes: `"open"` (the same text, ignoring case), `">10"`, `"<=2025-12-31"`, `"<>done"`, `"app*"` (`*` any text, `?` one character, `~*` a star), `""` (an empty cell), `"<>"` (a cell that is not empty), or joined with a value: `">"&[@limit]`, `"<"&TODAY()`. They are not the filter row's syntax.

An optional argument can be left out between others: `XLOOKUP([@score], [min], [grade], , -1)`.

### Custom functions

Custom functions, your own, are written in JavaScript, in a file of your space, the way the built-in ones are, and given to Silverware Table from Space Lua. For example `Library/me/functions.js`:

```js
export default ({ toNumber, isError }) => [
  {
    name: "VAT",
    syntax: "VAT(amount, [rate])",
    description: "The amount with VAT, 21 % unless a rate is given.",
    minArgs: 1,
    maxArgs: 2,
    call: ([amount, rate = 0.21]) => {
      const a = toNumber(amount);
      const r = toNumber(rate);
      if (isError(a)) return a;
      if (isError(r)) return r;
      return a * (1 + r);
    },
  },
];
```

and in a `space-lua` block of any page (your [[CONFIG]], say; a block with a priority of its own must have one below 50, Silverware Table's own):

```lua
silverware.table.defineFunctions(js.importFromSpace("Library/me/functions.js"))
```

Then `=VAT([@price])` works in every table, and typing it shows its syntax and description.

* The file's default export is the list of functions, or a function that gets Silverware Table's helpers (below) and returns the list. Each function has a `name` (letters, digits, `_` and `.`, starting with a letter, not one that reads as a cell such as `LOG2`; formulas may write it in any case), a `call`, and optionally `syntax` and `description` (shown while typing a formula), `category` (its group in the *Functions* dialog: `math`, `logic`, `text`, `date` or `lookup`; none: *Custom*), `example` (a formula using it, shown there), `minArgs` (default 0) and `maxArgs` (default: any number).
* `call(args, place)` gets the arguments' values: a number, a text, `true` or `false`, `null` for an empty cell, a time (`TimeValue`) or an error (`FormulaError`); a reference (`A1`, `[@price]`, `A1:A5`, `[qty]`) is the list of its cells' values, one for one cell, as the built-in functions get them (so `SUM(A1)` skips a text there as in a range). `toNumber`, `toText` and `single` take a one-cell list as its value. `place` is where the formula is: `{ row, column }`, 1 the first row under the header and the first column. It returns one value: a number, a text, `true` or `false`, `null` (empty), a time or an error.
* It must give its result at once, from its arguments only: it is called whenever the table is calculated, and its result is written into the cell. It cannot wait for anything (a query, another page): a function that returns a promise gives `#VALUE!`. For data from SilverBullet, a cell with a Lua expression (`${…}`) shows it.
* A function that throws gives `#VALUE!` with its message (on the cell's hover), as does one that returns a list or an object; one that throws a `FormulaError` gives that error.
* A function with a built-in function's name replaces it.
* The helpers are the conversions the built-in functions use: `toNumber`, `toText`, `toBoolean` (an error for a value that is none), `numbers` (the numbers of all the arguments, ranges skipping empty cells and text), `flatten` (all the values of the arguments, ranges taken apart), `single` (a range's first value), `firstError`, `isError`, `isRange`, `toDate` / `parseDate` (a date as `{ ms, time }`), `formatDate` (written back), and `FormulaError` (`new FormulaError("#N/A", "why")`) and `TimeValue` (`new TimeValue(seconds)`). An error given to them comes back, so a function passes errors in its arguments on by returning it.
* Functions are defined again whenever SilverBullet loads Space Lua again: a change of the file shows after reloading the page (the browser keeps a module it loaded). A formula calling a function that is not defined (its file missing, or not loaded) keeps the result written, and *Recalculate* in the toolbar is highlighted: an edit of that table writes `#NAME?` there.
* A mistake in a definition (no `call`, a name formulas cannot write) is shown in a notification until you close it, with the pages whose `space-lua` blocks call `silverware.table.defineFunctions` and a button opening each; the other functions are defined.

### Formulas from Space Lua

Two functions calculate a formula on the page, outside any table, so a page's text or a script can use what its tables hold. `silverware.table.evaluateText(formula)` gives text for the page, as a cell would show it:

```
VAT: ${silverware.table.evaluateText("=fruit!vat")}
Fruit: ${silverware.table.evaluateText("=fruit![item]")}
```

`silverware.table.evaluate(formula)` gives the values, for a script:

```
Expensive: ${(function()
  local n = 0
  for _, price in ipairs(silverware.table.evaluate("=fruit![price]")) do
    if type(price) == "number" and price > 10 then n = n + 1 end
  end
  return n
end)()}
```

* It is not in a table, so it names what it reads by a table's name: `fruit!B2`, `fruit![qty]`, `fruit!vat`, `fruit!pear[price]`, `[[Prices]]fruit!B2` for a table on another page. `A1` or `[qty]` alone find no table: `#REF!`. The `=` is optional.
* `evaluateText`: one value as its text (`21`), several (a range, a column, an operator over one) joined by a comma: `Pear, Fig`. An error shows as its code, `#REF!`, written so that SilverBullet does not take it for a hashtag.
* `evaluate`: one value as a number, `true` or `false`, or text (a date or a time as written: `2026-11-05`, `14:30`); an empty cell `nil`. A range (`fruit!B1:B3`, a column, an operator over one) is always a list, also of one value; an empty cell in it is `""`, and a cell with an error is `{ code = "#DIV/0!", detail = "…" }` in its place (a table, so `type(v) == "table"` tells it). An error of the whole formula gives `nil` and the error: `local value, err = silverware.table.evaluate("=nope!A1")`, then `err.code` is `#REF!` and `err.detail` says why.
* It reads the page as it is now, and calculates the formulas it reaches anew; your own functions work too. Nothing is written. A script that has a page's text may give it: `silverware.table.evaluate(formula, text, page)` (and `evaluateText`) calculates on that text, as the page `page`.
* A `${…}` showing it follows the tables: SilverBullet shows it anew when the page is edited (a cell changed in a table too) or another page it reads changes. (From SilverBullet's next release: 2.12.1 shows it anew when the page is opened again.)
* While you type the formula, names complete as in a cell: the functions (with their syntax and what they do), the page's named tables, and after `table!` that table's named cells.
* Its references follow the tables as a cell's do: rename a column or the table, insert, move or delete rows and columns with Silverware Table, and the formula in the page's text is written anew with them, in the same edit (one Ctrl+Z undoes both). That holds for a formula written whole in one string, in quotes or apostrophes, without escapes (`\"`): one put together in Lua (`"=SUM(" .. name .. ")"`) is left as it is. Edits made in the markdown are not followed, as for tables.
* It needs the formulas module (else `evaluateText` shows `#N/A`, and `evaluate` gives `nil` and the error `#N/A`), and `[[Page]]` references the pageLinks module (else they are not read).

A shorter name for each: in a `space-lua` block of yours, `silverware.table.evaluateTextAlias("te")` makes a function `te` that does what `evaluateText` does, `silverware.table.evaluateAlias("ev")` one `ev` doing what `evaluate` does, completion and following the tables included:

```lua
silverware.table.evaluateTextAlias("te")
silverware.table.evaluateAlias("ev")
```

```
VAT: ${te("=fruit!vat")}
```

* Call each once for each name you want; it takes effect when Space Lua loads (as your scripts do).
* A name a Lua function cannot have, or one already taken by something else (`print`, a function of yours), is refused with a notification that says where it was called.
* Remove the line and the name no longer completes; the function itself goes once the page is loaded again.

**Before 2026-11**, `evaluate` gave text, several values as a list `["Pear","Fig"]`, and `evaluateAlias` made a name for it. In a page's text, write `evaluateText` where you had `evaluate`, and make the names you use there with `evaluateTextAlias` instead of `evaluateAlias`: with `evaluate`, several values show as a box with a line each, and an error as `nil`.

#### Formula errors

Every formula cell showing an error, on a page or in the whole space, calculated as it is now (a table not recalculated since shows its errors as they are, with why):

```
${silverware.table.errorsText()}
${silverware.table.errorsText(editor.getCurrentPage())}
```

`errorsText` shows them as a table: the page, the table's name, the cell (a link that puts the cursor in it, the table shown as markdown), the error and why; with none, *No formula errors*. For a script, `silverware.table.errors(page)` gives a list of records: `page`, `ref` (the cell in the markdown, as `Budget@1234`: `editor.navigate(ref)` opens it), `table` (`nil` where the table has no name), `cell` (`C3`), `column`, `code` (`#REF!`), `detail` (why) and `formula`:

```
${(function()
  local count = {}
  for _, e in ipairs(silverware.table.errors()) do count[e.code] = (count[e.code] or 0) + 1 end
  return count["#REF!"] or 0
end)()}
```

* The page is named as SilverBullet names it (`"Budget"`, `editor.getCurrentPage()`); left out, every page whose tables hold a formula, and the page open.
* It reads each page as saved (the page open as it is now), and the other pages their formulas read; a `${…}` showing them follows those pages as `evaluate` does.
* With the formulas module off, `errors` gives `nil` and the error `#N/A`.

The *Silverware Table: Find formula errors* command lists them in SilverBullet's picker (type to find a page or a cell), and opens the one you pick with the cursor in that cell.

### For other plugins

These functions let another plugin (or a script of yours) work with tables without reading their markdown itself. [[Library/damesene/silverware-chart|Silverware Chart]] uses them for charts of named tables.

* `silverware.table.tables(text)` gives the tables of a markdown text (usually `editor.getText()`): each with its `name` (where you named it), its place `from` and `to` in the text, its `columns` (each `{ name, key }`, the key as SilverBullet's index has it) and its body's cells as they show, row by row, in `rows`.
* `silverware.table.defineMenuEntries(definitions)` adds entries to a row's or a column's menu, in a section of the plugin's own or beside Silverware Table's of a kind: see [[#Custom menu entries]].
* `silverware.table.onWrite(fn)` calls `fn(text, context)` whenever Silverware Table writes tables, `text` the page's text as the write leaves it. `fn` gives a list of edits of that text outside the tables, `{ from = 10, to = 14, text = "new" }`, which are written in the same edit: one Ctrl+Z undoes them with the table. An edit that touches a table, reaches past the text or overlaps another is left out. Keep `fn` quick and let it write nothing itself; give it again in each load of Space Lua (a `space-lua` block does).
* `context` tells what the write did, so a reference to a table or a column can follow it:
  * `context.renamed()`: whether a table or a column was renamed (check it first: most writes rename nothing);
  * `context.table("sales")`: the table that was named *sales* before the write, if the write wrote it; `context.tableAt(offset)`: the table written at that offset of `text`;
  * on either, `.name` is its name now and `.column("Qty")` the name the column *Qty* has now (`nil` where it was deleted).

```lua
silverware.table.onWrite(function(text, context)
  if context.renamed() then
    local t = context.table("sales")
    if t then print("Qty is now " .. tostring(t.column("Qty"))) end
  end
  return {}
end)
```

### Errors

| Shows | Because |
|---|---|
| `#REF!` | A reference outside the table, a column name that does not exist, or a table name that no table on the page (or on the page named) has |
| `#NAME?` | An unknown function, or a name no cell of the table has (of the table named before it: `rates!vat`) |
| `#VALUE!` | A value of the wrong kind (text where a number is needed), or a wrong number of arguments |
| `#DIV/0!` | Division by zero, or an average of no numbers |
| `#NUM!` | A result that is not a finite number, or a number a function cannot take (`LARGE` with k past the count, `WEEKDAY` with an unknown type) |
| `#N/A` | `XLOOKUP` did not find the value, or `RANK` the number |
| `#CYCLE!` | The formula depends on its own result |
| `#SPILL!` | The result is several values and a cell holds one (see [[#Arrays]]: *Show result* shows them) |
| `#CALC!` | An array function left nothing (`FILTER` keeping no row without its if_empty, `TAKE` of no rows, `SEQUENCE` of none) |
| `#ERROR!` | The formula cannot be read (e.g. a missing `)`) |

An error is written into the markdown with its `#` escaped (`\#REF!`), so SilverBullet does not take it for a hashtag (it would tag the row `REF`); it shows as `#REF!`. A table written before shows *Out of date* once, and Recalculate writes its errors so.

## Column types

A hashtag in a column's header gives the column a type, which changes how its cells show. Pick it in the column's menu (the ⠿ grip above the column, or right-click its header): *Type* shows the column's type, the icon after it opens the types in the same menu, the × beside it removes the type (greyed out while there is none). The types show (hover one to see how it is written and what it shows), the arrow before the menu's title (or the Left key) returns to the column's menu, and the type picked is written as a hashtag in the header. Editing a header changes only the column's name: its type's hashtag stays. In the markdown, the hashtag can also be typed by hand, e.g. for a parameter the menu does not offer (`#currency-usd`).

```
| Item | Price #currency-usd | Rating #stars | Done #check |
| ---- | ------------------- | ------------- | ----------- |
| Pear | 12.99               | 4             | yes         |
```

shows `$12.99`, `★★★★☆` and `☑`.

* The markdown keeps the value as written: the type only changes what the cell shows. The cell editor shows the value. Sorting, filters and copying (Ctrl+C) use the value too, so a rating sorts by its number.
* The type's hashtag is hidden in the header, and the type's icon shows after the column's name (hover it for the type); the menu marks the types with the same icons. SilverBullet leaves hashtags out of a column's key, so a query still reads `Price #currency-usd` as `price`, and the hashtag tags neither the rows nor the page.
* A parameter goes after a dash: `#currency-usd`, `#number-2`, `#stars-10`. A hashtag that is not a type (or a type with a parameter it does not take) is an ordinary hashtag.
* A cell whose value is not one of the type shows as written, in red; hover it to see why. Empty cells are left alone.
* The cell editor offers the type's values where it has a few (`#stars`, `#check`, `#trend`) in a list under the cell, all of them even when the cell has one: click one, or move along them with ↑ / ↓ and take one with Enter. Typing narrows the list. A value saved that is not of the type is kept as typed, and Silverware Table says so.
* A formula's result is shown in its column's type, e.g. `=SUM([price])` as an amount of money.
* The hashtags of MdTableRender also work for these types: `#euro`, `#usd`, `#int`, `#float`, `#kg`, `#km`, `#watt`, `#logical`, `#evaluation`, `#gauge`.

| Type | Shows |
|---|---|
| `#currency, #currency-usd` | An amount of money: the currency's three-letter code after the dash (default EUR). Its sign goes where the currency's country writes it: $12.99, 12.99 €, 12.99 Kč. |
| `#number, #number-2` | A number with thousands separators: the decimal places after the dash (default: as written). |
| `#percent, #percent-1` | A fraction as a percentage, 0.15 is 15 % (15 % stays 15 %): the decimal places after the dash (default 0). |
| `#unit-kg` | A number with a unit: the unit after the dash. |
| `#stars, #stars-10` | A rating as stars: a whole number from 0 to the most stars after the dash (default 5). |
| `#check` | Yes or no as a check box: yes, true, x, ☑ or a number above 0 shows ☑; no, false, ☐, 0 or a number below it shows ☐. |
| `#choice, #choice-name` | One of a list's values: the list named after the dash, kept in the table as values or as a formula making them (=\@projects; picking Choice opens a dialog to set it up). A value not in the list is marked, and the column sorts in the list's order. Without a list the editor offers the values the column has. |
| `#date, #date-long` | A date written as 2025-11-06 (with a time: 2025-11-06 14:30), shown as the locale writes it: short, medium (default) or long after the dash. |
| `#time` | A time of day written as 14:30 or 14:30:15 (or as a fraction of a day, 0.5 is 12:00), shown as the locale writes times. |
| `#trend` | A trend as an arrow: + or a number above 0 shows ↑, - or one below 0 shows ↓, = or 0 shows =. |
| `#progress, #progress-10` | Progress as a bar: a number from 0 to the maximum after the dash (default 100). |
| `#link` | A web address as a link, shown without its https://. |

Numbers and dates are written as your browser's language writes them.

### Choices

A `#choice` column takes one of a list of values, as a status column (open, in progress, done). The list is kept in the table and named; the column names it after the dash:

```
| Task       | Status #choice-status |
| ---------- | --------------------- |
| Write docs | in progress           |
| Release    | open                  |
| <meta core.table columntypes.choice.status='["open","in progress","done"]'> |
```

* Picking *Choice* in the *Type* menu opens the *Choices* dialog (so does the pencil in the column's *Type: Choice* row). Its row at the top picks where the values come from, what each does in a line under it: *Column's values* makes it `#choice`, which offers the values the column has and checks nothing; *Own list* sets up a list: its name, and its values one a line (dragged by the ⠿ left of each, or Alt+↑ ↓, to order them, Enter for a new one, *Take values from the column* to add those the column has). A new list starts with the column's values and is named after the column; *Formula* makes it of a formula (below). Lists are kept in the table's metadata, so saving one needs the *Store table metadata* setting. Nothing changes until Save.
* A list can be made by a formula instead of values typed: *Formula* takes one, a source of the space ([[#Sources of the space]]) as `=@projects` (one of its columns: `=@users[name]`; `@` typed offers the sources) or any other (`=SORT(UNIQUE(tasks![status]))`, `=FILTER(@users[name], @users[active])`). The dialog shows the values it gives as you type. The table keeps the formula as the list (`columntypes.choice.projects='=@projects'`), so it says where its values come from, read in its markdown with no script known:

  ```markdown
  | Task | Project #choice-projects |
  |------|--------------------------|
  | A    | Atlas                    |
  | <meta core.table columntypes.choice.projects='=@projects'> |
  ```

  * Its values are the formula's result as the column shows (nothing is written): a list, or a table of one column, in its order (sort it with `SORT(…)`), empty ones and repeats left out (whatever their case), numbers and `TRUE` / `FALSE` as cells show them. It follows what it reads: a source read anew, another table of the page edited.
  * A result that is an error, or a table of several columns, checks nothing: the column's type icon says why in its tooltip, so does the dialog. So does a list whose formula reads a source not read yet, or with the `formulas` module off.
  * Renaming a column or table of the page the formula reads, with Silverware Table, changes the formula with it, in the same edit.
  * In the *Type* menu such a list is under *Choice* as any other, its formula in its tooltip (`=@projects · Used by Project`).
* Renaming a value in the *Choices* dialog renames it in the cells of every column that takes the list; renaming the list renames it in their headers. A value removed from the list stays in its cells, marked.
* The cell editor offers the list's values; a value not in the list is kept as typed and marked in red. Values match whatever their case.
* Sorting by the column puts the values in the list's order (open, in progress, done), not the alphabet's.
* Every list of the table shows under *Choice* in the *Type* menu, where a column takes one (*Choice* itself opens the dialog, and is checked for `#choice` without a list), and where a list is deleted (🗑). Deleting a list columns take asks first; those columns are then left without a type, their cells as written. A list is not deleted by itself when no column takes it any more.
* A list's name is lower case letters (a to z) and digits, words joined by dashes: `status`, `task-status`.
* A column of a list shows the list in a box as its icon, `#choice` alone a plain list.
* `#choice` alone, or a list the table does not have, checks nothing: the editor offers the values the column has.

### Custom column types

Custom column types, your own, are written in JavaScript, in a file of your space, the way the built-in ones are, and given to Silverware Table from Space Lua, as [[#Custom functions]] are. For example `Library/me/types.js`:

```js
export default ({ numberOf, notANumber, formatNumber, lineIcon }) => [
  {
    name: "temp",
    syntax: "#temp, #temp-f",
    description: "A temperature in °C, or in °F after the dash.",
    icon: lineIcon('<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>'),
    params: { scale: { kind: "choice", values: ["c", "f"], default: "c" } },
    check: notANumber,
    format: (text, { scale }, locale) => `${formatNumber(numberOf(text), locale)} °${scale.toUpperCase()}`,
  },
];
```

and in a `space-lua` block of any page (with a priority of its own, one below 50):

```lua
silverware.table.defineTypes(js.importFromSpace("Library/me/types.js"))
```

Then `| Outside #temp |` and `| Oven #temp-f |` show their cells so, the *Type* menu offers it, and its hashtag is hidden in headers.

* The file's default export is the list of types, or a function that gets Silverware Table's helpers (below) and returns the list. Each type has a `name` (letters, digits and `_`, starting with a letter: its hashtag) and optionally:
  * `syntax` and `description`, shown in the *Type* menu, and `icon`, an SVG (`lineIcon` draws one from SVG paths, 24 by 24);
  * `params`, the parameters written after the dash, one after another separated by dashes (the last takes the rest: `#unit-m-s`). Each is `{ kind: "number", integer, min, max, default }`, `{ kind: "choice", values: [...], default }` (any case) or `{ kind: "text", pattern, default }`. Silverware Table reads them from the hashtag: the type gets their values (a number as a number, a choice as listed, a parameter not written as its default, or `undefined`). A hashtag whose parameters do not fit is an ordinary hashtag;
  * `aliases`: other hashtags that mean the type, with its parameters as written after the dash: `{ fahrenheit: "f" }`;
  * `check(text, params)`: why a cell's text is not a value of the type (it shows in red, with the reason on hover), or nothing when it is one. Empty cells are not checked. None: every text is one;
  * `format(text, params, locale)`: what a valid cell shows, a text, a link `{ text, href }`, or a meter `{ text, meter }` (a bar filled to `meter`, from 0 to 1, the text in a box over it, as `#progress` shows); `locale` is the browser's language. None: the text as written;
  * `sortValue(text, params)`: what sorting and filters compare instead of the text, e.g. `1` and `0` for yes and no;
  * `choices(params)`: the values the cell editor offers, texts or `{ value, label }`.
* A type with a built-in type's name replaces it (its aliases too). Its own name comes before another type's alias, and its aliases before the built-in types' ones; of two types of one name, the last defined counts.
* A method must give its result at once. One that throws, or gives something else, marks the cell in red with why; the table shows the rest as usual.
* The helpers are those the built-in types use: `numberOf` (a cell's text as a number, as sorting reads it: `12,99`, `1 000`, `15 %`; else `undefined`), `notANumber` (a `check` for numbers), `formatNumber(n, locale, options)`, `numberFormat` and `dateTimeFormat` (`Intl` formatters, made once), `parseDate` (a date written as `2025-11-06` as `{ ms, time }`) and `lineIcon`.
* Types are defined while SilverBullet loads Space Lua, before the page's tables show. A change of the file shows after reloading the page. A mistake in a definition is shown in a notification until you close it, with the pages whose `space-lua` blocks call `silverware.table.defineTypes` and a button opening each; the other types are defined.

## Pivot tables

A pivot table summarizes another table: its rows grouped by a column, a value for each group, totals. **Insert pivot table…** in a table's ⋯ menu opens a dialog: pick what groups the rows (a column, a date by year, quarter or month), what makes columns, the values (sum, average, count, min, max of a column, each as it is or as a percentage of the total, of its row's total or of its column's), which rows count (a column compared with a value, or matching a regular expression) and the order, and the pivot they make shows under the fields as you change them; *Insert* writes it under the table (a table without a name gets one: a pivot names its source). The *Silverware Table: Insert pivot table* command, or `/pivot` typed in the page, opens the same dialog for a pivot of the page's first named table (on a page without one: of another page's) and writes it where the cursor is. A pivot is calculated by the `formulas` module: while it is off, the dialog says so first and inserts nothing. The **Pivot settings…** icon in a pivot's toolbar opens the same dialog to change it. Its source may be a table of another page: pick *Another page…*, type the page (its name is offered as you type) and pick one of its named tables; the dialog says what such a pivot does not do (see below). A field the dialog has no choice for can be written as a formula (its **fx**).

It is a plain markdown table, its numbers written in it (it shows anywhere, as any table), and its definition is in its metadata row, in the language of formulas:

````markdown
| Region | Sum of Revenue |
|---|--:|
| East | 6125 |
| North | 2300 |
| West | 5500 |
| Total | 13925 |
| <meta core.table pivot.source='orders' pivot.rows='region' pivot.values='SUM([revenue])'> |
````

| Attribute | What it says |
|---|---|
| `pivot.source` | The table summarized: a table of the page by its name (see [[#Table names]]), of another page as formulas refer to it: `[[Orders]]orders`, or a source of the space: `@tasks` (see [[#Sources of the space]]) |
| `pivot.rows` | What groups the rows: a column (`region`), or a formula of one row (`TEXT([@date], "yyyy-mm")`, `YEAR([@date])`), several comma separated |
| `pivot.columns` | What makes columns of the groups, the same way (optional): a cross table |
| `pivot.values` | What each group shows: formulas over its rows, `SUM([revenue])`, `AVERAGE([qty])`, `COUNTA([date])`, `SUM([qty] * [price])`, comma separated; `SHARE(…)` around one shows it as a share of the grand total (`SHARE(SUM([revenue]))`), `SHARE(…, "row")` of its row's total, `SHARE(…, "column")` of its column's, its column typed `#percent-1`; SHARE is the pivot's, so it is the whole value or nothing (`SHARE(…) * 100` is `#NAME?`) |
| `pivot.where` | Which rows count: a formula of one row, true for those (`[@category] = "Hardware"`, `AND([@qty] > 5, [@region] <> "West")`, a regular expression: `REGEXTEST([@code], "^EU-")`) |
| `pivot.sort` | The rows' order: groups or values as the definition writes them, each with `desc` where it goes down (`SUM([revenue]) desc, region`); by default the groups, as numbers, dates or texts sort |
| `pivot.totals` | `both` (the default): the Total row and, with columns, the Total column; `row`: the Total row alone; `column`: the Total column alone; `none` |

* An edit of its source with Silverware Table writes the pivot anew in the same edit: one Ctrl+Z takes back both. Its source renamed, the pivot names it so. A table whose formulas read the pivot, and a view of it, are written anew in the same edit too; a pivot's source may be a view.
* A pivot that cannot be calculated (its source gone) keeps its numbers; the formulas reading it show the error, as for a view.
* Edited by hand (in its markdown) the source is ahead of the pivot: its **Refresh pivot** icon in the toolbar is highlighted, and its tab says *Out of date* (*Cannot be calculated* where it cannot be); click Refresh pivot and the pivot is calculated anew.
* A source on another page is as a formula's table there (see [[#Other tables]]): its edits do not write the pivot; once SilverBullet has indexed that page, **Refresh pivot** is highlighted where the pivot is out of date. Renamed there, the source (or its columns) is not followed: the pivot says what it cannot find, and its settings fix it. It needs the `pageLinks` module.
* A source of the space (`@tasks`) changed: **Refresh pivot** is highlighted; while it has not been read, the pivot keeps its numbers.
* Its values are calculated, so its cells are not edited: the editor does not open on them (it says why, and the pivot's settings open instead, where what it shows is changed), and its menus offer nothing that changes them or adds, moves or deletes its rows and columns (nor *Unpin all*: its totals are pinned by it). Its grips open their menus but do not drag, and its cells selected have no edge to drag them by. The order of its groups and values is set in its dialog (↑ ↓ beside each). Rename a header as in any table: the pivot keeps your name (and a type's hashtag added to it) when it is calculated again.
* It says what it is at a glance: *Pivot of orders* in a small tab at its top right corner (with the `tableLabels` module), `Pivot of [[Orders]]orders` for a source on another page, as its definition writes it.
* Its totals are pinned: the Total row to the bottom, a cross table's Total column to the right, so they stay in view and out of a sort (with *Store table metadata*).
* It needs the `formulas` module.

## Views

A view is a table made by one formula: its rows are the formula's result, as Excel 365 spills a `FILTER` or a `SORT`, kept in a table of its own. **Insert view…** in a table's ⋯ menu opens a dialog with the table's whole body to start from (`=tasks![#Data]`; a table without a name gets one in the same edit, as a view reads tables by their names): type the formula (names and functions are offered as you type, the function the caret is in is explained, **fx** finds one by what it does), name the view, and the table it makes shows under them as you type, with its size; *Insert* writes it under the table. The *Silverware Table: Insert view* command, or `/view` typed in the page, opens the same dialog starting from the page's first named table and writes the view where the cursor is. **View settings…** in a view's toolbar opens it to change the formula or the name.

````markdown
| Name | Assignee | Hours |
|---|---|---:|
| Write | anna | 3 |
| Ship | anna | 2 |
| <meta core.table core.name='annas' view.formula='=SORT(FILTER(tasks![#Data], tasks![assignee] = "anna"), 3, -1)'> |
````

* **What a formula gives**: rows and columns (`FILTER(tasks![#Data], …)`, `CHOOSECOLS(…)`), a list (`=SORT(UNIQUE(tasks![assignee]))`: one column), or one value (`=SUM(tasks![hours])`: one cell). See [[#Arrays]] for the functions. A result of no rows is the header alone.
* **Its headers** are the names of the columns its values come from (`Assignee`), else letters (A, B, C). Rename a header as in any table: the view keeps your name (and a type's hashtag added to it) whenever it is calculated again; empty it, or give it its name back, and it follows its source again.
* **It follows what it reads**: an edit of a table it reads, with Silverware Table, writes the view anew in the same edit (one Ctrl+Z takes back both), and so does a table whose formulas read the view, in the same edit too. The table it reads renamed, or its columns renamed or moved, the view's formula says so.
* Changed otherwise (its source typed in the markdown, a table on another page it reads, a source of the space it reads, `TODAY()` moved on), the view's tab says *Out of date* and its **Refresh view** icon in the toolbar is highlighted; click it and the view is calculated anew. A formula that cannot be calculated (its table gone: `#REF!`; `FILTER` keeping nothing without its third argument: `#CALC!`; a view reading itself or two reading each other: `#CYCLE!`) writes nothing: the view keeps what it shows, its tab says *Cannot be calculated* and its Refresh view icon why.
* **A named view is a table like any other** for formulas (`=SUM(annas![hours])`), pivots, charts and exports; its numbers are written in the markdown, so it shows anywhere.
* Its values are its formula's, so its cells are not edited: a press on one says why and opens its settings, and its menus offer nothing that changes them or adds, moves or deletes its rows and columns. A large result is written whole (the dialog says so past 1,000 rows).
* Its formula is in its metadata row (`view.formula`), its renamed headers too (`view.headers`); it needs *Store table metadata* and the `formulas` module (off: the dialog says so and inserts nothing; views keep their values). In an Excel file a view is its values.

## Rows and columns

Hover a cell to show two grips: ⠿ left of its row, and ⠿ above its column; moving the pointer along the left of the table (above it) takes them from row to row (column to column). Hovering a grip tints its row or column. While a cell is edited, they stay with it.

* **Click a grip**: the row (column) is selected, for Ctrl+C or Delete, as a click selects a cell; **click it again** (the pointer shows a menu on the grip of a row selected), or **right-click** it, for its menu. With *Edit mode* on, as a click edits a cell at once, the first click opens the menu too. On a touch screen: tap to select, tap again or press and hold for the menu.
  * Row: copy, cut, paste (also as new rows), clear, insert above or below, duplicate, move up or down, select rows, delete.
  * Column: copy (with its header), cut (the cells under it), paste, clear (the cells under it), sort, filter, type (see [[#Column types]]), align (left, center, right), insert left or right, move, select columns, delete.
  * With several rows (columns) selected, it acts on them all (*Copy 3 rows*, *Delete 3 rows*).
  * With rows (columns) selected whole, a right click on one of their cells (on a touch screen: a tap or a long press) gives this menu too, not a cell's, as in a spreadsheet. A right click on a header (a long press) gives its column's menu, the column selected.
  * *Paste* in a column's menu pastes from its header a column copied with its header (*Copy column*), which names it; anything else (cells from a spreadsheet, cells cut) goes under the header, the column keeping its name. *Paste as new rows* with rows cut moves them there (as a spreadsheet inserts cut cells).
* **Shift+click on a grip** selects at once the rows from the one selected with a click (else the first of the rows or cells selected) to that one; Shift+click another grip to change where they end. A click on the grip of a selected row then opens its menu with *Delete N rows*.
* **Drag a grip** to move the row or column: a copy follows the pointer and the others move aside to show where it goes; near the top or bottom of the view the page scrolls. Esc cancels the drag.
* **Several rows (columns) at once**: select them whole (a grip's click, then Shift+click another, or on a touch screen the dots at the selection's edges), then drag the grip of any of them: they move together, in their order, as one edit. *Move up* / *Move down* (*Move left* / *Move right*) in the menu of one of them move them all (*Move 3 rows down*). They must follow each other and be in one zone of pinned rows (columns).
* **Insert with +**: with a mouse or a pen, while a cell of the table is selected or edited, a small dot marks each border where a row or column can go: left of the row grips, and above the column grips. Move the pointer onto a dot and it turns into a **+**, with a line where the row (column) will go; click the **+** to insert one there (a click beside it does nothing). The dots under the last row and right of the last column add one at the end. Hovering a table without selecting a cell shows no dots, so they stay out of the way while you write. A new column is named *Column N*, ready to rename. On a touch screen, insert from the row's or column's menu.
* **Numbered column**: *Insert numbered column left* in a column's menu adds a column `#` with `=ROW()` in every row: it numbers the rows as written (sorting or filtering the view does not renumber them), rows added later get the formula too, and inserting, deleting or moving rows numbers them again. Add as many as you like. It needs the *Store table metadata* setting, as every new formula.
* Rows can be moved only in the original order (no sorting, no filter), so a row always lands where you see it.
* **Column width**: drag the right edge of a column's header (a faint dashed line shows there while the header cell is hovered, selected or edited; the pointer shows ↔ on it) to move the edge between that column and the next. The table keeps its width: what one column gains, the column on the other side of the edge gives. A column gives down to 80 px; dragged further, the next column gives. A header narrower than its name is cut with an ellipsis, its whole name shown when you point at it. Drag back and every column has its width again. The last column's edge is the table's: drag it right to make the last column and the table wider (the table then scrolls sideways), left to make them narrower, down to the width of the page. On release every column keeps the width it shows; text too long is cut (or wraps) within it, see [[#Long text in cells (`silverware.table.modules.longText`)]]. Double-click an edge, or *Fit to content* in a column's menu, to make the column as wide as its longest text (up to the maximum column width); the column beside it gives or takes the difference (for the last column, the table gets wider or narrower). *Reset column widths* in the ⋯ menu of the table's toolbar makes every column as wide as its text again. The table keeps its share of the page: set in full screen or a wider window, it is narrower in proportion on the page, though no column narrower than its header needs (up to 160 px, and never wider than you set it): the other columns give the room, and where they cannot, the table scrolls sideways. A column inserted gets an equal share of the table, the others narrower; a column deleted gives its room to the others. With the *Store table metadata* setting the widths are stored in the table (`widths.-c-price.size='180'`, and `widths.box`, the width the table had room for, see [[#Table metadata]]) and follow their columns when they are renamed or moved; without it, they hold until the page is opened again.
* **The table's width on the page**: with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed, a table can be wider (or narrower) than the page's text, centred on it: drag the bar Silverware Layout shows beside the table's right edge. Its columns keep their shares of the wider table. The width is stored in the table's metadata (`layout.width='1200'`), so it needs the *Store table metadata* setting; without Silverware Layout the table is as wide as the text, the width kept.

### Custom menu entries

Your own entries in a row's or a column's menu (or another plugin's) are written in JavaScript in a file of your space and given in a `space-lua` block of any page:

```js
// Library/me/menus.js
export default [
  {
    name: "lists",
    // Called as a row's or a column's menu opens: what to show in it
    lineMenu(context, menu) {
      if (context.axis !== "column") return [];
      const column = context.table.columns[context.at];
      const values = context.table.rows.map((row) => row[context.at]);
      return [
        // A section of its own of primary actions, under Copy, Cut, Paste and Clear
        menu.slot.custom({ name: "Lists", position: "primary" }, [
          menu.item({ label: `Copy ${column.name} as a list`, run: () => navigator.clipboard.writeText(values.map((v) => `- ${v}`).join("\n")) }),
          menu.submenu({ label: "Count values" }, () =>
            [...new Set(values)].map((value) => menu.item({ label: `${value}: ${values.filter((v) => v === value).length}`, run: () => {} })),
          ),
        ]),
        // Or in a place of the menu's own: here with Filter and Fit to content
        menu.slot.view([menu.item({ label: "Log the values", run: () => console.log(values) })]),
      ];
    },
  },
];
```

```lua
silverware.table.defineMenuEntries(js.importFromSpace("Library/me/menus.js"))
```

* `lineMenu(context, menu)` returns a list of groups of entries (at once, as the menu opens: not `async`; an entry's `run` may be), each made by `menu.slot`, which says where they go by what they do:
  * `clipboard`, `edit` (what changes the cells, as Clear), `insert` (as *Insert numbered column left*), `columnType` (as Type), `view` (as Filter), `look` (as Conditional formatting), `remove` (as Remove metadata): beside Silverware Table's own of that kind;
  * `custom({ name, position, priority }, [...])`: a section of its own. Entries of one `name` (yours, or several plugins' giving that name) are one section, ordered by `priority` (a number, lower higher, decimals too; equal ones as they came); sections in the order their names first came. `position` says what its actions are among the menu's: `"primary"` (often used: under Copy, Cut, Paste and Clear) or `"secondary"` (the others: before Remove metadata and Delete, the default).
* The entries: `menu.item({ label, icon, run, hint, disabled, danger, checked, value })`, `menu.submenu({ label, icon, value }, () => [...])` (its entries shown in the menu's place as it is chosen, made then), `menu.segmented({ label, options: [{ icon, title, run, active }] })` (a row of icon buttons, as Sort), `menu.separator()`. `icon` is an SVG's text, or left out. A `run` closes the menu; it may be `async`.
* `context`: `axis` (`"row"` or `"column"`), `at` (the row's place in the markdown, the header 0, so its cells are `context.table.rows[at - 1]`; or the column's, the first 0), `lines` (the rows or columns its actions are for: those selected whole that hold it, else it alone), `page`, and `table`: the table as `silverware.table.tables` gives it (`name`, `columns` each `{ name, key }`, `rows` the body's cells as they show).
* Calls add up: a plugin's and yours each add their own, a `name` given again replaces its entries. A mistake in a definition, or a `lineMenu` or a `run` that fails, is shown in a notification; the menu shows the rest.
* Entries are shown on every table, a pivot's too: an entry that would change a pivot's cells is refused by the table as any edit there is.

## Pinning

With the *Store table metadata* setting on, the row menu has *Pin to top* and *Pin to bottom*, the column menu *Pin left* and *Pin right* (click a checked item again to unpin).

* Pinning moves the row (column) in the markdown, to the edge of the table, next to the rows (columns) already pinned there. The table stores how many are pinned at each edge, see [[#Table metadata]].
* Pinned rows and columns stay in view: rows pinned to the top move with the header, rows pinned to the bottom stay at the bottom of the view, columns stay at the left or right edge while a wide table scrolls sideways.
* They are kept at the edges through every edit: rows added at the end go above the rows pinned to the bottom, columns added at the end left of the columns pinned to the right, and nothing is inserted above the first row pinned to the top or below the last one pinned to the bottom. A row inserted between pinned rows is pinned too.
* Moving (drag, menu, Ctrl+Alt+arrows) keeps a pinned row (column) among the pinned ones and the others outside them.
* Pinned rows are not sorted or filtered: they always show.
* Unpinning moves the row (column) out of its edge, next to the unpinned ones; it does not go back to where it was before pinning (Ctrl+Z does).
* *Unpin all* in the ⋯ menu of the table's toolbar unpins every row and column at once; they stay where they are (at the edges) and scroll and sort with the others again.
* "Pinned" means a number of rows (columns) at an edge: a row typed by hand above the first pinned row becomes the pinned one.
* Rows pinned to the top look like the header.

## Touch screens

On a phone or a tablet:

* Tap a cell to select it, tap it again to edit it (with *Edit mode* on, the first tap edits). The handles of its row and column show next to it: tap one to select the row or column, tap it again (or press and hold it) for its menu (insert rows and columns there), or drag it to move the row or column. A pen that hovers (such as the S Pen) also gets the **+** on the borders, as a mouse does.
* The sort buttons in the header are always shown (there is no hover to show them on). The toolbar (the filter icon, the ⋯ menu) shows while a cell of the table is edited.
* Swiping scrolls a wide table sideways and the page up and down, as usual.
* **Selecting more cells**: tap a cell, then drag one of the dots at the selection's corners (top left, bottom right) across other cells; near the edge of the screen the page scrolls along. Tap a row's or column's handle to select the whole row (column), then drag a dot to select more rows (columns): they stay whole. For whole rows (columns) the dots sit in the middle of what you see of them, on the first row's top and the last row's bottom (the first column's left, the last column's right), and stay there as the page or the table scrolls, as in a spreadsheet's app.
* **Tap a cell of a selection** of several cells for their menu (copy, clear, delete the rows or columns, *Move to…*), as in a spreadsheet's app.
* Press and hold a cell for its menu (copy, cut, paste, clear, filter by its value, name it); a header for its column's menu.
* **AutoFill**: select the cells to go on from, tap them for their menu, *AutoFill to…*, then tap the last cell to fill, see [[#AutoFill]]. The fill handle does not show after a touch: the corner's dot selects.
* Not on touch screens: the keyboard shortcuts (unless the device has a keyboard) and middle-button scrolling.

## Lazy saving

Every edit rewrites the whole table in your page, which takes a moment in a large table. **Lazy saving** (the clock icon in the table's toolbar, the `lazy` module) keeps the cells you edit and saves them together once you stop editing:

* Click the clock: it shows as switched on (tinted) while lazy saving is on, for that table, until you leave the page.
* Cells you edit show their new text at once (marked in their bottom right corner); they are saved together when no cell has been edited for half a second (the *Saves after (ms)* setting, `silverware.table.modules.lazy.delay`). While edits are not saved yet the clock is highlighted.
* Click the clock again: what is not saved yet is saved at once, and lazy saving is off.
* Anything else that changes the table (adding or moving a row, pasting, Delete) saves the cells edited along with it.
* **Ctrl+Z** while cells are not saved yet takes them all back at once (Ctrl+Y brings them back); while a cell is being edited it undoes your typing as usual.
* Until they are saved, a cell shows its text as typed (a link or a formula's result shows once saved), and sorting, filters and formulas use the values saved.
* Leaving the page saves them: opening another page writes them into this page; switching to another tab or app saves them at once; closing the tab saves them, and the browser asks whether to leave.
* A cell changed elsewhere meanwhile (in the markdown, on another device) keeps that change, and a message says the edit there was not saved.

## Conditional formatting

Cells can look different where their values meet a condition, as in a spreadsheet: numbers over a limit in red, a color scale from the smallest to the largest, a bar under each number, an arrow by its size, words like *done* or *blocked* in their colors.

* **A column's rules**: *Conditional formatting* in a column's menu offers quick rules (*Greater than…*, *Between…*, *Text contains…*, *Duplicate values*, *Top 10*, *By keywords…*, *By number ranges…*, *Color scale*, *Data bar*…). Each opens the rules' dialog with the new rule ready: set its values and its look, and *Save*. *Clear rules of this column* removes them.
* **All of a table's rules**: *Conditional formatting…* in the table's ⋯ menu (or the cell menu) opens the dialog. A table with rules shows its icon in the toolbar too, which opens the same dialog.
* **The dialog** lists the rules in the order they apply. Click a rule to edit it under its line: what it applies to (*Whole table*, a column, a named row), which cells (*All cells* or a condition and its values), and its format (and the format's settings). Under the rule edited, *Preview* shows it on the table's own cells: a few of them across their values (the smallest, the largest and those between, so a scale or levels show whole however large the table; a cell it formats and one it does not), a line for each column where it applies to each on its own, and how many cells it formats of how many. Every change shows there at once; the table itself stays as it is while you edit (repainting a large table on every change would be slow). The eye by the × puts the dialog aside and shows the rules being edited in the table: it is yours meanwhile (scroll to another part of it, select, edit); *Back to the dialog* brings the dialog back as it was, the table still showing them. *Save* writes them, *Cancel* or Esc leaves the table as it was. ↑ ↓ change the order, × removes a rule. Another dialog opened meanwhile closes it, its changes not saved.
* **Several rules on a cell**: they apply from the first; a look an earlier rule set (a fill, a text color) stays, a later rule adds what it does not set. *Stop* on a rule leaves the cells it formats to it alone.
* **The cell menu**'s *Conditional formatting…* shows the table's rules where it has some, else starts a first rule for the cell's column.
* **A rule of the whole table** takes its cells as one range, as a spreadsheet's range does: whatever a rule works out from all its cells is of all of them (a scale, levels, a data bar, icons; the top and bottom values, the average, the duplicates). *Each column on its own*, under *Applies to* in the dialog, works each of those out for each column apart (so a column of quantities is not graded against a column of prices); the Excel file has a rule for each column then.
* **A formula condition** (*Formula*) is typed with help, as a formula in a cell is: the table's columns offered after `[` or `[@` (also when a column's name is retyped inside one, `[@due]`), the functions and the page's names as a name is typed (↑ ↓ to pick, Enter or Tab to put it in, Esc to close the list), the syntax of the function the caret is in, and what is wrong while it does not read.
* **What is compared**: the value as sorting compares it: a typed column's value (`12,99 €` as 12.99, a date as a date), a formula's result.
* **Never formatted**: the header, and pinned rows and columns (totals pinned to the bottom do not change a scale or the top values).
* Rules are stored in the table's metadata row (they need *Store table metadata*, see [[#Table metadata]]): a column's on its column, so they follow it when it is renamed or moved, the whole table's on the table. Viewing never changes the table.
* The `conditions` module can be turned off (see [[#Modules]]): cells look as they are, the rules stay in the table.

Formats you set up in the dialog, without code:

* **By keywords**: as many rows as you add, each a keyword or a pattern and its look. A pattern is written as a filter takes it: a word found anywhere in the cell (case and diacritics ignored), `/regular expression/flags`, `=done|closed` (whole cells), `>10`, `!word` (not). The first row that matches a cell styles it.
* **By number ranges**: as many rows as you add, each a range (*From*, up to but not including *To*; either may be left empty) and its look.
* **Color scale**: as Google Sheets has it, a *Minpoint*, a *Midpoint* and a *Maxpoint*, each its color and where it is: *Min value* / *Max value* (the smallest or largest number), a *Number*, a *Percent* of the range from the smallest to the largest, or a *Percentile* (50: the middle number, so one far larger number does not crowd the others at one end); the midpoint can be *None* (a scale of two colors). By default: red at the smallest, yellow at the 50th percentile, green at the largest. A number before the minpoint or past the maxpoint has that point's color.
* **Levels**: how many levels (2 to 10), the lowest and the highest color (the ones between are mixed), and how the numbers are split: as many cells in each level (the default: the smallest number in the first level, the largest in the last, the others spread between), or equal ranges between the smallest and the largest number (one far larger number then leaves all the others in the first levels).
* **Own style**: a fill, a text color, bold, italic, underline or strikethrough. Colors are picked from the palette (each has a light and a dark look, and follows SilverBullet's mode) or any color.

| Condition | Which cells |
|---|---|
| Greater than | Cells whose number is greater than a value |
| Less than | Cells whose number is less than a value |
| Between | Cells whose number is between two values, both included |
| Equal to | Cells that are a value: as numbers where both are, else as text, case ignored |
| Not equal to | Cells that are not a value (as Equal to compares them) |
| Text contains | Cells whose text contains a text, case and diacritics ignored |
| Text does not contain | Cells whose text does not contain a text, case and diacritics ignored |
| Text starts with | Cells whose text starts with a text, case and diacritics ignored |
| Text ends with | Cells whose text ends with a text, case and diacritics ignored |
| Matches | Cells a filter would show: words found anywhere, /regular expression/flags, =a\|b (whole cells), >10, !… (not) |
| Empty | Empty cells |
| Not empty | Cells that are not empty |
| Duplicate values | Cells whose value another of the rule's cells has too (case ignored); empty cells left out |
| Unique values | Cells whose value no other of the rule's cells has (case ignored); empty cells left out |
| Top values | The cells of the largest numbers: a count of them, or a percentage of the cells with numbers |
| Bottom values | The cells of the smallest numbers: a count of them, or a percentage of the cells with numbers |
| Above average | Cells whose number is above the average of the rule's cells |
| Below average | Cells whose number is below the average of the rule's cells |
| Date occurring | Cells whose date is in a period around today (weeks start on Monday) |
| Formula | Cells of the rows a formula of one row is true for (=[\@due] < TODAY()); needs the formulas module |

| Format | How the cells look |
|---|---|
| Light red fill with dark red text | A light red fill, dark red text |
| Yellow fill with dark yellow text | A yellow fill, dark yellow text |
| Green fill with dark green text | A green fill, dark green text |
| Blue fill with dark blue text | A blue fill, dark blue text |
| Red text | Red text |
| Bold text | Bold text |
| Own style | A fill, a text color, bold, italic, underline or strikethrough of your choice |
| By keywords | A style for each keyword or pattern (as a filter takes them: words found anywhere, /regular expression/, =a\|b); the first that matches a cell styles it |
| By number ranges | A style for each range of numbers (from, up to but not including to; either end left open); the first range a cell's number is in styles it |
| Color scale | A fill along two or three colors: at the minpoint, the midpoint (or none) and the maxpoint, each the smallest or largest value, a number, a percent of the range or a percentile; a cell past a point has its color |
| Levels | The numbers split into levels, each a color between two: as many cells in each, or equal ranges between the smallest and the largest (one far larger number leaves the others in the first levels) |
| Heat map | Ten levels from blue to red, as many cells in each |
| Traffic light | The numbers in three equal ranges: red, yellow, green from the smallest |
| Data bar | A bar under each number, as long as its share of the largest |
| Arrows | An arrow before each number: down in red, right in yellow, up in green: below 33 %, below 67 % and from 67 % of the range, as Excel's icon sets |
| Traffic light dots | A dot before each number: red, yellow, green: below 33 %, below 67 % and from 67 % of the range, as Excel's icon sets |

A rule as the table stores it (in its metadata row), here a column's rule coloring its scores by ranges:

```
| <meta core.table conditions.-c-score.rules='[{"format":["byRange",{"rows":[{"to":50,"style":{"fill":"red"}},{"from":50,"style":{"fill":"green"}}]}]}]'> |
```

### Custom conditions and formats

Your own conditions and formats are written in JavaScript in a file of your space, in the form the built-in ones are written in (each built-in one could be copied into your file as it is), and given in a `space-lua` block of any page:

```js
// Library/me/formats.js
export default ({ palette, levels, mix }) => [
  // Colors by your own regular expressions
  {
    name: "status",
    label: "Status colors",
    look: (cell) =>
      /^(done|hotovo)$/i.test(cell.text) ? { color: palette.green, strike: true }
      : /^blocked/i.test(cell.text) ? { fill: palette.red, bold: true }
      : undefined,
  },
  // Five levels of your colors, at your thresholds
  {
    name: "grade",
    label: "School grades",
    look: levels(["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027"].map((fill) => ({ fill })), [1.5, 2.5, 3.5, 4.5]),
  },
  // A setting the dialog asks for: a color of each look
  {
    name: "brand",
    label: "Brand",
    params: { strong: { kind: "boolean", label: "Bold", default: true } },
    style: ({ strong }) => ({ fill: { light: "#e8f0ff", dark: "#1d2b4a" }, bold: strong }),
  },
];
```

```js
// Library/me/conditions.js
export default ({ normalize }) => [
  {
    name: "overdue",
    label: "Overdue",
    description: "Rows whose due date has passed and that are not done",
    test: (cell, { row }) => row.due?.date !== undefined && row.due.date < Date.now() && normalize(row.status?.text ?? "") !== "done",
  },
];
```

```lua
silverware.table.defineFormats(js.importFromSpace("Library/me/formats.js"))
silverware.table.defineConditions(js.importFromSpace("Library/me/conditions.js"))
```

* The file's default export is the list, or a function that gets the helpers (below) and returns it; an item of the list may also be such a function. Each has a `name` (letters, digits and `_`, starting with a letter: how rules store it), a `label` (what the dialog shows), optionally a `description` and `params`.
* **A condition** has `test(cell, context)`: true for the cells the rule formats.
* **A format** has a `style` (one look for every cell, or a function of the params giving one) or a `look(cell, context)` (the look of one cell, or nothing to leave it as it is).
* A **style** is data: `fill`, `color` (the text's), `bold`, `italic`, `underline`, `strike`, `bar` (`{ share, color }`: a bar under the content, `share` from 0 to 1), `icon` (a short text before the content, such as ▲ or ●) and `iconColor`. A color is a palette's name (`red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`: a light tint as a fill, a dark shade as text, a strong one for bars and icons, each with its dark look), any CSS color, or `{ light, dark }`.
* **`cell`**: `text` (what it shows), `value` (what sorting compares), `number` and `date` (milliseconds) where the value is one, `column` (its column's key).
* **`context`**: `params` (the rule's settings, as `params` declares them), `scope` (the cells the rule applies to together: `min`, `max`, `average`, `sum`, `size`, `numbers`, `position(cell)` from 0 at the smallest to 1 at the largest, `share(cell)` a bar's length, `rank(cell)` 1 the largest, `rank(cell, true)` 1 the smallest, `quantile(cell)` its place among the numbers from 0 to 1, `count(cell)` how many have its value; a format's are the cells its condition picked), `row` (the cells of its row by their column's key) and `formula(text)` (a formula of one row calculated for the cell's row, with the `formulas` module).
* **`params`**: what the dialog asks for, each `{ kind, label, default }`: `number` (with `integer`, `min`, `max`), `choice` (`values`, `labels`), `text`, `pattern` (a filter's syntax, checked as typed), `formula` (a formula of one row: the dialog offers the functions, the page's names and the table's columns as it is typed, shows the syntax of the function the caret is in and says where it does not read), `color`, `boolean`, `style` (the style editor) or `list` (rows of the fields in its `of`, as many as the user adds). `line`: params of the same line show side by side under its name (a color scale's *Minpoint*: its color, its kind, its value); `visible(params)`: whether the dialog shows the field, by the params as set (a point's value only for a number).
* **The helpers**: `palette` (the names above), `mix(colors, t)` (the color at `t` from 0 to 1 along two or more colors), `gradient(colors, n)` (n colors along them), `levels(styles, split)` (a `look` grading numbers into as many levels as styles: `"equal"` ranges, `"quantiles"`, thresholds `[1.5, 2.5]`, `{ percent: [33, 67] }`), `matches(pattern)` (a test of text in the filter's syntax), `normalize(text)` (case and diacritics taken off), `today()` and `DAY` (dates' milliseconds), `icons` (`up`, `down`, `right`, `dot`, `check`, `cross`, `star`…), `number(text)` (a text as a number, as a cell is read), `excelText(text)`, `excelSearchText(text)` (for Excel's SEARCH: its wildcards `* ? ~` taken as themselves), `excelFilter(pattern, at)` (a filter's pattern as an Excel formula: a regular expression by `REGEXTEST`) and `plainPattern(pattern)` (whether a filter's pattern is plain words, as Excel's "contains" has them).
* `category`: its group in the dialog's lists (*Numbers*, *Text*, *Cells*, *Dates*, *Formula* for the built-in conditions; *Styles*, *By values*, *Scales*, *Icons* for the formats; a name of your own is a group of its own); without one it is under *Other*, last.
* **In an Excel file** (*Export to Excel…*, *Download .xlsx*): a format with a `style` is written as Excel's cell format by itself. A condition, or a format with a `look`, gives its Excel form with `excel(params, at)`, as the built-in ones do (`at` the first cell of the rule's range, `B2`, which its formulas refer to): a condition `{ type, attrs, formulas }` as Excel's file writes a rule (`{ type: "cellIs", attrs: { operator: "greaterThan" }, formulas: ["50"] }`; `excelText(text)` puts a text in Excel's quotes), a format `{ kind: "rules", rules: [{ formula, style }] }` (a formula true for the cells each style is for, the first that holds styling a cell: no rule after it is stopped), `{ kind: "colorScale", points: [{ type, value, color }] }` (`min`, `max`, `num`, `percent`, `percentile`), `{ kind: "dataBar", color }` or `{ kind: "iconSet", set }` (Excel's name: `3Arrows`, `3TrafficLights1`…); a text instead says why it has none. Without `excel` the rule is listed as not written.
* A definition with a built-in one's name replaces it. A mistake in a definition is shown in a notification, the others are defined; a `test` or `look` that throws, or gives something else, formats nothing for that rule, and a notification says why once.

## Themes

A theme sets how tables look: their header, the lines between rows and columns, the striping, corners, shadow and spacing. *Native* (the default) leaves tables as SilverBullet shows them.

* **For every table**: the *Theme* setting (`silverware.table.modules.themes.theme`, in *Silverware Table settings…* or `config.set("silverware.table.modules.themes", { theme = "slate" })`).
* **For one table**: *Theme* in the ⋯ menu of its toolbar picks a theme of its own, stored in the table (`<meta core.table themes.name='slate'>`, needs *Store table metadata*, see [[#Table metadata]]). Hovering a theme there (or moving to it with the arrow keys) shows a small table in it beside the list, with the table's stripes (not for *Global theme*: its theme is the one marked *(default)*). *Global theme*, first in that list, makes the table follow the settings again, its theme and its stripes; a theme (or stripes, the icons under it) picked stays the table's whatever the settings become, also the settings' own one (marked *(default)*).
* **Light or dark**: each theme has both, and SilverBullet decides which one shows (its own light or dark mode).
* **Stripes** are not the theme's: the *Stripes* setting (`silverware.table.modules.themes.stripes`) tints every other row (`rows`, the default, as SilverBullet does), every other column (`columns`) or nothing (`none`), in the theme's color; for one table, the three icons in *Theme* in its ⋯ menu (no stripes, rows, columns) choose (`<meta core.table themes.stripes='columns'>`), *Global theme* there the setting's again. It works with *Native* too.
* Built in: *Native*, *Plain* (no lines, fills nor bold header: plain text in rows and columns, e.g. for a layout), *Playground* (the look of the Silverware Table playground: a light header, soft striping), *Minimal* (a small-caps header, thin lines, no other fills), *Slate* (a card with rounded corners and a soft shadow, sans-serif type), *Grid* (a spreadsheet, every cell outlined, compact, sans-serif type), *Ocean* (a deep teal header, teal striping), *Paper* (warm tones, serif type), *Contrast* (high contrast: a black header, strong lines, roomy cells), *Compact* (small type, tight cells, for tables of data), *Bold* (thick lines, square corners, a hard shadow, yellow on black), *Soft* (airy: a pastel header, large corners, rounded type where the device has it), *Ledger* (an account book: lines between columns, green-bar stripes, figures in a monospace font, so they line up).
* The `themes` module can be turned off (see [[#Modules]]): tables look as SilverBullet shows them, and a theme stored in a table is kept but not used.

### Your own theme

A theme is a `space-style` block on any page of your space; Silverware Table finds it there and offers it in the setting and in a table's menu by its name. Set the variables you want, in a block for the light look and one for the dark; any you leave out stay as SilverBullet has them:

```css
.sb-table-widget[data-swt-theme="sand"] {
  --swt-head-bg: #f3ead8;
  --swt-head-color: #4a3b2a;
  --swt-stripe: #fbf7ef;
  --swt-border: #e6dcc8;
  --swt-row-line: 1px;
  --swt-radius: 8px;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="sand"] {
  --swt-head-bg: #3b3326;
  --swt-head-color: #f3ead8;
  --swt-stripe: rgba(243, 234, 216, 0.05);
  --swt-border: #4b4234;
}
```

A theme's name is letters, digits, `-` and `_`; menus show it capitalized (`sand` is *Sand*).

| Variable | What it sets | Example |
|---|---|---|
| `--swt-head-bg` | The header's background | `#f1f5f9` |
| `--swt-head-color` | The header's text color (`currentColor`: as the rows) | `#334155` |
| `--swt-head-weight` | The header's font weight | `600` |
| `--swt-head-size` | The header's font size | `0.8em` |
| `--swt-head-transform` | The header's letter case | `uppercase` |
| `--swt-head-spacing` | The header's letter spacing | `0.05em` |
| `--swt-head-padding` | The header cells' padding (else as `--swt-padding`) | `10px 12px` |
| `--swt-stripe` | The color of stripes (rows, columns or none is the *Stripes* setting's) | `#f8fafc` |
| `--swt-hover` | The row under the pointer | `rgba(0, 0, 0, 0.04)` |
| `--swt-color` | The rows' text color | `#1f2937` |
| `--swt-accent` | Selection, pinned rows and columns, formula marks | `#2563eb` |
| `--swt-border` | The color of every line below | `#e5e7eb` |
| `--swt-row-line` | Lines between rows | `1px` |
| `--swt-head-line` | The line under the header (else as `--swt-row-line`) | `2px` |
| `--swt-column-line` | Lines between columns | `1px` |
| `--swt-outline` | A line around the table | `1px` |
| `--swt-sheet-table-line` | The line around a table in the sheet view, where it ends among the empty cells | the text's color, 40 % |
| `--swt-radius` | The table's corners | `8px` |
| `--swt-shadow` | The table's shadow | `0 2px 8px rgba(0, 0, 0, 0.1)` |
| `--swt-padding` | The cells' padding (density) | `6px 10px` |
| `--swt-font-size` | The table's font size | `0.9em` |
| `--swt-font` | The table's font (fonts on the device; none downloaded) | `ui-monospace, monospace` |
| `--swt-head-font` | The header's font (else as `--swt-font`) | `Georgia, serif` |

The header's background and its text color go together: SilverBullet's header is dark with light text, so a light header needs `--swt-head-color` too. For more than these, a theme's block can style the table further (`.sb-table-widget[data-swt-theme="sand"] td { … }`).

## Sheet view

The sheet icon (a grid, before the sheet's name in the first row of a table's ⋯ menu, or in its toolbar while you hold Shift) shows the table like a spreadsheet, over the whole window: the columns' letters above, the rows' numbers beside them (as formulas refer to cells, `B3`), and empty rows and columns past the table's last row and column. More appear as you scroll on.

* **Select an empty cell** as a table's cell: a click selects it (in *Edit mode* it edits it at once); typing, a second click, Enter or F2 edits it; Esc unselects it, a second Esc closes the view. An arrow on a table's edge cell goes on out of the table, as Ctrl+arrow does too: from a cell selected it selects the cell past the edge, from a cell edited it saves it and edits the cell past the edge. Among the empty cells Ctrl+arrows move as arrows do; in an empty cell's editor Ctrl+arrow saves it and edits the next cell that way. Arrows go on from the table's last row or column into the empty cells and back.
* **Grow the table**: click the empty cell right under its last row, or right next to its last column, and type. Enter or Tab saves it, and the table grows by that row or column, in one edit (one Ctrl+Z), as a spreadsheet's table grows; a new column is named *Column 5* (rename it like any header). Typing into the header's line right next to the table adds a column with that name. A value typed farther from the table makes a table of its own there (see *Sheets of several tables*); cells pasted there (Ctrl+V, from a spreadsheet or a table) make a table too, its top left at that cell and their first row its header (a single row pasted goes under *Column 1*, *Column 2*…), where it does not cover another table. As in the table, Enter then edits the cell below, Tab the next one (Shift the other way), Esc leaves the cell selected.
* **Paste into an empty cell**: Ctrl+V on the cell right under or next to the table pastes cells copied from a spreadsheet there, and the table grows to hold all of them; a single value goes into the cell's editor. Farther from the table, what is pasted goes into the cell's editor as text.
* **Nothing is added for a cell left empty**: Enter on an empty cell, or Esc, writes nothing.
* **Rows pinned to the bottom stay last**: a new row goes above them, as Tab on the last cell does; a column, left of the columns pinned to the right.
* **Sheets' tabs**: at the bottom, one tab per sheet of the page, in the page's order; click one (or press Ctrl+Shift+PageDown / Ctrl+Shift+PageUp) to show that sheet; the sheet view of a table on no sheet has that table's tab first (*Table*). **+** shows a new empty sheet (*Sheet1*, *Sheet2*… as the page has none of that name); a value typed, cells pasted or a table added there make its first table, and the sheet exists from then on; left empty, it goes. Click the tab shown (or right-click any) for its menu: the pencil in its title renames the sheet in all its tables at once, *Remove sheet* takes its tables off it (they stay in the page with their names). These need *Store table metadata*.
* **Close it** with the same icon (*Exit sheet view*) or Esc. *Full screen* stays as it was: the table over the window without empty cells.

### Sheets of several tables

A page's tables can share a sheet, as a spreadsheet's sheet holds several tables. The row *Sheet* of the table's ⋯ menu shows the sheet it is on (*Sheet: Budget*; *Sheet* alone on none); click its pencil and type another to put the table on that sheet: one of the page's, or a new one. It keeps its place there where nothing is in its way, else it goes in column A, one empty row under the sheet's lowest table; the sheet's other tables stay where they are. A table without a name is named for it (`table1`): the sheet's other tables refer to its cells by its name (`costs!B2`). An empty name, *Remove from sheet* under the field, or the × of the row *Sheet* takes the table off its sheet, its name kept. The table keeps its place in the page, which shows it as before; its metadata row says which sheet it is on and where (`<meta core.table core.name='costs' sheet.name='Budget' sheet.at='B3'>`). It needs the *Store table metadata* setting (without it, a table on a sheet can still move to another one, or off it). A sheet view showing the table goes to its new sheet. In the sheet view, right-click an empty cell (or long-press it, or press the Menu key on it selected) and choose *Add table here*: it lists the page's tables not on this sheet, by their name, else their header; hover one to see where it would go, click it to put it on the sheet with its top left in that cell. One that would cover a table of the sheet is offered disabled. A table moved from another sheet whose only table it is asks first, as that sheet goes with it. *Delete table* in its ⋯ menu takes it off the sheet with the page; the sheet's column widths, kept in its first table, go to the next one (with the *Store table metadata* setting off they stay in the table that has them, also when it is no longer the first, and go when it is deleted: you are asked first).

To move a table on its sheet:

* Drag the handle at its top left corner (it shows while the pointer is over the table; on a touch screen, while a cell of it is selected). Its outline shows where it would go, with the address of its top left cell; red where another table is in the way, and there it does not go. Esc cancels.
* Or select the whole table (a click on that handle) and drag the selection by its edge, as you move cells.
* Or pick *Move table…* in its ⋯ menu or a cell's menu, then click or tap the cell where its top left corner goes; Esc cancels. This is the easy way on a phone.

Moving changes only the table's place on the sheet (`sheet.at`); the page keeps the table where it is, and its formulas stay as they are. A table never goes over another one, nor pushes one aside. A table shown alone (on no sheet) is put on a sheet first: its toolbar says *No sheet* in red there, whatever the *Names in the toolbar* setting; click it and type a sheet's name.

Rows and columns pinned in a table (see [[#Pinning]]) stay in view there while their table is: as the sheet scrolls, the header with the rows pinned to the top stays at the top of the view, the rows pinned to the bottom at its bottom and pinned columns at its sides, never past their table. A table still grows as in the page: a value typed under a row pinned to the bottom (a total) goes into a new row above it, and one typed right of a column pinned to the right into a new column left of it, so the pinned ones stay last.

The sheet view of a table on a sheet shows all the sheet's tables, each at its place (its `sheet.at` cell), however far apart they are in the page. The sheet's rows have one height, and each column is as wide as the widest of the tables' columns in it. The empty cell right next to a table's last column (in its rows) or right under its last row (in its columns) grows that table, as for a table alone (the one left of it, where a cell is both).

**A value typed into an empty cell that no table grows to makes a new table there**: its header *Column 1* goes in the cell above, the value under it (on the sheet's first row the table starts there and the value goes one row lower, so the header fits), named like `table1` and placed after the page's last table; Enter then goes on under the value, which grows the new table. A formula typed there is saved as text, as its table does not exist yet: edit the cell in the sheet view and remove the `'` before the `=` to make it a formula. On a table that is on no sheet, its sheet view becomes a sheet so: the table goes on a new sheet (`Sheet1`) at A1, named if it has no name, with the new table, in the same edit (one Ctrl+Z undoes it all). Both need the *Store table metadata* setting.

**A table that grows makes room on its sheet**, so the layout you made stays as it is:

* Rows added to a table (Tab on its last row, the +, *Insert row*, *Paste as new rows*) move every table that starts below it down by as many rows, whatever its columns, so tables side by side stay in line. Columns added move every table that starts right of it to the right.
* A value typed or pasted into empty cells past a table takes those cells: nothing moves while they are empty, and where the table would reach into another one, every table below it (or right of it) moves as far as needed.
* A table beside it (starting next to it, above its bottom) stays where it is.
* A table that gets smaller moves nothing back.
* It is one edit: one Ctrl+Z puts everything back.

In the sheet view a column with no width of its own is as wide as its widest cell, at most 300 px (or the *Maximum column width* of long text, where it is smaller); text longer than its column is cut there: a header's name with an ellipsis, a cell's as the longText module's setting says (wrapped within the row's height, or on one line with an ellipsis). A table's header and pinned rows and columns stay in view while the table is, as frozen rows and columns do in a spreadsheet, each table on its own. A column's width dragged there (the handle on a header's right edge, or the right edge of the column's letter above the sheet, also for a column no table has) is the sheet's column's, for every table in that column, as a spreadsheet's columns are (kept in the sheet's first table, `sheet.width.B='140'`); a double-click makes it automatic again. A table's own widths still apply in the page. The sheet view of a table alone works the same: the width dragged is its sheet view's column's, kept in the table.

In the sheet view formulas read in the sheet's addresses, as the letters and numbers show them: in a table at `D1`, whose own `A1` is the sheet's `D2`, `=prices!B1*2` reads `=B2*2` where `prices` is at `A1`, and a formula typed or pointed at there is stored in its tables' addresses again (`=B3*2` as `prices!B2*2`). A reference stays on its row: sorting a table changes the address shown, not the value. In a sorted or filtered table a range of several rows cannot be pointed at there, as its rows are not in the markdown's order (the hint under the cell says so); a click on a header gives the whole column (`[qty]`). While a formula waits for a reference, the sheet's other tables can be pointed at too: a cell gives its sheet's address (stored by the table's name, `prices!B2`), a header the table's column (`prices![price]`). A range is always within one table. A reference to a table on no sheet, or on another page, reads as stored; one to the sheet's empty cells is written as `#REF!`. Out of the sheet view a formula reads as stored.

Everything else works as in the page: editing, selecting, menus, formulas. A table sorted or filtered shows a row added so where its sorting or filter puts it (or hides it); the rows' numbers are the sheet's. The empty cells are not cells yet: a selection, AutoFill or a drag stays within the table, a formula cannot refer to them, and the cell menu has nothing for them.

## Large tables

* **Sticky header**: while you scroll past a long table, its header stays at the top of the view, with the toolbar above it.
* **Maximum height**: with the *Maximum table height* setting, a taller table scrolls inside its own box; its header stays at the top of that box. See [[#Settings]].
* **Wide tables** scroll sideways; Silverware Table keeps the scroll position after edits, and new rows open their editor in a column you can see.
* **Autoscroll**: the middle mouse button over a wide table scrolls the table sideways and the page up and down together; in the sheet view, anywhere on the sheet (a table or an empty cell), it scrolls the sheet both ways. Hold and drag, or click and move; the next click ends it.

## Settings

These settings are for every table in the space (a table's own sorting, filters, widths and names are in its menus).

**Silverware Table settings** (*Silverware Table settings…* in a table's ⋯ menu, or the *Silverware Table: Settings* command) shows them all in one dialog: *General*, then the modules by kind (*Editing*, *Data*, *Look*, *View*, *Export*), each with its switch and its own settings under it. Nothing changes until *Save*: then they are written into SilverBullet's configuration, where the Configuration Manager keeps its settings (the managed block of your [[CONFIG]] page), so both always show the same. Turning a module on or off saves and reloads the page (*Save and reload*), as modules start with Silverware Table. *Cancel* (or Esc) closes it unsaved.

You can also open *Configuration: Open* (Ctrl+, / Cmd+,) and find the *Silverware Table* and *Silverware Table: Modules* categories, or set them in your [[CONFIG]]. Settings of whole tables are `silverware.table.<setting>`, those of a part of Silverware Table `silverware.table.<part>.<setting>`, and those of a module (a part that can be turned off) `silverware.table.modules.<module>.<setting>`. A part is set in one go, with only what you change (the rest keeps its default):

```lua
config.set("silverware.table.metadata", true)
config.set("silverware.table.editor", { enterKey = "moveDown", selectOnClick = true })
config.set("silverware.table.modules.formulas", { enabled = false })
config.set("silverware.table.expressions", { refreshDelay = 1000 })
```

Setting a part replaces what an earlier `config.set` of the same part set: set each part once, or one setting at a time (`config.set("silverware.table.editor.enterKey", "moveDown")`).

### Tables

* **Store table metadata** (`silverware.table.metadata`), default `true`
  * `true`: table settings (the sorting and pinned rows and columns) can be stored in any table, see [[#Table metadata]], rows and columns can be pinned, see [[#Pinning]], and formulas can be added, see [[#Formulas]].
  * `false`: tables without metadata get none: sorting is a view only, and a formula typed into a cell is saved as text. Tables that already have metadata keep using it: their sorting is still stored, rows and columns can be unpinned and their formulas keep working, but nothing new can be pinned and no new formula added.
* **Maximum table height (px)** (`silverware.table.maxHeight`), default `0`
  * `0`: no limit, a table is as tall as its rows.
  * A number of pixels, e.g. `400`: a taller table gets its own vertical scrollbar.

### Formatting

* **Auto-format on edit** (`silverware.table.autoFormat`), default `true`
  * `true`: a table edited with Silverware Table is written with aligned pipes, padded to the widest cell of each column (as *Long cells* allows) and aligned as its delimiter row says.
  * `false`: each table keeps its own style: aligned tables stay aligned, compact tables stay compact, untouched rows are kept byte for byte.
  * Either way, *Format table* in the ⋯ menu of a table's toolbar aligns that table now (e.g. one typed by hand); an aligned table stays as it is.
* **Long cells** (`silverware.table.formatLong`), default `limit`: how a table is formatted where cells are long, such as a link. It applies to tables formatted as they are edited and to *Format table*.
  * `limit` (*Limit column width*): **Max padded cell (chars)** (`silverware.table.formatCellWidth`), default `40`. Each column is padded to its longest cell of at most this many characters. A longer cell is written as it is, past the column's `|`, so the other rows and the delimiter row do not widen. `0`: no limit, every column is as wide as its widest cell.
  * `compact` (*Compact if too wide*): **Max line length (chars)** (`silverware.table.formatLineWidth`), default `80`. A table whose longest line would be longer than this with its columns padded is written compact: no padding, the delimiter row `---`, as Prettier does with `proseWrap: "never"`. Narrower tables stay aligned. `0`: no limit.

### Cell editor (`silverware.table.editor`)

* **Enter in a cell editor** (`enterKey`), default `moveDown`
  * `save`: Enter saves the cell.
  * `moveDown`: Enter saves and edits the cell below (on the last row: a row added under it, edited); Shift+Enter too, opening it with its text selected (with *Click selects the cell's text*: with the cursor at the end).
  * `moveDownOnly`: as `moveDown`, but on the last row Enter only saves the cell and leaves it selected, no row added (on a sheet too).
* **Click selects the cell's text** (`selectOnClick`), default `false`
  * `false`: a click, Enter, Tab and Ctrl+arrows open a cell with the cursor at the end of its text; Shift+Enter opens the cell below with its whole text selected.
  * `true`: they open it with its whole text selected; Shift+Enter with the cursor at the end.
  * Without the `selection` module, Shift+click and Ctrl+Shift+arrows open the cell as Shift+Enter does.
* **Ctrl+Enter adds a row** (`ctrlEnterAddsRow`), default `true`
  * `true`: Ctrl+Enter in a cell editor saves the cell, adds an empty row below its row and edits it.
  * `false`: Ctrl+Enter works like Enter.

### Long text in cells (`silverware.table.modules.longText`)

The `longText` module (see [[#Modules]]); off, cells show as SilverBullet renders them: on one line, as wide as their text.

* **Text that does not fit** (`overflow`), default `wrap`
  * `wrap`: text longer than the column's maximum width wraps onto more lines, up to the maximum cell height; the rest is cut and fades out.
  * `ellipsis`: it stays on one line, cut with `…`.
  * A cell whose text is cut shows an expand button at its top right when hovered: it opens the cell in a popup, its whole text wrapped, to read and edit (Enter saves, Esc closes; Ctrl+arrows and Ctrl+Alt+arrows move in the text only, not to other cells or rows). While a cell is edited, F2 (or the same button, shown when the text does not fit the field, e.g. a long formula) goes on in the popup.
* **Maximum column width (px)** (`maxWidth`), default `500`: wider text wraps or is cut. `0`: no limit, a cell is as wide as its text.
* **Maximum cell height (px)** (`maxHeight`), default `200`: a wrapped cell no taller than this. `0`: no limit.

### Cells with Lua expressions (`silverware.table.expressions`)

* **Delay before refreshing (ms)** (`refreshDelay`), default `500`
  * After you edit a table, a cell that holds a Lua expression (`${…}`) reading the page index (a query, or a formula of a spreadsheet library such as MdTableSheet) shows its new result once SilverBullet has indexed the page again. This is how many milliseconds it waits for the index: raise it if such cells still show old results (a slow device, a large space).

### Modules (`silverware.table.modules`)

Each module can be turned off with `enabled = false`, e.g. `config.set("silverware.table.modules.paste", { enabled = false })`; all are on by default. A change applies when the page is loaded again. A module turned off is not loaded at all: what it stored in tables stays as it is, and is not used. Editing cells, sorting and the toolbar are always on.

| Module | When on |
|---|---|
| `formulas` | Formulas can be typed into cells, with their help and references; *Recalculate* in the toolbar; every edit recalculates the table and the tables referring to it, and references follow moved rows and columns. Off: nothing is recalculated, results stay as written, and references do not follow moves. A typed formula is saved as text; a formula cell edited, pasted over or emptied keeps its formula (hidden), which is used again once formulas are on. See [[#Formulas]]. |
| `names` | Tables, columns, rows and cells can be named: the pencil in the title of a table's ⋯ menu, a column's, a row's or a cell's menu; named headers and cells show a mark. Off: none of these, and no marks; names already in tables are kept and formulas still use them, but a duplicated row copies them too. See [[#Table names]]. |
| `pageLinks` | Formulas can refer to tables and named cells on other pages (`[[Prices]]fruit!B2`), which Silverware Table reads for them. Off: it reads no other page; formulas that refer to one keep the results they have (the formulas using them too), a new one shows `#REF!`. It needs the `formulas` module. See [[#Tables on other pages]]. |
| `sources` | Formulas, views, pivots and choice lists read the sources of the space a script gives (`silverware.table.defineSource`, read as `@tasks`). Off: no source is read; formulas, views and pivots reading one keep what they show, a choice list of one checks nothing. See [[#Sources of the space]]. |
| `filters` | Rows can be filtered: the toolbar's filter icon shows a filter field under each header, *Filter* in a column menu opens that column's filter, *Filter: = value* in the cell menu filters by a cell's value; with *Store table metadata* the filters are stored in the table. Its setting `smart` (default `true`): fields understand `>10`, `/pattern/`, `=text`, `a\|b` and `!filter`; `false`: everything typed is text to find. Off: no filtering; filters stored in a table are kept but not used. See [[#Filtering]]. |
| `columnTypes` | A header's type hashtag formats its column, the cell editor offers the type's values, and the column menu has *Type*. Off: cells show as written. See [[#Column types]]. |
| `conditions` | Conditional formatting: rules that color cells by their values, from a column's menu and the table's ⋯ menu; a table with rules shows their icon in its toolbar. Off: cells look as they are; rules stored in tables are kept but not used. See [[#Conditional formatting]]. |
| `selection` | Dragging across cells, Shift+click and Shift+arrows select them; Ctrl+C copies them, Delete empties them (whole rows, columns or a whole table already empty: deletes them); *Copy*, *Clear* and *Delete N rows / columns* in the cell menu. A click selects a cell, a second one edits it; the toolbar's *Edit mode* button edits on the first click. Off: a click always edits; Shift+click opens the cell as Shift+Enter does. |
| `themes` | Tables look as their theme sets: the *Theme* setting (`theme`, default `native`), or a table's own from *Theme* in its ⋯ menu; stripes from *Stripes* (`stripes`: `rows`, the default, `columns` or `none`), or as the icons in *Theme* in a table's ⋯ menu say. See [[#Themes]]. Off: tables look as SilverBullet shows them (striped); a theme stored in a table is kept but not used. |
| `lazy` | The toolbar's lazy saving icon (a clock) switches a table to saving its cells edited together, a moment after editing stops. Setting `delay` (milliseconds, default `500`). See [[#Lazy saving]]. Off: every cell is saved as you leave it. |
| `export` | *Copy as CSV* and *Copy as Markdown* in the table's ⋯ menu copy the whole table. |
| `autofill` | The fill handle at the corner of the cells selected: drag it to fill the cells after them, double-click it to fill down. See [[#AutoFill]]. Needs `selection`. Off: no handle. |
| `pivot` | Pivot tables: a table defined in its metadata row as a summary of another, calculated anew with each edit of it, *Refresh pivot* in its toolbar. Needs `formulas`. Off: pivots stay as written, their cells edited as any table's. See [[#Pivot tables]]. |
| `view` | Views: a table made by one formula (`view.formula` in its metadata row), calculated anew with each edit of what it reads, *Insert view…*, *View settings…* and *Refresh view*. Needs `formulas`. Off: views stay as written, their cells edited as any table's. See [[#Views]]. |
| `excel` | *Export to Excel…* in the table's ⋯ menu: copy for Excel, or download an .xlsx file with the formulas. Setting `functions`: templates for your custom functions in the file. See [[#Excel]]. |
| `paste` | Copy, Cut and Paste in the cell menu; Ctrl+X cuts cells (they move where they are pasted); Ctrl+V pastes cells copied from a spreadsheet over the table, Ctrl+Shift+V as new rows. Off: a paste goes into the cell editor as text, no Cut or Paste in the cell menu (Copy and Ctrl+C stay, with the `selection` module). |
| `handles` | The handles beside rows and above columns: drag them to move rows and columns, click them for the row and column menus. Off: rows and columns still move with Ctrl+Alt+arrows, and the **+** on a border still inserts them. |
| `longText` | Long text wraps (up to a maximum cell height) or is cut with an ellipsis at a maximum column width; a cut cell shows an expand button for its popup. Settings: see [[#Long text in cells (`silverware.table.modules.longText`)]]. Off: cells on one line, as wide as their text (F2 still opens a cell's popup while editing). |
| `widths` | Columns' widths set by dragging the edge between two headers (the table keeps its width), *Fit to content* in the column's menu, *Reset column widths* in the table's ⋯ menu; with *Store table metadata* stored in the table. Off: columns are as wide as their text; widths stored in tables are kept but not used. |
| `sticky` | A table's header stays in view while the page scrolls past the table, and rows pinned to the bottom stay at the bottom of the view. |
| `autoscroll` | The middle mouse button over a table scrolls it. |
| `fullScreen` | The table's icon (in the first row of its ⋯ menu, or in its toolbar while you hold Shift) shows the table over the whole window (not the browser's full screen), with its toolbar, menus and editing as in the page, the columns' letters above the header and the rows' numbers left of them, as formulas refer to them (`B3`); the same icon (*Exit full screen*) or Esc closes it. |
| `sheet` | The sheet's name in the table's ⋯ menu (a table is put on a sheet, moved and taken off it there) and the sheet icon, which shows the table's sheet as a spreadsheet over the whole window, as `fullScreen` does, with empty rows and columns around its tables (more as you scroll on), their letters and numbers too. Type into the empty cell right under or next to a table: Enter or Tab saves it, and the table grows by that row or column, a new column named *Column 4*; farther from the tables, a value makes a table of its own. A cell left empty adds nothing; Esc drops it. The same icon (*Exit sheet view*) or Esc closes it. See [[#Sheet view]]. |
| `tableLabels` | A named table shows its name in a small tab at its top right corner, so you can tell tables apart at a glance, in the page and on the sheet; a pivot shows *Pivot of* its source there, named or not, and a table whose data are out of date (formulas' results, a pivot) says *Out of date* there, highlighted, so you see it without hovering the table. The tab stays on the header while the header is held at the top, and it hides while you hover the table (or just above its header, where the tab is), where the toolbar shows instead. |
| `largeTables` | Off by default. A table with many rows (setting `minRows`, default `200`) scrolls in a box of its own: as tall as *Maximum table height*, else the window. Only the rows in and around the box's view are in the page, so editing, sorting and filtering a table of thousands of rows stays quick. The browser's find (Ctrl+F) finds only those rows. Off: every row is in the page, the table as tall as its rows (unless *Maximum table height* is set). |

## Table names

A table can have a name, so formulas in other tables can refer to it. The title of the table's ⋯ menu is its name (*Table* while it has none): click the pencil after it, type the name and press Enter; an empty name removes it. While you hold Shift the toolbar shows the name too: a click on it names it as well. The name is stored in the table's metadata row (`<meta core.table core.name='prices'>`), so it needs the *Store table metadata* setting; without it, a name the table has can still be changed or removed.

* A name is letters, digits and `_`, not starting with a digit, e.g. `prices` or `price_list`. Names that read as a cell (`A1`, `AB12`) or as `TRUE` / `FALSE` are refused.
* Names are compared ignoring case, and two tables on a page cannot have the same name.
* Renaming a table renames the references to it in the formulas on the page; removing the name (or the table's metadata) leaves them as they are, showing `#REF!`.

## Table metadata

With the *Store table metadata* setting on, Silverware Table stores a table's settings in a last row that holds only a `<meta …>` tag: the sorting, the filters and the pinned rows and columns.

```
| Name  | Qty |
| ----- | --: |
| Pear  |   3 |
| Apple |  10 |
| Total |  13 |
| <meta core.table core.-c-qty.sort='desc' core.pin-bottom='1'> |
```

* `core.table` marks the row as the table's metadata. Every other attribute starts with whose it is: `core.` for Silverware Table's own, else the module's name (`filters.`, `widths.`, `themes.`, `sheet.`).
* `core.-c-qty.sort` is the sorting (by the column Qty, `asc` or `desc`), `core.pin-top`, `core.pin-bottom`, `core.pin-left` and `core.pin-right` how many rows (columns) at each edge are pinned, `core.name` the table's name (see [[#Table names]]). `filters.-c-qty.condition` is a column's filter (as typed), `widths.-c-qty.size` its width in pixels and `widths.box` the width the table had room for when the widths were set (the table keeps that share of the room it has), `themes.name` the table's own theme and `themes.stripes` its stripes (`rows`, `columns` or `none`, see [[#Themes]]), `sheet.name` and `sheet.at` its sheet and its place there (see [[#Sheet view]]).

* The row is hidden in SilverBullet. Browsers never show `<meta>`, and other markdown renderers (GitHub, Obsidian) drop it, leaving at most an empty row.
* It is always the last row: new rows go above it, and it is not sorted, filtered or moved.
* Attributes of a column name it after `-c-`: `core.-c-qty.sort`, `filters.-c-status.condition`. Names are keys, as for formula references (see [[#References]]): the column `Unit price` is `-c-unit_price`, and any spelling with that key names it; a column with a name of its own goes by it. With several columns of the same name, the occurrence is added: `filters.-c-qty:2.condition` is the second column named Qty. They follow their column when it is renamed or moved, and are removed with it.
* A filter is stored as typed, once you leave its field; a `|` in it is written `\|`, as everywhere in a table: `filters.-c-status.condition='=open\|blocked'`.
* When nothing is left in it (no sorting, no filter, nothing pinned, no name, no theme, no stripes), the row is removed.
* With the setting off, nothing new is stored, also in a table that has a `<meta>` row: what a table has may change or go (its sorting, also by another column; a filter or width of a column that has one; its theme, stripes, name, sheet and place; pins at an edge that has them), nothing is added. In cells the same: a formula or a name a cell has may change, a new one is left out of the write (you are told so), the cell keeping its text; a calculated column still fills new rows, its formula being the table's already. When the row is left empty, it is removed.
* To remove metadata: *Remove metadata* in the ⋯ menu of a table's toolbar removes that table's `<meta>` tags; the *Silverware Table: Remove table metadata* command removes them from all tables on the page (it says how many). That is the metadata row (a sorting and filters stored there end: the rows show as written; the table's name, theme and stripes go too) and the formulas stored in cells (see [[#Formulas]]): those cells keep their current results as plain values. *Remove metadata* in the menu of a cell, of the cells selected, or of a row or a column (its handle's menu, or a header's) removes only theirs: the hidden tags of those cells (a column's header included) and, for a column, what the metadata row keeps of it (its stored sorting, filter, width); the table's own metadata stays. It shows only where there is some. All of them ask first, saying whose data goes (Silverware Table's own, each module's by its name, also a module turned off) and in how many cells, and one Ctrl+Z brings everything back.
* SilverBullet indexes the row like any other: a query over the table's rows (`index.tag "table"`) also returns it, with the `<meta …>` text in its first column.

## How your markdown is kept

* Every change is one ordinary edit: Ctrl+Z undoes it.
* With *Auto-format on edit* on (the default), every table you edit is written with aligned pipes (a table with long cells as *Long cells* says). Tables are formatted only when edited, never just by viewing them. With it off, rows you did not change are kept byte for byte, and aligned tables stay aligned, compact ones compact. See [[#Settings]].
* Cells that are one `${…}` expression (e.g. formulas of a spreadsheet library such as MdTableSheet) are re-evaluated once the page is re-indexed after an edit, so they do not keep a stale result.
* Sorting (unless stored as [[#Table metadata]]), filters and scroll positions (sideways and, with a maximum height, up and down) are views only: they are remembered per table until the page is reloaded, and never written to the page.
* SilverBullet does not show columns without a name, which shifts the header against the data. For such a table Silverware Table shows a notice with a *Name them* button instead of enhancing it.

## Limits

* Works on tables written in the page. Query and Lua output, and tables in block quotes, are left as they are.
* If a SilverBullet update renders tables differently, Silverware Table switches itself off with one notification, and tables behave as without it.

## Implementation

Silverware Table is started by [silverware-table-init](silverware-table-init.md) (its settings, events and commands), its Space Lua API is [silverware-table-api](silverware-table-api.md) and its look [silverware-table-style](silverware-table-style.md). All three are installed with this page.
