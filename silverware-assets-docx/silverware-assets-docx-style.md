---
tags: meta
---
# Silverware Assets DOCX style

The look of [Silverware Assets DOCX](silverware-assets-docx.md): a Word document's preview and its reader. It is installed with the library.

```space-style
/* A document's preview (src/preview.ts): a box of the preview's room with the type's icon and the file's name while
   its first page is drawn (and where it cannot be); then the page drawn smaller, cut to its own size, white as paper */
.swa-docx-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  /* (Its room's width in px, not a share: a frame as wide as what it shows takes its width from it) */
  width: var(--swa-docx-box-width, 100%);
  max-width: 100%;
  height: var(--swa-docx-box-height, 160px);
  box-sizing: border-box;
  padding: 8px;
  overflow: hidden;
  color: var(--root-color);
  background: color-mix(in srgb, var(--root-color, #000) 6%, transparent);
  border-radius: 4px;
  cursor: pointer;
}
/* While it is drawn: shown only after a moment (a preview kept in the space comes at once, with no box before it to
   jump from) */
@keyframes swa-docx-wait {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
/* (Shaped as a page upright, as most are, so the page drawn takes its place without a jump) */
.swa-docx-preview[data-swa-docx-state="drawing"] {
  width: min(var(--swa-docx-box-width, 100%), calc(var(--swa-docx-box-height, 160px) / 1.4142));
  animation: swa-docx-wait 0s 0.4s both;
}
.swa-docx-preview-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  opacity: 0.7;
}
.swa-docx-preview-icon svg {
  width: 100%;
  height: 100%;
}
.swa-docx-preview-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.85em;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.swa-docx-preview[data-swa-docx-state="page"] {
  display: block;
  width: fit-content;
  height: auto;
  padding: 0;
  background: none;
  border-radius: 0;
}
/* (The page itself in the box's shadow root, src/documents.ts) */
.swa-docx-preview-page {
  position: relative;
  overflow: hidden;
  /* (What it shows, kept in the space, drawn within it alone: a fixed position held to it, nothing painted outside) */
  contain: paint;
  background: #fff;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--root-color, #000) 14%, transparent);
}
/* <shared-reader> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* A document's reader (shared/docreader.ts): a box of the embed's height in the page (filling a side panel or the
   enlarged view), a bar on top (a label at its left, the zoom at its right, clear of a file frame's "…" at its top
   right, Silverware Assets', which lay over it), the document on a quiet ground under it, scrolled inside it */
.swa-docx-reader {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--root-color, #000) 14%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color, #000) 5%, var(--root-background-color, #fff));
}
.swa-docx-reader.swa-docx-reader-fills {
  height: 100%;
}
.swa-docx-reader-bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 4px 40px 4px 8px;
  font: 13px var(--ui-font, system-ui, sans-serif);
  color: var(--root-color);
  background: var(--root-background-color, #fff);
  border-bottom: 1px solid color-mix(in srgb, var(--root-color, #000) 12%, transparent);
}
.swa-docx-reader-label {
  flex: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.swa-docx-reader-tools {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 2px;
  overflow-x: auto;
}
.swa-docx-reader-zoom {
  display: inline-flex;
  flex: none;
  gap: 2px;
}
.swa-docx-reader-button {
  min-width: 28px;
  padding: 2px 6px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.swa-docx-reader-button:hover,
.swa-docx-reader-button:focus-visible {
  border-color: color-mix(in srgb, var(--root-color, #000) 25%, transparent);
}
.swa-docx-reader-button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--root-color, #000) 10%, transparent);
}
.swa-docx-reader-fit {
  min-width: 48px;
  font-variant-numeric: tabular-nums;
}
.swa-docx-reader-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
/* </shared-reader> */
/* A document's reader (src/reader.ts), in the shared shell: the document in a shadow root of its own (its styles and
   Word's defaults there, src/documents.ts); what is said where it cannot be shown */
.swa-docx-reader-failed {
  margin: 16px;
  opacity: 0.8;
}
/* <shared-scrollbar> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The boxes of the plugin's own that scroll (a view, a list, a panel, a dialog's body, a menu): a thin scrollbar, its
   thumb quiet in the text's color and its track clear, the same in every plugin (Silverware Table's first). The page's
   own scrollbar is SilverBullet's, left as it is. Of no weight of its own (`:where`): a rule of the plugin's for one of
   them (a strip whose scrollbar is hidden) still holds. A theme sets another thumb by `--sw-scrollbar-thumb` */
:where(.swa-docx-reader-scroll) {
  scrollbar-width: thin;
  scrollbar-color: var(--sw-scrollbar-thumb, color-mix(in srgb, var(--root-color, #333) 30%, transparent)) transparent;
}
/* </shared-scrollbar> */
```
