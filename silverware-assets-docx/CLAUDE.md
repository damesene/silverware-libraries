# Silverware Assets DOCX

Word documents (.docx) drawn by docx-preview (prefix `swa-docx-`, settings and API under `silverware.assets_docx`: none yet), a type of file registered with Silverware Assets through its API alone (`silverware.assets.api`, handed over by the init page; `shared/assets.ts`). The plan and decisions, shared with Silverware Assets PDF and XLSX: [docs/silverware-viewers.md](../docs/silverware-viewers.md). User docs: `silverware-assets-docx.md`; `-init.md` (the bridge: Assets' API), `-style.md` (its own rules and the shared reader's block, `shared/docreader.css`).

## Mental model

- **One type, `docx`** (ext `docx`, its MIME): `preview` its first page drawn smaller (`src/preview.ts`: a clone of the page docx-preview drew, scaled by CSS `zoom` to the preview's height, cut to its size), `embed` a reader of the whole document (`src/reader.ts`, in the shared shell `shared/docreader.ts`: the pages fitted to the reader's width times the zoom by CSS `zoom` on docx-preview's wrapper), which Assets draws for the original and in its side panel and enlarged view (`RenderContext.fills`).
- **docx-preview (with JSZip) is a file beside the bundle** (`silverware-assets-docx-docxpreview.js`, built by `scripts/build.mjs` from `src/vendor.ts`, never imported by the bundle), loaded the first time a document is drawn (`src/load.ts`). A document is fetched and drawn once per file and version (`drawn` in src/documents.ts: at most two at once), its previews and readers cloning what was drawn.
- docx-preview draws each page a `section.swa-docx-docx` in a `.swa-docx-docx-wrapper`, its `<style>`s scoped by that class (`className`); a page's size is its inline `width` / `min-height` in pt (`pageSize`). Images as data URLs (`useBase64URL`): nothing to let go.
- **What a document draws is made safe and kept apart** (`src/documents.ts`): only `http(s)` and `mailto` links (a `javascript:` link of a document would run in SilverBullet's page), nothing that runs (scripts, frames, `on…` attributes; its alternative chunks, HTML in a frame, not drawn), and shown in a shadow root of its own (its styles stay in, the page's stay out; Word's defaults set there, `DOCUMENT_CSS`, as the editor's font and size still reach it inherited). Kept by file and version (`fileVersion`), six at most; made safe by `shared/safehtml.ts` (`madeSafe`). **A preview kept in the space** (`stored`, `storesPreview`): its first page and styles as HTML (`data-swa-docx-styles`, `data-swa-docx-page` with its size; images made smaller, 600 px), read back through `safeHtml` (anyone who can write the space can write it).

## Gotchas

- The reader stops `mousedown`, `pointerdown` and `keydown` at its element (the shared shell): the editor around it would move its cursor into the embed and show its markdown.
- docx-preview's own wrapper has a grey ground and padding: `DOCUMENT_CSS` in the shadow root takes them off (`!important` over its generated rules); the style page reaches no further than the shadow's host.
- Pages break where the document has a page break (`breakPages`); a page's content is not split at its height (docx-preview lays out no lines).

## Tests

- `src/isolation.test.ts`: Silverware Assets only through `shared/assets.ts`; the reader's shell and elements of `shared/`; no other plugin's code; `vendor.ts` imported by nothing.
- Unit tests (jsdom: the renderer is not beside `src/`, so a preview stays its icon and a reader says it cannot show the document) for the sizes and the fallback.
- `ui-tests/` against SilverBullet only (`helpers.ts`: a test's pages and files under `UiDocx/<test>/`; `docxOf(pages)`, a document made with JSZip in Node, a page break between pages).
