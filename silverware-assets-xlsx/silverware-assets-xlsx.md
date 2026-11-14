---
name: Library/damesene/silverware-assets-xlsx
tags: meta/library
version: 1.0.0
description: "Silverware Assets XLSX: Excel workbooks (.xlsx) in your pages, with Silverware Assets: a preview shows the first sheet's first cells, and the original, the side panel and the enlarged view are a reader of every sheet as a spreadsheet shows it. Works offline."
files:
- silverware-assets-xlsx.js
- silverware-assets-xlsx-init.md
- silverware-assets-xlsx-style.md
- silverware-assets-xlsx-exceljs.js
---
# Silverware Assets XLSX

Excel workbooks (`.xlsx`) your pages embed, drawn in SilverBullet, where without it they are only a card. It needs [Silverware Assets](https://github.com/damesene/silverware-libraries/blob/main/silverware-assets/silverware-assets.md), which shows your embedded files: Silverware Assets XLSX draws how a workbook looks there.

- **A preview** (`![[budget.xlsx|||{ view: preview }]]`, or previews chosen in Silverware Assets' settings) is the first sheet's first cells, drawn small, as high as your previews are. A click on it does what Silverware Assets' settings say (open it in a new tab, in a side panel, enlarged).
- **The original** (`{ view: embed }`) is a reader of the workbook in a box of the page, scrolled inside it: a sheet as a spreadsheet shows it (the columns' letters, the rows' numbers, the cells' fonts, colours, alignment, borders and merged cells, the columns' widths, the rows and columns frozen in Excel held in view), a tab for each sheet in its bar, and zoom.
- **The side panel and the enlarged view** (a file's menu: *Show in a side panel*, *Show enlarged*) are the same reader, as large as the panel.

The workbooks are read by [ExcelJS](https://github.com/exceljs/exceljs), which comes with this library (installed beside it), so it works offline. It is loaded the first time a workbook is shown, not before.

## Good to know

- A formula shows the value Excel saved with it: nothing is calculated, so a workbook saved by a program that does not save its formulas' values shows them empty.
- Numbers and dates are shown by their format near enough (decimals, thousands, percent, currency, dates in your browser's language), not always exactly as Excel shows them; charts, pictures, comments and conditional formatting are not shown.
- A sheet larger than 2000 rows or 100 columns shows its first ones and says so: open the file to see all of it.
- Only `.xlsx` (Excel 2007 and later) is read; an old `.xls` stays a card. Hidden sheets are not shown.
- The reader only shows the workbook: to edit it, open it in Excel or another spreadsheet.
- Without Silverware Assets, this library shows nothing: workbooks are shown as SilverBullet shows them.
