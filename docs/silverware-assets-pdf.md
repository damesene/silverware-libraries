# Silverware Assets PDF: a PDF's preview by pdf.js

Decisions and findings of Silverware Assets PDF (with Silverware Assets DOCX and XLSX: docs/silverware-viewers.md). Built 2026-11-14 inside Silverware Assets first, for the user to decide whether it is worth it, then moved into a library of its own the same day, so only who wants it downloads it.

## Decided (2026-11-14)

- **The preview alone**: a PDF's preview is its first page as an image, drawn by [pdf.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist` 6.4.299, Apache-2.0, pinned), in place of the browser's own viewer made small. The original, the side panel and the enlarged view stay the browser's own viewer, which reads every page already: a reader of pages (each drawn as it came near the view, the page number, zoom) was built and taken out the same day, the user's word.
- **Silverware Assets keeps its own PDF type** on what the browser's `<object>` shows (the preview a small viewer, the original the browser's); Silverware Assets PDF registers its `pdf` in its place, with its preview added and no `embed` of its own, so Assets draws the original as before.
- **Offline, in the repository**: pdf.js and its worker are two files beside the bundle, `silverware-assets-pdf/silverware-assets-pdf-pdfjs.js` (448 kB, 129 kB as SilverBullet 2.12.1 sends it compressed) and `silverware-assets-pdf-pdfjs-worker.js` (1.2 MB, 371 kB compressed), in the library page's `files:`: the package's own minified build, copied unchanged by `scripts/build.mjs` (`copied`), which `check-build` compares with the package installed. Loaded the first time a preview is drawn (as Silverware Chart loads Chart.js), never in a space without one.
- **Smaller is not to be had** (measured): the part of pdf.js in the page tree-shaken to what is used saves 2 % (one module with side effects); the worker is the PDF parser itself, needed for one page as for all.

## Behaviour

- A preview looks as an image's preview does (the settings' height, its width by the page's proportions, at most the preview width), its click the settings' click with no layer over a viewer, its frame as wide as the page.
- Drawn to fit the preview's box, sharp for the screen (`devicePixelRatio`, three at most), as a PNG; each kept by file, its version (a HEAD request's ETag or date: a file replaced under the same name is drawn again) and the pixels it is drawn at, the 40 newest; each preview makes its own object URL and lets it go once shown.
- At most two PDFs read at once, a turn handed on as a read ends; a read no preview waits for any more is skipped. One worker for every PDF read.
- Where pdf.js cannot draw (not loaded, a file it cannot read): the browser's viewer in the preview's box, Assets' shield laid over it as it comes (decorate.ts watches a preview for a viewer put in later). pdf.js not loaded is asked again after 30 s.
- **A relative URL is resolved by the document's base**: pdf.js resolves it by the window's address, which, on a page in a folder, fetched SilverBullet's app page in place of the file (found by the UI test).

## Limits

- Fonts not embedded in the PDF are drawn with the system's (pdf.js' standard fonts and CMaps not shipped: 4 MB more); JPEG 2000 and JBIG2 images (scans) need pdf.js' WebAssembly decoders, not shipped: left out of the preview.
- On a phone without a PDF viewer the preview shows, the original (the browser's viewer) does not.

## Verified (2026-11-14)

SilverBullet 2.12.1 and its main: the files served as JavaScript, the module worker started from `.fs/Library/damesene/`, a first page drawn (a page of text with colours; a test's PDF of coloured rectangles, its colour checked in the middle of the image), on pages at the root and in folders.
