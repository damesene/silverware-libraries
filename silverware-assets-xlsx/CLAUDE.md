# Silverware Assets XLSX

Excel workbooks (.xlsx) read by ExcelJS and drawn as spreadsheets (prefix `swa-xlsx-`, settings and API under `silverware.assets_xlsx`: none yet), a type of file registered with Silverware Assets through its API alone (`silverware.assets.api`, handed over by the init page; `shared/assets.ts`). The plan and decisions, shared with Silverware Assets PDF and DOCX: [docs/silverware-viewers.md](../docs/silverware-viewers.md). User docs: `silverware-assets-xlsx.md`; `-init.md` (the bridge: Assets' API), `-style.md` (its own rules and the shared reader's block, `shared/docreader.css`).

## Mental model

- **One type, `xlsx`** (ext `xlsx`, its MIME): `preview` the first sheet's first cells drawn small (`src/preview.ts`), `embed` a reader of every sheet (`src/reader.ts`, in the shared shell `shared/docreader.ts`: a sheet at a time, its tabs in the bar's tools), which Assets draws for the original and in its side panel and enlarged view (`RenderContext.fills`).
- **ExcelJS reads, the library draws**: `src/workbook.ts` makes what ExcelJS read into the model (`src/model.ts`, plain data: each cell's text and look, widths and heights in px, merges, frozen panes, what was cut past `MOST`), `src/format.ts` shows a value by its number format, `src/table.ts` draws a sheet as a table (letters, numbers, Excel's grid; `holdFrozen` makes the frozen rows and columns sticky once laid out). All of these pure or DOM-only: ExcelJS' objects are declared structurally in workbook.ts, never imported.
- **ExcelJS is a file beside the bundle** (`silverware-assets-xlsx-exceljs.js`, built by `scripts/build.mjs` from `src/vendor.ts`, its package's `bare` browser build: no polyfills), loaded the first time a workbook is drawn (`src/load.ts`). A workbook is fetched and read once per file and version (`workbook`, `fileVersion`: replaced under the same name, read again; at most two at once, six kept), its previews and readers drawing what was read. **A preview kept in the space** (`stored`, `storesPreview`): its cells' table as HTML, read back through `shared/safehtml.ts` (`safeHtml`: anyone who can write the space can write it).
- `holdFrozen` measures in the table's own pixels (its CSS zoom divided out: what is set in a zoomed table is scaled again) and finds each cell's column past cells merged down from rows above.

## Gotchas

- A formula's value is the one Excel saved (`result`); nothing is calculated. Dates are UTC (Excel's have no time zone): formatted with `timeZone: "UTC"`.
- Excel's theme colours are its default theme's (Office 2013+), tinted as the file says; a workbook with a theme of its own shows the default's colours.
- The reader stops `mousedown`, `pointerdown` and `keydown` at its element (the shared shell).

## Tests

- `src/isolation.test.ts`: Silverware Assets only through `shared/assets.ts`; the reader's shell and elements of `shared/`; no other plugin's code; ExcelJS in `vendor.ts` alone, which nothing imports.
- Unit tests: the formats (numbers, percent, currency, dates), the colours, a worksheet made into the model (a stand-in of ExcelJS' objects), a sheet drawn; the fallback in jsdom (ExcelJS is not beside `src/`).
- `ui-tests/` against SilverBullet only (`helpers.ts`: a test's pages and files under `UiXlsx/<test>/`; `xlsxOf(build)`, a workbook made with ExcelJS in Node).
