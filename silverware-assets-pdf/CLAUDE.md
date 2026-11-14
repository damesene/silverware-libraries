# Silverware Assets PDF

PDFs drawn by pdf.js (prefix `swa-pdf-`, settings and API under `silverware.assets_pdf`: none yet), a type of file registered with Silverware Assets through its API alone (`silverware.assets.api`, handed over by the init page; `shared/assets.ts`). The plan and decisions, shared with Silverware Assets DOCX and XLSX: [docs/silverware-viewers.md](../docs/silverware-viewers.md); its own decisions, limits and findings: [docs/silverware-assets-pdf.md](../docs/silverware-assets-pdf.md). User docs: `silverware-assets-pdf.md`; `-init.md` (the bridge: Assets' API), `-style.md`.

## Mental model

- **One type, `pdf`**, in place of Silverware Assets' own (a name registered again replaces): `preview` its first page as an image (`src/preview.ts`) and nothing else. No `embed`: the original, the side panel and the enlarged view stay the browser's own viewer, as Assets draws a PDF (the user's choice, 2026-11-14: a reader of pages would add nothing to it; one was built and taken out the same day).
- **pdf.js is a file beside the bundle** (`silverware-assets-pdf-pdfjs.js`, its worker `silverware-assets-pdf-pdfjs-worker.js`: the `pdfjs-dist` package's own minified build, copied unchanged by `scripts/build.mjs`, `copied`; check-build compares them), loaded the first time a PDF is drawn (`src/pdfjs/load.ts`, `new URL(…, import.meta.url)`): offline, never in a space showing no PDF. Its types are declared there, not imported. One worker for every document; pdf.js not loaded is asked again after 30 s.
- **Where pdf.js cannot draw** (not loaded: the playground, a unit test; a file it cannot read): the browser's viewer (`<object>`) in its place; Assets lays its layer over a preview's viewer put in later.

## Gotchas

- **A relative URL is resolved by the document's base** before pdf.js gets it (`openPdf`): pdf.js resolves it by the window's address, which on a page in a folder (`Folder/Page`) fetched SilverBullet's app page in place of the file (found by the UI test, 2026-11-14).
- Previews: at most two PDFs read at once (a turn handed on as a read ends), a read no preview waits for skipped, images kept by file, its version (`fileVersion`: a HEAD request's ETag or date, so a file replaced under the same name is drawn again) and drawn pixels (40), each preview its own object URL let go once shown.
- The type is registered once while the same Assets API is handed over (`init`): Space Lua loaded again would otherwise take it off and register it again, and Assets draws every file of the page anew on a change of its types.

## Tests

- `src/isolation.test.ts`: Silverware Assets only through `shared/assets.ts`; of shared/ the reads (`shared/reads.ts`) and elements; no other plugin's code.
- Unit tests (jsdom: pdf.js is not beside `src/`, so the viewer in its place) for the sizes and the fallback.
- `ui-tests/` against SilverBullet only (`helpers.ts`: a test's pages and files under `UiPdf/<test>/`; `pdfOf(colours)`, a PDF of coloured rectangles written by hand): the preview's page drawn, the original and the side panel the browser's viewer, the viewer for a file pdf.js cannot read.
