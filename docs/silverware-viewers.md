# Silverware Assets PDF, Silverware Assets DOCX, Silverware Assets XLSX: readers of documents

Planned 2026-11-14 with the user, after pdf.js was tried inside Silverware Assets (docs/silverware-assets-pdf.md): each format a library of its own, installed by whoever wants it, so nobody downloads a reader they do not use.

## Decided (2026-11-14)

- **One library per format**: **Silverware Assets PDF** (`silverware-assets-pdf/`, prefix `swa-pdf-`, `silverware.assets_pdf`), **Silverware Assets DOCX** (`silverware-assets-docx/`, `swa-docx-`, `silverware.assets_docx`), **Silverware Assets XLSX** (`silverware-assets-xlsx/`, `swa-xlsx-`, `silverware.assets_xlsx`). Named by the file format: "Word" and "Excel" are Microsoft's trademarks; the docs say they open Word and Excel files.
- **Silverware Assets PDF the preview alone** (the user's choice, the same day, once its reader was built): the original, the side panel and the enlarged view stay the browser's own viewer, which reads every page already; Silverware Assets' own PDF type stays the browser's viewer for all, Silverware Assets PDF replaces it with its preview added.
- **What each draws**, a type of file registered with Silverware Assets through its public API (`silverware.assets.api`, `shared/assets.ts`), so Assets' views, menus, side panel (peek) and enlarged view (popover) show it as any file:
  - the **preview**: small, its first page (a PDF's as an image; a DOCX's first page drawn smaller; an XLSX's first sheet's first cells);
  - the **original** (`view: embed`) and the **side panel and enlarged view** (which draw a type's `embed`), DOCX's and XLSX's: a **reader** of the whole document, read-only: the whole DOCX, every sheet of an XLSX with its tabs. In the page a box of the embed's height (Assets' `heights.embed`), scrolled inside; in a panel, the panel's room. A PDF's: the browser's own viewer (above).
- **Excel by ExcelJS** (MIT, npm; it reads the cells' formatting: fonts, fills, alignment, borders, merged cells, widths). Formulas show the value Excel saved with them; nothing is calculated.
- **Word by docx-preview** (Apache-2.0, npm; with JSZip, MIT): the document as HTML with its pages, headings, tables, images and styles; close to Word, never exact (Word lays a document out by its fonts and printer).
- **PDF by pdf.js** (`pdfjs-dist`, Apache-2.0): moved out of Silverware Assets, which shows a PDF's preview as the browser's viewer again where Silverware Assets PDF is not installed.
- **Offline, in the repository**: each reader's code a file of its own beside the library's bundle, loaded the first time a document of its kind is drawn (as Silverware Chart loads Chart.js); pdf.js copied unchanged from its package, the others bundled from theirs by `scripts/build.mjs`.
- **None needs another** but Silverware Assets, whose API they use (handed over by their init page, as Silverware Chart takes Silverware Table's); without Assets they draw nothing and say so in their library page.

## Silverware Assets' part (generic)

- Files drawn again as a type is registered or replaced (a library's init page may run after the page's files were drawn): the registry tells the decorator, which redraws once a moment after.
- pdf.js out of Assets: its `src/pdfjs/`, the two files, the build's copy, `.gitattributes`' line; the PDF type's preview the browser's viewer again; the layer over a viewer put in later (decorate.ts) kept: generic.

## Each reader

- **Silverware Assets PDF**: the preview its first page as an image (from Assets' `src/pdfjs/`, moved). Its reader (every page drawn as it comes near the view, the page number, zoom) was built and taken out the same day: the browser's viewer reads a PDF already.
- **Silverware Assets DOCX**: docx-preview renders into a box of its own (its styles scoped to it, `className` its prefix). The preview: the first page drawn at the preview's height, scaled down (a transform), cut at its edge; the reader: the whole document, scrolled.
- **Silverware Assets XLSX**: ExcelJS reads the workbook; each sheet a table drawn by the library (its fonts, fills, alignment, borders, merged cells, widths and heights), tabs for the sheets; the first rows and columns held as a spreadsheet does. A sheet larger than a limit (2000 rows × 100 columns) drawn to the limit, said. The preview: the first sheet's first cells (about 8 × 5), drawn small.

## Steps

1. Silverware Assets: files drawn again as types change; pdf.js out (its preview the browser's viewer).
2. Silverware Assets PDF: the library (pages, scripts, build, deploy, tests), the preview (its reader built, then taken out: the browser's viewer).
3. Silverware Assets DOCX: the same with docx-preview.
4. Silverware Assets XLSX: the same with ExcelJS.
5. Each: its UI tests in SilverBullet (documents made by the tests: a PDF written by hand, a DOCX and an XLSX made with JSZip and ExcelJS in Node), its docs; the root CLAUDE.md's table; versions and changelogs with the user's word; REPO.md at their release.

## Done (2026-11-14)

Steps 1 to 5 but the releases: the three libraries, their tests and docs, a review and its fixes (a document's links and styles kept from the page: only web and mail links, its own shadow root; frozen columns past merged cells, the zoom measured once; types registered once per Space Lua load; documents kept by their file's version). Then Silverware Assets PDF made the preview alone, Assets' own PDF type the browser's viewer, and an archive a type of Assets' own (a card, its own icon). Left: the versions' and changelogs' confirmation, REPO.md at the release, the user's own look.

## Open

- Old formats (.doc, .xls, .ppt) and PowerPoint (.pptx): none (no reader in JavaScript draws them well enough).
