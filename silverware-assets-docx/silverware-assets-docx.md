---
name: Library/damesene/silverware-assets-docx
tags: meta/library
version: 1.0.0
description: "Silverware Assets DOCX: Word documents (.docx) in your pages, with Silverware Assets: a preview shows the first page, and the original, the side panel and the enlarged view are a reader of the whole document with zoom. Works offline."
files:
- silverware-assets-docx.js
- silverware-assets-docx-init.md
- silverware-assets-docx-style.md
- silverware-assets-docx-docxpreview.js
---
# Silverware Assets DOCX

Word documents (`.docx`) your pages embed, drawn in SilverBullet, where without it they are only a card. It needs [Silverware Assets](https://github.com/damesene/silverware-libraries/blob/main/silverware-assets/silverware-assets.md), which shows your embedded files: Silverware Assets DOCX draws how a document looks there.

- **A preview** (`![[report.docx|||{ view: preview }]]`, or previews chosen in Silverware Assets' settings) is the document's first page, drawn smaller, as high as your previews are. A click on it does what Silverware Assets' settings say (open it in a new tab, in a side panel, enlarged).
- **The original** (`{ view: embed }`) is a reader of the whole document in a box of the page, its pages one under another, scrolled inside it. Its bar shows the page you are on and how many there are, and zooms out, back to the width (the percentage), and in.
- **The side panel and the enlarged view** (a file's menu: *Show in a side panel*, *Show enlarged*) are the same reader, as large as the panel.

The documents are drawn by [docx-preview](https://github.com/VolodymyrBaydalka/docxjs), which comes with this library (installed beside it), so it works offline. It is loaded the first time a document is shown, not before.

## Good to know

- A document is drawn close to how Word shows it, never exactly: Word lays a document out by its fonts and its printer, so lines and pages can break elsewhere. Pages break where the document has a page break of its own.
- Only `.docx` (Word 2007 and later) is read; an old `.doc` stays a card.
- The reader only shows the document: to edit it, open it in Word or another editor.
- Fonts the document names and your system has not are replaced by your system's.
- Without Silverware Assets, this library shows nothing: documents are shown as SilverBullet shows them.
