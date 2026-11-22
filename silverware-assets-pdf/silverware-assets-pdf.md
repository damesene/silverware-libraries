---
name: Library/damesene/silverware-assets-pdf
tags: meta/library
version: 1.0.1
description: "Silverware Assets PDF: with Silverware Assets, a PDF's preview in your pages is its first page as an image, drawn by pdf.js (in place of a small browser viewer). Works offline, on a phone too."
files:
- silverware-assets-pdf.js
- silverware-assets-pdf-init.md
- silverware-assets-pdf-style.md
- silverware-assets-pdf-pdfjs.js
- silverware-assets-pdf-pdfjs-worker.js
---
# Silverware Assets PDF

A PDF's preview, drawn by [pdf.js](https://mozilla.github.io/pdf.js/) (Mozilla's PDF reader, the one Firefox shows PDFs with) as an image of its first page, in place of the browser's own PDF viewer made small. It needs [Silverware Assets](https://github.com/damesene/silverware-libraries/blob/main/silverware-assets/silverware-assets.md), which shows your embedded files: Silverware Assets PDF draws how a PDF looks there.

- **A preview** (`![[report.pdf|||{ view: preview }]]`, or previews chosen in Silverware Assets' settings) is the PDF's first page as a small image, as high as your previews are. A click on it does what Silverware Assets' settings say (open it in a new tab, in a side panel, enlarged).
- **Full** (`{ view: full }`), **the side panel and the enlarged view** (a file's menu: *Open in side panel*, *Open enlarged*) stay the browser's own PDF viewer, which already reads every page.

pdf.js comes with this library (installed beside it), so it works offline, and on a phone, where the browser often has no PDF viewer of its own (the preview shows there; a PDF shown full needs the browser's viewer). It is loaded the first time a preview is shown, not before. A preview is drawn once and kept in your space (Silverware Assets' `_silverware-assets-previews` folder): shown from there after, pdf.js not needed again until the PDF changes.

## Good to know

- A PDF pdf.js cannot read is previewed by the browser's viewer, as without this library.
- Fonts a PDF does not carry itself are drawn with your system's fonts; scanned pages stored as JPEG 2000 or JBIG2 images are left out.
- Without Silverware Assets, this library shows nothing: PDFs are shown as SilverBullet shows them.
