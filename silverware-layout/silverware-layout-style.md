---
tags: meta
---
# Silverware Layout style

The look of [Silverware Layout](silverware-layout.md): its settings dialog. It is installed with the library.

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
/* A widget staying at the text's start (its provider's say: an embedded medium): it grows to the right alone,
   as far as the pane's right edge less half the gutter (the text centred in the pane, 100% its width) */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-align="left"]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  width: min(var(--swl-shown), calc((var(--swl-pane-width, 100vw) + 100%) / 2 - 20px)) !important;
  margin-left: 0 !important;
  margin-right: auto !important;
}
/* A widget staying at the text's end (its provider's say: a medium aligned right): it grows to the left alone, as far
   as the pane's left edge less half the gutter */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-align="right"]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  --swl-end-shown: min(var(--swl-shown), calc((var(--swl-pane-width, 100vw) + 100%) / 2 - 20px));
  width: var(--swl-end-shown) !important;
  /* (Its left margin what is left of the line, below none once it is wider: an auto one went to none then, and the
     widget grew to the right, its guides, placed from its right edge, moving with it) */
  margin-left: calc(100% - var(--swl-end-shown)) !important;
  margin-right: 0 !important;
}
/* A widget laid out in a room of its own, not the page's text (a medium in a grid's cell): within that room, no
   wider; at its start, centred or at its end as its provider says */
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-in-room]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  width: min(var(--swl-width), 100%) !important;
  max-width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-in-room][data-swl-align="left"]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  margin-left: 0 !important;
}
:root:not([data-swl-narrow]) [data-swl-content] [data-swl-width][data-swl-in-room][data-swl-align="right"]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  margin-right: 0 !important;
}
/* A widget in another plugin's editor field (a file in a grid's cell edited: a shadow root, which the rules of the
   content do not reach; the field puts the page's rules naming swl- in it): within its room as in the cell drawn,
   standing where it stands there */
[data-swl-in-shadow][data-swl-width]:not([data-silverware-over-window]) {
  width: min(var(--swl-width), 100%) !important;
  max-width: 100% !important;
  box-sizing: border-box;
}
[data-swl-in-shadow]:is([data-swl-align="center"], [data-swl-align="right"]):not([data-silverware-over-window]) {
  display: block !important;
  width: fit-content;
  margin-left: auto !important;
  margin-right: auto !important;
}
[data-swl-in-shadow][data-swl-align="right"]:not([data-silverware-over-window]) {
  margin-right: 0 !important;
}
/* Where a widget stands (data-swl-align, its provider's say: a medium aligned), with or without a width laid out, a
   narrow pane too: centred or at the text's end (of its room, a cell). The inline box the host draws such a widget in
   (marked data-swl-align-holder by the code: its parent alone, and only an inline one) the whole line then, so the
   widget has room to stand in; a widget in a room a block of its own width. Important over the host's own margins (SilverBullet's by an id); the rules of a width laid out, above, more
   particular, place it as wide as it is */
[data-swl-content] [data-swl-align="center"]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  margin-left: auto !important;
  margin-right: auto !important;
}
[data-swl-content] [data-swl-align="right"]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  margin-left: auto !important;
  margin-right: 0 !important;
}
/* (An inline block as wide as the line, as the host itself has its widgets' boxes: a block in the line made a row of
   its own of what the line has round it besides (the editor's caret anchors), an empty line's height above and below
   the widget, the caret there looking like a blank line where there is none) */
/* (Not by the content around it: in an editor's field, a shadow root, too; the code marks none elsewhere) */
[data-swl-align-holder]:not([data-silverware-over-window], [data-silverware-over-window] *) {
  display: inline-block !important;
  width: 100%;
  vertical-align: top;
}
[data-swl-content] [data-swl-in-room]:is([data-swl-align="center"], [data-swl-align="right"]):not([data-silverware-over-window]) {
  display: block !important;
  width: fit-content;
}
/* SilverBullet showing the markdown as written (Editor: Toggle Markdown Syntax Rendering): the grids it still draws
   there hidden, their markdown alone shown; the host's box round each too (an empty one is a line's height) */
:root[data-swl-syntax-shown] .swl-grid-widget,
:root[data-swl-syntax-shown] :has(> .swl-grid-widget) {
  display: none !important;
}
/* The pointer over a link shown as its markdown, whose click places the cursor (src/host/silverbullet/links.ts marks
   the root while it is there): the text's, not a hand */
:root[data-swl-text-pointer] :hover {
  cursor: text !important;
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
/* The content's scale (shared/contentscale.ts) none over the window (a database's peek, a full screen): its text is not
   the editor's, which the font zoom sizes, so what it shows keeps its size too */
[data-silverware-over-window] {
  --sw-content-scale: 1;
}
/* Font zoom's label at the window's bottom left, a moment after each step, as the browser's own zoom shows its */
.swl-zoom-label {
  position: fixed;
  left: 12px;
  /* (Above a bar another plugin docks at the window's bottom: the room it takes, shared/room.ts) */
  bottom: calc(12px + var(--sw-room-bottom, 0px));
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
/* The handle of a widget's width: a short rounded grip beside its right edge, quiet grey, the accent's as the pointer
   is on it or it is dragged (the user's choice, 2026-11-14; a grid's column dividers a line alone, no grip: 2026-11-16) */
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
  position: relative;
  box-sizing: border-box;
  width: 12px;
  height: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: ew-resize;
  touch-action: none;
}
.swl-handle-bar::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: min(28px, 100%);
  transform: translate(-50%, -50%);
  border-radius: 2px;
  background: color-mix(in srgb, var(--root-color) 35%, transparent);
  transition: background-color 0.12s, height 0.12s;
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
/* In a grid's cell, within the widget at its edge (docs/silverware-layout-room-handles.md): over what it shows (an
   image), so a light grip outlined, read on a dark picture and a light one alike, unlike the grey grip between the
   grid's columns */
.swl-handle.swl-handle-inside .swl-handle-bar::after {
  width: 6px;
  background: color-mix(in srgb, var(--root-background-color, #fff) 92%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--root-color) 45%, transparent), 0 1px 3px rgb(0 0 0 / 25%);
  /* (A little see-through until pointed at: less of the picture hidden; the user's wish, 2026-11-16) */
  opacity: 0.7;
  transition: background-color 0.12s, height 0.12s, opacity 0.12s;
}
.swl-handle.swl-handle-inside .swl-handle-bar:is(:hover, :focus-visible)::after,
.swl-handle-dragging.swl-handle-inside .swl-handle-bar::after {
  background: var(--ui-accent-color, #464cfc);
  opacity: 1;
}
/* A widget not widened (a preview; any in a pane too narrow to lay widths out): its bar the grip of its menu alone
   (where it stands), pressed as a button; the drag's line kept, plainly off (the user's wish, 2026-11-14: seen to be
   no width's at a glance): faint, neither growing nor taking the accent as it is pointed at, a little stronger alone */
.swl-handle.swl-handle-menu-only .swl-handle-bar {
  cursor: pointer;
}
.swl-handle.swl-handle-menu-only .swl-handle-bar::after,
.swl-handle.swl-handle-menu-only .swl-handle-bar:is(:hover, :focus-visible)::after {
  height: min(28px, 100%);
  background: color-mix(in srgb, var(--root-color) 15%, transparent);
}
.swl-handle.swl-handle-menu-only .swl-handle-bar:is(:hover, :focus-visible)::after {
  background: color-mix(in srgb, var(--root-color) 40%, transparent);
}
/* (Within a widget in a cell, its menu's grip alone plainly off as beside one outside a grid: grey, fainter, no accent
   nor growth as pointed at, a little stronger alone; outlined still, read over what it shows) */
.swl-handle.swl-handle-inside.swl-handle-menu-only .swl-handle-bar::after {
  background: color-mix(in srgb, var(--root-background-color, #fff) 70%, var(--root-color) 30%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--root-color) 25%, transparent);
  opacity: 0.55;
}
.swl-handle.swl-handle-inside.swl-handle-menu-only .swl-handle-bar:is(:hover, :focus-visible)::after {
  background: color-mix(in srgb, var(--root-background-color, #fff) 45%, var(--root-color) 55%);
  opacity: 0.9;
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
.swl-handle-bar:focus-visible {
  outline: none;
}
.swl-handle-bar:hover::after,
.swl-handle-bar:focus-visible::after,
.swl-handle-dragging .swl-handle-bar::after {
  height: min(40px, 100%);
  background: var(--ui-accent-color, #464cfc);
}
/* Silverware Layout (prefix swl-): the settings dialog ("Silverware Layout: Settings"), over the page and
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
/* Full width: the list's last row (the widest), a box for its number, as tall as a guide's row */
.swl-dialog-full-row {
  display: flex;
  align-items: center;
  min-height: 32px;
}
.swl-dialog-full {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.swl-dialog-full-note {
  opacity: 0.6;
}
/* What guides are, on top; the list with none says so, quiet */
.swl-dialog-guides-lead {
  margin: 0;
  opacity: 0.8;
}
.swl-dialog-guides-empty {
  margin: 0;
  font-size: 12px;
  opacity: 0.6;
}
.swl-dialog-guides-empty[hidden] {
  display: none;
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
/* Preview on the Guides tab (held, the guides on the page) and Restore defaults beside it, over the list: an icon and its name each */
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
  /* (Named: the lines of a cell edited lie in their middle) */
  --swl-grid-row-gap: 0.5em;
  --swl-grid-column-gap: 1.5em;
  gap: var(--swl-grid-row-gap) var(--swl-grid-column-gap);
  /* (Each cell as tall as its row: a shorter cell clicked anywhere, under its text too, is edited) */
  align-items: stretch;
}
/* (A grid of columns as many as fit keeps them: a gallery on a phone, as many as its narrowest width lets in) */
:root[data-swl-narrow] .swl-grid:not([data-swl-fit]) {
  grid-template-columns: minmax(0, 1fr);
}
/* The dividers between a grid's columns (src/grid/ui/dividers.ts): a boundary is a line, so a line is all it draws, as
   a table's column border is (the user's choice 2026-11-16, docs/silverware-layout-room-handles.md *Column dividers*): none
   at rest, the line over the grid's height lit as the pointer is over the divider or it is dragged, the column's cursor.
   No grip: a grip is a widget's width (the handle beside a grid, inside a file in a cell), told apart at a glance. On a
   touch screen, while the grid has the focus, the line faint with a knob a finger takes. Out of the grid's flow (placed
   by the code at each gap's middle), none in a narrow pane (one column) */
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
.swl-grid-divider::before,
.swl-grid-divider::after {
  content: "";
  position: absolute;
  left: 50%;
  transition: opacity 0.12s;
}
/* The line over the grid's height, on the pointer */
.swl-grid-divider::before {
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: var(--ui-accent-color, #4a90e2);
  opacity: 0;
}
/* A finger's knob, on a touch screen alone: at the middle of the part of the grid in view (src/grid/ui/dividers.ts
   sets --swl-knob-y), a tall grid's seen wherever it is scrolled to */
.swl-grid-divider::after {
  top: var(--swl-knob-y, 50%);
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid var(--ui-accent-color, #4a90e2);
  background: var(--root-background-color, #fff);
  opacity: 0;
}
.swl-grid-divider:hover::before,
.swl-grid-divider[data-swl-dragging]::before {
  opacity: 1;
}
@media (hover: none) {
  .swl-grid:focus-within > .swl-grid-divider::before {
    opacity: 0.45;
  }
  .swl-grid:focus-within > .swl-grid-divider::after,
  .swl-grid-divider[data-swl-dragging]::after {
    opacity: 1;
  }
  .swl-grid-divider[data-swl-dragging]::before {
    opacity: 1;
  }
}
@media (pointer: coarse) {
  .swl-grid-divider {
    width: 24px;
    margin-left: -12px;
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
  /* (Over the knob's place, which rides in the part of the grid in view) */
  top: calc(var(--swl-knob-y, 50%) - 12px - 1.8em);
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
  /* (An empty cell a line high: somewhere to click into to write in it) */
  min-height: 1lh;
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
/* What a cell draws of its markdown in the look the theme gives the page's: a table as a card, a picture's and a code
   block's corners, a quote's bar, by the theme's own variables (SilverBullet's after 2.12.1: its corners, its card's
   border and shadow, its code's ground), else plain (2.12.1 has none of them, nor its page). These rules alone set
   it: the page's own drawing is SilverBullet's, untouched. The cell's own blocks alone (its children): what a plugin
   draws in a box of its own (a spreadsheet's preview) keeps its look. Of more weight than a host's rules for a table in a
   block of its (`:not(#swl-none)` twice: two ids more, matching every one) */
.swl-grid-cell > table:not(#swl-none):not(#swl-none) {
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--ui-surface-border-color, transparent);
  border-radius: var(--ui-radius-xl, 0);
  box-shadow: var(--ui-shadow-card, none);
  background: var(--root-background-color);
}
/* (Its corner cells rounded as the card, inside its border: a cell's ground would show past a rounded corner) */
.swl-grid-cell > table > :first-child > tr:first-child > :first-child {
  border-top-left-radius: max(0px, calc(var(--ui-radius-xl, 0px) - 1px));
}
.swl-grid-cell > table > :first-child > tr:first-child > :last-child {
  border-top-right-radius: max(0px, calc(var(--ui-radius-xl, 0px) - 1px));
}
.swl-grid-cell > table > :last-child > tr:last-child > :first-child {
  border-bottom-left-radius: max(0px, calc(var(--ui-radius-xl, 0px) - 1px));
}
.swl-grid-cell > table > :last-child > tr:last-child > :last-child {
  border-bottom-right-radius: max(0px, calc(var(--ui-radius-xl, 0px) - 1px));
}
/* (A picture of the cell's own markdown alone, in its paragraph or item: one a plugin draws, in a box of its own, is
   that plugin's to look so) */
.swl-grid-cell > :is(p, li) > img:not(#swl-none) {
  border-radius: var(--ui-radius-lg, 0);
  outline: 1px solid var(--ui-surface-border-color, transparent);
  outline-offset: -1px;
}
.swl-grid-cell > pre:not(#swl-none) {
  padding: 12px 16px;
  overflow-x: auto;
  border-radius: var(--ui-radius-lg, 0);
  background-color: var(--editor-code-background-color, transparent);
}
.swl-grid-cell > pre:not(#swl-none) code {
  padding: 0;
  border-radius: 0;
  background: none;
}
.swl-grid-cell > blockquote:not(#swl-none) {
  margin-left: 0;
  margin-right: 0;
  padding-left: 1em;
  border-left: 2px solid var(--editor-blockquote-border-color, color-mix(in srgb, var(--root-color, #000) 25%, transparent));
}
/* A grid's borders (its `border` attribute): faint lines round it and between its cells, as a table's. The gap goes
   into each cell's padding, so a line between two columns lies where the gap's middle was, on its divider. All within
   the grid's box (it cuts off what lies outside, but above: `clip-path`): its ring on its own first and last
   pixels; between cells each cell's right and bottom shadow, on the pixel after the
   cell, where a divider draws its line (each cell closed so, a last row's last cell too, not run into the empty
   place beside it). Opaque, so where two meet the line is no darker. Cells as tall as their row: a line between two
   columns runs its height. */
.swl-grid[data-swl-border] {
  --swl-grid-line: color-mix(in srgb, var(--root-color, #000) 16%, var(--root-background-color, #fff));
  gap: 0;
  align-items: stretch;
  box-shadow: inset 0 0 0 1px var(--swl-grid-line);
}
.swl-grid[data-swl-border] > .swl-grid-cell {
  padding: 0.5em 0.75em;
  box-shadow: 1px 0 0 var(--swl-grid-line), 0 1px 0 var(--swl-grid-line);
}
/* (Its line the border's own pixel, lit: no wider, not into the next cell) */
.swl-grid[data-swl-border] > .swl-grid-divider::before {
  width: 1px;
  transform: none;
}
.swl-grid[data-swl-border] > .swl-grid-divider::after {
  transform: translate(calc(-50% + 0.5px), -50%);
}
/* A grid of columns as many as fit, its borders: its ring on its top and left alone, each cell's right and bottom
   shadow seen past its edge (a last row of fewer cells closed by its cells' lines, no ring round the empty place
   beside them) */
.swl-grid[data-swl-border][data-swl-fit] {
  box-shadow: inset 1px 1px 0 0 var(--swl-grid-line);
  clip-path: inset(-48px -1px -1px 0);
}
/* A grid's lines between its cells alone (`border="inner"`): a faint line in the middle of each gap, between its
   columns and between its rows, no ring round it, its layout as it is. Each cell draws its line at its left, half a
   gap before it, run down through the gap under it to meet the next row's, and its line under it, in the middle of the
   gap under it, run half a gap past each side to meet its neighbours'. What falls outside the grid (the first column's
   line, the last row's, the ends past its sides) its `clip-path` cuts off. Drawn by the cells, not the dividers: the
   same in a grid of columns as many as fit and in a narrow pane, where there are none. Not while a cell is edited or the
   grid resized (all its lines are drawn then, by the same pseudo-elements) nor while a place is picked (the
   grid's clip taken off, what falls outside would show). */
.swl-grid[data-swl-border-inner] {
  --swl-grid-line: color-mix(in srgb, var(--root-color, #000) 16%, var(--root-background-color, #fff));
  align-items: stretch;
}
:root:not([data-swl-picking]) .swl-grid[data-swl-border-inner]:not(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) > .swl-grid-cell::before,
:root:not([data-swl-picking]) .swl-grid[data-swl-border-inner]:not(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) > .swl-grid-cell::after {
  content: "";
  position: absolute;
  background: var(--swl-grid-line);
  pointer-events: none;
}
:root:not([data-swl-picking]) .swl-grid[data-swl-border-inner]:not(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) > .swl-grid-cell::before {
  top: 0;
  bottom: calc(var(--swl-grid-row-gap) * -1);
  left: calc(var(--swl-grid-column-gap) / -2 - 0.5px);
  width: 1px;
}
:root:not([data-swl-picking]) .swl-grid[data-swl-border-inner]:not(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) > .swl-grid-cell::after {
  bottom: calc(var(--swl-grid-row-gap) / -2 - 0.5px);
  left: calc(var(--swl-grid-column-gap) / -2);
  right: calc(var(--swl-grid-column-gap) / -2);
  height: 1px;
}
/* A grid without all its lines one of whose cells is edited, or whose column divider or width is dragged (its widget
   marked data-swl-resizing by the handle): all its lines as a table's for as long as it is (in place of an outline round
   the field: the user's choice, 2026-11-14; every line while it is resized, not its ring alone: the user's report,
   2026-11-16), its layout as it is (its borders' gap and padding moved its content and the columns under the pointer:
   2026-11-15). Each line in the middle of a gap: each cell's right and bottom, the grid's top and left half a gap
   outside it, the grid letting that half gap be seen. Opaque, one line where two meet */
.swl-grid:not([data-swl-border]):is(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) {
  --swl-grid-line: color-mix(in srgb, var(--root-color, #000) 16%, var(--root-background-color, #fff));
  clip-path: inset(-48px calc(var(--swl-grid-column-gap) / -2 - 1px) calc(var(--swl-grid-row-gap) / -2 - 1px));
}
.swl-grid:not([data-swl-border]):is(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *)::before,
.swl-grid:not([data-swl-border]):is(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) > .swl-grid-cell::after {
  content: "";
  position: absolute;
  inset: calc(var(--swl-grid-row-gap) / -2) calc(var(--swl-grid-column-gap) / -2);
  pointer-events: none;
}
.swl-grid:not([data-swl-border]):is(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *)::before {
  box-shadow: inset 1px 1px 0 0 var(--swl-grid-line);
}
.swl-grid:not([data-swl-border]):is(:has(> .swl-grid-editing), :has(> .swl-grid-divider[data-swl-dragging]), [data-swl-resizing] *) > .swl-grid-cell::after {
  box-shadow: inset -1px -1px 0 0 var(--swl-grid-line);
}
/* A cell is edited by a click in it: the text's pointer over it (no outline round it: cut off at the grid's edges, and
   drawn on every column, the user found it noisy, 2026-11-14), its markdown in a field as tall as its text while
   edited, the grid keeping its shape */
@media (hover: hover) {
  .swl-grid-cell:not(.swl-grid-editing):hover {
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
/* An editor showing the markdown as rendered (Silverware Editor's): the cell's own look, its font, size and spacing,
   nothing round it (the grid's lines show the cell edited), so only what the caret is at changes as the cell is
   edited. Nothing of it cut off: its caret at a line's start lies a pixel left of it (an empty line's, unseen) */
.swl-grid-editor.swl-grid-editor-preview {
  min-height: 1lh;
  padding: 0;
  overflow: visible;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  background: none;
  border: 0;
  border-radius: 0;
}
/* A grid focused by a press in it (it takes the focus from the editor round it): no ring */
.swl-grid:focus {
  outline: none;
}
/* A cell text dragged over would be dropped in (written into its markdown where it is let go) */
.swl-grid-cell.swl-grid-drop {
  outline: 2px dashed color-mix(in srgb, var(--ui-accent-color, #464cfc) 60%, transparent);
  outline-offset: -2px;
}
/* Move to grid: a place being picked (src/grid/ui/placepicker.ts). The grids outlined as what can be picked, the
   pointer a copy's over them, their own controls (a cell's grip, a divider, the width's handle) away meanwhile */
:root[data-swl-picking] .swl-grid {
  outline: 2px dashed color-mix(in srgb, var(--ui-accent-color, #464cfc) 45%, transparent);
  outline-offset: 6px;
  /* (Not cut off: what the clip keeps in, its grips and dividers, is away) */
  clip-path: none;
}
:root[data-swl-picking] .swl-grid,
:root[data-swl-picking] .swl-grid * {
  cursor: copy !important;
}
:root[data-swl-picking] :is(.swl-grid-cell-grip, .swl-grid-divider, .swl-handle) {
  display: none !important;
}
/* The cell the text would go into, tinted */
.swl-grid-cell.swl-grid-pick-cell {
  outline: 2px dashed var(--ui-accent-color, #464cfc);
  outline-offset: -2px;
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 8%, transparent);
}
/* Where it would go: a line between cells (a dot at each end), or where a cell's blocks meet */
.swl-pick-mark {
  position: fixed;
  z-index: var(--sw-layer-control);
  pointer-events: none;
  border-radius: 2px;
  background: var(--ui-accent-color, #464cfc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-accent-color, #464cfc) 25%, transparent);
}
.swl-pick-mark[hidden],
.swl-pick-label[hidden] {
  display: none;
}
.swl-pick-mark:not([data-swl-pick="inside"])::before,
.swl-pick-mark:not([data-swl-pick="inside"])::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ui-accent-color, #464cfc);
}
.swl-pick-mark[data-swl-pick="between-columns"]::before {
  top: -5px;
  left: -3px;
}
.swl-pick-mark[data-swl-pick="between-columns"]::after {
  bottom: -5px;
  left: -3px;
}
.swl-pick-mark[data-swl-pick="between-rows"]::before {
  left: -5px;
  top: -3px;
}
.swl-pick-mark[data-swl-pick="between-rows"]::after {
  right: -5px;
  top: -3px;
}
/* What it would make there, by the line */
.swl-pick-label {
  position: fixed;
  z-index: calc(var(--sw-layer-control) + 1);
  pointer-events: none;
  padding: 2px 8px;
  border-radius: 10px;
  font: 600 12px/18px system-ui, sans-serif;
  white-space: nowrap;
  color: #fff;
  background: var(--ui-accent-color, #464cfc);
}
/* What to do, with Cancel: at the window's top, over the page's controls (its bar at the top meanwhile; a phone's
   keyboard and toolbar at the bottom) */
.swl-pick-bar {
  position: fixed;
  left: 50%;
  top: calc(8px + env(safe-area-inset-top, 0px));
  transform: translateX(-50%);
  width: max-content;
  z-index: var(--sw-layer-menu);
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px;
  border: 1px solid color-mix(in srgb, var(--ui-accent-color, #464cfc) 50%, transparent);
  border-radius: 10px;
  font: 13px/1.35 system-ui, sans-serif;
  color: var(--root-color, #222);
  background: var(--root-background-color, #fff);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}
.swl-pick-bar-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.swl-pick-bar-text > span {
  opacity: 0.75;
}
.swl-pick-bar-cancel {
  flex: none;
  padding: 6px 12px;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 6px;
  font: inherit;
  color: inherit;
  background: none;
  cursor: pointer;
}
.swl-pick-bar-cancel:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
/* (The field no outline as it has the focus: the grid's lines show the cell edited) */
.swl-grid-editor:is(:focus, :focus-within) {
  outline: none;
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
/* An item's icon its own size, centred on its line: a plugin's own rules for its class (Silverware Assets' file
   icons, 22 px) do not reach into its menus. Where any item of a menu has an icon, each item keeps its place, so
   their words line up (an item without one an empty place) */
.swl-menu .swl-icon {
  width: auto;
  height: auto;
  align-items: center;
}
.swl-menu:has(.swl-menu-item > .swl-icon > svg) .swl-menu-item > .swl-icon {
  flex: 0 0 16px;
  width: 16px;
}
/* A menu of no icons: no empty place before an item's words (with the gap after it, they began further in than a row
   of choices' label above them) */
.swl-menu:not(:has(.swl-menu-item > .swl-icon:not(:empty))) .swl-menu-item > .swl-icon:empty {
  display: none;
}
.swl-menu .swl-icon > svg {
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
/* A row of icon buttons after a label: a choice (Align) or a pair of actions (Move up, Move down). Its buttons under
   the label, at the right, where they do not fit beside it (a menu as wide as a phone lets it: a grid's columns, eight
   of them, ran out of the menu), on more lines where they do not fit on one */
.swl-menu-segmented {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  padding: 2px 4px 2px 8px;
}
.swl-menu-segmented > .swl-segments {
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}
/* A menu whose items have icons: a row's label where their words begin (the icon's place and the gap after it) */
.swl-menu:has(.swl-menu-item > .swl-icon > svg) .swl-menu-segmented {
  padding-left: 32px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items; a short one whole, never
   squeezed by the buttons beside it (Show as) */
.swl-menu-segmented > .swl-label {
  flex: 0 0 auto;
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
/* A grid's cell grip (src/grid/ui/columngrips.ts, docs/silverware-layout-grid-handles.md): a short grey grip lying
   at the middle of the cell's top edge, half above it (the line above a grid is kept free), as a divider's grip turned
   on its side; shown as the pointer is over the cell, lit and longer as it is pointed at, its click the cell's
   menu. Its target larger than what is drawn (a finger's larger still) */
/* (The box the host draws a grid in let out: it scrolls what lies outside it away, so the grips' upper halves were
   cut off. The grid then cuts off itself what lies outside it but above: its cells' lines the pixel after the last
   column and row, as the box did (the grid's borders drawn within it), a cell's content too wide; above it, in the
   line kept free, the cell grips' upper halves and a divider's label stay seen) */
.swl-grid-widget :has(> .swl-grid) {
  overflow: visible !important;
}
.swl-grid {
  clip-path: inset(-48px 0 0 0);
}
.swl-grid-cell {
  position: relative;
}
.swl-grid-cell-grip {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: var(--sw-layer-control);
  width: 44px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  transform: translate(-50%, -50%);
  opacity: 0;
  /* (Hidden, it takes no press: a press there is the cell's, edited, as it was before the grip was there) */
  pointer-events: none;
  cursor: pointer;
  touch-action: none;
}
.swl-grid-cell-grip::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--root-color) 35%, transparent);
  transform: translate(-50%, -50%);
  transition: background-color 0.12s, width 0.12s;
}
.swl-grid-cell:hover > .swl-grid-cell-grip,
.swl-grid-cell-grip:focus-visible,
.swl-grid-cell-grip[aria-expanded="true"] {
  opacity: 1;
  pointer-events: auto;
}
.swl-grid-cell-grip:hover::after,
.swl-grid-cell-grip:focus-visible::after,
.swl-grid-cell-grip[aria-expanded="true"]::after {
  width: 40px;
  background: var(--ui-accent-color, #4a90e2);
}
/* A touch screen: no pointer over anything; a grid's grips shown while it has the focus (a tap in it gives it), a
   finger's target */
@media (hover: none) {
  .swl-grid:focus-within > .swl-grid-cell > .swl-grid-cell-grip {
    opacity: 1;
    pointer-events: auto;
  }
}
@media (pointer: coarse) {
  /* (A finger's target, wider, its height half above the edge, in the gap between rows, half in its cell's top: not
     over the cell above's text, nor a short cell's middle, whose tap is the cell's) */
  .swl-grid-cell-grip {
    width: 56px;
    height: 16px;
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
/* The Alignment tab (src/ui/aligntab.ts): a row per kind of widget, its name and where it stands */
.swl-align {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swl-align-note {
  margin: 0 0 4px;
  opacity: 0.8;
}
.swl-align-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(0, 12em);
  gap: 12px;
  align-items: center;
}
.swl-align-select {
  font: inherit;
}
/* The Markdown tab: a line on top, then a section a setting, each headed as the other tabs name their rows: what
   SilverBullet does, the box, what on and off give (quiet, as a row's note) */
.swl-syntax {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.swl-syntax-lead {
  margin: 0;
  opacity: 0.8;
}
.swl-syntax-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swl-syntax-heading {
  margin: 0;
  padding: 0;
  font-size: inherit;
}
.swl-syntax-text {
  margin: 0;
}
.swl-syntax-note {
  margin: 0;
  font-size: 12px;
  opacity: 0.6;
}
.swl-syntax-check {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
/* A cell's markdown that could not be rendered, and a grid drawn before Silverware Layout started: as typed */
.swl-grid-plain {
  white-space: pre-wrap;
  font-family: inherit;
}
```
