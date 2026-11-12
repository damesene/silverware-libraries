---
tags: meta
---
# Silverware Chart style

The look of [Silverware Chart](silverware-chart.md): a chart's box, its toolbar, menu and settings. It is installed with the library.

```space-style
/* Silverware Chart: a chart's box, and what shows where one cannot be drawn */
/* What Silverware Chart assumes about SilverBullet's DOM, all of it here: its own controls of a chart's block
   (its widget menu: Reload, Copy, Edit; .button-bar in the widget in the release 2.12.1, verified in its
   container on 2026-11-03, .sb-widget-menu-bar in main; the block's Copy button, .sb-code-copy-button in
   the block's first line, .cm-line > .sb-actions) left out, as the chart's toolbar has them; .swc-widget is the
   class the init page gives the chart's widget */
/* (On a touch screen SilverBullet shows its widget menu always, `display: block !important` by
   #sb-main .cm-editor .sb-lua-directive-block .button-bar in (hover: none) and (pointer: coarse), seen on a phone
   2026-11-09: its id and three classes outweigh two, so this names the same path, the widget's own class beside it) */
.swc-widget .button-bar,
#sb-main .cm-editor .swc-widget.sb-lua-directive-block .button-bar,
.swc-widget .sb-widget-menu-bar,
.cm-line:has(.swc-widget) > .sb-actions .sb-code-copy-button {
  display: none !important;
}

/* (An element of its own: swc-chart) */
.swc-chart {
  display: block;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.swc-problem {
  height: auto !important;
  padding: 8px 12px;
  border: 1px dashed var(--editor-error-color, #d33);
  border-radius: 6px;
  color: var(--editor-error-color, #d33);
  font-size: 0.9em;
}

.swc-stale {
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 2px 8px;
  border: 1px solid var(--editor-warning-color, #c80);
  border-radius: 4px;
  background: var(--root-background-color, #fff);
  color: var(--editor-warning-color, #c80);
  font-size: 12px;
  cursor: pointer;
  opacity: 0.85;
}

.swc-stale:hover {
  opacity: 1;
}

.swc-choices {
  margin-top: 6px;
  color: var(--root-color, inherit);
}

.swc-choice {
  margin: 2px 4px 2px 0;
  padding: 1px 8px;
  border: 1px solid var(--subtle-color, #999);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.swc-choice:hover {
  border-color: var(--ui-accent-color, #4e79a7);
}

/* The toolbar of the chart hovered and its menu, floating in the page (Silverware Table's look) */
.swc-floating {
  position: fixed;
  z-index: 50;
  display: none !important;
  font-family: var(--ui-font, system-ui, sans-serif);
}

.swc-floating.swc-visible {
  display: flex !important;
}

.swc-bar {
  box-sizing: border-box;
  height: 26px;
  align-items: center;
  gap: 2px;
  padding: 1px 2px;
  font-size: 12px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.swc-bar button {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}

.swc-bar button:hover {
  background: color-mix(in srgb, var(--ui-accent-color) 16%, transparent);
}

.swc-menu {
  z-index: 60;
  flex-direction: column;
  min-width: 220px;
  max-width: 340px;
  padding: 4px;
  font-size: 13px;
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}

/* <shared-menu> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The look of shared/menu.ts's menus: one template for every plugin drawing them, its classes those renderMenu gives
   (`<base>-menu-item`…) with a placeholder for the base; scripts/sharedstyles.mjs writes it, the plugin's base (`swt`,
   `swc`, `swd`) in place, into each plugin's style page (between its marks; npm run build), and check-build fails where
   one differs.
   The menu's box (where it shows, its size, its font, its background) is the plugin's own, `.<base>-menu`. */

/* The menu's entries one under another */
[role="menu"].swc-menu,
.swc-menu > [role="menu"] {
  display: flex;
  flex-direction: column;
  outline: none;
}
/* The title centered; a submenu's back arrow at the left */
.swc-menu-title {
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
.swc-menu-title-text {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* A submenu's way back: an arrow before its title */
.swc-menu-back {
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
.swc-menu-back:hover,
.swc-menu-back:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swc-menu .swc-menu-back svg {
  width: 14px;
  height: 14px;
}
/* The × closing the menu, at the title's right */
.swc-menu-close {
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
.swc-menu-close:hover,
.swc-menu-close:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swc-menu .swc-menu-close svg {
  width: 14px;
  height: 14px;
}
/* What the menu is about named in its title: a pencil after the title, the title a field once pressed */
.swc-menu-rename {
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
.swc-menu-rename:hover,
.swc-menu-rename:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swc-menu-rename[aria-disabled] {
  opacity: 0.3;
  cursor: default;
  background: none;
}
.swc-menu .swc-menu-rename svg {
  width: 14px;
  height: 14px;
}
.swc-menu-title.swc-naming {
  display: block;
  padding: 2px 6px 6px;
}
.swc-menu-name {
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
.swc-menu-name-clear {
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
.swc-menu-name-problem {
  max-width: 260px;
  padding: 0 8px 6px;
  font-size: 12px;
  color: var(--danger-color, #c62828);
}
/* An item: its icon, its label (and its value), a mark where it opens a submenu or is checked */
.swc-menu-item {
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
.swc-menu-item:hover,
.swc-menu-item:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
/* A list opened in the menu's place: its choice highlighted (focusMenu), not
   the item that came under the pointer, until the pointer moves */
.swc-menu.swc-menu-still .swc-menu-item:hover:not(:focus-visible),
.swc-menu-still .swc-menu-item:hover:not(:focus-visible) {
  background: none;
}
.swc-menu-item.swc-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swc-menu-item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swc-menu-item[aria-disabled="true"]:hover {
  background: none;
}
.swc-menu-item .swc-label {
  flex: 1;
}
.swc-menu-item.swc-menu-sub::after {
  content: "\203A";
  opacity: 0.6;
}
.swc-menu-item[aria-checked="true"]::after {
  content: "\2713";
  color: var(--ui-accent-color);
}
.swc-menu-item.swc-danger {
  color: var(--danger-color, #c62828);
}
.swc-icon {
  display: inline-flex;
}
.swc-menu svg {
  width: 16px;
  height: 16px;
}
/* An item's detail: a bubble beside the menu, at the item's height */
.swc-menu-detail {
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
.swc-menu-detail.swc-left {
  left: auto;
  right: calc(100% + 8px);
}
.swc-menu-detail[hidden] {
  display: none;
}
.swc-menu-detail-title {
  margin-bottom: 4px;
  font-weight: 600;
}
.swc-menu-detail-code {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.swc-menu-detail-code code {
  padding: 1px 5px;
  font-size: 11px;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  border-radius: 4px;
}
.swc-menu-detail p {
  margin: 0;
}
.swc-menu-detail .swc-menu-detail-note {
  margin-top: 6px;
  opacity: 0.7;
}
/* The icon of an item's value: Type: ☆ Stars */
.swc-menu-value-icon {
  display: inline-flex;
  margin-right: 3px;
  vertical-align: -2px;
}
.swc-menu .swc-menu-value-icon svg {
  width: 14px;
  height: 14px;
}
.swc-menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.3));
}
/* A row of icon buttons after a label: a choice (Align) or a pair of actions (Move up, Move down) */
.swc-menu-segmented {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 2px 8px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items */
.swc-menu-segmented > .swc-label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Something missing (a table shown as a sheet on none): its label in the danger color */
.swc-menu-segmented .swc-label.swc-attention {
  font-weight: 600;
  color: var(--danger-color, #c62828);
  opacity: 1;
}
/* (Its buttons, swc-segments and swc-segment, are shared/segments.css's) */
.swc-action[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A bar of actions, a caption under each icon (Copy, Cut, Paste): first in a menu */
.swc-menu-actions {
  display: flex;
  gap: 2px;
  padding: 2px;
}
.swc-action {
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
.swc-action .swc-icon {
  display: inline-flex;
}
.swc-action:not([aria-disabled="true"]):hover,
.swc-action:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 15%, transparent);
  outline: none;
}
.swc-action-caption {
  white-space: nowrap;
  opacity: 0.85;
}
/* Choices laid out as tiles, an icon over each label (a gallery: a chart's types) */
.swc-menu-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.swc-menu-tile {
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
.swc-menu-tile[aria-checked="true"] {
  border-color: var(--ui-accent-color);
}
.swc-menu-tile[aria-checked="true"] .swc-label::after {
  content: " \2713";
  color: var(--ui-accent-color);
}
.swc-menu-tile[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swc-menu-tile:not([aria-disabled="true"]):hover,
.swc-menu-tile:focus-visible,
.swc-menu-tile.swc-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swc-menu-tile svg {
  width: 22px;
  height: 22px;
}
/* </shared-menu> */
/* <shared-segments> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* Joined buttons side by side, one of them pressed: a choice (a menu's Align,
   a width's unit px or %) or a pair of actions (Move up, Move down). Drawn
   by a menu's segmented entry (shared/menu.ts) and by segmentedControl
   (shared/controls.ts) */
.swc-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swc-segment {
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
.swc-segment:not([aria-disabled="true"]):hover,
.swc-segment:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swc-segment[aria-checked="true"] {
  color: var(--ui-accent-color);
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.swc-segment[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A finger's targets: bigger buttons in a row */
@media (pointer: coarse) {
  .swc-segment {
    padding: 8px 10px;
  }
}
/* </shared-segments> */
/* What a view says without items (Reading the page…, No table on this page) */
.swc-menu-line {
  padding: 5px 8px;
  opacity: 0.7;
}


.swc-icon {
  display: inline-flex;
}
.swc-icon:empty {
  display: none;
}






.swc-menu-series {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swc-menu-series input[type="color"] {
  width: 24px;
  height: 22px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.swc-menu-series input[type="text"],
.swc-menu-series select {
  min-width: 0;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 4px;
}

.swc-menu-series input[type="text"] {
  flex: 1;
  padding: 2px 4px;
}












/* The chart's settings dialog: the look of Silverware Tags' settings (shared/dialog.ts, its classes by the base swc-settings) */
.swc-settings-backdrop {
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
.swc-settings {
  --swc-settings-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swc-settings-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
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
  border: 1px solid var(--swc-settings-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swc-settings:focus {
  outline: none;
}
.swc-settings button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swc-settings-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swc-settings-titles {
  flex: 1;
  min-width: 0;
}
.swc-settings-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swc-settings-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
}
.swc-settings-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swc-settings-close:hover {
  opacity: 1;
  background: var(--swc-settings-card);
}
.swc-settings-close svg {
  width: 16px;
  height: 16px;
}
/* One row however many tabs: too wide for the dialog (a phone), it scrolls sideways */
.swc-settings-tabs {
  /* Never shrunk by a tall body (it scrolls sideways, so a column's flex would squeeze it: on a phone it slid under the body) */
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swc-settings-line);
}
.swc-settings-tab {
  flex: none;
  white-space: nowrap;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swc-settings-tab:hover {
  opacity: 1;
}
.swc-settings-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swc-settings-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
.swc-settings-panel[hidden] {
  display: none;
}
.swc-settings-group {
  margin: 14px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}
.swc-settings-panel > .swc-settings-card:first-child {
  margin-top: 12px;
}
.swc-settings-card {
  background: var(--swc-settings-card);
  border: 1px solid var(--swc-settings-line);
  border-radius: 8px;
}
.swc-settings-card > :not(:first-child) {
  border-top: 1px solid var(--swc-settings-line);
}
.swc-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
}
.swc-settings-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swc-settings-module-name,
.swc-settings-name {
  font-weight: 500;
}
.swc-settings-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.swc-settings-row select,
.swc-settings-row input[type="number"] {
  flex: none;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swc-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swc-settings-row select {
  max-width: 55%;
}
.swc-settings-row input[type="number"] {
  width: 6.5em;
}
.swc-settings-row input.swc-settings-invalid {
  border-color: var(--danger-color, #c62828);
}
/* A switch: the checkbox (invisible, still focusable) drawn as a track and a knob */
.swc-settings-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
}
.swc-settings-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swc-settings-knob {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--root-color) 22%, var(--root-background-color));
  transition: background 0.15s;
  pointer-events: none;
}
.swc-settings-knob::after {
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
.swc-settings-switch input:checked + .swc-settings-knob {
  background: var(--ui-accent-color);
}
.swc-settings-switch input:checked + .swc-settings-knob::after {
  transform: translateX(14px);
}
.swc-settings-switch input:focus-visible + .swc-settings-knob {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 2px;
}
.swc-settings-switch input:disabled + .swc-settings-knob {
  opacity: 0.5;
}
/* A module's own settings: under it, indented, while it is on */
.swc-settings-module-settings {
  margin: 0 12px 10px 24px;
  border-left: 2px solid var(--swc-settings-line);
}
.swc-settings-module-settings .swc-settings-row {
  padding: 6px 0 6px 12px;
}
.swc-settings-module-settings[hidden] {
  display: none;
}
.swc-settings-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swc-settings-line);
}
.swc-settings-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swc-settings-cancel,
.swc-settings-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swc-settings-line);
  background: var(--root-background-color);
}
.swc-settings-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swc-settings-save:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swc-settings {
    width: 100vw;
    height: 100vh;
    height: var(--sw-view-height, 100dvh);
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swc-settings-body {
    flex: 1 1 auto;
  }
  .swc-settings-tab {
    padding: 10px 12px;
  }
  .swc-settings-row {
    min-height: 44px;
  }
  .swc-settings-cancel,
  .swc-settings-save {
    padding: 10px 18px;
  }
  .swc-settings-row {
    flex-wrap: wrap;
  }
  /* The name keeps room to be read; a control that does not fit beside it goes under it, the row's width */
  .swc-settings-label {
    flex: 1 1 14em;
  }
  .swc-settings-row select {
    flex: 1 1 auto;
    max-width: 100%;
  }
  .swc-settings-row select,
  .swc-settings-row input[type="number"] {
    font-size: 16px;
  }
}

/* A row of each series (or slice): its number or label, then a control per setting */
.swc-settings-item {
  gap: 8px;
}
.swc-settings-item-name {
  flex: 0 0 auto;
  /* (One width for all: the controls after it under each other) */
  width: 5.5em;
  min-width: 1.5em;
  max-width: 8em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  opacity: 0.65;
}
.swc-settings-item input[type="text"] {
  flex: 1;
  min-width: 0;
}
.swc-settings-item input[type="radio"] {
  flex: none;
  margin: 0 8px;
  accent-color: var(--ui-accent-color);
}
.swc-settings-row input[type="text"] {
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swc-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swc-settings-row input[type="color"] {
  flex: none;
  width: 28px;
  height: 24px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
.swc-settings-row :disabled {
  opacity: 0.5;
  cursor: default;
}

/* The settings' conditions: a row each, a column, an operator, a value and ×, then + another */
.swc-settings-row-wide {
  flex-wrap: wrap;
}
.swc-settings-conditions {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swc-settings-conditions > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swc-settings-condition {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swc-settings-condition select,
.swc-settings-condition input {
  min-width: 0;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swc-settings-line);
  border-radius: 6px;
  padding: 3px 6px;
}
.swc-settings-condition input {
  flex: 1;
}
.swc-settings-remove,
.swc-settings-add {
  padding: 3px 8px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.75;
}
.swc-settings-add {
  align-self: flex-start;
  font-size: 12px;
}
.swc-settings-remove:hover,
.swc-settings-add:hover {
  opacity: 1;
  background: var(--swc-settings-card);
}

.swc-code {
  margin: 0;
  white-space: pre-wrap;
}
```
