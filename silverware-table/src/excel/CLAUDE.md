# Excel export of Silverware Table: the domain (`excel/`) and its module (`features/excel.ts`)

## Decisions

- **Its own module beside `export`** (CSV, Markdown): it has its own settings and code; both read a table through `src/export/`, neither the other.
- **Excel knows the formulas, the formulas know nothing of Excel**: how each function is written in Excel is a table by name in `functions.ts`, and a test requires every built-in function in `SAME_IN_EXCEL` or `EXCEL_FUNCTIONS`, so a new function needs a decision. A function in neither (a custom one without a template from `silverware.table.modules.excel.functions`) is written as its value.
- **Formulas go into the .xlsx file only**: pasted as text, Excel reads a formula in its UI's language (a Czech Excel wants SUMA and `;`) and does not shift references to where it lands; a file keeps formulas in English. *Copy for Excel* copies values typed with Excel's HTML attributes (`x:num`, `x:bool`, `mso-number-format`; `"\@"` keeps text text, so `1-2` is no date).
- **The file has every row in the markdown's order** (formulas refer to rows by place), the header at row 1, so a formula's A1 is Excel's A2. Copy for Excel has the rows as shown.
- **The sheet's cells are an Excel table** (`xl/tables/table1.xml`, decided 2026-10-24): named as the table (else Table1), columns named unique and non-empty, its last row the totals row where it is the table's only total row, a calculated column's `calculatedColumnFormula` (a row added in Excel gets it), none for a table without rows (Excel's needs one).
- Column references are the table's (`Table1[Qty]`; `[@Qty]` as `Table1[[#This Row],[Qty]]`; `[@[a]:[b]]` as `Table1[[#This Row],[A]:[B]]`; `[ ] # '` escaped by `'`). Not in the totals row (it has no This Row: cells there), and `[qty]` with a total row elsewhere is one run of the column's rows without the total rows, else the formula is its value.
- Operators on ranges are array formulas (`t="array"`), so Excels before 365 calculate them. Functions newer than Excel 2007 get `_xlfn.` (else `#NAME?`). TEXT is written as its value: Excel reads its format codes in its own language.
- Results are written with the formulas (a reader that does not calculate shows them; number formats from the results: a date's result is a date), and `fullCalcOnLoad`.
- **Nothing that would break the file is written**: Excel refuses to open the whole file for one formula it cannot read (verified with `SUM()`), so a call outside its function's minArgs/maxArgs, an empty template or a range as the result is the cell's value, listed in the dialog with why. Templates are put in parentheses, and so are their arguments that are operations.
- A cell's text becomes a number only when nothing written is lost (`PLAIN_NUMBER_RE` in values.ts: `007`, a phone number, `3 kg`, more than 15 digits stay text).
- The dialog groups formulas alike (a calculated column one entry, its cells a range) and shows at most 50.
- A formula reading a source of the space (`@tasks`) is its value.

## Conditional formatting in the file (`conditions.ts`)

- Generic: each definition gives its own Excel form (`excel(params, at)` in conditions/api.ts), built-in and custom alike; a style's format is a dxf in styles.xml; the rules go before the table part. What has no Excel form is listed with why.
- The palette's light hex values are the style page's; a test keeps them in step.
- A filter's pattern (Matches, By keywords) is a formula by `filterExcelFormula` (filter.ts), a regular expression `_xlfn.REGEXTEST` (Microsoft 365 only: written, the dialog says so).
- Compared with Excel 16 rule by rule on 58 cases (our evaluation against the file's DisplayFormat through COM): every case alike but diacritics (the table ignores them as filters do; Excel does not). That led to: number conditions written `AND(ISNUMBER(…))` (Excel's cellIs takes text as greater than numbers, blanks as 0), SEARCH's wildcards escaped (`~`), duplicates of numbers by value, a color scale's ends and a midpoint at an end as Excel colors them, ranges' and keywords' rules not stopping later rules.

## Verified with Excel 16 (English UI) through COM

- 2026-10-24 and before: files open without repair; XLOOKUP, TEXTJOIN (array), CEILING.MATH, EDATE, DATEDIF, WORKDAY calculate; dates, times (`[h]:mm`), percentages, logical values and errors show as written. The Excel table opens as a table of its name, range, filter and totals row; `SUM([Qty])` in the totals row, `[@Qty]*[@[Price €]]`, `SUM(Table1[@[Qty]:[Qty2]])` calculate; a row added (ListRows.Add) gets the calculated columns' formulas; names with `'` and `#` read.
- Copy for Excel from Chrome (Playwright, headed) pasted into Excel keeps its attributes (Chrome strips neither `x:num` nor `mso-number-format`): numbers (`12,99 €` as 12.99) and text as meant.
- 2026-11-03: a file of 29 rules opens without repair, every rule loaded, colors as meant. Build 20326 lacks REGEXTEST: the file opens, that rule formats nothing, the others do.
- Not verified: Excel in another language; the download in SilverBullet's mobile app.
