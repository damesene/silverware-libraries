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
/* A widget off the text's middle (its edges dragged alone: a grid), by --swl-shift (its middle right of the text's):
   held within the pane less half the gutter on either side */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-shift]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  margin-left: clamp(calc(20px - (var(--swl-pane-width, 100vw) - 100%) / 2), calc((100% - var(--swl-shown)) / 2 + var(--swl-shift, 0px)), calc(100% + (var(--swl-pane-width, 100vw) - 100%) / 2 - 20px - var(--swl-shown))) !important;
  margin-right: auto !important;
}
/* A widget staying at the text's start (its provider's say: an embedded medium): it grows to the right alone,
   as far as the pane's right edge less half the gutter (the text centred in the pane, 100% its width) */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-anchor-start]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  width: min(var(--swl-shown), calc((var(--swl-pane-width, 100vw) + 100%) / 2 - 20px)) !important;
  margin-left: 0 !important;
  margin-right: auto !important;
}
/* A widget laid out in a room of its own, not the page's text (a medium in a grid's cell): within that room, at its
   start, no wider */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-in-room]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  width: min(var(--swl-width), 100%) !important;
  max-width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
/* SilverBullet showing the markdown as written (Editor: Toggle Markdown Syntax Rendering): the grids it still draws
   there hidden, their markdown alone shown; the host's box round each too (an empty one is a line's height) */
:root[data-swl-syntax-shown] .swl-grid-widget,
:root[data-swl-syntax-shown] :has(> .swl-grid-widget) {
  display: none !important;
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
/* A widget's edges dragged alone (src/ui/edges.ts, its provider's say: a grid): a line on each edge as its handle
   shows, quiet, plain as the pointer is on it or it is dragged (as a grid's column dividers); a finger's target wider */
/* (Its bar none: the lines are its handle) */
.swl-handle.swl-handle-bare {
  display: none !important;
}
.swl-edge {
  position: fixed;
  z-index: var(--sw-layer-control);
  width: 12px;
  margin-left: -6px;
  cursor: ew-resize;
  touch-action: none;
}
.swl-edge[hidden] {
  display: none;
}
.swl-edge::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 2px;
  border-radius: 1px;
  background: var(--ui-accent-color, #4a90e2);
  opacity: 0.25;
  transition: opacity 0.12s;
}
.swl-edge:hover::before,
.swl-edge:focus-visible::before,
.swl-edge.swl-edge-dragging::before {
  opacity: 1;
}
.swl-edge:focus {
  outline: none;
}
@media (pointer: coarse) {
  .swl-edge {
    width: 24px;
    margin-left: -12px;
  }
  .swl-edge::before {
    left: 11px;
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
  width: min(560px, calc(100vw - 24px));
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
/* Page width and Font: a row a value, its name (where it holds: this page, all pages, this device) at the left, a
   slider (marked with the guides for a width), the value typed and ↺ at the right, under them what it follows while
   it has no value of its own */
.swl-dialog-widths {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 14px 2px 6px;
}
.swl-dialog-row {
  display: grid;
  grid-template-columns: 7em minmax(0, 1fr);
  column-gap: 12px;
  align-items: start;
}
.swl-dialog-row > :not(.swl-dialog-row-name) {
  grid-column: 2;
}
.swl-dialog-row-name {
  grid-column: 1;
  grid-row: 1;
  /* (Level with the slider's track) */
  padding-top: 5px;
  font-weight: 600;
}
.swl-dialog-row-note {
  min-height: 1.3em;
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.6;
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
/* A row following another: its slider quiet, at the value it follows (its field empty, that value its placeholder), no
   ↺; its own once moved or typed in. A row off (this device's while Ctrl + scroll does not zoom): all of it quiet */
.swl-dialog-follows .swl-dialog-slider {
  opacity: 0.45;
}
.swl-dialog-follows .swl-dialog-reset {
  visibility: hidden;
}
.swl-dialog-off .swl-dialog-width-controls,
.swl-dialog-off .swl-dialog-row-note {
  opacity: 0.5;
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
.swl-dialog-guide-list {
  align-self: stretch;
}
.swl-dialog-guide-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* A guide's slider: the room the row leaves its number, unit and × */
.swl-dialog-guide-slider-box {
  flex: 1;
  min-width: 0;
}
.swl-dialog-guide-slider-box .swl-dialog-slider {
  display: block;
  margin: 0;
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
/* What the Page width tab says on a screen too narrow for widths (a phone): quiet, an icon and a line */
.swl-dialog-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--swl-dialog-card);
  font-size: 13px;
  line-height: 1.4;
}
.swl-dialog-notice-icon {
  display: inline-flex;
  flex: none;
  margin-top: 1px;
  color: var(--ui-accent-color);
}
.swl-dialog-notice-icon svg {
  width: 16px;
  height: 16px;
}
/* Preview on the Guides tab (held, the guides on the page) and Default guides beside it, over the list: an icon and its name each */
.swl-dialog-guide-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.swl-dialog-preview-box {
  display: flex;
}
.swl-dialog-guides-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.8;
}
.swl-dialog-guides-reset:hover:not(:disabled),
.swl-dialog-guides-reset:focus-visible {
  opacity: 1;
  background: var(--swl-dialog-card);
}
.swl-dialog-guides-reset:disabled {
  opacity: 0.35;
}
.swl-dialog-guides-reset svg {
  width: 16px;
  height: 16px;
}
.swl-dialog-preview {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: none;
  border: 1px solid var(--swl-dialog-line);
  border-radius: 6px;
  /* (Held by a finger: no text selected, no menu of the browser's) */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}
.swl-dialog-preview:hover,
.swl-dialog-preview:focus-visible {
  border-color: var(--ui-accent-color);
}
.swl-dialog-preview svg {
  width: 16px;
  height: 16px;
}
/* The font size's sliders have no guides under them */
.swl-dialog-slider-box.swl-dialog-slider-plain {
  padding-bottom: 0;
}
/* Ctrl + scroll on or off, in this device's row, under its note */
.swl-dialog-zoom {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
/* ↺: an icon button, quiet until pointed at */
.swl-dialog-reset {
  display: inline-flex;
  flex: none;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: inherit;
  opacity: 0.7;
}
.swl-dialog-reset:hover,
.swl-dialog-reset:focus-visible {
  opacity: 1;
  background: var(--swl-dialog-card);
}
.swl-dialog-reset svg {
  width: 16px;
  height: 16px;
}
.swl-dialog-reset:disabled {
  opacity: 0.3;
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
  /* (Its name over its slider) */
  .swl-dialog-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .swl-dialog-row > :not(.swl-dialog-row-name) {
    grid-column: 1;
  }
  .swl-dialog-row-name {
    grid-row: auto;
    padding: 0 0 6px;
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
/* A grid (docs/silverware-layout-grid.md): its cells side by side as its columns attribute says (--swl-grid-columns,
   set by Silverware Layout), one under another in a pane too narrow to lay out. A cell's markdown is the host's own
   rendering: its first and last block take no margin outside the cell */
/* (The frame SilverBullet draws a custom syntax's widget in, given the class swl-grid-widget by the init page: no
   border round a grid, which is the page's own layout, not a box in it. Its rule names #sb-main, but sets no
   !important, so this one outweighs it) */
.swl-grid-widget {
  border: none !important;
}
.swl-grid {
  display: grid;
  grid-template-columns: var(--swl-grid-columns, repeat(2, minmax(0, 1fr)));
  gap: 0.5em 1.5em;
  align-items: start;
}
:root[data-swl-narrow] .swl-grid {
  grid-template-columns: minmax(0, 1fr);
}
/* The dividers between a grid's columns (src/grid/ui/dividers.ts): in each gap, a quiet line as the pointer is over
   the grid, plain over the divider or while it is dragged; a finger's target wider than the line. Out of the grid's
   flow (placed by the code at each gap's middle), none in a narrow pane (one column) */
.swl-grid {
  position: relative;
}
.swl-grid-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: var(--sw-layer-control);
  width: 12px;
  margin-left: -6px;
  cursor: col-resize;
  touch-action: none;
}
.swl-grid-divider::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 2px;
  border-radius: 1px;
  background: var(--ui-accent-color, #4a90e2);
  opacity: 0;
  transition: opacity 0.12s;
}
.swl-grid:hover > .swl-grid-divider::before {
  opacity: 0.25;
}
.swl-grid-divider:hover::before,
.swl-grid-divider[data-swl-dragging]::before {
  opacity: 1;
}
@media (hover: none) {
  .swl-grid-divider::before {
    opacity: 0.3;
  }
}
@media (pointer: coarse) {
  .swl-grid-divider {
    width: 24px;
    margin-left: -12px;
  }
  .swl-grid-divider::before {
    left: 11px;
  }
}
:root[data-swl-narrow] .swl-grid-divider {
  display: none;
}
/* The guides of a divider dragged: a quiet dashed line at each ratio's place over the grid's height; the one snapped
   to plain, its ratio named at its top (as a widget's width's guides) */
.swl-grid-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--root-color) 22%, transparent);
  pointer-events: none;
}
.swl-grid-guide.swl-grid-guide-near {
  border-left: 1px solid color-mix(in srgb, var(--root-color) 45%, transparent);
}
.swl-grid-guide-label {
  position: absolute;
  bottom: 100%;
  left: 3px;
  font: 11px var(--ui-font, system-ui, sans-serif);
  white-space: nowrap;
  color: color-mix(in srgb, var(--root-color) 45%, transparent);
}
/* (Named only where snapped: seven names over a narrow pair of columns would lie on each other) */
.swl-grid-guide:not(.swl-grid-guide-near) .swl-grid-guide-label {
  display: none;
}
.swl-grid-guide-near .swl-grid-guide-label {
  color: color-mix(in srgb, var(--root-color) 75%, transparent);
}
/* What a divider dragged says: the ratio snapped to, else the two columns' shares */
.swl-grid-divider-label {
  position: absolute;
  top: -1.8em;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 12px;
  white-space: nowrap;
  color: #fff;
  background: var(--ui-accent-color, #4a90e2);
  pointer-events: none;
}
.swl-grid-cell {
  min-width: 0;
  overflow-wrap: anywhere;
}
/* A blank line of a cell's markdown its rendering left out (next to a list, a heading, a table): a line of the cell's
   text, as the editor shows it */
.swl-grid-blank {
  height: 1lh;
}
.swl-grid-cell > :first-child {
  margin-top: 0;
}
.swl-grid-cell > :last-child {
  margin-bottom: 0;
}
.swl-grid-cell img {
  max-width: 100%;
}
/* A cell is edited by a click in it: a quiet hint of that as the pointer is over it, its markdown in a field as tall
   as its text while edited, the grid keeping its shape */
@media (hover: hover) {
  .swl-grid-cell:not(.swl-grid-editing):hover {
    outline: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
    outline-offset: 4px;
    cursor: text;
  }
}
.swl-grid-editor {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 2.5em;
  margin: 0;
  padding: 4px 6px;
  resize: none;
  overflow: hidden;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  line-height: 1.5;
  color: inherit;
  background: color-mix(in srgb, currentColor 5%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  border-radius: 4px;
}
.swl-grid-editor:focus {
  outline: 2px solid color-mix(in srgb, currentColor 40%, transparent);
  outline-offset: 1px;
}
/* <shared-menu> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The look of shared/menu.ts's menus: one template for every plugin drawing them, its classes those renderMenu gives
   (`<base>-menu-item`…) with a placeholder for the base; scripts/sharedstyles.mjs writes it, the plugin's base (`swt`,
   `swc`, `swd`) in place, into each plugin's style page (between its marks; npm run build), and check-build fails where
   one differs.
   The menu's box (where it shows, its size, its font, its background) is the plugin's own, `.<base>-menu`. */

/* The menu's entries one under another */
[role="menu"].swl-menu,
.swl-menu > [role="menu"] {
  display: flex;
  flex-direction: column;
  outline: none;
}
/* The title centered; a submenu's back arrow at the left */
.swl-menu-title {
  /* No say in the menu's width: as wide as its items, a long title cut */
  contain: inline-size;
  display: grid;
  /* The back arrow | the title | its pencil | the ×: the sides keep room for the arrow and the ×, the title is cut first */
  grid-template-columns: minmax(22px, 1fr) minmax(0, max-content) auto minmax(22px, 1fr);
  align-items: center;
  gap: 4px;
  padding: 4px 8px 6px;
  font-size: 12px;
  font-weight: 600;
}
.swl-menu-title-text {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* A submenu's way back: an arrow before its title */
.swl-menu-back {
  justify-self: start;
  display: inline-flex;
  margin: -3px 0 -3px -5px;
  padding: 3px;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swl-menu-back:hover,
.swl-menu-back:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swl-menu .swl-menu-back svg {
  width: 14px;
  height: 14px;
}
/* The × closing the menu, at the title's right */
.swl-menu-close {
  grid-column: 4;
  grid-row: 1;
  justify-self: end;
  display: inline-flex;
  margin: -3px -5px -3px 0;
  padding: 3px;
  color: inherit;
  opacity: 0.6;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swl-menu-close:hover,
.swl-menu-close:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swl-menu .swl-menu-close svg {
  width: 14px;
  height: 14px;
}
/* What the menu is about named in its title: a pencil after the title, the title a field once pressed */
.swl-menu-rename {
  grid-column: 3;
  grid-row: 1;
  justify-self: start;
  display: inline-flex;
  margin: -3px 0;
  padding: 3px;
  color: inherit;
  opacity: 0.6;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swl-menu-rename:hover,
.swl-menu-rename:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swl-menu-rename[aria-disabled] {
  opacity: 0.3;
  cursor: default;
  background: none;
}
.swl-menu .swl-menu-rename svg {
  width: 14px;
  height: 14px;
}
.swl-menu-title.swl-naming {
  display: block;
  padding: 2px 6px 6px;
}
.swl-menu-name {
  box-sizing: border-box;
  width: 100%;
  padding: 3px 6px;
  font: inherit;
  font-weight: 400;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--ui-accent-color);
  border-radius: 5px;
  outline: none;
}
.swl-menu-name-clear {
  margin: 4px 0 0;
  padding: 2px 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  color: inherit;
  background: none;
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 5px;
  cursor: pointer;
}
.swl-menu-name-problem {
  max-width: 260px;
  padding: 0 8px 6px;
  font-size: 12px;
  color: var(--danger-color, #c62828);
}
/* An item: its icon, its label (and its value), a mark where it opens a submenu or is checked */
.swl-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swl-menu-item:hover,
.swl-menu-item:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
/* A list opened in the menu's place: its choice highlighted (focusMenu), not
   the item that came under the pointer, until the pointer moves */
.swl-menu.swl-menu-still .swl-menu-item:hover:not(:focus-visible),
.swl-menu-still .swl-menu-item:hover:not(:focus-visible) {
  background: none;
}
.swl-menu-item.swl-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swl-menu-item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swl-menu-item[aria-disabled="true"]:hover {
  background: none;
}
.swl-menu-item .swl-label {
  flex: 1;
}
.swl-menu-item.swl-menu-sub::after {
  content: "\203A";
  opacity: 0.6;
}
.swl-menu-item[aria-checked="true"]::after {
  content: "\2713";
  color: var(--ui-accent-color);
}
.swl-menu-item.swl-danger {
  color: var(--danger-color, #c62828);
}
.swl-icon {
  display: inline-flex;
}
.swl-menu svg {
  width: 16px;
  height: 16px;
}
/* An item's detail: a bubble beside the menu, at the item's height */
.swl-menu-detail {
  position: absolute;
  left: calc(100% + 8px);
  width: max-content;
  max-width: 280px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}
.swl-menu-detail.swl-left {
  left: auto;
  right: calc(100% + 8px);
}
.swl-menu-detail[hidden] {
  display: none;
}
.swl-menu-detail-title {
  margin-bottom: 4px;
  font-weight: 600;
}
.swl-menu-detail-code {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.swl-menu-detail-code code {
  padding: 1px 5px;
  font-size: 11px;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  border-radius: 4px;
}
.swl-menu-detail p {
  margin: 0;
}
.swl-menu-detail .swl-menu-detail-note {
  margin-top: 6px;
  opacity: 0.7;
}
/* The icon of an item's value: Type: ☆ Stars */
.swl-menu-value-icon {
  display: inline-flex;
  margin-right: 3px;
  vertical-align: -2px;
}
.swl-menu .swl-menu-value-icon svg {
  width: 14px;
  height: 14px;
}
.swl-menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.3));
}
/* A row of icon buttons after a label: a choice (Align) or a pair of actions (Move up, Move down) */
.swl-menu-segmented {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 2px 8px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items */
.swl-menu-segmented > .swl-label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Something missing (a table shown as a sheet on none): its label in the danger color */
.swl-menu-segmented .swl-label.swl-attention {
  font-weight: 600;
  color: var(--danger-color, #c62828);
  opacity: 1;
}
/* (Its buttons, swl-segments and swl-segment, are shared/segments.css's) */
.swl-action[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A bar of actions, a caption under each icon (Copy, Cut, Paste): first in a menu */
.swl-menu-actions {
  display: flex;
  gap: 2px;
  padding: 2px;
}
.swl-action {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 44px;
  padding: 6px 2px 4px;
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swl-action .swl-icon {
  display: inline-flex;
}
.swl-action:not([aria-disabled="true"]):hover,
.swl-action:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 15%, transparent);
  outline: none;
}
.swl-action-caption {
  white-space: nowrap;
  opacity: 0.85;
}
/* Choices laid out as tiles, an icon over each label (a gallery: a chart's types) */
.swl-menu-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.swl-menu-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  font: inherit;
  font-size: 11px;
  color: inherit;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.swl-menu-tile[aria-checked="true"] {
  border-color: var(--ui-accent-color);
}
.swl-menu-tile[aria-checked="true"] .swl-label::after {
  content: " \2713";
  color: var(--ui-accent-color);
}
.swl-menu-tile[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swl-menu-tile:not([aria-disabled="true"]):hover,
.swl-menu-tile:focus-visible,
.swl-menu-tile.swl-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swl-menu-tile svg {
  width: 22px;
  height: 22px;
}
/* </shared-menu> */
/* A grid's cell's "…", at the cell's top right as the pointer is over the cell */
.swl-grid-cell {
  position: relative;
}
.swl-grid-cell-more {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: var(--sw-layer-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 4px;
  font: inherit;
  line-height: 1;
  color: inherit;
  background: var(--root-background-color);
  opacity: 0;
  cursor: pointer;
}
.swl-grid-cell:hover > .swl-grid-cell-more,
.swl-grid-cell-more:focus-visible,
.swl-grid-cell-more[aria-expanded="true"] {
  opacity: 1;
}
@media (hover: none) {
  .swl-grid-cell-more {
    opacity: 0.8;
  }
}
/* The box of a popup menu (shared/popupmenu.ts), over the page */
.swl-popup {
  position: fixed;
  z-index: var(--sw-layer-menu);
}
/* The box of Silverware Layout's menus (the shared menu's look is its template's, above) */
.swl-menu {
  min-width: 200px;
  max-width: 320px;
  padding: 4px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 13px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}
/* The Markdown tab: its boxes one under another */
.swl-syntax {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swl-syntax-note {
  margin: 0 0 4px;
  opacity: 0.8;
}
.swl-syntax-check {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* A cell's markdown that could not be rendered, and a grid drawn before Silverware Layout started: as typed */
.swl-grid-plain {
  white-space: pre-wrap;
  font-family: inherit;
}
```
