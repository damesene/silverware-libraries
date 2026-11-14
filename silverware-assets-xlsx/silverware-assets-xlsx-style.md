---
tags: meta
---
# Silverware Assets XLSX style

The look of [Silverware Assets XLSX](silverware-assets-xlsx.md): a workbook's preview and its reader. It is installed with the library.

```space-style
/* A workbook's preview (src/preview.ts): a box of the preview's room with the type's icon and the file's name while
   it is read (and where it cannot be); then the first sheet's first cells, small, cut to the room */
.swa-xlsx-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  /* (Its room's width in px, not a share: a frame as wide as what it shows takes its width from it) */
  width: var(--swa-xlsx-box-width, 100%);
  max-width: 100%;
  height: var(--swa-xlsx-box-height, 160px);
  box-sizing: border-box;
  padding: 8px;
  overflow: hidden;
  color: var(--root-color);
  background: color-mix(in srgb, var(--root-color, #000) 6%, transparent);
  border-radius: 4px;
  cursor: pointer;
}
.swa-xlsx-preview-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  opacity: 0.7;
}
.swa-xlsx-preview-icon svg {
  width: 100%;
  height: 100%;
}
.swa-xlsx-preview-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.85em;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.swa-xlsx-preview[data-swa-xlsx-state="sheet"] {
  display: block;
  /* (As wide as its cells, at most its room: no white beside a narrow sheet) */
  width: fit-content;
  max-width: min(100%, var(--swa-xlsx-box-width, 100%));
  padding: 0;
  background: #fff;
  border-radius: 0;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--root-color, #000) 14%, transparent);
}
.swa-xlsx-preview-sheet {
  overflow: hidden;
  height: 100%;
}

/* A sheet (src/table.ts) as a spreadsheet shows it: a workbook's own font where its cells name none (Calibri 11 pt,
   black on white), Excel's grid, the columns' letters and the rows' numbers on a quiet ground, held as it scrolls */
.swa-xlsx-sheet {
  --swa-xlsx-font: Calibri, Carlito, "Segoe UI", Arial, sans-serif;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-family: var(--swa-xlsx-font);
  font-size: 11pt;
  line-height: 1.2;
  color: #000;
  background: #fff;
}
.swa-xlsx-sheet :is(td, th) {
  box-sizing: border-box;
  padding: 1px 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: clip;
  vertical-align: bottom;
  border-right: 1px solid #d4d4d4;
  border-bottom: 1px solid #d4d4d4;
}
.swa-xlsx-sheet td {
  background: #fff;
}
.swa-xlsx-sheet th {
  font-weight: normal;
  font-size: 9pt;
  text-align: center;
  vertical-align: middle;
  color: #444;
  background: #f3f3f3;
  border-color: #c8c8c8;
}
.swa-xlsx-sheet-letters th {
  position: sticky;
  top: 0;
  z-index: 4;
}
.swa-xlsx-sheet-number {
  position: sticky;
  left: 0;
  z-index: 1;
}
.swa-xlsx-sheet-corner {
  left: 0;
  z-index: 5 !important;
}

/* <shared-reader> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* A document's reader (shared/docreader.ts): a box of the embed's height in the page (filling a side panel or the
   enlarged view), a bar on top (a label at its left, the zoom at its right, clear of a file frame's "…" at its top
   right, Silverware Assets', which lay over it), the document on a quiet ground under it, scrolled inside it */
.swa-xlsx-reader {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--root-color, #000) 14%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color, #000) 5%, var(--root-background-color, #fff));
}
.swa-xlsx-reader.swa-xlsx-reader-fills {
  height: 100%;
}
.swa-xlsx-reader-bar {
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
.swa-xlsx-reader-label {
  flex: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.swa-xlsx-reader-tools {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 2px;
  overflow-x: auto;
}
.swa-xlsx-reader-zoom {
  display: inline-flex;
  flex: none;
  gap: 2px;
}
.swa-xlsx-reader-button {
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
.swa-xlsx-reader-button:hover,
.swa-xlsx-reader-button:focus-visible {
  border-color: color-mix(in srgb, var(--root-color, #000) 25%, transparent);
}
.swa-xlsx-reader-button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--root-color, #000) 10%, transparent);
}
.swa-xlsx-reader-fit {
  min-width: 48px;
  font-variant-numeric: tabular-nums;
}
.swa-xlsx-reader-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
/* </shared-reader> */
/* A workbook's reader (src/reader.ts), in the shared shell: a sheet's tabs in its bar, the sheet from the reader's
   top left, what is said of it (cut, empty, unread) quietly under it */
.swa-xlsx-reader-tab {
  max-width: 14em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.swa-xlsx-reader-cut,
.swa-xlsx-reader-empty,
.swa-xlsx-reader-failed {
  margin: 8px 12px;
  font: 13px var(--ui-font, system-ui, sans-serif);
  opacity: 0.8;
}
```
