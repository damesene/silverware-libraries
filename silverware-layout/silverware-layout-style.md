---
tags: meta
---
# Silverware Layout style

The look of [Silverware Layout](silverware-layout.md): its Page layout dialog. It is installed with the library.

```space-style
/* The page as Silverware Layout marks it (src/host/marks.ts), never by a host's elements: the content its widgets
   are in (data-swl-content), the editor whose font it sizes (data-swl-editor), the pane's width (--swl-pane-width) and
   a pane too narrow to lay out (data-swl-narrow), on the root. */
/* A widget's width (Silverware Layout writes data-swl-width and --swl-width on the widget's own element): as wide as
   it keeps, at most the pane less 40 px, centred on the text however wide; in a narrow pane and out of the page's flow
   (a widget over the window, or on a sheet) none. Important: SilverBullet's and the widget plugins' own rules size
   these elements too */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  --swl-shown: min(var(--swl-width), var(--swl-pane-width, 100vw) - 40px);
  width: var(--swl-shown) !important;
  max-width: none !important;
  margin-left: calc((100% - var(--swl-shown)) / 2) !important;
  margin-right: calc((100% - var(--swl-shown)) / 2) !important;
  box-sizing: border-box;
}
/* The boxes a widget laid out is in, within the content, let it out: SilverBullet scrolls a Lua block's output in a
   box of the text's width (overflow: auto), which cut a wider database off and showed a scrollbar */
:root:not([data-swl-narrow]) [data-swl-content] > * :has([data-swl-width]:not([data-silverware-over-window])) {
  overflow: visible !important;
}
/* The editor's font size (the setting, or this device's zoom), over the host's own: SilverBullet sizes its editor in
   px (2.12.1) or by --editor-font-size (since); the text, headings, code and widgets in em of it */
:root[data-swl-font-size] [data-swl-editor] {
  font-size: var(--swl-font-size) !important;
}
/* A task's box: SilverBullet sizes it 1.3em of its own font, which is the browser's for a control (13.33 px), not the
   text's, so it kept its size as the font changed; given the text's in the proportion it has in SilverBullet's
   18 px (13.33 / 18), it is as SilverBullet draws it there and grows with the font */
:root[data-swl-font-size] [data-swl-editor] input[type="checkbox"] {
  font-size: 0.7407em;
}
/* Font zoom's label at the window's bottom left, a moment after each step, as the browser's own zoom shows its */
.swl-zoom-label {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: var(--sw-layer-dialog);
  padding: 6px 10px;
  font: 13px var(--ui-font, system-ui, sans-serif);
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
.swl-zoom-label[hidden] {
  display: none;
}
/* The handle of a widget's width: a bar beside its right edge, quiet (grey, a dashed outline, as Silverware Table's +)
   until the pointer is on it or it is dragged */
.swl-handle {
  position: fixed;
  z-index: var(--sw-layer-control);
  width: 12px;
  display: flex;
  justify-content: center;
}
.swl-handle[hidden] {
  display: none !important;
}
.swl-handle-bar {
  box-sizing: border-box;
  width: 6px;
  height: 100%;
  padding: 0;
  background: color-mix(in srgb, var(--root-color) 6%, var(--root-background-color));
  border: 1px dashed color-mix(in srgb, var(--root-color) 40%, transparent);
  border-radius: 3px;
  cursor: ew-resize;
  touch-action: none;
}
/* A finger's target: wider than the bar looks, the room beside it taken (a touch screen, a tablet with a mouse too) */
@media (any-pointer: coarse) {
  .swl-handle-bar {
    position: relative;
  }
  .swl-handle-bar::before {
    content: "";
    position: absolute;
    inset: -6px -12px;
  }
}
/* The guides of a drag: a quiet dashed line each side for the text's width and each guide, over the whole height the
   page is seen in and under its widgets (in CodeMirror's scroller, z-index -1, as Confluence's), named at its top; the
   one the width snaps to a little stronger, nothing loud. Where the page has no scroller, over the window */
.swl-handle-guide {
  position: absolute;
  z-index: -1;
  width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--root-color) 22%, transparent);
  pointer-events: none;
}
.swl-handle-guide.swl-handle-guide-fixed {
  position: fixed;
  z-index: calc(var(--sw-layer-control) - 1);
}
.swl-handle-guide.swl-handle-guide-near {
  border-left: 1px solid color-mix(in srgb, var(--root-color) 45%, transparent);
}
/* At the top of the page's view, its end at its line; a row lower where it would touch the name left of it (the
   handle sets its top) */
.swl-handle-guide-label {
  position: absolute;
  top: 4px;
  right: 3px;
  font: 11px var(--ui-font, system-ui, sans-serif);
  white-space: nowrap;
  color: color-mix(in srgb, var(--root-color) 45%, transparent);
}
.swl-handle-guide-near .swl-handle-guide-label {
  color: color-mix(in srgb, var(--root-color) 75%, transparent);
}
.swl-handle-bar:hover,
.swl-handle-bar:focus-visible,
.swl-handle-dragging .swl-handle-bar {
  outline: none;
  background: var(--ui-accent-color, #464cfc);
  border: 1px solid var(--ui-accent-color, #464cfc);
}
/* Silverware Layout (prefix swl-): the Page layout dialog ("Silverware Layout: Page layout"), over the page and
   SilverBullet's top bar, in the page's colors; over the part of the window an on-screen keyboard leaves
   (shared/dialog.ts sets where it is) */
.swl-dialog-backdrop {
  position: fixed;
  inset: 0;
  top: var(--sw-view-top, 0);
  bottom: auto;
  height: var(--sw-view-height, 100%);
  z-index: var(--sw-layer-dialog);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--modal-backdrop-color, rgba(0, 0, 0, 0.35));
  font-family: var(--ui-font, system-ui, sans-serif);
}
.swl-dialog {
  --swl-dialog-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swl-dialog-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  display: flex;
  flex-direction: column;
  /* (Its border within the height: SilverBullet sets no box-sizing) */
  box-sizing: border-box;
  width: min(520px, calc(100vw - 24px));
  /* (As high on either tab: it does not jump as they are switched, the footer where it was) */
  min-height: min(560px, calc(var(--sw-view-height, 100dvh) - 32px));
  max-height: min(600px, calc(var(--sw-view-height, 100dvh) - 32px));
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swl-dialog-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swl-dialog *,
.swl-dialog *::before,
.swl-dialog *::after {
  box-sizing: border-box;
}
.swl-dialog:focus {
  outline: none;
}
.swl-dialog button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swl-dialog-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swl-dialog-titles {
  flex: 1;
  min-width: 0;
}
.swl-dialog-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swl-dialog-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
  overflow-wrap: anywhere;
}
.swl-dialog-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swl-dialog-close:hover {
  opacity: 1;
  background: var(--swl-dialog-card);
}
.swl-dialog-close svg {
  width: 16px;
  height: 16px;
}
.swl-dialog-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
/* Held at the window's top right, the page under it not darkened: a width set shows on the page at once, the text's
   left edge in view */
.swl-dialog-backdrop.swl-dialog-backdrop-top {
  align-items: flex-start;
  justify-content: flex-end;
  padding: 12px 16px 0 0;
  background: transparent;
}
.swl-dialog-backdrop-top .swl-dialog {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
/* The tabs (Page, Guides) under the head */
.swl-dialog-tabs {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swl-dialog-line);
}
.swl-dialog-tab {
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swl-dialog-tab:hover {
  opacity: 1;
}
.swl-dialog-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swl-dialog-panel[hidden] {
  display: none;
}
/* Page: a row for this page's width and one for all pages', each its name and what it follows or Own, then a slider
   marked with the guides and the width typed */
.swl-dialog-widths {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px 2px 6px;
}
.swl-dialog-width-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.swl-dialog-width-name {
  font-weight: 600;
}
.swl-dialog-width-controls {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.swl-dialog-slider-box {
  flex: 1;
  min-width: 0;
  position: relative;
  padding-bottom: 19px;
}
.swl-dialog-slider {
  width: 100%;
  margin: 6px 0 0;
  accent-color: var(--ui-accent-color);
}
/* A row following another: its slider and number quiet, showing the width it follows, its own once moved */
.swl-dialog-follows .swl-dialog-slider {
  opacity: 0.45;
}
.swl-dialog-follows .swl-dialog-amount {
  color: color-mix(in srgb, var(--root-color) 55%, transparent);
}
/* The guides under the slider, at their values: a tick and their width */
.swl-dialog-ticks {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 0;
  height: 17px;
  pointer-events: none;
}
.swl-dialog-tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  padding-top: 7px;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  opacity: 0.6;
}
.swl-dialog-tick::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  height: 3px;
  border-left: 1px solid currentColor;
}
.swl-dialog-width-value {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
.swl-dialog-amount,
.swl-dialog-guide-amount {
  width: 6.5em;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swl-dialog-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swl-dialog-amount:disabled,
.swl-dialog-slider:disabled {
  opacity: 0.5;
}
.swl-dialog-invalid {
  border-color: var(--danger-color, #c62828) !important;
}
/* Guides: a row a width, typed straight in, a × out; added under them; Full width a box */
.swl-dialog-guides {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 2px 6px;
}
.swl-dialog-guide-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swl-dialog-guide-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swl-dialog-unit {
  opacity: 0.7;
}
.swl-dialog-remove {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.6;
}
.swl-dialog-remove:hover {
  opacity: 1;
  background: var(--swl-dialog-card);
}
.swl-dialog-remove svg {
  width: 14px;
  height: 14px;
}
.swl-dialog-add {
  padding: 5px 10px;
  background: none;
  border: 1px dashed var(--swl-dialog-line);
  border-radius: 6px;
}
.swl-dialog-add:hover {
  border-color: var(--ui-accent-color);
}
.swl-dialog-full {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  cursor: pointer;
}
/* The font size: its slider has no guides under it; Font zoom a box, how it is used said quietly beside it; this
   device's zoom with Reset */
.swl-dialog-slider-box.swl-dialog-slider-plain {
  padding-bottom: 0;
}
.swl-dialog-zoom {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  cursor: pointer;
}
.swl-dialog-zoom input {
  margin-top: 3px;
}
.swl-dialog-zoom-text {
  display: flex;
  flex-wrap: wrap;
  column-gap: 8px;
}
.swl-dialog-hint {
  opacity: 0.6;
}
/* This device's zoom: its name over a slider, its size (or "default") and Reset */
.swl-dialog-device {
  margin-top: 12px;
}
.swl-dialog-device > .swl-dialog-width-name {
  display: block;
  margin-bottom: 6px;
}
.swl-dialog-device[hidden] {
  display: none;
}
/* (As wide for 5 px as for 40 px: the slider beside it never moves) */
.swl-dialog-device-value {
  width: 3.5em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.swl-dialog-reset:disabled {
  opacity: 0.4;
}
/* A slider held: the dialog all but gone, the controls held alone shown on a quiet ground of their own, so what the
   slider changes is seen on the page under the dialog (on a phone it takes the whole screen) */
.swl-dialog.swl-dialog-sliding {
  visibility: hidden;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
.swl-dialog-sliding .swl-dialog-held {
  visibility: visible;
  /* (Its ground round it without moving it: moved as it was pressed, a press near the slider's edge was off it by the
     time the browser started dragging, and nothing moved) */
  padding: 6px 8px;
  margin: -6px -8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--root-background-color) 88%, transparent);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.swl-dialog-reset {
  padding: 3px 10px;
  background: none;
  border: 1px solid var(--swl-dialog-line);
  border-radius: 6px;
}
.swl-dialog-reset:hover {
  border-color: var(--ui-accent-color);
}
.swl-dialog-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swl-dialog-line);
}
.swl-dialog-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swl-dialog-note.swl-dialog-problem {
  color: var(--danger-color, #c62828);
  opacity: 1;
}
.swl-dialog-cancel,
.swl-dialog-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swl-dialog-line);
  background: var(--root-background-color);
}
.swl-dialog-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swl-dialog-save:disabled {
  opacity: 0.45;
  cursor: default;
}
/* A phone: the whole screen, the slider over the width typed, bigger targets for a finger */
@media (max-width: 480px) {
  .swl-dialog-backdrop.swl-dialog-backdrop-top {
    padding: 0;
  }
  .swl-dialog-width-controls {
    flex-direction: column;
    align-items: stretch;
  }
  .swl-dialog-amount,
  .swl-dialog-guide-amount {
    width: 8em;
    padding: 8px 10px;
  }
  .swl-dialog {
    width: 100vw;
    max-height: none;
    height: var(--sw-view-height, 100dvh);
    border-radius: 0;
    border: 0;
  }
}
/* <shared-segments> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* Joined buttons side by side, one of them pressed: a choice (a menu's Align,
   a width's unit px or %) or a pair of actions (Move up, Move down). Drawn
   by a menu's segmented entry (shared/menu.ts) and by segmentedControl
   (shared/controls.ts) */
.swl-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swl-segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.swl-segment:not([aria-disabled="true"]):hover,
.swl-segment:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swl-segment[aria-checked="true"] {
  color: var(--ui-accent-color);
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.swl-segment[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A finger's targets: bigger buttons in a row */
@media (pointer: coarse) {
  .swl-segment {
    padding: 8px 10px;
  }
}
/* </shared-segments> */
```
