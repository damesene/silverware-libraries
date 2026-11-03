---
tags: meta
---
# Silverware Table style

The look of [Silverware Table](silverware-table.md): its controls, menus and dialogs, and the built-in themes. It is installed with the library; your own themes go in a `space-style` block of your own (see *Themes* on the library's page).

```space-style
.sb-table-widget.swt-table td {
  cursor: text;
}
/* Select mode (Edit mode off): a click selects a cell, so the default pointer;
   on the cell selected alone the next click edits it, so the text cursor */
body.swt-select-mode .sb-table-widget.swt-table td {
  cursor: default;
}
body.swt-select-mode .sb-table-widget.swt-table td.swt-selected-alone {
  cursor: text;
}
/* An empty row is as tall as a row with text (zero-width space, not in the text) */
.sb-table-widget.swt-table td:not(.swt-editing)::before {
  content: "\200b";
}
/* An empty column stays wide enough to click into */
.sb-table-widget.swt-table td {
  min-width: 4em;
}
.sb-table-widget.swt-table td a,
.sb-table-widget.swt-table td button,
.sb-table-widget.swt-table td input[type="checkbox"] {
  cursor: pointer;
}

/* Offer to name unnamed columns, which SilverBullet does not render */
.swt-notice {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
  padding: 6px 10px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 13px;
  white-space: normal;
  color: var(--root-color);
  background: color-mix(in srgb, var(--ui-accent-color) 10%, transparent);
  border-left: 3px solid var(--ui-accent-color);
  border-radius: 4px;
}
.swt-notice button {
  padding: 2px 10px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--ui-accent-color);
  border-radius: 4px;
  cursor: pointer;
}

/* A header on one line (layOutHeaderCell): its name, then the icons after it,
   which always show; where the name does not fit (a width set), it is cut
   (with an ellipsis by the longText module) */
.sb-table-widget.swt-table thead tr:first-child > td {
  white-space: nowrap;
}
.sb-table-widget.swt-table .swt-head {
  display: inline-flex;
  align-items: center;
  vertical-align: top;
}
.sb-table-widget.swt-table .swt-head-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.sb-table-widget.swt-table .swt-head > .swt-ui {
  flex: none;
}
/* Sort control: shown on header hover, always while it sorts */
.swt-sort {
  margin-left: 6px;
  padding: 0 2px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.8em;
  font-weight: normal;
  color: inherit;
  cursor: pointer !important;
  opacity: 0;
  transition: opacity 0.12s;
}
.sb-table-widget.swt-table thead tr:hover .swt-sort {
  opacity: 0.5;
}
/* A touch screen has no hover to show it on: always shown there, faint
   (lighter than a column type's icon, so the two do not compete) */
@media (hover: none) {
  .sb-table-widget.swt-table thead tr .swt-sort:not(.swt-active) {
    opacity: 0.3;
  }
  /* A long press opens the cell menu: not the system's text selection and callout */
  .sb-table-widget.swt-table td:not(.swt-editing) {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
}
.sb-table-widget.swt-table thead tr .swt-sort:hover,
.sb-table-widget.swt-table thead tr .swt-sort.swt-active {
  opacity: 1;
}
.sb-table-widget .swt-hidden,
.sb-table-widget tr.swt-meta-row {
  display: none !important;
}

/* A table that fits its width, without a maximum height (the script sets
   swt-sticky-native): its box is clipped, not scrolled, so it captures no
   sticky positioning, and the header (with the rows pinned to the top) and the
   rows pinned to the bottom stick to the page, moved by the browser itself
   (smooth on a phone too). The gap above the header is STICKY_GAP in the
   script; keep both in step. */
.sb-table-widget.swt-table.swt-sticky-native {
  overflow: clip !important;
}
.sb-table-widget.swt-sticky-native thead,
.sb-table-widget.swt-sticky-native thead.swt-stuck {
  position: sticky;
  /* STICKY_GAP, less for a table nearer the page's top (the script: --swt-sticky-top) */
  top: var(--swt-sticky-top, 66px);
  z-index: 3;
}
.sb-table-widget.swt-sticky-native tfoot,
.sb-table-widget.swt-sticky-native tfoot.swt-stuck {
  position: sticky;
  /* The view's bottom: less the scrolling box's bottom padding, which sticky positioning leaves out (the script:
     --swt-sticky-bottom; SilverBullet's scroller has 360px) */
  bottom: var(--swt-sticky-bottom, 0px);
  z-index: 3;
}
/* A table laid over the window (full screen, swt-sticky-box): it scrolls in
   its own box only, which captures the sticky positioning: the header held
   STICKY_GAP below the box's top (room for the toolbar), the bottom rows at
   its bottom, moved by the browser */
.sb-table-widget.swt-sticky-box thead,
.sb-table-widget.swt-sticky-box thead.swt-stuck {
  position: sticky;
  top: 66px;
  z-index: 3;
}
.sb-table-widget.swt-sticky-box tfoot,
.sb-table-widget.swt-sticky-box tfoot.swt-stuck {
  position: sticky;
  bottom: 0;
  z-index: 3;
}
/* The room above a held header (STICKY_GAP) covered in the page's color: a
   band above each of the header's top cells (positioned: relative, or sticky
   where pinned), under the cell's own content (the columns' letters) as it is
   behind it in the header's stacking context (z-index 3). Not a shadow of the
   cells: a theme collapsing the table's borders (border-collapse: collapse)
   has the browser paint no cell's box-shadow, and rows showed there. Only the
   top row has it: from the filter row it would cover the header row. */
.sb-table-widget.swt-sticky-box thead tr:first-child > td::after,
.sb-table-widget thead.swt-stuck tr:first-child > td::after {
  content: "";
  position: absolute;
  left: -1px;
  right: -1px;
  bottom: 100%;
  height: 66px;
  background: var(--root-background-color, #fff);
  pointer-events: none;
  z-index: -1;
}
/* Its header opaque, and the room above it covered, at all times: the browser
   holds the header at once while the script marks it held (swt-stuck) only a
   frame later, so a fast scroll showed rows there.
   (:where: a selected or edited header cell's own marks still win.) */
.sb-table-widget.swt-sticky-box :where(thead td) {
  background: linear-gradient(
      var(--editor-table-head-background-color, transparent),
      var(--editor-table-head-background-color, transparent)
    ),
    var(--root-background-color, #fff);
}

/* Header held at the top of the view while the table scrolls past (moved by
   script, or by the browser with swt-sticky-native) */
.sb-table-widget thead.swt-stuck {
  /* above the rows it is moved over */
  position: relative;
  z-index: 3;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
}
/* The header color may be see-through (dark theme): lay it over the page color
   (the gap above it is covered by the band above) */
.sb-table-widget thead.swt-stuck td {
  background: linear-gradient(
      var(--editor-table-head-background-color, transparent),
      var(--editor-table-head-background-color, transparent)
    ),
    var(--root-background-color, #fff);
}

/* Pinned rows and columns stay in view (moved there by script); they need an
   opaque background over the rows and columns scrolling under them.
   SilverBullet clips tables with overflow: hidden, which would make the table
   the box sticky columns stick in; clip cuts the same without that. */
.sb-table-widget.swt-table table {
  overflow: clip !important;
}
.sb-table-widget tfoot.swt-stuck {
  position: relative;
  z-index: 3;
  filter: drop-shadow(0 -2px 3px rgba(0, 0, 0, 0.25));
}
.sb-table-widget tfoot.swt-stuck td {
  background: var(--root-background-color, #fff);
}
.sb-table-widget td.swt-pin-left,
.sb-table-widget td.swt-pin-right {
  position: sticky;
  z-index: 1;
  background: var(--root-background-color, #fff);
}
.sb-table-widget tbody tr:nth-of-type(even) td.swt-pin-left,
.sb-table-widget tbody tr:nth-of-type(even) td.swt-pin-right {
  background: linear-gradient(
      var(--editor-table-even-background-color, transparent),
      var(--editor-table-even-background-color, transparent)
    ),
    var(--root-background-color, #fff);
}
.sb-table-widget thead td.swt-pin-left,
.sb-table-widget thead td.swt-pin-right {
  background: linear-gradient(
      var(--editor-table-head-background-color, transparent),
      var(--editor-table-head-background-color, transparent)
    ),
    var(--root-background-color, #fff);
}
/* Pinned rows and the body cells of pinned columns: a light tint of the accent
   color, so they show apart from the rows and columns that scroll (still
   opaque, over the page color; a selected or edited cell's tint, an inset
   shadow, shows over it) */
.sb-table-widget.swt-table {
  --swt-pinned-tint: color-mix(in srgb, var(--ui-accent-color, #464cfc) 12%, transparent);
}
.sb-table-widget.swt-table :is(tbody, tfoot) td:is(.swt-pin-left, .swt-pin-right),
.sb-table-widget.swt-table :is(thead, tfoot) tr[data-swt-row] > td {
  background: linear-gradient(var(--swt-pinned-tint), var(--swt-pinned-tint)), var(--root-background-color, #fff);
}
.sb-table-widget.swt-table tbody tr:nth-of-type(even) td:is(.swt-pin-left, .swt-pin-right) {
  background: linear-gradient(var(--swt-pinned-tint), var(--swt-pinned-tint)),
    linear-gradient(var(--editor-table-even-background-color, transparent), var(--editor-table-even-background-color, transparent)),
    var(--root-background-color, #fff);
}
.sb-table-widget td.swt-pin-left.swt-pin-edge {
  box-shadow: 3px 0 4px -2px rgba(0, 0, 0, 0.3);
}
.sb-table-widget td.swt-pin-right.swt-pin-edge {
  box-shadow: -3px 0 4px -2px rgba(0, 0, 0, 0.3);
}

/* The pin icon on pinned rows (first cell) and columns (header): at the
   cell's right edge, out of the layout, so no text moves when pinning */
.sb-table-widget td:has(> .swt-pin-mark) {
  position: relative;
}
.sb-table-widget td.swt-pin-left:has(> .swt-pin-mark),
.sb-table-widget td.swt-pin-right:has(> .swt-pin-mark) {
  position: sticky;
}
.swt-pin-mark {
  position: absolute;
  top: 50%;
  right: 2px;
  display: inline-flex;
  transform: translateY(-50%);
  opacity: 0.8;
}
.swt-pin-mark svg {
  width: 14px;
  height: 14px;
}
/* In a header the name ends in the sort control: the pin icon gets its own
   room there instead of covering it (SilverBullet's header padding is 8px) */
.sb-table-widget thead tr:first-child > td:has(> .swt-pin-mark) {
  padding-right: 22px !important;
}

/* Ctrl held in a cell editor: arrows move between cells */
/* Ctrl held in a cell editor: the move cursor on the cell under the pointer
   (a class on that cell only: one on an ancestor of every cell made the
   browser recalculate the whole page's style on every press of Ctrl) */
.sb-table-widget.swt-table.swt-navigating-here,
.sb-table-widget.swt-table :is(td, th).swt-navigating-here,
.sb-table-widget.swt-table :is(td, th).swt-navigating-here * {
  cursor: move !important;
}

/* Inline editing: the field takes the text's place and size; the cell is
   highlighted as selected cells are. The tint is an inset shadow over the
   cell's background, not a background color: a pinned cell, or one of a
   header held at the top, keeps its opaque background, so the rows and
   columns scrolling under it do not show through */
.sb-table-widget td.swt-editing {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--ui-accent-color) 45%, transparent),
    inset 0 0 0 9999px color-mix(in srgb, var(--ui-accent-color) 18%, transparent);
}
.swt-cell-editor {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  color: inherit;
  background: transparent;
  outline: none;
}

/* A body cell's content is in a box as wide as its text (layOutCells), which
   modules size and limit. An inline block, so the column's alignment still
   applies. Alone it shows the cell as SilverBullet does. */
.sb-table-widget.swt-table .swt-cell-content {
  display: inline-block;
  vertical-align: top;
  width: max-content;
}

/* A table over the whole window (core/overwindow.ts: the fullScreen module, the
   sheet view): the table's box over the window, under
   Silverware Table's controls (toolbar, grips, menus: z-index 49 and up) and SilverBullet's
   dialogs, over its page and top bar; the Maximum table height (set inline) does not apply */
.sb-table-widget.swt-over-window {
  position: fixed !important;
  inset: 0;
  z-index: 45;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: none !important;
  margin: 0;
  /* Room only where Silverware Table's controls need it: left of the rows (the +,
     the grips) and above the header (the toolbar). At the left a border, not
     padding: a border does not scroll away with the table. At the top the
     table's margin, as high as the header is held below the box's top
     (STICKY_GAP, swt-sticky-box); rows scrolled into it are covered by the
     held header's shadow in the page's color. */
  padding: 0;
  border: 0;
  border-left: 28px solid var(--root-background-color, #fff);
  overflow: auto;
  background: var(--root-background-color, #fff);
}
.sb-table-widget.swt-over-window > table {
  margin-top: 66px;
}
/* A table Silverware Table draws itself (the sheet: core/silverbullet/drawn.ts),
   outside SilverBullet's editor: SilverBullet's own rules for its tables
   (#sb-main .cm-editor) do not reach it, so they are said again here */
.sb-table-widget.swt-drawn {
  display: inline-block;
  vertical-align: top;
  font-family: var(--editor-font);
  font-weight: normal;
  border-radius: 4px 4px 0 0;
}
.sb-table-widget.swt-drawn table {
  width: 100%;
  border-spacing: 0;
  border-radius: 4px 4px 0 0;
}
.sb-table-widget.swt-drawn thead tr {
  font-weight: bold;
}
.sb-table-widget.swt-drawn thead tr td {
  padding: 11px 8px;
}
.sb-table-widget.swt-drawn td {
  padding: 8px;
  white-space: nowrap;
}
.sb-table-widget.swt-drawn .sb-table-align-left {
  text-align: left;
}
.sb-table-widget.swt-drawn .sb-table-align-right {
  text-align: right;
}
.sb-table-widget.swt-drawn .sb-table-align-center {
  text-align: center;
}
/* Full screen keeps the same room right of the table: else the table ends at the
   window's edge, the + of a new column is pushed back over the toolbar and its
   line drawn on the edge (the sheet view shows its empty columns there) */
.sb-table-widget.swt-over-window.swt-fullscreen {
  border-right: 28px solid var(--root-background-color, #fff);
}
/* The columns' letters above the header and the rows' numbers left of the
   rows, in that room (as formulas count them). Shown over the window only. The
   table lets them out of its box (it is clipped in the page), each header cell
   holds its letter (a pinned one is sticky, which holds it too). */
.sb-table-widget .swt-col-letter {
  display: none;
}
.sb-table-widget.swt-over-window.swt-table > table {
  overflow: visible !important;
}
.sb-table-widget.swt-over-window thead tr:first-child > td:not(.swt-pin-left):not(.swt-pin-right) {
  position: relative;
}
.sb-table-widget.swt-over-window .swt-col-letter {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 22px;
  line-height: 22px;
  text-align: center;
  font: 12px/22px var(--ui-font, system-ui, sans-serif);
  font-weight: normal;
  font-variant-numeric: tabular-nums;
  color: var(--root-color, #333);
  opacity: 0.5;
  pointer-events: none;
}
.swt-floating.swt-over-window-rows {
  z-index: 46;
  left: 0;
  width: 28px;
  overflow: hidden;
  pointer-events: none;
  display: block !important;
}
.swt-floating.swt-over-window-rows:not(.swt-visible) {
  display: none !important;
}
.swt-floating.swt-over-window-rows.swt-at-right {
  left: auto;
  right: 0;
}
.swt-over-window-rows > span {
  position: absolute;
  left: 0;
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font: 11px var(--ui-font, system-ui, sans-serif);
  font-variant-numeric: tabular-nums;
  color: var(--root-color, #333);
  opacity: 0.5;
}
.swt-over-window-rows.swt-at-right > span {
  left: 2px;
  right: 0;
  justify-content: flex-start;
}
.swt-over-window-rows > span[hidden] {
  display: none;
}

/* The sheet module (core/silverbullet/modules/sheet.ts): the board, one box
   over the window holding the sheet's tables (drawn by the module), each at
   its place, on a grid of rows of one height (--swt-sheet-row) and the
   sheet's columns' widths. The room for the letters (above) and the numbers
   (beside) is the box's border: it does not scroll away. The rows' lines are
   a gradient, the columns' (their widths differ) elements. The empty cell
   selected or edited is a td laid over its place. */
.swt-sheet-board {
  --swt-sheet-line: var(--swt-border, color-mix(in srgb, currentColor 14%, transparent));
  position: fixed;
  inset: 0;
  z-index: 45;
  box-sizing: border-box;
  border-left: 28px solid var(--root-background-color, #fff);
  border-top: 66px solid var(--root-background-color, #fff);
  /* The room for the sheets' tabs (TABS_ROOM) */
  border-bottom: 30px solid var(--root-background-color, #fff);
  overflow: auto;
  background: var(--root-background-color, #fff);
  color: var(--root-color, #333);
}
.swt-sheet-board:focus {
  outline: none;
}
.swt-sheet-content {
  position: relative;
  cursor: cell;
  background-image: linear-gradient(to bottom, transparent calc(var(--swt-sheet-row) - 1px), var(--swt-sheet-line) 0);
  background-size: 100% var(--swt-sheet-row);
}
.swt-sheet-column-lines > div {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--swt-sheet-line);
  pointer-events: none;
}
.swt-sheet-column-lines > div[hidden] {
  display: none;
}
/* A table on the board: at its place, as wide as the sheet's columns it takes;
   it scrolls with the board. Its box is clipped, not scrolled (overflow: clip),
   so it captures no sticky positioning: its header with the rows pinned to the
   top, its rows pinned to the bottom and its pinned columns are held at the
   board's edges while the table is in view, never past the table */
.sb-table-widget.swt-table.swt-sheet-table {
  position: absolute;
  display: block;
  overflow: clip !important;
  max-height: none !important;
  cursor: auto;
  /* A light line round it, stronger than the grid's: where the table ends among the empty cells (a shadow: its box
     clips what is in it, not what is drawn round it) */
  box-shadow: 0 0 0 1px var(--swt-sheet-table-line, color-mix(in srgb, currentColor 40%, transparent));
}
/* Held by the browser against the board (its scrolling box, under the letters' room, right of the numbers'):
   the header with the rows pinned to the top at its top (not STICKY_GAP below it: the toolbar has the room above),
   the rows pinned to the bottom at its bottom, pinned columns at its sides (their offsets the core's) */
/* A table drawn anew, until it is laid out: the copy of what it replaced shows in its place (presses go through
   to the table, unseen under it) */
.sb-table-widget.swt-stand-in {
  pointer-events: none;
}
.sb-table-widget.swt-stand-in + .sb-table-widget.swt-sheet-table {
  opacity: 0;
}
.sb-table-widget.swt-table.swt-sheet-table :is(thead, thead.swt-stuck) {
  position: sticky !important;
  top: 0 !important;
  transform: none !important;
  z-index: 3;
}
.sb-table-widget.swt-table.swt-sheet-table :is(tfoot, tfoot.swt-stuck) {
  position: sticky !important;
  bottom: 0 !important;
  transform: none !important;
  z-index: 3;
}
.sb-table-widget.swt-sheet-table table {
  border-spacing: 0;
}
.sb-table-widget.swt-sheet-table tr > td {
  box-sizing: border-box;
  height: var(--swt-sheet-row);
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
/* The cell is not clipped itself (what sits on its edges stays reachable: the
   fill handle, the pin mark, the selection's handles); its content is, at the
   cell's width (not as wide as its text: the sheet's columns have theirs) and
   the row's height: on one line cut with an ellipsis, or wrapped and cut at the
   row's height (the longText module's wrap) */
.sb-table-widget.swt-sheet-table tr > td > .swt-cell-content {
  display: block;
  box-sizing: border-box;
  width: auto;
  max-width: none;
  max-height: var(--swt-sheet-row);
  /* Room above and below the line, the same (the text stays in the row's middle): what is drawn under the text, a
     formula result's underline, is within the box its overflow clips to */
  padding-block: 0.35em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-table-widget.swt-sheet-table.swt-cells-wrap tr > td > .swt-cell-content {
  white-space: normal;
  overflow-wrap: anywhere;
  text-overflow: clip;
}
/* A header at its cell's width: its name cut with an ellipsis, its icons after it */
.sb-table-widget.swt-sheet-table .swt-head {
  display: flex;
  max-width: 100%;
}
.sb-table-widget.swt-sheet-table .swt-head-name {
  text-overflow: ellipsis;
}
/* The sheet's rows have their height: no zero-width space keeps an empty one tall, which before a block (the content
   above) would be a line of its own and push the content to the row's bottom */
.sb-table-widget.swt-sheet-table.swt-table td:not(.swt-editing)::before {
  content: none;
}
.swt-sheet-content > td.swt-sheet-cell {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 6px;
  background: var(--root-background-color, #fff);
  box-shadow: inset 0 0 0 2px var(--ui-accent-color, #3b82f6);
}
.swt-floating.swt-sheet-letters {
  z-index: 46;
  overflow: hidden;
  background: var(--root-background-color, #fff);
  pointer-events: none;
  display: block !important;
}
.swt-floating.swt-sheet-letters:not(.swt-visible) {
  display: none !important;
}
.swt-sheet-letters > span {
  position: absolute;
  bottom: 0;
  height: 22px;
  text-align: center;
  font: 12px/22px var(--ui-font, system-ui, sans-serif);
  font-variant-numeric: tabular-nums;
  color: var(--root-color, #333);
  opacity: 0.5;
}
.swt-sheet-letters > span[hidden] {
  display: none;
}
/* A column's letter's right edge: dragged, the column's width (a table there or none); a line under the pointer */
.swt-sheet-letters > span > .swt-sheet-width {
  position: absolute;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  pointer-events: auto;
}
.swt-sheet-letters > span > .swt-sheet-width:hover,
.swt-sheet-letters > span > .swt-sheet-width.swt-active {
  background: linear-gradient(var(--ui-accent-color), var(--ui-accent-color)) center / 2px 100% no-repeat;
}
/* A letter's edge lit: its letter whole */
.swt-sheet-letters > span:has(> .swt-sheet-width:is(:hover, .swt-active)) {
  opacity: 1;
}
/* Off for a finger, as a table's width handles are */
@media (pointer: coarse) {
  .swt-sheet-letters > span > .swt-sheet-width {
    display: none;
  }
}
.swt-floating.swt-sheet-numbers {
  background: var(--root-background-color, #fff);
}
/* The page's sheets, one tab each, at the board's bottom (as a spreadsheet's): the one shown marked, + a new one */
.swt-floating.swt-sheet-tabs {
  z-index: 46;
  display: flex !important;
  align-items: stretch;
  gap: 2px;
  box-sizing: border-box;
  padding: 0 8px 4px 28px;
  overflow-x: auto;
  background: var(--root-background-color, #fff);
  border-top: 1px solid var(--swt-border, color-mix(in srgb, currentColor 14%, transparent));
  font: 12px var(--ui-font, system-ui, sans-serif);
  color: var(--root-color, #333);
}
.swt-floating.swt-sheet-tabs:not(.swt-visible) {
  display: none !important;
}
.swt-sheet-tabs > button {
  display: inline-flex;
  flex: none;
  align-items: center;
  padding: 0 12px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 0 0 6px 6px;
  opacity: 0.7;
  cursor: pointer;
}
.swt-sheet-tabs > button.swt-sheet-tab {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swt-sheet-tabs > button:hover,
.swt-sheet-tabs > button:focus-visible,
.swt-sheet-tabs > button.swt-active {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  outline: none;
}
.swt-sheet-tabs > .swt-sheet-tab[aria-selected="true"] {
  font-weight: 600;
  color: var(--ui-accent-color);
  opacity: 1;
  box-shadow: inset 0 2px 0 var(--ui-accent-color);
}
.swt-sheet-tabs > .swt-sheet-tab.swt-muted {
  font-style: italic;
}
.swt-sheet-tabs > .swt-sheet-tab-add {
  padding: 0 8px;
}
.swt-sheet-tabs > .swt-sheet-tab-add svg {
  width: 14px;
  height: 14px;
}
.swt-sheet-tabs > .swt-sheet-tab-add[aria-disabled="true"] {
  opacity: 0.3;
  cursor: default;
}

/* CodeMirror's scroller is a stacking context (z-index 0) under SilverBullet's
   top bar (z-index 20): lifted over it while it holds a table shown so */
.cm-scroller:has(.sb-table-widget.swt-over-window) {
  z-index: 30 !important;
}
/* The largeTables module: a large table scrolls in its own box, at most the
   window's height (the Maximum table height setting, set inline, wins); the
   empty rows standing in for the rows out of the document take no room but their height */
.sb-table-widget.swt-large-table {
  max-height: calc(100vh - 120px);
  max-height: calc(100dvh - 120px);
  overflow: auto;
}
.sb-table-widget tr.swt-large-spacer > td {
  padding: 0 !important;
  border: 0 !important;
  background: none !important;
}

/* The longText module (silverware.table.modules.longText): only on the tables it
   marks swt-long-text. The box, and a header's line, at most the maximum width
   (--swt-cell-max-width, set by the script); longer text wraps (swt-cells-wrap:
   up to the maximum height, the rest cut and faded) or is cut with an ellipsis
   (swt-cells-ellipsis); a header's name, or the text of a column with a width
   set, cut with an ellipsis. Off: none of this, cells as SilverBullet shows them. */
.sb-table-widget.swt-long-text .swt-cell-content,
.sb-table-widget.swt-long-text .swt-head {
  max-width: var(--swt-cell-max-width, none);
}
.sb-table-widget.swt-long-text .swt-head-name,
.sb-table-widget.swt-long-text td.swt-sized > .swt-cell-content {
  text-overflow: ellipsis;
}
/* SilverBullet keeps cells on one line (white-space: nowrap): the box wraps */
.sb-table-widget.swt-cells-wrap .swt-cell-content {
  white-space: normal;
  overflow-wrap: anywhere;
  max-height: var(--swt-cell-max-height, none);
  overflow: hidden;
}
.sb-table-widget.swt-cells-wrap td.swt-cut .swt-cell-content {
  mask-image: linear-gradient(to bottom, #000 calc(100% - 1.4em), transparent);
}
.sb-table-widget.swt-cells-ellipsis .swt-cell-content {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* A meter (#progress, or a custom type's { text, meter }): a bar filled to its share in the text's color (as a
   rating's full stars are); its text (the percentage) in a small box over the middle, in the page's own colors, so it
   reads whatever the theme, its type smaller than the bar is high */
.swt-meter {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 6em;
  max-width: 100%;
  height: 1em;
  vertical-align: middle;
  overflow: hidden;
  border-radius: 0.25em;
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.swt-meter-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: currentColor;
}
.swt-meter-text {
  position: relative;
  padding: 0 0.35em;
  font-size: 0.6em;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--root-color, #222);
  background: var(--root-background-color, #fff);
  border-radius: 0.2em;
}
/* A named table's tab (the tableLabels module): its name on a quiet tint of the page's text color at its top right corner, above it, or in
   its header's corner where the view leaves no room above (swt-inside); over the sheet's board, under the controls;
   it takes no presses */
.swt-floating.swt-table-label {
  z-index: 47;
  box-sizing: border-box;
  height: 18px;
  padding: 1px 7px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--root-color, #222) 70%, transparent);
  background: color-mix(in srgb, var(--root-color, #222) 9%, var(--root-background-color, #fff));
  border-radius: 5px 5px 0 0;
  pointer-events: none;
}
.swt-floating.swt-table-label.swt-visible {
  display: block !important;
}
.swt-floating.swt-table-label.swt-inside {
  border-radius: 0 0 0 5px;
  opacity: 0.9;
}
/* What a feature says the table is (a pivot's "Pivot of orders"): as the name, its icon before it */
.swt-table-label .swt-table-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 16px;
  vertical-align: top;
}
/* (A box of the icon's size: an inline svg sits on the text's baseline, above its middle) */
.swt-table-label .swt-table-badge-icon {
  display: flex;
}
/* Its data out of date (Out of date): as the toolbar's button asking for attention, Refresh or Recalculate */
.swt-table-label .swt-table-badge.swt-attention {
  padding: 0 4px;
  margin: 0 -3px;
  color: var(--ui-accent-color);
  background: color-mix(in srgb, var(--ui-accent-color) 16%, transparent);
  border-radius: 4px;
}
.swt-table-label .swt-table-badge-icon svg {
  display: block;
  width: 11px;
  height: 11px;
}

/* The expand button of a cell whose text does not fit: opens its popup */
.swt-expand {
  z-index: 52;
  width: 18px;
  height: 18px;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 4px;
  opacity: 0.75;
  cursor: pointer;
}
.swt-expand:hover {
  color: var(--ui-accent-color);
  opacity: 1;
}
.swt-expand svg {
  width: 12px;
  height: 12px;
}
/* The widths module: a handle on a header cell's right edge sets the column's
   width (a line shows on it while hovered or dragged) */
.sb-table-widget.swt-table thead tr:first-child > td:not(.swt-pin-left):not(.swt-pin-right) {
  position: relative;
}
.sb-table-widget .swt-col-resize {
  /* Inside its cell, at its right edge: past it, the table clips it (the last
     column) or a pinned neighbour covers it (pinned cells stack) */
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 2;
  width: 8px;
  cursor: col-resize;
}
.sb-table-widget .swt-col-resize::after {
  content: "";
  position: absolute;
  top: 20%;
  bottom: 20%;
  right: 0;
  width: 2px;
  border-radius: 1px;
}
.sb-table-widget .swt-col-resize:hover::after,
.sb-table-widget .swt-col-resize.swt-active::after {
  background: var(--ui-accent-color);
}
/* While its header cell is hovered, selected or edited: quiet (a grey dashed
   line) until the pointer is on it, as the quiet + */
@media not (pointer: coarse) {
  .sb-table-widget.swt-table thead tr:first-child > td:is(:hover, .swt-selected, .swt-editing) > .swt-col-resize:not(:hover):not(.swt-active)::after {
    width: 0;
    background: none;
    border-right: 1px dashed color-mix(in srgb, var(--root-color) 45%, transparent);
  }
}
@media (pointer: coarse) {
  .sb-table-widget .swt-col-resize {
    pointer-events: none;
  }
}
body.swt-resizing,
body.swt-resizing * {
  cursor: col-resize !important;
  user-select: none;
}

/* A column with a width set: its cells' text never spills over (cut; with an
   ellipsis by the longText module) */
.sb-table-widget.swt-table td.swt-sized > .swt-cell-content {
  overflow: hidden;
}

/* The settings dialog (Silverware Table settings… in a table's ⋯ menu, "Silverware Table:
   Settings"): tabs, rows in cards (the name and what it does left, the control
   right), switches */
.swt-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--modal-backdrop-color, rgba(0, 0, 0, 0.35));
  font-family: var(--ui-font, system-ui, sans-serif);
}
.swt-settings {
  --swt-settings-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swt-settings-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  /* Of one height whatever its tab shows (switching tabs moves nothing), 720px where the window has room;
     its body scrolls (a phone: the whole screen, below) */
  display: flex;
  flex-direction: column;
  /* (Its border within the height: SilverBullet sets no box-sizing, the playground border-box) */
  box-sizing: border-box;
  width: min(600px, calc(100vw - 24px));
  height: min(720px, calc(100vh - 32px));
  height: min(720px, calc(var(--sw-view-height, 100dvh) - 32px));
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swt-settings-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swt-settings:focus {
  outline: none;
}
.swt-settings button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swt-settings-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swt-settings-titles {
  flex: 1;
  min-width: 0;
}
.swt-settings-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swt-settings-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
}
.swt-settings-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swt-settings-close:hover {
  opacity: 1;
  background: var(--swt-settings-card);
}
.swt-settings-close svg {
  width: 16px;
  height: 16px;
}
/* One row however many tabs: too wide for the dialog (a phone), it scrolls sideways */
.swt-settings-tabs {
  /* Never shrunk by a tall body (it scrolls sideways, so a column's flex would squeeze it) */
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swt-settings-line);
}
.swt-settings-tab {
  flex: none;
  white-space: nowrap;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swt-settings-tab:hover {
  opacity: 1;
}
.swt-settings-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swt-settings-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
.swt-settings-panel[hidden] {
  display: none;
}
.swt-settings-group {
  margin: 14px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}
.swt-settings-panel > .swt-settings-card:first-child {
  margin-top: 12px;
}
.swt-settings-card {
  background: var(--swt-settings-card);
  border: 1px solid var(--swt-settings-line);
  border-radius: 8px;
}
.swt-settings-card > :not(:first-child) {
  border-top: 1px solid var(--swt-settings-line);
}
.swt-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
}
.swt-settings-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swt-settings-module-name,
.swt-settings-name {
  font-weight: 500;
}
.swt-settings-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.swt-settings-row select,
.swt-settings-row input[type="number"] {
  flex: none;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swt-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swt-settings-row select {
  max-width: 55%;
}
.swt-settings-row input[type="number"] {
  width: 6.5em;
}
.swt-settings-row input.swt-settings-invalid {
  border-color: var(--danger-color, #c62828);
}
/* A switch: the checkbox (invisible, still focusable) drawn as a track and a knob */
.swt-settings-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
}
.swt-settings-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swt-settings-knob {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--root-color) 22%, var(--root-background-color));
  transition: background 0.15s;
  pointer-events: none;
}
.swt-settings-knob::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.swt-settings-switch input:checked + .swt-settings-knob {
  background: var(--ui-accent-color);
}
.swt-settings-switch input:checked + .swt-settings-knob::after {
  transform: translateX(14px);
}
.swt-settings-switch input:focus-visible + .swt-settings-knob {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 2px;
}
.swt-settings-switch input:disabled + .swt-settings-knob {
  opacity: 0.5;
}
/* A module's own settings (or a switch's: `under`): under it, indented, while it is on */
.swt-settings-module-settings {
  margin: 0 12px 10px 24px;
  border-left: 2px solid var(--swt-settings-line);
}
.swt-settings-module-settings .swt-settings-row {
  padding: 6px 0 6px 12px;
}
.swt-settings-module-settings[hidden] {
  display: none;
}
.swt-settings-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swt-settings-line);
}
.swt-settings-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swt-settings-cancel,
.swt-settings-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swt-settings-line);
  background: var(--root-background-color);
}
.swt-settings-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swt-settings-save:disabled {
  opacity: 0.45;
  cursor: default;
}
/* A feature's dialog (the Functions dialog): as the settings dialog looks */
.swt-dialog-backdrop {
  position: fixed;
  inset: 0;
  /* Over the part of the window in view (an on-screen keyboard leaves the rest): the shared dialog's --sw-view-* */
  top: var(--sw-view-top, 0);
  bottom: auto;
  height: 100vh;
  height: var(--sw-view-height, 100dvh);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--modal-backdrop-color, rgba(0, 0, 0, 0.35));
  font-family: var(--ui-font, system-ui, sans-serif);
}
.swt-dialog {
  --swt-dialog-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swt-dialog-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  display: flex;
  flex-direction: column;
  width: min(640px, calc(100vw - 24px));
  max-height: calc(100vh - 32px);
  max-height: calc(var(--sw-view-height, 100dvh) - 32px);
  /* (Its border within the height: SilverBullet sets no box-sizing) */
  box-sizing: border-box;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swt-dialog-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swt-dialog:focus {
  outline: none;
}
.swt-dialog button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swt-dialog-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swt-dialog-titles {
  flex: 1;
  min-width: 0;
}
.swt-dialog-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swt-dialog-subtitle {
  margin: 2px 0 0;
  overflow: hidden;
  font-family: var(--editor-font, monospace);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.65;
}
.swt-dialog-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swt-dialog-close:hover {
  opacity: 1;
  background: var(--swt-dialog-card);
}
.swt-dialog-close svg {
  width: 16px;
  height: 16px;
}
/* What does not fit scrolls, its head and its foot (Save) staying in view */
.swt-dialog-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 16px 12px;
  overflow: auto;
  overscroll-behavior: contain;
}
.swt-dialog-head,
.swt-dialog-foot {
  flex: none;
}
/* A phone: the dialog nearly the whole screen, a section's name over its fields */
@media (max-width: 600px) {
  .swt-dialog {
    width: calc(100vw - 12px);
    max-height: calc(100vh - 12px);
    max-height: calc(var(--sw-view-height, 100dvh) - 12px);
  }
  .swt-dialog-head {
    padding: 10px 12px 6px;
  }
  .swt-dialog-body {
    padding: 0 12px 10px;
  }
  .swt-dialog-foot {
    padding: 8px 12px 10px;
  }
  .swt-pivot-section,
  .swt-cf-section {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .swt-pivot-label,
  .swt-cf-label {
    padding-top: 0;
  }
  .swt-cf-editor {
    margin-left: 4px;
    padding: 6px 6px 6px 8px;
  }
  .swt-cf-line {
    flex-wrap: wrap;
  }
}
.swt-dialog-foot {
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swt-dialog-line);
}
.swt-dialog-button,
.swt-dialog-primary {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swt-dialog-line);
  background: var(--root-background-color);
}
.swt-dialog-primary {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swt-dialog-primary:disabled {
  opacity: 0.45;
  cursor: default;
}
.swt-dialog-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
/* The pivot dialog: its fields, a section a line, then the pivot they make */
.swt-pivot-dialog {
  width: min(760px, calc(100vw - 24px));
}
.swt-pivot {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.swt-pivot-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swt-pivot-section {
  display: grid;
  grid-template-columns: 9em 1fr;
  gap: 4px 12px;
  align-items: start;
}
.swt-pivot-label {
  display: flex;
  flex-direction: column;
  padding-top: 5px;
}
.swt-pivot-name {
  font-weight: 600;
}
.swt-pivot-hint {
  font-size: 11px;
  opacity: 0.65;
}
.swt-pivot-fields {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.swt-pivot-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}
.swt-pivot select,
.swt-pivot input[type="text"] {
  padding: 4px 6px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swt-dialog-line);
  border-radius: 6px;
  min-width: 0;
}
.swt-pivot input[type="text"] {
  width: 22em;
  max-width: 100%;
}
.swt-pivot-of {
  opacity: 0.7;
}
.swt-pivot-add,
.swt-pivot-remove,
.swt-pivot-formula,
.swt-pivot-move {
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}
.swt-pivot-add {
  color: var(--ui-accent-color) !important;
}
.swt-pivot-remove,
.swt-pivot-formula,
.swt-pivot-move {
  opacity: 0.65;
}
.swt-pivot-add:hover,
.swt-pivot-remove:hover,
.swt-pivot-formula:hover,
.swt-pivot-move:hover:not(:disabled) {
  background: var(--swt-dialog-card);
  opacity: 1;
}
/* A list's order: up and down side by side, the end's way out dimmed */
.swt-pivot-order {
  display: inline-flex;
}
.swt-pivot-move {
  padding: 2px 5px;
}
.swt-pivot-move:disabled {
  opacity: 0.25;
  cursor: default;
}
.swt-pivot-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
}
.swt-pivot-preview-title {
  font-weight: 600;
  padding-top: 4px;
  border-top: 1px solid var(--swt-dialog-line);
}
.swt-pivot-scroll {
  overflow: auto;
  max-height: 260px;
}
.swt-pivot-table {
  border-collapse: collapse;
  font-size: 13px;
}
.swt-pivot-table th,
.swt-pivot-table td {
  padding: 3px 10px;
  border-bottom: 1px solid var(--swt-dialog-line);
  text-align: left;
  white-space: nowrap;
}
.swt-pivot-table th {
  position: sticky;
  top: 0;
  /* (Not SilverBullet's table header's colors: this is no table of the page) */
  color: var(--root-color);
  background: var(--swt-dialog-card);
}
.swt-pivot-table td.swt-pivot-number {
  text-align: right;
}
.swt-pivot-size,
.swt-pivot-none {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.75;
}
.swt-pivot-warning {
  margin: 0 0 6px;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 6px;
  background: color-mix(in srgb, #d9822b 18%, transparent);
}
/* What a source on another page does not do: said, not warned of */
.swt-pivot-info {
  margin: 0;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--ui-accent-color, #4a7cf0) 12%, transparent);
}
.swt-pivot-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swt-pivot-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
@media (max-width: 600px) {
  .swt-pivot-section {
    grid-template-columns: 1fr;
  }
}
/* The Functions dialog: a search, the groups, the list beside the one picked */
.swt-functions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.swt-functions-search {
  padding: 7px 10px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swt-dialog-line);
  border-radius: 6px;
}
.swt-functions-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.swt-functions-group {
  padding: 3px 10px;
  font-size: 13px !important;
  background: none;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 999px;
}
.swt-functions-group[aria-pressed="true"] {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swt-functions-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 12px;
  height: min(340px, 50vh);
  min-height: 0;
}
.swt-functions-list {
  position: relative;
  overflow-y: auto;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 6px;
}
.swt-functions-option {
  display: flex;
  flex-direction: column;
  padding: 5px 10px;
  cursor: pointer;
}
.swt-functions-option code {
  font-weight: 600;
}
.swt-functions-option span {
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.7;
}
.swt-functions-option:hover {
  background: var(--swt-dialog-card);
}
.swt-functions-option[aria-selected="true"] {
  background: color-mix(in srgb, var(--ui-accent-color, #4a7cc7) 18%, transparent);
}
.swt-functions-none {
  margin: 10px;
  opacity: 0.7;
}
.swt-functions-detail {
  overflow-y: auto;
}
.swt-functions-name {
  margin: 0 0 6px;
  font-size: 15px;
}
.swt-functions-syntax {
  display: block;
  font-weight: 600;
  white-space: pre-wrap;
}
.swt-functions-description {
  margin: 8px 0;
  line-height: 1.45;
}
.swt-functions-example {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: var(--swt-dialog-card);
  border-radius: 6px;
}
.swt-functions-example code {
  white-space: pre-wrap;
}
.swt-functions-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
}
.swt-functions-group-name {
  margin: 8px 0 0;
  font-size: 12px;
  opacity: 0.6;
}
.swt-functions-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* The Excel dialog: the formulas written as values, each with its cell and why */
.swt-excel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.swt-excel-option {
  padding: 8px 10px;
  border: 1px solid var(--button-border-color);
  border-radius: 6px;
}
.swt-excel-option-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.swt-excel-option-title {
  margin: 0;
  font-size: 14px;
}
.swt-excel-option-text {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
}
.swt-excel-option-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
/* The file's name edited in place: text with a dashed line under it, as wide as it is, .xlsx right after it */
.swt-excel-file {
  display: flex;
  align-items: baseline;
  min-width: 0;
  font-size: 13px;
}
.swt-excel-file-label {
  margin-right: 4px;
  opacity: 0.75;
}
.swt-excel-file-input {
  /* As wide as its text where the browser can (else the size attribute set by script) */
  field-sizing: content;
  min-width: 1ch;
  max-width: 22em;
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-bottom: 1px dashed currentColor;
  border-radius: 0;
  outline: none;
}
.swt-excel-file-input:focus {
  border-bottom-style: solid;
  border-bottom-color: var(--ui-accent-color, currentColor);
}
.swt-excel-formulas {
  margin-top: 8px;
  font-size: 13px;
}
.swt-excel-formulas-title {
  margin-bottom: 4px;
}
.swt-excel-ok {
  color: var(--swt-excel-ok, #2e7d32);
}
.swt-excel-error {
  color: var(--swt-excel-error, #c62828);
}
html[data-theme="dark"] .swt-excel-ok {
  color: var(--swt-excel-ok, #81c784);
}
html[data-theme="dark"] .swt-excel-error {
  color: var(--swt-excel-error, #ef9a9a);
}
.swt-excel-status:empty {
  display: none;
}
.swt-excel-skipped {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 30vh;
  overflow-y: auto;
  font-size: 13px;
}
.swt-excel-skipped-item {
  display: grid;
  grid-template-columns: 4em minmax(0, 1fr);
  column-gap: 8px;
}
.swt-excel-skipped-cell {
  grid-row: span 2;
  font-weight: 600;
}
.swt-excel-skipped-formula {
  overflow-wrap: anywhere;
}
.swt-excel-skipped-reason {
  opacity: 0.75;
}
.swt-excel-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* A phone: the dialog takes the screen, the list above the one picked, larger targets for a finger */
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swt-dialog {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swt-dialog-body {
    flex: 1 1 auto;
  }
  .swt-functions {
    flex: 1 1 auto;
  }
  .swt-functions-search {
    font-size: 16px;
  }
  .swt-functions-main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    flex: 1 1 auto;
    height: auto;
  }
  .swt-functions-detail {
    max-height: 40vh;
  }
  .swt-functions-option {
    padding: 9px 12px;
  }
  .swt-dialog-button,
  .swt-dialog-primary {
    padding: 10px 18px;
  }
}
/* A phone: the dialog takes the screen (the buttons always at its bottom), fields
   in 16px (no zoom on focus), larger targets for a finger */
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swt-settings {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swt-settings-body {
    flex: 1 1 auto;
  }
  .swt-settings-tab {
    padding: 10px 12px;
  }
  .swt-settings-row {
    min-height: 44px;
  }
  .swt-settings-cancel,
  .swt-settings-save {
    padding: 10px 18px;
  }
  .swt-settings-row {
    flex-wrap: wrap;
  }
  .swt-settings-row select {
    max-width: 100%;
  }
  .swt-settings-row select,
  .swt-settings-row input[type="number"] {
    font-size: 16px;
  }
}

/* The cell's popup: its editor over the cell, the whole text wrapped */
.swt-floating.swt-cell-popup.swt-visible {
  display: block !important;
}
.swt-cell-popup {
  z-index: 55;
  box-sizing: border-box;
  /* The font is the cell's (set by the script) */
  padding: 6px 8px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--ui-accent-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.swt-cell-popup .swt-cell-popup-field {
  min-height: 1.5em;
  max-height: 50vh;
  overflow-y: auto;
  resize: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Filter row: a field per column; the one filtering is marked */
.sb-table-widget .swt-filter-row td {
  padding: 4px 6px !important;
  vertical-align: middle;
}
/* Its field gives the row its height: no empty line before it */
.sb-table-widget.swt-table .swt-filter-row td::before {
  content: none;
}
.swt-filter-box {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 4px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 12px;
  font-weight: normal;
}
.swt-filter-box:focus-within {
  border-color: var(--ui-accent-color);
}
.swt-filter-active .swt-filter-box,
.swt-filter-popover.swt-filter-typed .swt-filter-box {
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--ui-accent-color) 60%, transparent);
}
.swt-filter-icon {
  display: inline-flex;
  flex: none;
  opacity: 0.45;
}
.swt-filter-active .swt-filter-icon {
  color: var(--ui-accent-color);
  opacity: 1;
}
.swt-filter-icon svg {
  width: 12px;
  height: 12px;
}
/* Fills its box without widening the column (the cell has a minimum width) */
.swt-filter {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  outline: none;
  cursor: text !important;
}
.swt-filter::placeholder {
  color: inherit;
  opacity: 0.5;
}
/* An invalid regular expression: it filters nothing, the tooltip says why */
.swt-filter-box:has(.swt-filter.swt-invalid) {
  border-color: var(--danger-color, #c62828);
}
/* Clears the field: shown while it holds something (!important: see .swt-floating) */
.swt-filter-clear {
  display: none !important;
  flex: none;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.6;
}
.swt-filter-typed .swt-filter-clear {
  display: inline-flex !important;
}
.swt-filter-clear:hover {
  opacity: 1;
  color: var(--ui-accent-color);
}
.swt-filter-clear svg {
  width: 12px;
  height: 12px;
}
/* In a filtered column's header (also while the filter row is hidden): opens its filter */
.swt-filter-mark {
  display: none;
  margin-left: 4px;
  color: var(--ui-accent-color);
  vertical-align: -2px;
  cursor: pointer;
}
.sb-table-widget.swt-table td.swt-filtered .swt-filter-mark {
  display: inline-flex;
}
.swt-filter-mark svg {
  width: 13px;
  height: 13px;
}
/* Under the field typed in, or a column's filter on its own: what the field
   understands, and a column's few values to tick */
.swt-filter-bubble.swt-visible {
  flex-direction: column;
  gap: 6px;
  max-width: 300px;
  padding: 6px;
  font-size: 12px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}
.swt-filter-popover.swt-visible {
  min-width: 220px;
}
.swt-filter-popover .swt-filter-box {
  padding: 4px 6px;
  font-size: 13px;
}
/* A column's filter on its own: its field, and a × closing it beside */
.swt-filter-popover-head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.swt-filter-popover-head .swt-filter-box {
  flex: 1;
  min-width: 0;
}
.swt-filter-close {
  display: inline-flex;
  flex: none;
  padding: 3px;
  color: inherit;
  opacity: 0.6;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swt-filter-close:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swt-filter-close svg {
  width: 14px;
  height: 14px;
}
.swt-filter-bubble-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swt-filter-bubble-body:empty {
  display: none;
}
.swt-filter-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.swt-filter-hint {
  padding: 1px 6px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.swt-filter-hint:hover {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swt-filter-hint code {
  font-size: 11px;
  color: var(--ui-accent-color);
}
.swt-filter-values {
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
  border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  padding-top: 4px;
}
.swt-filter-value {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
}
.swt-filter-value:hover {
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
}
.swt-filter-value input {
  margin: 0;
  cursor: pointer;
}
.swt-filter-value-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swt-filter-value-count {
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}
/* A toolbar chip's icon before its text (the filters') */
.swt-chip > svg {
  width: 12px;
  height: 12px;
  margin-right: 4px;
}

/* Floating controls. Shown and hidden with !important: themes may set display
   on every button with !important (grips and the + are buttons), which would
   leave them in view where they no longer act */
.swt-floating {
  position: fixed;
  z-index: 50;
  display: none !important;
  font-family: var(--ui-font, system-ui, sans-serif);
}
.swt-floating.swt-visible {
  display: flex !important;
}
/* Two boxes, each as wide as what it holds, at the toolbar's right edge: the
   names left of how the table is shown and the icons where both fit in the
   table's width (the toolbar's max-width, set as it is placed), else above
   them (both kept in the room above a held header, STICKY_GAP) */
.swt-bar {
  flex-flow: row wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 2px 4px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--root-color);
}
/* Each of one height whatever it holds (a chip is taller than an icon): the
   two rows fit the room above a held header (STICKY_GAP) */
.swt-bar-names,
.swt-bar-main {
  flex: none;
  box-sizing: border-box;
  height: 24px;
  padding: 1px 2px;
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.swt-bar button {
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.swt-bar button:hover,
.swt-bar button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--ui-accent-color) 16%, transparent);
}
/* The toolbar's rows: the names (what holds the table, the table), then how it
   is shown and the icons */
.swt-bar-names,
.swt-bar-main {
  display: flex;
  align-items: center;
  gap: 2px;
}
.swt-bar-names {
  gap: 10px;
}
/* Between how the table is shown (at the left) and the icons (at the right) */
.swt-bar-gap {
  flex: 1;
}
.swt-bar-name-slot {
  display: inline-flex;
  align-items: center;
}
/* A name: the accent's, set; a stand-in for none (Table, No sheet) muted */
.swt-bar button.swt-bar-name {
  padding: 2px 4px;
  font-weight: 600;
  color: var(--ui-accent-color);
}
.swt-bar button.swt-bar-name.swt-muted {
  font-weight: normal;
  color: inherit;
  opacity: 0.55;
}
/* Something missing (a table shown as a sheet on none): in the danger color, in the toolbar and the ⋯ menu alike */
.swt-bar button.swt-bar-name.swt-attention,
.swt-menu-segmented .swt-label.swt-attention {
  font-weight: 600;
  color: var(--danger-color, #c62828);
  opacity: 1;
}
/* A long name cut, whole in its tooltip */
.swt-bar button.swt-bar-name {
  display: block;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swt-bar button.swt-bar-name.swt-active {
  background: color-mix(in srgb, var(--ui-accent-color) 16%, transparent);
}
/* At the left, what the table is and how it is shown: its name, its sorting,
   its rows filtered; set off from the icons at the right */
.swt-bar .swt-bar-label {
  padding: 2px 6px;
  font-weight: 600;
  color: var(--ui-accent-color);
}
.swt-bar .swt-bar-label,
.swt-bar .swt-chip,
.swt-bar .swt-status {
  margin-right: 4px;
}
/* The ⋯ button while its menu is open */
.swt-bar button.swt-bar-more.swt-active {
  background: color-mix(in srgb, var(--ui-accent-color) 16%, transparent);
}
/* Icon buttons (Recalculate, Filter, ⋯), highlighted when they ask to be used */
.swt-bar button.swt-bar-icon {
  display: inline-flex;
  align-items: center;
  padding: 3px 5px;
}
.swt-bar-icon svg {
  width: 14px;
  height: 14px;
}
.swt-bar button.swt-attention {
  color: var(--ui-accent-color);
  background: color-mix(in srgb, var(--ui-accent-color) 16%, transparent);
}
/* A switch that is on and asks for attention (lazy saving with edits not saved
   yet): stronger than a switch that is only on, with a dot */
.swt-bar button.swt-attention[aria-pressed="true"] {
  position: relative;
  background: color-mix(in srgb, var(--ui-accent-color) 32%, transparent);
}
.swt-bar button.swt-attention[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  top: 1px;
  right: 1px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-accent-color);
}

.swt-status {
  padding: 0 6px;
  font-weight: 600;
}
.swt-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 2px 1px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
}
.swt-bar .swt-chip-clear,
.swt-bar .swt-chip-apply {
  display: inline-flex;
  padding: 2px;
  border-radius: 3px;
}
.swt-bar .swt-chip-clear:hover,
.swt-bar .swt-chip-apply:hover {
  color: var(--ui-accent-color);
  background: color-mix(in srgb, var(--ui-accent-color) 18%, transparent);
}
.swt-chip-clear svg,
.swt-chip-apply svg {
  width: 12px;
  height: 12px;
}
/* The row and column grips: quiet bars until hovered (their size is set where
   they are placed); hovered, opaque, as they lie half over a cell */
.swt-handle {
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--root-color);
  background: none;
  opacity: 0.5;
  border: 0;
  border-radius: 4px;
  cursor: grab;
  touch-action: none;
}
/* The grip of a line selected: its click opens the line's menu */
.swt-handle.swt-line-selected {
  cursor: context-menu;
}
.swt-handle:hover,
.swt-handle.swt-active {
  color: var(--ui-accent-color);
  background: color-mix(in srgb, var(--ui-accent-color) 18%, var(--root-background-color));
  /* A border that takes no room: set off from the tinted row (column) */
  box-shadow: 0 0 0 1px var(--ui-accent-color);
  opacity: 1;
}
.swt-handle.swt-no-drag {
  cursor: pointer;
}
.swt-handle svg {
  width: 10px;
  height: 10px;
}
.swt-grip-column svg {
  transform: rotate(90deg);
}
/* What the hovered grip acts on */
.sb-table-widget.swt-table .swt-handle-hover {
  box-shadow: inset 0 0 0 9999px color-mix(in srgb, var(--ui-accent-color) 10%, transparent);
}
.swt-insert {
  /* Over its line */
  z-index: 51;
  width: 18px;
  height: 18px;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--ui-accent-color);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.swt-insert svg {
  width: 12px;
  height: 12px;
}
/* Under the last row while it is hovered, selected or edited: quiet (grey,
   see-through, a dashed outline) until the pointer is on it */
.swt-insert.swt-quiet:not(:hover) {
  box-sizing: border-box;
  color: color-mix(in srgb, var(--root-color) 45%, transparent);
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
  border: 1px dashed color-mix(in srgb, var(--root-color) 40%, transparent);
  box-shadow: none;
}
/* The border a row (column) goes to: over the table, not taking the pointer */
.swt-insert-line {
  background: var(--ui-accent-color);
  pointer-events: none;
}

/* Row and column menus */
.swt-menu {
  z-index: 60;
  flex-direction: column;
  min-width: 200px;
  padding: 4px;
  font-size: 13px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  outline: none;
}
/* The title centered; a submenu's back arrow at the left */
.swt-menu-title {
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
.swt-menu-back {
  justify-self: start;
}
.swt-menu-title-text {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* A submenu's way back: an arrow before its title */
.swt-menu-back {
  display: inline-flex;
  margin: -3px 0 -3px -5px;
  padding: 3px;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swt-menu-back:hover,
.swt-menu-back:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swt-menu .swt-menu-back svg {
  width: 14px;
  height: 14px;
}
/* The × closing the menu, at the title's right */
.swt-menu-close {
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
.swt-menu-close:hover,
.swt-menu-close:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swt-menu .swt-menu-close svg {
  width: 14px;
  height: 14px;
}
/* What the menu is about named in its title: a pencil after the title, the title a field once pressed */
.swt-menu-rename {
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
.swt-menu-rename:hover,
.swt-menu-rename:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swt-menu-rename[aria-disabled] {
  opacity: 0.3;
  cursor: default;
  background: none;
}
.swt-menu .swt-menu-rename svg {
  width: 14px;
  height: 14px;
}
.swt-menu-title.swt-naming {
  display: block;
  padding: 2px 6px 6px;
}
.swt-menu-name {
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
.swt-menu-name-problem {
  max-width: 260px;
  padding: 0 8px 6px;
  font-size: 12px;
  color: var(--danger-color, #c62828);
}
.swt-menu-item {
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
.swt-menu-item:hover,
.swt-menu-item:focus-visible,
.swt-segment:not([aria-disabled="true"]):hover,
.swt-segment:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
/* A list opened in the menu's place: its choice highlighted (focusMenu), not
   the item that came under the pointer, until the pointer moves */
.swt-menu.swt-menu-still .swt-menu-item:hover:not(:focus-visible) {
  background: none;
}
.swt-menu-item.swt-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swt-menu-item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swt-menu-item[aria-disabled="true"]:hover {
  background: none;
}
.swt-menu-item .swt-label {
  flex: 1;
}
.swt-menu-item[aria-checked="true"]::after {
  content: "\2713";
  color: var(--ui-accent-color);
}
.swt-menu-item.swt-danger {
  color: var(--danger-color, #c62828);
}
.swt-icon {
  display: inline-flex;
}
.swt-menu svg {
  width: 16px;
  height: 16px;
}
/* An item's detail: a bubble beside the menu, at the item's height */
.swt-menu-detail {
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
/* A theme's preview in the Theme list's bubble: a small table, styled as a table
   in the page is (SilverBullet's own rules for tables are the editor's only) */
.swt-theme-preview {
  display: block;
  width: 240px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 4px 4px 0 0;
  font-weight: normal;
}
.swt-theme-preview table {
  width: 100%;
  border-spacing: 0;
}
.swt-theme-preview td {
  padding: 6px 8px;
  white-space: nowrap;
}
.swt-theme-preview thead tr {
  font-weight: bold;
}
.swt-theme-preview td:not(:first-child) {
  text-align: right;
}
.swt-menu-detail.swt-left {
  left: auto;
  right: calc(100% + 8px);
}
.swt-menu-detail[hidden] {
  display: none;
}
.swt-menu-detail-title {
  margin-bottom: 4px;
  font-weight: 600;
}
.swt-menu-detail-code {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.swt-menu-detail-code code {
  padding: 1px 5px;
  font-size: 11px;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  border-radius: 4px;
}
.swt-menu-detail p {
  margin: 0;
}
.swt-menu-detail .swt-menu-detail-note {
  margin-top: 6px;
  opacity: 0.7;
}
/* The icon of an item's value: Type: ☆ Stars */
.swt-menu-value-icon {
  display: inline-flex;
  margin-right: 3px;
  vertical-align: -2px;
}
.swt-menu .swt-menu-value-icon svg {
  width: 14px;
  height: 14px;
}
/* The values a typed cell offers, under its editor */
.swt-choices {
  z-index: 57;
  flex-direction: column;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  font-size: 13px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}
.swt-choice {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  white-space: nowrap;
  border-radius: 5px;
  cursor: pointer;
}
.swt-choice:hover,
.swt-choice.swt-active {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swt-choice.swt-current::after {
  content: "\2713";
  margin-left: auto;
  color: var(--ui-accent-color);
}
.swt-menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.3));
}
.swt-menu-segmented {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 2px 8px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items */
.swt-menu-segmented > .swt-label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swt-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swt-segment {
  display: inline-flex;
  padding: 4px 6px;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.swt-segment[aria-checked="true"] {
  color: var(--ui-accent-color);
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.swt-segment[aria-disabled="true"],
.swt-action[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A bar of actions, a caption under each icon (Copy, Cut, Paste): first in a menu */
.swt-menu-actions {
  display: flex;
  gap: 2px;
  padding: 2px;
}
.swt-action {
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
.swt-action .swt-icon {
  display: inline-flex;
}
.swt-action:not([aria-disabled="true"]):hover,
.swt-action:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 15%, transparent);
  outline: none;
}
.swt-action-caption {
  white-space: nowrap;
  opacity: 0.85;
}
/* A finger's targets: bigger buttons in a row */
@media (pointer: coarse) {
  .swt-segment {
    padding: 8px 10px;
  }
}

/* Middle-button autoscroll over a wide table: the start point */
.swt-autoscroll {
  z-index: 70;
  width: 24px;
  height: 24px;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid var(--root-color);
  border-radius: 50%;
  background:
    radial-gradient(circle, var(--root-color) 2px, transparent 3px),
    var(--root-background-color);
  opacity: 0.8;
}
body.swt-autoscrolling,
body.swt-autoscrolling * {
  cursor: all-scroll !important;
}

/* Formulas */
/* Names: a mark in a cell's corner, as a spreadsheet marks a comment. A named
   cell or column (its header) at the top right, a named row at its first
   cell's top left; one overlay draws them (and lazy saving's mark of a cell not
   saved yet, at the bottom right), over the cell, so a pinned or striped cell's
   background does not hide them */
.sb-table-widget.swt-table td:is(.swt-named, .swt-row-named, .swt-lazy-pending):not(.swt-pin-left):not(.swt-pin-right) {
  position: relative;
}
.sb-table-widget.swt-table td.swt-named {
  --swt-name-mark: linear-gradient(225deg, color-mix(in srgb, var(--ui-accent-color) 70%, transparent) 50%, transparent 50%);
}
.sb-table-widget.swt-table td.swt-row-named {
  --swt-row-name-mark: linear-gradient(135deg, color-mix(in srgb, var(--ui-accent-color) 70%, transparent) 50%, transparent 50%);
}
/* A cell edited in lazy saving, not saved yet: a mark in its bottom right corner */
.sb-table-widget.swt-table td.swt-lazy-pending {
  --swt-lazy-mark: linear-gradient(315deg, var(--ui-accent-color) 50%, transparent 50%);
}
.sb-table-widget.swt-table td:is(.swt-named, .swt-row-named, .swt-lazy-pending)::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    var(--swt-name-mark, none) top right / 6px 6px no-repeat,
    var(--swt-row-name-mark, none) top left / 6px 6px no-repeat,
    var(--swt-lazy-mark, none) bottom right / 6px 6px no-repeat;
  pointer-events: none;
}
/* A header's hashtag a feature hides (a column type's: its icon shows after
   the column's name instead); a value not of a column's type is red */
.sb-table-widget .swt-hidden-tag {
  display: none;
}
.swt-type-icon {
  display: inline-flex;
  margin-left: 4px;
  vertical-align: -2px;
  opacity: 0.6;
}
.swt-type-icon svg {
  width: 14px;
  height: 14px;
}
.sb-table-widget.swt-table td.swt-type-invalid {
  color: var(--danger-color);
}

/* Cells selected by dragging, to copy */
.sb-table-widget.swt-table td.swt-selected {
  /* An inset shadow over the background, as for the cell edited (td.swt-editing) */
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--ui-accent-color) 45%, transparent),
    inset 0 0 0 9999px color-mix(in srgb, var(--ui-accent-color) 18%, transparent);
}
/* A pinned column's edge keeps its shadow when selected or edited */
.sb-table-widget.swt-table td.swt-pin-left.swt-pin-edge:is(.swt-selected, .swt-editing) {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--ui-accent-color) 45%, transparent),
    inset 0 0 0 9999px color-mix(in srgb, var(--ui-accent-color) 18%, transparent),
    3px 0 4px -2px rgba(0, 0, 0, 0.3);
}
.sb-table-widget.swt-table td.swt-pin-right.swt-pin-edge:is(.swt-selected, .swt-editing) {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--ui-accent-color) 45%, transparent),
    inset 0 0 0 9999px color-mix(in srgb, var(--ui-accent-color) 18%, transparent),
    -3px 0 4px -2px rgba(0, 0, 0, 0.3);
}
/* Cells copied or cut (Ctrl+C, Ctrl+X, Copy, Cut): outlined dashed, as a
   spreadsheet marks them, until they are pasted (or the outline ends); a piece
   in each cell on the edge, out of the layout, as AutoFill's outline */
.sb-table-widget td:has(> .swt-cut-edge) {
  position: relative;
}
.sb-table-widget td:is(.swt-pin-left, .swt-pin-right):has(> .swt-cut-edge) {
  position: sticky;
}
.swt-cut-edge {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 0 dashed var(--ui-accent-color, #4a7cc7);
  pointer-events: none;
}
.swt-cut-edge.swt-cut-top {
  border-top-width: 2px;
}
.swt-cut-edge.swt-cut-bottom {
  border-bottom-width: 2px;
}
.swt-cut-edge.swt-cut-left {
  border-left-width: 2px;
}
.swt-cut-edge.swt-cut-right {
  border-right-width: 2px;
}

/* The selection's handles, after a touch (data-swt-pointer on the page's root):
   a dot on the first cell's top left and the last cell's bottom right corner,
   in a bigger area for a finger, dragged to select more. In the cells, out of
   the layout, as the pin mark is; inside them on the table's edges, where its
   box would cut them */
.swt-select-handle {
  display: none;
}
html[data-swt-pointer="touch"] .sb-table-widget td:has(> .swt-select-handle) {
  position: relative;
}
html[data-swt-pointer="touch"] .sb-table-widget td:is(.swt-pin-left, .swt-pin-right):has(> .swt-select-handle) {
  position: sticky;
}
html[data-swt-pointer="touch"] .swt-select-handle {
  position: absolute;
  /* Over the cells beside, under pinned columns (sticky, z-index 1) a cell scrolls under */
  z-index: 0;
  display: block;
  width: 28px;
  height: 28px;
  touch-action: none;
}
html[data-swt-pointer="touch"] .swt-select-handle::after {
  content: "";
  position: absolute;
  inset: 7px;
  box-sizing: border-box;
  background: var(--ui-accent-color, #4a7cc7);
  border: 2px solid var(--root-background-color, #fff);
  border-radius: 50%;
}
.swt-select-start {
  top: -14px;
  left: -14px;
}
.swt-select-end {
  right: -14px;
  bottom: -14px;
}
.swt-select-start.swt-at-top {
  top: -7px;
}
.swt-select-start.swt-at-left {
  left: -7px;
}
.swt-select-end.swt-at-bottom {
  bottom: -7px;
}
.swt-select-end.swt-at-right {
  right: -7px;
}
/* The band on the selection's edge a mouse drags the cells by (not after a
   touch: there Move to… in their menu); the cells where they go outlined, and
   their address by the pointer */
.sb-table-widget td:has(> .swt-select-edge, > .swt-move-edge) {
  position: relative;
}
.sb-table-widget td:is(.swt-pin-left, .swt-pin-right):has(> .swt-select-edge, > .swt-move-edge) {
  position: sticky;
}
.swt-select-edge {
  position: absolute;
  z-index: 1;
  cursor: move;
}
html[data-swt-pointer="touch"] .swt-select-edge {
  display: none;
}
.swt-select-edge-top {
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
}
.swt-select-edge-bottom {
  bottom: -3px;
  left: 0;
  right: 0;
  height: 6px;
}
.swt-select-edge-left {
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
}
.swt-select-edge-right {
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
}
.swt-move-edge {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 0 dashed var(--ui-accent-color, #4a7cc7);
  pointer-events: none;
}
.swt-move-edge.swt-move-top {
  border-top-width: 2px;
}
.swt-move-edge.swt-move-bottom {
  border-bottom-width: 2px;
}
.swt-move-edge.swt-move-left {
  border-left-width: 2px;
}
.swt-move-edge.swt-move-right {
  border-right-width: 2px;
}
.swt-move-tip {
  z-index: 57;
  padding: 2px 6px;
  font-size: 12px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
  pointer-events: none;
  white-space: nowrap;
}
body.swt-moving-cells,
body.swt-moving-cells * {
  cursor: move !important;
}
body.swt-move-picking .sb-table-widget.swt-table td {
  cursor: crosshair !important;
}
/* Moving a table on the sheet: the handle at its top left corner (where its
   row and column grips meet), the outline of where it would go with its
   address, red where another table is; Move table… waits for a cell */
.swt-floating.swt-sheet-grab {
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: inherit;
  background: var(--root-background-color, #fff);
  border: 1px solid var(--swt-line, rgba(127, 127, 127, 0.45));
  border-radius: 4px;
  cursor: move;
  /* A finger's drag is the handle's, not a scroll of the board */
  touch-action: none;
}
.swt-floating.swt-sheet-grab:hover {
  color: var(--ui-accent-color, #3b6fd4);
  border-color: var(--ui-accent-color, #3b6fd4);
}
.swt-sheet-grab svg {
  width: 14px;
  height: 14px;
}
.swt-sheet-move {
  position: absolute;
  z-index: 4;
  box-sizing: border-box;
  border: 2px dashed var(--ui-accent-color, #3b6fd4);
  pointer-events: none;
}
.swt-sheet-move[hidden] {
  display: none;
}
.swt-sheet-move.swt-invalid {
  border-color: var(--swt-invalid, #c62828);
  background: color-mix(in srgb, var(--swt-invalid, #c62828) 8%, transparent);
}
.swt-sheet-move-tip {
  position: absolute;
  left: -2px;
  bottom: 100%;
  margin-bottom: 2px;
  padding: 1px 6px;
  font: 12px var(--ui-font, system-ui, sans-serif);
  color: #fff;
  background: var(--ui-accent-color, #3b6fd4);
  border-radius: 4px;
  white-space: nowrap;
}
.swt-sheet-move.swt-invalid .swt-sheet-move-tip {
  background: var(--swt-invalid, #c62828);
}
body.swt-moving-table,
body.swt-moving-table * {
  cursor: move !important;
}
body.swt-table-picking .swt-sheet-board,
body.swt-table-picking .swt-sheet-board * {
  cursor: crosshair !important;
}

/* A handle dragged: the cell under the finger is found past the handles */
body.swt-select-dragging .swt-select-handle {
  pointer-events: none;
}

/* While a formula waits for a reference, cells can be pointed at */
.sb-table-widget.swt-table.swt-pointing td:not(.swt-editing) {
  cursor: move;
}
/* A formula's result: a dotted underline (not while the cell is edited). On
   the content box too: a decoration does not reach into an inline block. */
.sb-table-widget.swt-table td.swt-formula:not(.swt-editing),
.sb-table-widget.swt-table td.swt-formula:not(.swt-editing) > .swt-cell-content {
  text-decoration: underline dotted color-mix(in srgb, var(--ui-accent-color) 75%, transparent);
  text-decoration-thickness: 2px;
  /* Clear of the digits, which have no descenders to leave room */
  text-underline-offset: 0.3em;
}
.sb-table-widget.swt-table td.swt-formula-error {
  color: var(--danger-color);
}
.swt-formula-hint {
  z-index: 56;
  /* fx beside the formula and its help, at the edge by the cell (the top, or the bottom above the cell) */
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  max-width: 460px;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
  pointer-events: none;
}
.swt-formula-hint.swt-above {
  align-items: flex-end;
}
.swt-formula-hint-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.swt-formula-preview {
  font-family: var(--editor-font, monospace);
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-all;
}
.swt-formula-tab {
  opacity: 0.7;
}
.swt-formula-help code {
  margin-right: 6px;
  font-weight: 600;
}
/* The current argument in a function's syntax */
.swt-formula-argument {
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 2px;
}
/* The functions and names a name typed may be: picked with the arrows,
   inserted with Tab or a click (the hint lets clicks through to the table, the
   list takes them) */
.swt-formula-choices {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: 11.5em;
  margin: 0 -8px 0 -4px;
  overflow-y: auto;
  pointer-events: auto;
}
.swt-formula-choice {
  display: flex;
  gap: 8px;
  padding: 2px 8px 2px 4px;
  cursor: pointer;
  white-space: nowrap;
}
.swt-formula-choice code {
  min-width: 6em;
  font-weight: 600;
}
.swt-formula-choice span {
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.75;
}
.swt-formula-choice:hover {
  background: color-mix(in srgb, var(--ui-accent-color, #4a7cc7) 10%, transparent);
}
.swt-formula-choice[aria-selected="true"] {
  background: color-mix(in srgb, var(--ui-accent-color, #4a7cc7) 22%, transparent);
}
.swt-formula-choices + .swt-formula-help {
  padding-top: 4px;
  border-top: 1px solid var(--button-border-color);
}
.swt-formula-functions {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 3px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--button-border-color);
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  opacity: 0.8;
}
/* The autofill module: the fill handle in the corner of the selection's last
   cell, the cells a drag fills outlined (a piece in each cell on the edge),
   the last one's value by the pointer. In the cells, out of the layout, as
   the pin mark is: they scroll with the table, under its held header */
.sb-table-widget td:has(> .swt-fill-handle, > .swt-fill-edge) {
  position: relative;
}
.sb-table-widget td:is(.swt-pin-left, .swt-pin-right):has(> .swt-fill-handle, > .swt-fill-edge) {
  position: sticky;
}
/* Centered on the cell's corner, as in a spreadsheet; inside the cell on the
   table's last row or column, where the table's box would cut it */
.swt-fill-handle {
  position: absolute;
  right: -4px;
  bottom: -4px;
  z-index: 2;
  box-sizing: border-box;
  width: 8px;
  height: 8px;
  background: var(--ui-accent-color, #4a7cc7);
  border: 1px solid var(--root-background-color, #fff);
  cursor: crosshair;
  touch-action: none;
}
@media (pointer: coarse) {
  .swt-fill-handle {
    right: -7px;
    bottom: -7px;
    width: 14px;
    height: 14px;
  }
}
.swt-fill-handle.swt-at-right {
  right: 0;
}
.swt-fill-handle.swt-at-bottom {
  bottom: 0;
}
/* After a touch the corner is the selection's handle, to select more */
html[data-swt-pointer="touch"] .swt-fill-handle {
  display: none;
}
.swt-fill-edge {
  position: absolute;
  inset: 0;
  z-index: 1;
  border: 0 dashed var(--ui-accent-color, #4a7cc7);
  pointer-events: none;
}
.swt-fill-edge.swt-fill-top {
  border-top-width: 2px;
}
.swt-fill-edge.swt-fill-bottom {
  border-bottom-width: 2px;
}
.swt-fill-edge.swt-fill-left {
  border-left-width: 2px;
}
.swt-fill-edge.swt-fill-right {
  border-right-width: 2px;
}
.swt-fill-tip {
  z-index: 57;
  padding: 2px 6px;
  font-size: 12px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
  pointer-events: none;
  white-space: nowrap;
}
body.swt-filling,
body.swt-filling * {
  cursor: crosshair !important;
}
/* AutoFill to…: the next click on a cell fills to it */
.sb-table-widget.swt-table.swt-fill-picking td {
  cursor: crosshair !important;
}
.swt-formula-functions:hover {
  opacity: 1;
}
.swt-formula-functions svg {
  width: 15px;
  height: 15px;
}
@media (pointer: coarse) {
  .swt-formula-functions {
    padding: 7px;
  }
}
.swt-floating.swt-ref-mark {
  z-index: 49;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid var(--swt-ref-color);
  background: color-mix(in srgb, var(--swt-ref-color) 10%, transparent);
}
.swt-floating.swt-ref-mark.swt-visible {
  display: block !important;
}
.swt-ref-edge {
  position: absolute;
  pointer-events: auto;
  touch-action: none;
  cursor: move;
}
.swt-ref-top,
.swt-ref-bottom {
  left: -4px;
  right: -4px;
  height: 7px;
}
.swt-ref-top {
  top: -5px;
}
.swt-ref-bottom {
  bottom: -5px;
}
.swt-ref-left,
.swt-ref-right {
  top: -4px;
  bottom: -4px;
  width: 7px;
}
.swt-ref-left {
  left: -5px;
}
.swt-ref-right {
  right: -5px;
}
.swt-ref-corner {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 8px;
  height: 8px;
  pointer-events: auto;
  touch-action: none;
  cursor: nwse-resize;
  background: var(--swt-ref-color);
  border: 1px solid var(--root-background-color);
}
body.swt-ref-dragging,
body.swt-ref-dragging * {
  cursor: move !important;
  user-select: none;
}

/* Dragging */
/* A row (column) dragged: its copy follows the pointer, the others move aside */
.swt-drag-ghost {
  z-index: 55;
  pointer-events: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}
/* Opaque: the table's cells take their background from their rows */
.swt-drag-ghost table {
  border-collapse: collapse;
  background: var(--root-background-color);
}
/* Its place is covered by the rows (columns) moving aside: the gap left is where it goes */
.sb-table-widget .swt-dragged {
  opacity: 0;
}
body.swt-dragging .sb-table-widget.swt-table :is(td, th) {
  transition: transform 0.15s ease;
}
@media (prefers-reduced-motion: reduce) {
  body.swt-dragging .sb-table-widget.swt-table :is(td, th) {
    transition: none;
  }
}
body.swt-dragging,
body.swt-dragging * {
  cursor: grabbing !important;
  user-select: none;
}
/* ---- Themes (the themes module) ----------------------------------------------
   A table with data-swt-theme="<name>" takes its look from --swt-* variables,
   set by the theme for that name (below, or a space-style block of your own):

   .sb-table-widget[data-swt-theme="mine"] { --swt-head-bg: #eef; --swt-row-line: 1px; }
   html[data-theme="dark"] .sb-table-widget[data-swt-theme="mine"] { --swt-head-bg: #223; }

   Every variable is optional: one a theme leaves out is as SilverBullet has it.
   The rules key on data-swt-theme (data-swt-stripes) alone, which only Silverware Table
   sets: the preview of a theme in the Theme list is a table of their own too.
   The rules below turn them into the table's look; :is(#sb-main, html) gives
   them the weight of SilverBullet's own table rules (#sb-main .cm-editor …), so
   a theme's spacing and header win over them, in SilverBullet and the playground. */

/* SilverBullet's colors as the page has them, for a theme that leaves one out */
html {
  --swt-sb-head-bg: var(--editor-table-head-background-color);
  --swt-sb-head-color: var(--editor-table-head-color);
  --swt-sb-stripe: var(--editor-table-even-background-color);
  --swt-sb-accent: var(--ui-accent-color);
}
/* The colors: SilverBullet's own variables, within the table, so its header,
   striping, the held header, pinned cells and selection follow the theme */
:is(#sb-main, html) .sb-table-widget[data-swt-theme] {
  --editor-table-head-background-color: var(--swt-head-bg, var(--swt-sb-head-bg));
  --editor-table-head-color: var(--swt-head-color, var(--swt-sb-head-color));
  --editor-table-even-background-color: var(--swt-stripe, var(--swt-sb-stripe));
  --ui-accent-color: var(--swt-accent, var(--swt-sb-accent));
  color: var(--swt-color, currentColor);
  font-size: var(--swt-font-size, 1em);
  /* No fallback: without --swt-font the declaration is invalid, so the font is inherited (as SilverBullet's) */
  font-family: var(--swt-font);
  /* The table's box: its corners, its shadow, a line around it (inside the box, so it follows the corners) */
  border-radius: var(--swt-radius, 4px 4px 0 0);
  box-shadow: var(--swt-shadow, none);
  outline: var(--swt-outline, 0px) solid var(--swt-border, transparent);
  outline-offset: calc(-1 * var(--swt-outline, 0px));
}
/* Over the whole window (full screen, the sheet view): a box without corners or shadow */
:is(#sb-main, html) .sb-table-widget.swt-over-window[data-swt-theme] {
  border-radius: 0;
  box-shadow: none;
}
:is(#sb-main, html) .sb-table-widget[data-swt-theme] thead tr {
  font-weight: var(--swt-head-weight, bold);
  font-family: var(--swt-head-font, var(--swt-font));
  /* As SilverBullet colors it (colors.scss), also where nothing else does (the playground) */
  color: var(--editor-table-head-color, currentColor);
}
:is(#sb-main, html) .sb-table-widget[data-swt-theme] thead tr:first-child > td {
  padding: var(--swt-head-padding, var(--swt-padding, 11px 8px));
  font-size: var(--swt-head-size, 1em);
  text-transform: var(--swt-head-transform, none);
  letter-spacing: var(--swt-head-spacing, normal);
  border-bottom: var(--swt-head-line, var(--swt-row-line, 0px)) solid var(--swt-border, transparent);
}
/* Lines between rows (the last one has the box's), between columns */
:is(#sb-main, html) .sb-table-widget[data-swt-theme] :is(tbody, tfoot) td {
  padding: var(--swt-padding, 8px);
  border-bottom: var(--swt-row-line, 0px) solid var(--swt-border, transparent);
}
:is(#sb-main, html) .sb-table-widget[data-swt-theme] :is(tbody, tfoot):last-child tr:last-child > td {
  border-bottom-width: 0;
}
:is(#sb-main, html) .sb-table-widget[data-swt-theme] tr > td + td {
  border-left: var(--swt-column-line, 0px) solid var(--swt-border, transparent);
}
/* Stripes (the setting, or the table's stripes="…"), whatever the theme: it
   gives only their color. Rows are SilverBullet's own (no mark); none: every
   row as the others; columns: every other column of the body instead (not the
   header, nor pinned columns, tinted as they are) */
:is(#sb-main, html) .sb-table-widget:is([data-swt-stripes="none"], [data-swt-stripes="columns"]) {
  --swt-stripe-color: var(--swt-stripe, var(--swt-sb-stripe));
  --editor-table-even-background-color: transparent;
}
:is(#sb-main, html) .sb-table-widget[data-swt-stripes="columns"] :is(tbody, tfoot) td:nth-child(even):not(.swt-pin-left):not(.swt-pin-right) {
  background-image: linear-gradient(var(--swt-stripe-color), var(--swt-stripe-color));
}
/* The row under the pointer: a tint over its striping (none if the theme sets none) */
:is(#sb-main, html) .sb-table-widget[data-swt-theme] tbody tr:not(.swt-large-spacer):hover {
  background-image: linear-gradient(var(--swt-hover), var(--swt-hover));
}

/* plain: no lines, fills nor bold header: text in rows and columns, as for a layout */
.sb-table-widget[data-swt-theme="plain"] {
  --swt-head-bg: transparent;
  --swt-head-color: currentColor;
  --swt-head-weight: normal;
  --swt-stripe: transparent;
  --swt-hover: transparent;
  --swt-radius: 0;
}

/* playground: the look of Silverware Table's playground (a light header, soft striping) */
.sb-table-widget[data-swt-theme="playground"] {
  --swt-head-bg: #e8e8ee;
  --swt-head-color: currentColor;
  --swt-stripe: #f4f4f8;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="playground"] {
  --swt-head-bg: #2e2f38;
  --swt-stripe: #26272e;
}

/* minimal: a quiet small-caps header over a line, thin lines between rows, barely tinted stripes */
.sb-table-widget[data-swt-theme="minimal"] {
  --swt-head-bg: transparent;
  --swt-head-color: #6b7280;
  --swt-head-weight: 600;
  --swt-head-size: 0.78em;
  --swt-head-transform: uppercase;
  --swt-head-spacing: 0.06em;
  --swt-stripe: rgba(0, 0, 0, 0.025);
  --swt-border: #e5e7eb;
  --swt-row-line: 1px;
  --swt-head-line: 2px;
  --swt-hover: rgba(0, 0, 0, 0.03);
  --swt-radius: 0;
  --swt-padding: 10px 12px;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="minimal"] {
  --swt-head-color: #9ca3af;
  --swt-stripe: rgba(255, 255, 255, 0.03);
  --swt-border: #30333b;
  --swt-hover: rgba(255, 255, 255, 0.04);
}

/* slate: a card with rounded corners and a soft shadow, a cool grey header */
.sb-table-widget[data-swt-theme="slate"] {
  --swt-head-bg: #f1f5f9;
  --swt-head-color: #334155;
  --swt-head-weight: 600;
  --swt-stripe: #f8fafc;
  --swt-border: #e2e8f0;
  --swt-row-line: 1px;
  --swt-outline: 1px;
  --swt-radius: 10px;
  --swt-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 14px rgba(15, 23, 42, 0.06);
  --swt-hover: #eef2f7;
  --swt-padding: 9px 14px;
  --swt-head-padding: 11px 14px;
  --swt-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="slate"] {
  --swt-head-bg: #1e293b;
  --swt-head-color: #cbd5e1;
  --swt-stripe: rgba(148, 163, 184, 0.05);
  --swt-border: #334155;
  --swt-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(0, 0, 0, 0.3);
  --swt-hover: rgba(148, 163, 184, 0.08);
}

/* grid: a spreadsheet, every cell outlined, compact */
.sb-table-widget[data-swt-theme="grid"] {
  --swt-head-bg: #f3f4f6;
  --swt-head-color: #111827;
  --swt-head-weight: 600;
  --swt-stripe: #f9fafb;
  --swt-border: #d1d5db;
  --swt-row-line: 1px;
  --swt-column-line: 1px;
  --swt-outline: 1px;
  --swt-radius: 2px;
  --swt-padding: 4px 8px;
  --swt-head-padding: 6px 8px;
  --swt-font-size: 0.92em;
  --swt-hover: rgba(37, 99, 235, 0.06);
  --swt-accent: #2563eb;
  --swt-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="grid"] {
  --swt-head-bg: #262a33;
  --swt-head-color: #e5e7eb;
  --swt-stripe: rgba(255, 255, 255, 0.03);
  --swt-border: #3a3f4b;
  --swt-hover: rgba(96, 165, 250, 0.08);
  --swt-accent: #60a5fa;
}

/* ocean: a deep teal header, light teal striping, rounded */
.sb-table-widget[data-swt-theme="ocean"] {
  --swt-head-bg: #0e7490;
  --swt-head-color: #ffffff;
  --swt-head-weight: 600;
  --swt-stripe: #ecfeff;
  --swt-radius: 8px;
  --swt-shadow: 0 2px 10px rgba(14, 116, 144, 0.15);
  --swt-hover: rgba(14, 116, 144, 0.07);
  --swt-accent: #0891b2;
  --swt-padding: 9px 12px;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="ocean"] {
  --swt-head-bg: #155e75;
  --swt-head-color: #ecfeff;
  --swt-stripe: rgba(34, 211, 238, 0.06);
  --swt-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  --swt-hover: rgba(34, 211, 238, 0.1);
  --swt-accent: #22d3ee;
}

/* paper: warm tones, a header over a double-weight line, lines between rows */
.sb-table-widget[data-swt-theme="paper"] {
  --swt-head-bg: #f5efe6;
  --swt-head-color: #5b4636;
  --swt-head-weight: 600;
  --swt-stripe: #fbf8f3;
  --swt-border: #e8dccb;
  --swt-row-line: 1px;
  --swt-head-line: 2px;
  --swt-outline: 1px;
  --swt-radius: 6px;
  --swt-hover: #f7f1e8;
  --swt-accent: #b45309;
  --swt-padding: 8px 12px;
  --swt-font: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="paper"] {
  --swt-head-bg: #3a3128;
  --swt-head-color: #f0e2cf;
  --swt-stripe: rgba(240, 226, 207, 0.04);
  --swt-border: #4a3f34;
  --swt-hover: rgba(240, 226, 207, 0.07);
  --swt-accent: #f59e0b;
}

/* contrast: high contrast for reading: a black header, strong lines, roomy cells */
.sb-table-widget[data-swt-theme="contrast"] {
  --swt-head-bg: #111827;
  --swt-head-color: #ffffff;
  --swt-head-weight: 700;
  --swt-stripe: #eef0f3;
  --swt-color: #000000;
  --swt-border: #374151;
  --swt-row-line: 1px;
  --swt-outline: 2px;
  --swt-radius: 4px;
  --swt-hover: #e2e5ea;
  --swt-accent: #1d4ed8;
  --swt-padding: 10px 12px;
  --swt-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="contrast"] {
  --swt-head-bg: #f9fafb;
  --swt-head-color: #000000;
  --swt-stripe: rgba(255, 255, 255, 0.09);
  --swt-color: #ffffff;
  --swt-border: #d1d5db;
  --swt-hover: rgba(255, 255, 255, 0.14);
  --swt-accent: #93c5fd;
}

/* compact: for tables of data: small type, tight cells, no lines, soft stripes */
.sb-table-widget[data-swt-theme="compact"] {
  --swt-head-bg: #f3f4f6;
  --swt-head-color: #374151;
  --swt-head-weight: 600;
  --swt-stripe: #f9fafb;
  --swt-hover: rgba(0, 0, 0, 0.04);
  --swt-radius: 3px;
  --swt-padding: 2px 6px;
  --swt-head-padding: 4px 6px;
  --swt-font-size: 0.85em;
  --swt-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="compact"] {
  --swt-head-bg: #23262d;
  --swt-head-color: #d1d5db;
  --swt-stripe: rgba(255, 255, 255, 0.03);
  --swt-hover: rgba(255, 255, 255, 0.05);
}

/* bold: thick black lines, square corners, a hard offset shadow, an upper-case header on yellow accents */
.sb-table-widget[data-swt-theme="bold"] {
  --swt-head-bg: #111111;
  --swt-head-color: #fde047;
  --swt-head-weight: 800;
  --swt-head-transform: uppercase;
  --swt-head-spacing: 0.04em;
  --swt-head-font: "Arial Black", "Helvetica Neue", Arial, ui-sans-serif, sans-serif;
  --swt-stripe: #fefce8;
  --swt-border: #111111;
  --swt-row-line: 2px;
  --swt-outline: 3px;
  --swt-radius: 0;
  --swt-shadow: 6px 6px 0 #111111;
  --swt-hover: #fef9c3;
  --swt-accent: #ca8a04;
  --swt-padding: 10px 14px;
  --swt-font: "Helvetica Neue", Arial, ui-sans-serif, sans-serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="bold"] {
  --swt-head-bg: #fde047;
  --swt-head-color: #111111;
  --swt-stripe: rgba(253, 224, 71, 0.06);
  --swt-border: #fde047;
  --swt-shadow: 6px 6px 0 rgba(253, 224, 71, 0.35);
  --swt-hover: rgba(253, 224, 71, 0.1);
  --swt-accent: #fde047;
}

/* soft: airy and rounded: a pastel violet header, large corners, a deep soft shadow, no lines */
.sb-table-widget[data-swt-theme="soft"] {
  --swt-head-bg: #ede9fe;
  --swt-head-color: #5b21b6;
  --swt-head-weight: 600;
  --swt-stripe: #faf7ff;
  --swt-hover: #f3ecff;
  --swt-radius: 16px;
  --swt-shadow: 0 8px 24px rgba(91, 33, 182, 0.12);
  --swt-accent: #7c3aed;
  --swt-padding: 12px 16px;
  --swt-font: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="soft"] {
  --swt-head-bg: #2e1065;
  --swt-head-color: #e9d5ff;
  --swt-stripe: rgba(167, 139, 250, 0.06);
  --swt-hover: rgba(167, 139, 250, 0.1);
  --swt-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  --swt-accent: #a78bfa;
}

/* ledger: an account book: lines between columns, a heavy rule under a small-caps
   header, green-bar stripes, figures in a monospace font, so they line up */
.sb-table-widget[data-swt-theme="ledger"] {
  --swt-head-bg: #f0fdf4;
  --swt-head-color: #14532d;
  --swt-head-weight: 700;
  --swt-head-size: 0.8em;
  --swt-head-transform: uppercase;
  --swt-head-spacing: 0.05em;
  --swt-stripe: #f0fdf4;
  --swt-border: #86efac;
  --swt-column-line: 1px;
  --swt-head-line: 3px;
  --swt-outline: 1px;
  --swt-radius: 2px;
  --swt-hover: #dcfce7;
  --swt-accent: #15803d;
  --swt-padding: 6px 12px;
  --swt-font-size: 0.92em;
  --swt-font: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
html[data-theme="dark"] .sb-table-widget[data-swt-theme="ledger"] {
  --swt-head-bg: #052e16;
  --swt-head-color: #bbf7d0;
  --swt-stripe: rgba(74, 222, 128, 0.06);
  --swt-border: #166534;
  --swt-hover: rgba(74, 222, 128, 0.1);
  --swt-accent: #4ade80;
}

/* ---- Conditional formatting (the conditions module) ----
   A cell a rule formats has the mark swt-cf and custom properties of its
   style (--swt-cf-fill, --swt-cf-color, …, each with its -dark value): these
   rules read them, one set for every format, so a format of any colors and
   levels needs no CSS of its own. No !important: a theme that uses it wins. */

/* The palette: a tint to fill a cell, a shade for its text, a strong color for bars and icons; light and dark */
:root {
  --swt-cf-red-fill: #ffc7ce;
  --swt-cf-red-text: #9c0006;
  --swt-cf-red-solid: #e5534b;
  --swt-cf-orange-fill: #fdd9b5;
  --swt-cf-orange-text: #8a4300;
  --swt-cf-orange-solid: #f08c2e;
  --swt-cf-yellow-fill: #ffeb9c;
  --swt-cf-yellow-text: #9c5700;
  --swt-cf-yellow-solid: #e0b000;
  --swt-cf-green-fill: #c6efce;
  --swt-cf-green-text: #006100;
  --swt-cf-green-solid: #3fa34d;
  --swt-cf-teal-fill: #c3ece8;
  --swt-cf-teal-text: #0b5c55;
  --swt-cf-teal-solid: #1aa39a;
  --swt-cf-blue-fill: #cfe2ff;
  --swt-cf-blue-text: #0b3d91;
  --swt-cf-blue-solid: #4a7cf0;
  --swt-cf-purple-fill: #e3d5f7;
  --swt-cf-purple-text: #4b2a85;
  --swt-cf-purple-solid: #8a63d2;
  --swt-cf-pink-fill: #fbd3e9;
  --swt-cf-pink-text: #8a1d55;
  --swt-cf-pink-solid: #d9488f;
  --swt-cf-gray-fill: #e3e3e3;
  --swt-cf-gray-text: #3d3d3d;
  --swt-cf-gray-solid: #8a8a8a;
}
html[data-theme="dark"] {
  --swt-cf-red-fill: #5c1f24;
  --swt-cf-red-text: #ffb3b8;
  --swt-cf-red-solid: #f0716a;
  --swt-cf-orange-fill: #5c3514;
  --swt-cf-orange-text: #ffc58f;
  --swt-cf-orange-solid: #f5a052;
  --swt-cf-yellow-fill: #5a4a12;
  --swt-cf-yellow-text: #ffe08a;
  --swt-cf-yellow-solid: #f0c63a;
  --swt-cf-green-fill: #1e4d2b;
  --swt-cf-green-text: #a7e3b3;
  --swt-cf-green-solid: #5cc26b;
  --swt-cf-teal-fill: #134542;
  --swt-cf-teal-text: #9fe3dc;
  --swt-cf-teal-solid: #3cc4ba;
  --swt-cf-blue-fill: #1d3461;
  --swt-cf-blue-text: #b3cdfd;
  --swt-cf-blue-solid: #6f97f5;
  --swt-cf-purple-fill: #3a2a5c;
  --swt-cf-purple-text: #d4c2f5;
  --swt-cf-purple-solid: #a585e3;
  --swt-cf-pink-fill: #5a1f3d;
  --swt-cf-pink-text: #f7b5d6;
  --swt-cf-pink-solid: #e870a9;
  --swt-cf-gray-fill: #3a3a3a;
  --swt-cf-gray-text: #d6d6d6;
  --swt-cf-gray-solid: #a0a0a0;
}

/* The value of each look, picked by the page's: the rules below read these */
:is(td, .swt-cf-sample).swt-cf {
  --swt-cf-fill-now: var(--swt-cf-fill);
  --swt-cf-color-now: var(--swt-cf-color);
  --swt-cf-bar-color-now: var(--swt-cf-bar-color);
  --swt-cf-icon-color-now: var(--swt-cf-icon-color);
}
html[data-theme="dark"] :is(td, .swt-cf-sample).swt-cf {
  --swt-cf-fill-now: var(--swt-cf-fill-dark, var(--swt-cf-fill));
  --swt-cf-color-now: var(--swt-cf-color-dark, var(--swt-cf-color));
  --swt-cf-bar-color-now: var(--swt-cf-bar-color-dark, var(--swt-cf-bar-color));
  --swt-cf-icon-color-now: var(--swt-cf-icon-color-dark, var(--swt-cf-icon-color));
}
/* A fill over the stripes and the row's hover tint; a selected or edited cell's tint (an inset shadow) over it */
:is(#sb-main, html) .sb-table-widget td.swt-cf-fill,
.swt-cf-sample.swt-cf-fill {
  background-color: var(--swt-cf-fill-now);
}
/* A text color: not over a typed cell's invalid mark, which is told first */
:is(#sb-main, html) .sb-table-widget td.swt-cf-color:not(.swt-type-invalid),
:is(#sb-main, html) .sb-table-widget td.swt-cf-color:not(.swt-type-invalid) a,
.swt-cf-sample.swt-cf-color {
  color: var(--swt-cf-color-now);
}
.sb-table-widget td.swt-cf-text,
.sb-table-widget td.swt-cf-text > .swt-cell-content,
.swt-cf-sample.swt-cf-text {
  font-weight: var(--swt-cf-weight, inherit);
  font-style: var(--swt-cf-style, inherit);
  text-decoration-line: var(--swt-cf-line, none);
}
/* A data bar: under the content, from the cell's left edge, the fill (if any) around it */
:is(#sb-main, html) .sb-table-widget td.swt-cf-bar,
.swt-cf-sample.swt-cf-bar {
  background-image: linear-gradient(
    to right,
    color-mix(in srgb, var(--swt-cf-bar-color-now) 45%, transparent) var(--swt-cf-bar),
    transparent var(--swt-cf-bar)
  );
  background-repeat: no-repeat;
}
/* An icon before the content (an arrow, a dot) */
:is(#sb-main, html) .sb-table-widget td.swt-cf-icon > .swt-cell-content::before,
.swt-cf-sample.swt-cf-icon::before {
  content: var(--swt-cf-icon);
  color: var(--swt-cf-icon-color-now);
  margin-right: 0.35em;
  font-weight: normal;
  text-decoration: none;
  display: inline-block;
}

/* The rules' dialog */
.swt-cf-dialog {
  width: min(820px, calc(100vw - 24px));
}
.swt-cf-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.swt-cf-list:focus {
  outline: none;
}
.swt-cf-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 6px;
}
.swt-cf-line.swt-cf-open {
  border-color: var(--ui-accent-color);
}
.swt-cf-unread {
  opacity: 0.75;
  font-size: 12px;
}
.swt-cf-summary {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  padding: 2px 4px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.swt-cf-summary:hover {
  background: var(--swt-dialog-card);
}
.swt-cf-scope {
  font-weight: 600;
}
.swt-cf-arrow,
.swt-cf-stop {
  opacity: 0.6;
}
.swt-cf-stop {
  font-size: 11px;
  padding: 0 4px;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 4px;
}
/* How a rule's format looks: a strip of its colors (a scale's, levels'), as Google Sheets previews one */
.swt-cf-strip {
  display: inline-flex;
  flex: none;
  width: 84px;
  height: 20px;
  overflow: hidden;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 4px;
}
.swt-cf-strip > .swt-cf-sample.swt-cf-part {
  flex: 1;
  min-width: 0;
  padding: 0;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  border: none;
  border-radius: 0;
  overflow: hidden;
}
.swt-cf-strip > .swt-cf-sample.swt-cf-icon::before {
  margin-right: 0;
}
.swt-cf-param-line {
  gap: 8px;
}
.swt-cf-sample {
  display: inline-block;
  min-width: 3.2em;
  padding: 1px 6px;
  font-size: 12px;
  text-align: center;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 3px;
}
.swt-cf-tools {
  display: inline-flex;
}
.swt-cf-tool {
  padding: 2px 6px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.65;
}
.swt-cf-tool:hover:not(:disabled) {
  background: var(--swt-dialog-card);
  opacity: 1;
}
.swt-cf-tool:disabled {
  opacity: 0.25;
  cursor: default;
}
.swt-cf-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 6px 12px;
  padding: 8px 10px;
  border-left: 2px solid var(--ui-accent-color);
}
.swt-cf-section {
  display: grid;
  grid-template-columns: 8em 1fr;
  gap: 4px 12px;
  align-items: start;
}
.swt-cf-label {
  font-weight: 600;
  padding-top: 5px;
}
.swt-cf-fields,
.swt-cf-params {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}
.swt-cf-description {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}
.swt-cf-param {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.swt-cf-param-list {
  flex-direction: column;
  align-items: flex-start;
}
.swt-cf-param-name {
  font-size: 12px;
  opacity: 0.75;
  min-width: 5em;
}
.swt-cf-list-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 6px;
  border: 1px dashed var(--swt-dialog-line);
  border-radius: 6px;
}
.swt-cf select,
.swt-cf input[type="text"],
.swt-cf input[type="number"] {
  padding: 4px 6px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swt-dialog-line);
  border-radius: 6px;
  min-width: 0;
}
.swt-cf input[type="text"] {
  width: 16em;
  max-width: 100%;
}
.swt-cf input[type="number"] {
  width: 6em;
}
.swt-cf-problem {
  font-size: 12px;
  color: var(--danger-color, #c62828);
}
.swt-cf-problem:empty {
  display: none;
}
.swt-cf-colors {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}
.swt-cf-swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 4px;
  cursor: pointer;
}
.swt-cf-swatch[aria-pressed="true"] {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 1px;
}
.swt-cf-swatch-none {
  background: linear-gradient(to top right, transparent 45%, var(--danger-color, #c62828) 45% 55%, transparent 55%);
}
.swt-cf-colors input[type="color"] {
  width: 26px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}
.swt-cf-colors input[type="color"].swt-cf-picked {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 1px;
}
.swt-cf-style {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}
.swt-cf-style-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.swt-cf-style-name {
  font-size: 12px;
  opacity: 0.75;
  min-width: 2.6em;
}
.swt-cf-flag {
  min-width: 24px;
  padding: 1px 6px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--swt-dialog-line);
  border-radius: 4px;
  cursor: pointer;
}
.swt-cf-flag[aria-pressed="true"] {
  background: color-mix(in srgb, var(--ui-accent-color) 22%, transparent);
  border-color: var(--ui-accent-color);
}
.swt-cf-flag-bold {
  font-weight: bold;
}
.swt-cf-flag-italic {
  font-style: italic;
}
.swt-cf-flag-underline {
  text-decoration: underline;
}
.swt-cf-flag-strike {
  text-decoration: line-through;
}
.swt-cf-list-fields {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.swt-cf-none {
  margin: 4px 0;
  font-size: 12px;
  opacity: 0.7;
}
```
