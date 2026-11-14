---
tags: meta
---
# Silverware Assets PDF style

The look of [Silverware Assets PDF](silverware-assets-pdf.md): a PDF's preview. It is installed with the library.

```space-style
/* A PDF's preview (src/preview.ts): a box of the preview's room while its first page is drawn, quietly shaded; then
   the page as an image fitted to that room, its proportions kept; where pdf.js cannot draw it, the browser's viewer
   filling the room */
.swa-pdf-preview {
  position: relative;
  display: block;
  /* (Its room's width in px, not a share: a frame as wide as what it shows takes its width from it; a share counted
     as nothing there, and the frame took the browser's 300 px of a viewer) */
  width: var(--swa-pdf-box-width, 100%);
  max-width: 100%;
  height: var(--swa-pdf-box-height, 160px);
}
.swa-pdf-preview[data-swa-pdf-state="drawing"] {
  background: color-mix(in srgb, var(--root-color, #000) 6%, transparent);
  border-radius: 4px;
}
.swa-pdf-preview[data-swa-pdf-state="page"] {
  width: fit-content;
  height: auto;
}
.swa-pdf-preview[data-swa-pdf-state="page"] > img {
  display: block;
  width: auto !important;
  height: auto !important;
  max-width: min(100%, var(--swa-pdf-box-width, 100%)) !important;
  max-height: var(--swa-pdf-box-height, 160px) !important;
  /* (A page is white: its edge seen on a white page) */
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--root-color, #000) 14%, transparent);
  cursor: pointer;
}
.swa-pdf-preview > object {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}
```
