---
tags: meta
---
# Silverware Database style

The look of [Silverware Database](silverware-database.md): a database's place (its views' switcher, its notes). Its classes start with `swd-`. It is installed with the library.

```space-style
/* What Silverware Database assumes about SilverBullet's DOM, all of it here: its own controls of a database's block
   (its widget menu: Reload, Copy, Edit; .button-bar in the widget in the release 2.12.1, .sb-widget-menu-bar in main;
   the block's Copy buttons in the block's first line, .cm-line > .sb-actions) left out, as Silverware Chart leaves them
   out of a chart's: the database's own tools are its controls; .swd-widget is the class the init page gives the widget */
.swd-widget .button-bar,
.swd-widget .sb-widget-menu-bar,
.cm-line:has(.swd-widget) > .sb-actions {
  display: none !important;
}
/* SilverBullet's dark look: the browser's own controls (a date field's calendar icon, a list, a scrollbar) drawn dark too,
   as SilverBullet sets no color-scheme of its own (a date's icon was black on the dark page) */
html[data-theme="dark"] :is(.swd-widget, .swd-peek, .swd-settings-backdrop) {
  color-scheme: dark;
}
/* The widget takes the focus of a press in it on what takes none (index.ts, pressBeside): no ring for it */
.swd-widget:focus {
  outline: none;
}

/* The look's own values, from SilverBullet's: a line, a quiet text, a surface a little apart from the page */
.swd-place,
.swd-peek,
.swd-popover {
  --swd-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swd-quiet: color-mix(in srgb, var(--root-color, currentColor) 68%, transparent);
  --swd-hover: color-mix(in srgb, var(--root-color, currentColor) 7%, transparent);
  --swd-surface: color-mix(in srgb, var(--root-color, currentColor) 4%, var(--root-background-color, transparent));
  --swd-accent: var(--ui-accent-color, #4a6cf7);
}

/* A place: the database's name and count, its views' tabs and the tools in one bar, what the view draws under it */
.swd-place {
  margin: 0.5em 0;
}
.swd-place-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 2px;
}
.swd-place-name {
  font-weight: 600;
  font-size: 1.05em;
}
.swd-place-count {
  color: var(--swd-quiet);
  font-size: 0.85em;
}
.swd-place-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--swd-line);
}
/* The tabs: one row, scrolled sideways where they do not fit (a phone), the one shown underlined */
.swd-tabs {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  /* (Its right end fading: more tabs beyond, where they do not fit) */
  mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
}
.swd-tabs::-webkit-scrollbar {
  display: none;
}
.swd-switch {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 4px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.swd-switch:hover {
  color: inherit;
  background: var(--swd-hover);
}
/* A view's icon: its own markup (an SVG of the built-in views, a character of a user's) at the text's size */
.swd-switch-icon {
  display: inline-flex;
}
.swd-switch-icon svg {
  width: 16px;
  height: 16px;
}
.swd-switch[aria-pressed="true"] {
  border-bottom-color: currentColor;
  color: inherit;
  font-weight: 600;
}
.swd-place-body {
  overflow-x: auto;
}
/* A view gone while the place is drawn anew: shown, taking no presses */
.swd-place-body[inert] {
  opacity: 0.6;
}
.swd-place-note {
  margin: 0.25em 0;
  color: var(--danger-color, #c62828);
}
/* What every view has beside the tabs, as icons: the filter, the sort, Undo, ⋯ */
.swd-tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding-bottom: 2px;
}
.swd-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 32px;
  min-height: 32px;
  justify-content: center;
  padding: 4px 6px;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.9em;
  cursor: pointer;
}
.swd-tool:hover,
.swd-tool[aria-expanded="true"] {
  color: inherit;
  background: var(--swd-hover);
}
/* A tool that holds something (a filter set, a sort): in the accent's color */
.swd-tool.swd-tool-on {
  color: var(--swd-accent);
}
.swd-tool:disabled {
  opacity: 0.4;
}
.swd-tool-icon {
  display: inline-flex;
}
.swd-tool-icon svg {
  width: 16px;
  height: 16px;
}
.swd-tool-text {
  max-width: 9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swd-tool-badge {
  min-width: 1.4em;
  padding: 0 4px;
  border-radius: 999px;
  color: var(--root-background-color, #fff);
  background: var(--swd-accent);
  font-size: 0.75em;
  line-height: 1.5;
}
/* A tool's menu (the sort's, ⋯): under its tool, at the bar's right */
.swd-tool-box {
  position: relative;
  display: inline-flex;
}
.swd-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  right: 0;
  display: flex;
  flex-direction: column;
  min-width: 12em;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--swd-line);
  border-radius: 8px;
  background: var(--root-background-color, #fff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.swd-popover[hidden] {
  display: none;
}
.swd-menu-item,
.swd-popover .swd-tool {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.swd-menu-item:hover,
.swd-menu-item:focus-visible,
.swd-popover .swd-tool:hover {
  background: var(--swd-hover);
}
.swd-menu-check {
  display: inline-flex;
  width: 16px;
  color: var(--swd-accent);
}
.swd-menu-check svg {
  width: 16px;
  height: 16px;
}
.swd-menu-line {
  margin: 4px 0;
  border-top: 1px solid var(--swd-line);
}
/* A view drawn once per group (Group by in ⋯, core/groups.ts): each group's head, folded or not, then the view */
.swd-group + .swd-group {
  margin-top: 12px;
}
.swd-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.swd-group-head:hover {
  background: var(--swd-hover);
}
.swd-group-chevron {
  display: inline-flex;
  color: var(--swd-quiet);
  transition: transform 0.1s;
}
.swd-group-chevron.swd-group-open {
  transform: rotate(90deg);
}
.swd-group-chevron svg {
  width: 14px;
  height: 14px;
}
.swd-group-label.swd-invalid {
  color: var(--danger-color, #c62828);
}
.swd-group-count {
  color: var(--swd-quiet);
  font-weight: normal;
}
.swd-group-body {
  margin-top: 4px;
}
/* A section's title in a menu (Group by in ⋯), and why it offers nothing */
.swd-menu-heading {
  padding: 4px 8px 2px;
  color: var(--swd-quiet);
  font-size: 0.85em;
}
.swd-menu-note {
  margin: 0;
  padding: 4px 8px;
  color: var(--swd-quiet);
}
.swd-menu-ways {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--swd-line);
}
.swd-menu-way {
  flex: 1;
  min-height: 30px;
  border: 1px solid var(--swd-line);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  font-size: 0.9em;
  cursor: pointer;
}
.swd-menu-way[aria-pressed="true"] {
  border-color: var(--swd-accent);
  color: var(--swd-accent);
}
.swd-menu-way:disabled {
  opacity: 0.4;
  cursor: default;
}

/* A select's value: a pill in its option's color, mixed from SilverBullet's text and page so it reads in light and dark */
.swd-pill {
  --swd-pill: 128, 128, 128;
  display: inline-block;
  max-width: 100%;
  margin: 1px 4px 1px 0;
  padding: 0 7px;
  overflow: hidden;
  border-radius: 4px;
  color: color-mix(in srgb, rgb(var(--swd-pill)) 55%, var(--root-color, #000));
  background: color-mix(in srgb, rgb(var(--swd-pill)) 16%, var(--root-background-color, #fff));
  font-size: 0.9em;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: baseline;
}
.swd-pill[data-color="0"] { --swd-pill: 120, 120, 130; }
.swd-pill[data-color="1"] { --swd-pill: 51, 126, 169; }
.swd-pill[data-color="2"] { --swd-pill: 68, 131, 97; }
.swd-pill[data-color="3"] { --swd-pill: 190, 135, 30; }
.swd-pill[data-color="4"] { --swd-pill: 210, 105, 10; }
.swd-pill[data-color="5"] { --swd-pill: 212, 76, 71; }
.swd-pill[data-color="6"] { --swd-pill: 144, 101, 176; }
.swd-pill[data-color="7"] { --swd-pill: 193, 76, 138; }
/* A value that is none of the options: no color, a dashed edge, why in its title */
/* A required value missing, in a list's line or on a card: a pill of no color in the danger's color */
.swd-pill.swd-pill-missing {
  color: var(--danger-color, #c62828);
  background: none;
  outline: 1px dashed currentColor;
  outline-offset: -1px;
  opacity: 0.85;
}
.swd-board-none.swd-board-missing {
  color: var(--danger-color, #c62828);
}
.swd-pill.swd-pill-none {
  color: inherit;
  background: none;
  outline: 1px dashed var(--danger-color, #c62828);
  outline-offset: -1px;
}

.swd-filter {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12em, 1fr));
  gap: 6px 12px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 6px;
}
.swd-filter[hidden] {
  display: none;
}
.swd-filter-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85em;
}
.swd-filter-row input,
.swd-editor {
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 4px;
  padding: 2px 4px;
}
.swd-invalid,
.swd-filter-row input.swd-invalid {
  color: var(--danger-color, #c62828);
  border-color: var(--danger-color, #c62828);
}
/* A value's editor in place, its choices in a panel over what is under it */
.swd-editor {
  width: 100%;
  box-sizing: border-box;
}
.swd-editor-choices {
  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: auto;
  min-width: 10em;
  padding: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.swd-editor-choice {
  display: flex;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}
/* The table */
.swd-table-box {
  overflow-x: auto;
}
.swd-table {
  border-collapse: collapse;
  width: 100%;
}
.swd-table th,
.swd-table td {
  position: relative;
  padding: 4px 8px;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.3));
  text-align: left;
  vertical-align: top;
}
.swd-table th {
  background: var(--editor-table-head-background-color, transparent);
}
/* Long text wraps, as in Notion, a cell at most --swd-cell-max-width wide (a space-style may set it on .swd-place) and at
   least a few words (a wide table in a narrow page is not squeezed to a letter a line, it scrolls sideways); the row's grip,
   its actions and a checkbox as narrow as they are. SilverBullet keeps the editor's table cells on one line
   (`#sb-main .cm-editor td { white-space: nowrap }`, its editor.scss), which reaches a block's widget: :is() weighs as an id */
:is(#sb-main, html) .swd-place .swd-table :is(th, td) {
  white-space: normal;
}
.swd-table th:not(.swd-table-gripcol):not(.swd-table-actions):not([data-type="checkbox"]),
.swd-table td:not(.swd-table-grip):not(.swd-table-actions):not([data-type="checkbox"]) {
  min-width: 6em;
  max-width: var(--swd-cell-max-width, 24em);
  overflow-wrap: anywhere;
}
.swd-table-sort {
  padding: 0;
  border: 0;
  color: inherit;
  background: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.swd-table td:not(.swd-readonly):not(.swd-table-actions) {
  cursor: text;
}
/* A cell being edited keeps its size: what it showed stays under the editor, hidden (table.ts), and the editor lies over
   it on its first line, adding nothing to the row's height nor the column's width; the multi-select's list of boxes
   opens under it as everywhere */
.swd-editing-held {
  visibility: hidden;
}
.swd-table td.swd-editing > .swd-editor:not(.swd-editor-choices) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: min(100%, calc(1lh + 8px));
  margin: 0;
  padding: 0 7px;
  border-radius: 0;
  border-color: var(--ui-accent-color);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--ui-accent-color);
}
/* The cell being edited over its neighbours (each cell is positioned: a later one would be drawn over its editor) */
.swd-table td.swd-editing {
  z-index: 1;
}
/* The name's cell: its ↗ right after the last word, the two held on one line; never narrower than a few words (a phone) */
.swd-table-name {
  overflow-wrap: anywhere;
}
.swd-table-name-end {
  white-space: nowrap;
}
/* A header's sort arrow held to its name's last word */
.swd-table-sort-end {
  white-space: nowrap;
}
.swd-table-name .swd-open::before {
  content: "↗";
}
.swd-table td[data-key="name"] {
  min-width: 8em;
}
/* A row's grip: dragged to its place by hand (the table's first column, a list's line's start); shown as its row is hovered or
   it has the focus, always on a touch screen; none to press while the view is sorted */
.swd-table th.swd-table-gripcol,
.swd-table td.swd-table-grip {
  width: 18px;
  padding: 4px 0 4px 2px;
}
.swd-row-grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 22px;
  padding: 0;
  border: 0;
  color: var(--swd-quiet, currentColor);
  background: none;
  cursor: grab;
  touch-action: none;
  opacity: 0;
}
.swd-row-grip svg {
  width: 14px;
  height: 14px;
}
tr:hover .swd-row-grip,
li:hover .swd-row-grip,
.swd-row-grip:focus-visible {
  opacity: 0.7;
}
@media (hover: none) {
  .swd-row-grip {
    opacity: 0.45;
  }
}
.swd-list-item .swd-row-grip {
  align-self: center;
  margin: 0 -8px 0 -4px;
}
.swd-row-grip:disabled {
  cursor: default;
  visibility: hidden;
}
/* A row dragged: its place held, dimmed; a copy following the pointer (shared/drag.ts) */
.swd-rows-placeholder {
  opacity: 0.3;
}
.swd-rows-ghost {
  position: fixed;
  z-index: 101;
  margin: 0;
  pointer-events: none;
  box-sizing: border-box;
  display: block;
  border-radius: 6px;
  background: var(--root-background-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  opacity: 0.95;
}
/* A required value missing: its cell says so, quietly in the danger's color */
.swd-table td.swd-missing:not(.swd-editing)::after {
  content: "Required";
  color: var(--danger-color, #c62828);
  font-size: 0.85em;
  opacity: 0.75;
}
/* A date, a number: one line, as a value broken at its dash reads as two */
:is(#sb-main, html) .swd-place .swd-table td:is([data-type="date"], [data-type="number"]) {
  white-space: nowrap;
}
/* A date's column as wide as the browser's date field (its parts and its picker's button cannot scroll as a text does), so its
   editor fits in its cell and the column does not change as it opens */
.swd-table td[data-type="date"] {
  min-width: 9.5em;
}
.swd-open,
.swd-remove {
  margin-left: 6px;
  padding: 0 4px;
  border: 0;
  color: inherit;
  background: none;
  opacity: 0.4;
  cursor: pointer;
}
.swd-open:hover,
.swd-remove:hover,
tr:focus-within .swd-open {
  opacity: 1;
}
/* With a mouse, a row's ↗ and ✕ show only as it is hovered or has the focus (a touch screen shows them always) */
@media (hover: hover) {
  .swd-table tbody tr:not(:hover):not(:focus-within) .swd-open,
  .swd-table tbody tr:not(:hover):not(:focus-within) .swd-remove {
    opacity: 0;
  }
}
/* A board column's head: its option's pill (none: its name, quiet) and how many cards */
.swd-board-none {
  color: var(--swd-quiet);
}
.swd-board-count {
  color: var(--swd-quiet);
  font-weight: normal;
  font-size: 0.85em;
}
.swd-table-actions {
  width: 1px;
}
.swd-table-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.swd-table-add,
.swd-board-add {
  padding: 3px 8px;
  border: 1px dashed var(--button-border-color, currentColor);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  opacity: 0.8;
}
.swd-table-count {
  font-size: 0.85em;
  opacity: 0.7;
}
/* The list */
.swd-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.swd-list-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.3));
  overflow-wrap: anywhere;
}
/* A long name or value wraps within the line, never wider than it */
.swd-list-item > * {
  min-width: 0;
  max-width: 100%;
}
/* An item's name (a button: a click opens it) in a list or on a card wraps too. SilverBullet keeps every button in a widget
   on one line (`button:not(.sb-button):not(…)… { white-space: nowrap }`, its editor.scss, weighing an id and five classes):
   `:not(#swd-none)` weighs an id more, matching any button */
:is(#sb-main, html) .swd-place :is(.swd-list-name, .swd-board-name):not(#swd-none) {
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
}
/* A list's name beside its grip on the line's first row, however long (a flex line breaks by an item's size, clamped by its
   maximum: the room the grip and the gap leave), its values after it or on the rows under it */
.swd-list-item > .swd-list-name {
  max-width: calc(100% - 2.5em);
}
.swd-list-name,
.swd-board-name {
  padding: 0;
  border: 0;
  color: var(--ui-accent-color);
  background: none;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.swd-list-value,
.swd-board-value {
  font-size: 0.85em;
  opacity: 0.8;
}
/* The board: columns side by side, scrolled sideways where they are more than the page's width */
.swd-board {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
}
/* Each column as wide as the others, whatever its cards hold (--swd-column-width, a space-style may set it on .swd-place):
   their text wraps, as in Notion */
.swd-board-column {
  flex: 0 0 var(--swd-column-width, 16em);
  width: var(--swd-column-width, 16em);
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--root-color) 5%, var(--root-background-color));
}
/* A drag: the column under the pointer tinted, the card dragged faded where it was, a line where it goes */
.swd-board-column.swd-drop {
  background: color-mix(in srgb, var(--ui-accent-color) 10%, var(--root-background-color));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-accent-color) 45%, transparent);
}
.swd-board-card.swd-dragging {
  opacity: 0.35;
}
.swd-board-drop-line {
  height: 3px;
  margin: -1.5px 0;
  border-radius: 2px;
  background: var(--ui-accent-color);
  pointer-events: none;
}
.swd-board-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.9em;
}
.swd-board-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 1.5em;
}
.swd-board-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 6px 8px;
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  background: var(--root-background-color);
  cursor: grab;
}

/* The settings dialog (the command "Silverware Database: Settings"):
   the toolbar's settings' look: tabs, rows in cards, switches; of one height, so switching tabs moves nothing */
/* Over the part of the window an on-screen keyboard leaves (shared/dialog.ts sets where it is) */
.swd-settings-backdrop {
  position: fixed;
  inset: 0;
  top: var(--sw-view-top, 0);
  bottom: auto;
  height: var(--sw-view-height, 100%);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--modal-backdrop-color, rgba(0, 0, 0, 0.35));
  font-family: var(--ui-font, system-ui, sans-serif);
}
.swd-settings {
  --swd-settings-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swd-settings-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  /* Of one height whatever its tab shows (switching tabs moves nothing), 720px where the window has room;
     its body scrolls (a phone: the whole screen, below) */
  display: flex;
  flex-direction: column;
  /* (Its border within the height: SilverBullet sets no box-sizing, the playground border-box) */
  box-sizing: border-box;
  width: min(600px, calc(100vw - 24px));
  height: min(560px, calc(100vh - 32px));
  height: min(560px, calc(var(--sw-view-height, 100dvh) - 32px));
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swd-settings-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swd-settings:focus {
  outline: none;
}
.swd-settings button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swd-settings-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swd-settings-titles {
  flex: 1;
  min-width: 0;
}
.swd-settings-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swd-settings-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
}
.swd-settings-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swd-settings-close:hover {
  opacity: 1;
  background: var(--swd-settings-card);
}
.swd-settings-close svg {
  width: 16px;
  height: 16px;
}
/* One row however many tabs: too wide for the dialog (a phone), it scrolls sideways */
.swd-settings-tabs {
  /* Never shrunk by a tall body (it scrolls sideways, so a column's flex would squeeze it: on a phone it slid under the body) */
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swd-settings-line);
}
.swd-settings-tab {
  flex: none;
  white-space: nowrap;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swd-settings-tab:hover {
  opacity: 1;
}
.swd-settings-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swd-settings-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
.swd-settings-panel[hidden] {
  display: none;
}
.swd-settings-group {
  margin: 14px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}
.swd-settings-panel > .swd-settings-card:first-child {
  margin-top: 12px;
}
.swd-settings-card {
  background: var(--swd-settings-card);
  border: 1px solid var(--swd-settings-line);
  border-radius: 8px;
}
.swd-settings-card > :not(:first-child) {
  border-top: 1px solid var(--swd-settings-line);
}
.swd-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
}
.swd-settings-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swd-settings-module-name,
.swd-settings-name {
  font-weight: 500;
}
.swd-settings-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.swd-settings-row select,
.swd-settings-row input[type="number"] {
  flex: none;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swd-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swd-settings-row select {
  max-width: 55%;
}
.swd-settings-row input[type="number"] {
  width: 6.5em;
}
.swd-settings-row input.swd-settings-invalid {
  border-color: var(--danger-color, #c62828);
}
/* A switch: the checkbox (invisible, still focusable) drawn as a track and a knob */
.swd-settings-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
}
.swd-settings-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swd-settings-knob {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--root-color) 22%, var(--root-background-color));
  transition: background 0.15s;
  pointer-events: none;
}
.swd-settings-knob::after {
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
.swd-settings-switch input:checked + .swd-settings-knob {
  background: var(--ui-accent-color);
}
.swd-settings-switch input:checked + .swd-settings-knob::after {
  transform: translateX(14px);
}
.swd-settings-switch input:focus-visible + .swd-settings-knob {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 2px;
}
.swd-settings-switch input:disabled + .swd-settings-knob {
  opacity: 0.5;
}
/* A module's own settings: under it, indented, while it is on */
.swd-settings-module-settings {
  margin: 0 12px 10px 24px;
  border-left: 2px solid var(--swd-settings-line);
}
.swd-settings-module-settings .swd-settings-row {
  padding: 6px 0 6px 12px;
}
.swd-settings-module-settings[hidden] {
  display: none;
}
.swd-settings-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swd-settings-line);
}
.swd-settings-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swd-settings-cancel,
.swd-settings-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swd-settings-line);
  background: var(--root-background-color);
}
.swd-settings-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swd-settings-save:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swd-settings {
    width: 100vw;
    height: 100vh;
    height: var(--sw-view-height, 100dvh);
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swd-settings-body {
    flex: 1 1 auto;
  }
  .swd-settings-tab {
    padding: 10px 12px;
  }
  .swd-settings-row {
    min-height: 44px;
  }
  .swd-settings-cancel,
  .swd-settings-save {
    padding: 10px 18px;
  }
  .swd-settings-row {
    flex-wrap: wrap;
  }
  /* The name keeps room to be read; a control that does not fit beside it goes under it, the row's width */
  .swd-settings-label {
    flex: 1 1 14em;
  }
  .swd-settings-row select {
    flex: 1 1 auto;
    max-width: 100%;
  }
  .swd-settings-row select,
  .swd-settings-row input[type="number"] {
    font-size: 16px;
  }
}
/* The properties' dialog (the Properties module): a property a row (grip, type's icon, name, type), dragged to its place;
   a row open shows its details under it; options a list of their own, each with its grip, color, name and × */
.swd-properties {
  --swd-line: var(--swd-settings-line);
  --swd-quiet: color-mix(in srgb, var(--root-color, currentColor) 68%, transparent);
  --swd-hover: color-mix(in srgb, var(--root-color, currentColor) 7%, transparent);
  --swd-accent: var(--ui-accent-color, #4a6cf7);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.swd-properties input,
.swd-properties select {
  box-sizing: border-box;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid var(--swd-line);
  border-radius: 6px;
  color: inherit;
  background: var(--root-background-color);
  font: inherit;
}
.swd-props {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--swd-line);
  border-radius: 8px;
  overflow: hidden;
}
.swd-prop + .swd-prop {
  border-top: 1px solid var(--swd-line);
}
.swd-prop-row {
  display: flex;
  align-items: center;
}
.swd-prop-grip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  min-height: 40px;
  padding: 0;
  border: 0;
  color: var(--swd-quiet);
  background: none;
  cursor: grab;
  touch-action: none;
  opacity: 0.6;
}
.swd-prop-grip:hover,
.swd-prop-grip:focus-visible {
  opacity: 1;
}
.swd-prop-grip svg {
  width: 16px;
  height: 16px;
}
.swd-prop-head {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 40px;
  padding: 4px 6px 4px 0;
  border: 0;
  color: inherit;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.swd-prop-row:hover {
  background: var(--swd-hover);
}
/* The eye: shown in the views or hidden, pressed from the list */
.swd-prop-eye {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  cursor: pointer;
}
.swd-prop-eye:hover {
  color: inherit;
  background: var(--swd-hover);
}
.swd-prop-eye[aria-pressed="false"] {
  color: var(--swd-accent);
}
.swd-prop-eye svg {
  width: 16px;
  height: 16px;
}
.swd-prop-icon,
.swd-prop-lock,
.swd-prop-chevron {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--swd-quiet);
}
.swd-prop-icon svg,
.swd-prop-lock svg,
.swd-prop-chevron svg {
  width: 16px;
  height: 16px;
}
/* A property required: a * after its name in the list */
.swd-prop-required {
  margin-left: 3px;
  color: var(--danger-color, #c62828);
  font-weight: 600;
}
/* A property hidden in the views: its row quieter */
.swd-prop-is-hidden .swd-prop-name,
.swd-prop-is-hidden .swd-prop-icon {
  opacity: 0.55;
}
.swd-prop-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.swd-prop-type {
  flex: 0 0 auto;
  color: var(--swd-quiet);
  font-size: 0.9em;
}
.swd-prop-chevron {
  padding: 0 10px 0 4px;
  cursor: pointer;
  transition: transform 0.15s;
}
.swd-prop-open .swd-prop-chevron {
  transform: rotate(90deg);
}
.swd-prop-open > .swd-prop-row {
  background: var(--swd-hover);
}
/* A property open: its fields one a line, the name of each at the left (above it on a phone) */
.swd-prop-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px 28px;
}
.swd-prop-field {
  display: grid;
  grid-template-columns: 8em 1fr;
  gap: 4px 12px;
  align-items: center;
}
@media (max-width: 520px) {
  .swd-prop-field {
    grid-template-columns: 1fr;
  }
}
.swd-prop-field-name {
  display: flex;
  flex-direction: column;
  color: var(--swd-quiet);
  font-size: 0.9em;
}
.swd-prop-field-name .swd-settings-hint {
  font-size: 0.85em;
}
.swd-prop-options {
  align-items: start;
}
.swd-prop-options > .swd-prop-field-name {
  padding-top: 6px;
}
/* Advanced: what is seldom set, folded under its summary */
.swd-prop-advanced {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.swd-prop-advanced[open] > .swd-prop-field {
  margin-top: 10px;
}
.swd-prop-advanced-summary {
  width: fit-content;
  color: var(--swd-quiet);
  font-size: 0.9em;
  cursor: pointer;
}
.swd-prop-advanced-summary:hover {
  color: inherit;
}
.swd-prop-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--swd-line);
}
.swd-properties .swd-property-remove {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--danger-color, #c62828);
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-properties .swd-property-remove:hover {
  border-color: color-mix(in srgb, var(--danger-color, #c62828) 40%, transparent);
}
.swd-property-locked {
  cursor: pointer;
}
/* A row dragged: its place held, dimmed, the others sliding aside; a copy following the pointer (shared/drag.ts) */
.swd-props-placeholder {
  opacity: 0.3;
}
.swd-props-ghost {
  position: fixed;
  z-index: 101;
  margin: 0;
  pointer-events: none;
  box-sizing: border-box;
  border-radius: 6px;
  background: var(--root-background-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

/* A select's options: a list, each its grip, its color, its name, ×; one added under them; saved together */
.swd-options-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.swd-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.swd-option {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
}
.swd-option:hover {
  background: var(--swd-hover);
}
.swd-option .swd-prop-grip {
  width: 22px;
  min-height: 32px;
}
.swd-properties .swd-option-name {
  flex: 1 1 auto;
  min-width: 0;
  border-color: transparent;
  background: transparent;
}
.swd-properties .swd-option-name:hover,
.swd-properties .swd-option-name:focus {
  border-color: var(--swd-line);
  background: var(--root-background-color);
}
.swd-properties .swd-option-color,
.swd-properties .swd-option-swatch {
  flex: 0 0 auto;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-properties .swd-option-color-none {
  cursor: default;
  opacity: 0.4;
}
.swd-properties .swd-option-color:not(.swd-option-color-none):hover,
.swd-properties .swd-option-color[aria-expanded="true"],
.swd-properties .swd-option-swatch:hover {
  border-color: var(--swd-line);
}
.swd-properties .swd-option-swatch[aria-pressed="true"] {
  border-color: var(--swd-accent);
}
.swd-option-color .swd-pill,
.swd-option-swatch .swd-pill {
  margin: 0;
}
.swd-option-color .swd-pill {
  min-width: 1.2em;
}
.swd-properties .swd-option-remove {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  cursor: pointer;
}
.swd-properties .swd-option-remove:hover {
  color: var(--danger-color, #c62828);
  background: var(--swd-hover);
}
.swd-option-remove svg {
  width: 14px;
  height: 14px;
}
.swd-properties .swd-option-new {
  margin-left: 28px;
  border-style: dashed;
}
.swd-option-palette {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 0 6px 28px;
}
.swd-option-palette[hidden] {
  display: none;
}
.swd-properties .swd-option-own {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
}
.swd-properties .swd-option-own-input {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  min-height: 0;
  padding: 0;
  border: 1px solid var(--swd-line);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}
.swd-properties .swd-option-auto {
  padding: 2px 8px;
  font-size: 0.85em;
}
.swd-options-foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.swd-options-foot button:disabled {
  opacity: 0.4;
  cursor: default;
}

/* A property added: its name, its type, Add, one line under the list */
.swd-property-adder {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swd-properties .swd-property-new-label {
  flex: 1 1 12em;
  border-style: dashed;
}
.swd-properties .swd-property-add {
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid var(--swd-line);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-property-review {
  padding: 4px 12px;
}
.swd-property-review .swd-settings-row {
  justify-content: flex-end;
}

/* The peek: an item beside the page, over the right of the editor's area; a page of its own where the area is narrow */
.swd-peek {
  position: fixed;
  z-index: 50;
  /* The editor's font where SilverBullet does not tell its look (the panel sets it from the editor's text as it opens) */
  font-family: var(--editor-font, inherit);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 20px 20px;
  overflow: auto;
  background: var(--root-background-color);
  color: var(--root-color);
  border-left: 1px solid var(--swd-line);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.18);
}
/* Its fields in its own font (a browser's fields have their own); of no weight, a field's own size (the name's) kept */
:where(.swd-peek) :is(input, textarea, select) {
  font: inherit;
}
/* Its left edge, dragged to set its width (panel.ts `resizer`): an element of no size held at the panel's top left as it
   scrolls, its line the panel's height */
.swd-peek-resize {
  position: sticky;
  top: -10px;
  flex: 0 0 0;
  height: 0;
  margin: -10px 0 -12px -20px;
  align-self: flex-start;
  outline: none;
}
/* A zone to hit, not a line: the cursor says what it does, nothing drawn (the panel clips what is past its edge) */
.swd-peek-resize::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100vh;
  cursor: col-resize;
}
.swd-peek-whole .swd-peek-resize {
  display: none;
}
.swd-peek.swd-peek-whole {
  padding: 8px 16px max(16px, env(safe-area-inset-bottom));
  border-left: 0;
  box-shadow: none;
}
.swd-peek-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 -8px;
}
.swd-peek-gap {
  flex: 1;
}
.swd-peek-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  min-height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  cursor: pointer;
}
.swd-peek-button:hover {
  color: inherit;
  background: var(--swd-hover);
}
.swd-peek-button svg {
  width: 18px;
  height: 18px;
}
/* × beside the page, ← where the peek is the whole page */
.swd-peek-close-back,
.swd-peek-whole .swd-peek-close-x {
  display: none;
}
.swd-peek-whole .swd-peek-close-back {
  display: inline-flex;
}
.swd-peek-close-x {
  display: inline-flex;
}
/* Its name as a page's title: no field's edge until it is edited */
.swd-peek-name {
  width: 100%;
  box-sizing: border-box;
  padding: 2px 4px;
  margin: 0 -4px;
  border: 0;
  border-radius: 4px;
  outline: none;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 1.6em;
  font-weight: 700;
}
.swd-peek-name:hover,
.swd-peek-name:focus {
  background: var(--swd-hover);
}
.swd-peek-properties {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/* A property's row: its grip (shown as it is hovered), its name (a button opening it in Properties), its value */
.swd-peek-row {
  display: grid;
  grid-template-columns: 18px 9.5em 1fr;
  gap: 0 6px;
  align-items: start;
  margin-left: -18px;
}
.swd-peek-grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 32px;
  padding: 0;
  border: 0;
  color: var(--swd-quiet);
  background: none;
  cursor: grab;
  touch-action: none;
  opacity: 0;
}
.swd-peek-row:hover .swd-peek-grip,
.swd-peek-grip:focus-visible {
  opacity: 0.7;
}
.swd-peek-grip svg {
  width: 14px;
  height: 14px;
}
.swd-peek-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.9em;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
button.swd-peek-label {
  cursor: pointer;
}
button.swd-peek-label:hover {
  color: inherit;
  background: var(--swd-hover);
}
.swd-peek-add-property {
  align-self: flex-start;
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.9em;
  cursor: pointer;
}
.swd-peek-add-property:hover {
  color: inherit;
  background: var(--swd-hover);
}
/* A phone: the grip always shown (no hover), the row's name narrower */
@media (hover: none) {
  .swd-peek-grip {
    opacity: 0.5;
  }
}
@media (max-width: 520px) {
  .swd-peek-row {
    grid-template-columns: 18px 7.5em 1fr;
  }
}
/* The peek as the whole page: the grips within its padding */
.swd-peek-whole .swd-peek-row {
  margin-left: -12px;
}
.swd-peek-type {
  display: inline-flex;
}
.swd-peek-type svg {
  width: 15px;
  height: 15px;
}
.swd-peek-value {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-height: 32px;
  padding: 0 6px;
  border-radius: 6px;
  overflow-wrap: anywhere;
}
.swd-peek-value[role="button"] {
  cursor: pointer;
}
.swd-peek-value[role="button"]:hover {
  background: var(--swd-hover);
}
.swd-peek-value > .swd-editor:not(.swd-editor-choices) {
  width: 100%;
}
/* The properties hidden in the views: under their own quiet heading in the peek */
.swd-peek-hidden-title {
  margin-top: 4px;
  color: var(--swd-quiet);
  font-size: 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
/* A required value missing, in the peek */
.swd-peek-empty.swd-peek-missing {
  color: var(--danger-color, #c62828);
  opacity: 0.85;
}
.swd-peek-empty {
  color: var(--swd-quiet);
  opacity: 0.7;
}
.swd-peek-check {
  display: inline-flex;
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  border: 1.5px solid var(--swd-quiet);
  border-radius: 4px;
}
.swd-peek-check.swd-on {
  border: 0;
  color: var(--swd-accent);
}
.swd-peek-check svg {
  width: 18px;
  height: 18px;
}
.swd-peek-note p {
  margin: 0 0 6px;
  color: var(--danger-color, #c62828);
}
/* Its content: text under its properties, a line between, no field's edge until it is edited */
.swd-peek-body {
  flex: 1 1 12em;
  min-height: 12em;
  padding: 12px 4px 4px;
  border: 0;
  border-top: 1px solid var(--swd-line);
  border-radius: 0;
  outline: none;
  resize: none;
  color: inherit;
  background: transparent;
  font: inherit;
  line-height: 1.5;
}
.swd-peek-body:focus {
  background: var(--swd-surface);
}
```
