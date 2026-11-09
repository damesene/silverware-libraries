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
/* (On a touch screen SilverBullet shows its widget menu always, `display: block !important` by
   #sb-main .cm-editor .sb-lua-directive-block .button-bar in (hover: none) and (pointer: coarse), seen on a phone
   2026-11-09: its id and three classes outweigh two, so this names the same path, the widget's own class beside it) */
/* (SilverBullet's frame of a widget, #sb-main .cm-editor .sb-lua-directive-block { border: 1px solid … }: none round a
   database, which draws its own; the same path, the widget's own class beside it, outweighs it) */
#sb-main .cm-editor .swd-widget.sb-lua-directive-block {
  border: none;
}
.swd-widget .button-bar,
#sb-main .cm-editor .swd-widget.sb-lua-directive-block .button-bar,
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
.swd-peek {
  --swd-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swd-quiet: color-mix(in srgb, var(--root-color, currentColor) 68%, transparent);
  --swd-hover: color-mix(in srgb, var(--root-color, currentColor) 7%, transparent);
  --swd-surface: color-mix(in srgb, var(--root-color, currentColor) 4%, var(--root-background-color, transparent));
  --swd-accent: var(--ui-accent-color, #4a6cf7);
}

/* A place: one bar, the database's name and count quietly, then the view's picker (Launch plan 10 Board),
   the tools at its end; what the view draws under it */
.swd-place {
  margin: 0.5em 0;
}
/* A note, not a heading: quiet, its name cut with an ellipsis where the bar is narrow (it gives way before the view's
   picker does, down to its first letters), the tools never pushed out */
.swd-place-head {
  display: flex;
  flex: 0 1 auto;
  align-items: baseline;
  gap: 6px;
  /* (Its first letters and the count kept: "Lau… 10") */
  min-width: 7ch;
  padding-left: 2px;
  color: var(--swd-quiet);
  font-size: 0.85em;
}
.swd-place-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swd-place-count {
  flex: 0 0 auto;
}
.swd-place-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--swd-line);
}
/* A place over the whole window (the full screen module): its box laid over the page and SilverBullet's top bar, under the
   peek (z-index 50) and the dialogs, its views scrolling in it; the page's look kept */
.swd-place.swd-over-window {
  position: fixed;
  inset: 0;
  z-index: 45;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  margin: 0;
  padding: 12px 20px 20px;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--root-background-color, #fff);
}
/* SilverBullet's editor scrolls in a box that is a stacking context under its top bar: lifted over it while it holds a place
   shown so (as Silverware Table lifts it for a table over the window) */
.cm-scroller:has(.swd-place.swd-over-window) {
  z-index: 30 !important;
}
/* The view shown: one button (its icon, its label, a mark of its list) opening the views in a menu; the tools at the bar's end */
.swd-view-picker-box {
  /* (Cut only once the database's name is down to its first letters: a shrink so small that it gets none of what the bar
     lacks until the name can give no more, which a flex box then gives it whole) */
  flex: 0 0.00001 auto;
  min-width: 0;
  margin-right: auto;
}
/* (Its menu under it from its left edge: the picker is at the bar's start, the tools' menus open from their right one) */
.swd-view-picker-box > .swd-menu {
  right: auto;
  left: 0;
}
.swd-view-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: 0;
  max-width: 100%;
  min-height: 34px;
  padding: 4px 8px 4px 10px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  /* (Named, not shouted: a touch under the page's text, half bold) */
  font-size: 0.95em;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.swd-view-picker:disabled {
  color: var(--swd-quiet);
  cursor: default;
}
.swd-view-picker:not(:disabled):hover,
.swd-view-picker[aria-expanded="true"] {
  background: var(--swd-hover);
}
/* A view's icon: its own markup (an SVG of the built-in views, a character of a user's) at the text's size */
.swd-view-picker-icon,
.swd-view-picker-mark {
  display: inline-flex;
  flex: none;
}
.swd-view-picker-icon svg {
  width: 16px;
  height: 16px;
}
.swd-view-picker-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.swd-view-picker-mark {
  color: var(--swd-quiet);
}
.swd-view-picker-mark svg {
  width: 14px;
  height: 14px;
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
/* What every view has beside its picker, as icons: the filter, the sort, Undo, ⋯ */
.swd-tools {
  display: flex;
  flex: 0 0 auto;
  /* (At the bar's end, whatever is before it) */
  margin-left: auto;
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
.swd-menu {
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
.swd-menu[hidden] {
  display: none;
}
/* ⋯'s menu (core/placemenu.ts): the shared menu (shared/menu.ts) in Silverware Database's look, its classes swd-menu-…:
   its title (a way back in a submenu, its ×), then its entries one under another */
.swd-menu {
  min-width: 200px;
  max-width: 320px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 13px;
  color: var(--root-color);
}
/* <shared-menu> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The look of shared/menu.ts's menus: one template for every plugin drawing them, its classes those renderMenu gives
   (`<base>-menu-item`…) with a placeholder for the base; scripts/sharedstyles.mjs writes it, the plugin's base (`swt`,
   `swc`, `swd`) in place, into each plugin's style page (between its marks; npm run build), and check-build fails where
   one differs.
   The menu's box (where it shows, its size, its font, its background) is the plugin's own, `.<base>-menu`. */

/* The menu's entries one under another */
[role="menu"].swd-menu,
.swd-menu > [role="menu"] {
  display: flex;
  flex-direction: column;
  outline: none;
}
/* The title centered; a submenu's back arrow at the left */
.swd-menu-title {
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
.swd-menu-title-text {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* A submenu's way back: an arrow before its title */
.swd-menu-back {
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
.swd-menu-back:hover,
.swd-menu-back:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swd-menu .swd-menu-back svg {
  width: 14px;
  height: 14px;
}
/* The × closing the menu, at the title's right */
.swd-menu-close {
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
.swd-menu-close:hover,
.swd-menu-close:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swd-menu .swd-menu-close svg {
  width: 14px;
  height: 14px;
}
/* What the menu is about named in its title: a pencil after the title, the title a field once pressed */
.swd-menu-rename {
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
.swd-menu-rename:hover,
.swd-menu-rename:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swd-menu-rename[aria-disabled] {
  opacity: 0.3;
  cursor: default;
  background: none;
}
.swd-menu .swd-menu-rename svg {
  width: 14px;
  height: 14px;
}
.swd-menu-title.swd-naming {
  display: block;
  padding: 2px 6px 6px;
}
.swd-menu-name {
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
.swd-menu-name-clear {
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
.swd-menu-name-problem {
  max-width: 260px;
  padding: 0 8px 6px;
  font-size: 12px;
  color: var(--danger-color, #c62828);
}
/* An item: its icon, its label (and its value), a mark where it opens a submenu or is checked */
.swd-menu-item {
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
.swd-menu-item:hover,
.swd-menu-item:focus-visible,
.swd-segment:not([aria-disabled="true"]):hover,
.swd-segment:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
/* A list opened in the menu's place: its choice highlighted (focusMenu), not
   the item that came under the pointer, until the pointer moves */
.swd-menu.swd-menu-still .swd-menu-item:hover:not(:focus-visible),
.swd-menu-still .swd-menu-item:hover:not(:focus-visible) {
  background: none;
}
.swd-menu-item.swd-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swd-menu-item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swd-menu-item[aria-disabled="true"]:hover {
  background: none;
}
.swd-menu-item .swd-label {
  flex: 1;
}
.swd-menu-item.swd-menu-sub::after {
  content: "\203A";
  opacity: 0.6;
}
.swd-menu-item[aria-checked="true"]::after {
  content: "\2713";
  color: var(--ui-accent-color);
}
.swd-menu-item.swd-danger {
  color: var(--danger-color, #c62828);
}
.swd-icon {
  display: inline-flex;
}
.swd-menu svg {
  width: 16px;
  height: 16px;
}
/* An item's detail: a bubble beside the menu, at the item's height */
.swd-menu-detail {
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
.swd-menu-detail.swd-left {
  left: auto;
  right: calc(100% + 8px);
}
.swd-menu-detail[hidden] {
  display: none;
}
.swd-menu-detail-title {
  margin-bottom: 4px;
  font-weight: 600;
}
.swd-menu-detail-code {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.swd-menu-detail-code code {
  padding: 1px 5px;
  font-size: 11px;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  border-radius: 4px;
}
.swd-menu-detail p {
  margin: 0;
}
.swd-menu-detail .swd-menu-detail-note {
  margin-top: 6px;
  opacity: 0.7;
}
/* The icon of an item's value: Type: ☆ Stars */
.swd-menu-value-icon {
  display: inline-flex;
  margin-right: 3px;
  vertical-align: -2px;
}
.swd-menu .swd-menu-value-icon svg {
  width: 14px;
  height: 14px;
}
.swd-menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.3));
}
/* A row of icon buttons after a label: a choice (Align) or a pair of actions (Move up, Move down) */
.swd-menu-segmented {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 2px 8px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items */
.swd-menu-segmented > .swd-label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Something missing (a table shown as a sheet on none): its label in the danger color */
.swd-menu-segmented .swd-label.swd-attention {
  font-weight: 600;
  color: var(--danger-color, #c62828);
  opacity: 1;
}
.swd-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swd-segment {
  display: inline-flex;
  padding: 4px 6px;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.swd-segment[aria-checked="true"] {
  color: var(--ui-accent-color);
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.swd-segment[aria-disabled="true"],
.swd-action[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A bar of actions, a caption under each icon (Copy, Cut, Paste): first in a menu */
.swd-menu-actions {
  display: flex;
  gap: 2px;
  padding: 2px;
}
.swd-action {
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
.swd-action .swd-icon {
  display: inline-flex;
}
.swd-action:not([aria-disabled="true"]):hover,
.swd-action:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 15%, transparent);
  outline: none;
}
.swd-action-caption {
  white-space: nowrap;
  opacity: 0.85;
}
/* Choices laid out as tiles, an icon over each label (a gallery: a chart's types) */
.swd-menu-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.swd-menu-tile {
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
.swd-menu-tile[aria-checked="true"] {
  border-color: var(--ui-accent-color);
}
.swd-menu-tile[aria-checked="true"] .swd-label::after {
  content: " \2713";
  color: var(--ui-accent-color);
}
.swd-menu-tile[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swd-menu-tile:not([aria-disabled="true"]):hover,
.swd-menu-tile:focus-visible,
.swd-menu-tile.swd-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swd-menu-tile svg {
  width: 22px;
  height: 22px;
}
/* A finger's targets: bigger buttons in a row */
@media (pointer: coarse) {
  .swd-segment {
    padding: 8px 10px;
  }
}
/* </shared-menu> */
/* <shared-emoji> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The emoji picker (shared/emoji.ts): its groups as tabs, its search, the emoji, the current one's name. Its search field,
   group titles and "none" in the picker's own classes, which a plugin with a look of its own for them (the toolbar)
   replaces by its own */
.swd-emoji-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
}
.swd-emoji-field {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  font: inherit;
  font-size: 14px;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
}
.swd-emoji-group {
  padding: 8px 2px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.swd-emoji-none {
  padding: 12px 8px;
  opacity: 0.6;
}
/* Its groups as filters, over the search: All, then each by its first emoji */
.swd-emoji-tabs {
  display: flex;
  padding: 6px 6px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.swd-emoji-tabs::-webkit-scrollbar {
  display: none;
}
.swd-emoji-tab {
  /* All ten in the panel's width, sharing what is left */
  flex: 1 0 auto;
  min-width: 28px;
  height: 30px;
  padding: 0 3px;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: inherit;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
}
.swd-emoji-tab:first-child {
  font-size: 12px;
  font-weight: 600;
}
.swd-emoji-tab:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swd-emoji-tab[aria-checked="true"] {
  border-bottom-color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 10%, transparent);
}
.swd-emoji-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 6px 6px;
}
.swd-emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
}
.swd-emoji {
  height: 36px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swd-emoji.swd-emoji-current {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 16%, transparent);
}
.swd-emoji-name {
  min-height: 1.3em;
  padding: 6px 10px;
  border-top: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  opacity: 0.75;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* </shared-emoji> */
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
/* Group in ⋯ (core/groupmenu.ts): Hide empty groups as a switch, then the groups, each its grip, name, count and eye;
   Visible properties in ⋯ (core/propertiesmenu.ts) the same look: the properties, each its name and eye */
.swd-group-list,
.swd-shown-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.swd-group-switch,
.swd-group-all,
.swd-group-grip,
.swd-group-eye,
.swd-shown-all,
.swd-shown-eye {
  border: 0;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-group-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  text-align: left;
}
.swd-group-switch:hover,
.swd-group-row:hover,
.swd-group-all:hover,
.swd-shown-row:hover,
.swd-shown-all:hover {
  background: var(--swd-hover);
}
.swd-group-switch-track {
  position: relative;
  flex: none;
  width: 26px;
  height: 14px;
  border-radius: 7px;
  background: var(--swd-line);
  transition: background 0.1s;
}
.swd-group-switch-track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--root-background-color, #fff);
  transition: transform 0.1s;
}
.swd-group-switch[aria-checked="true"] .swd-group-switch-track {
  background: var(--swd-accent);
}
.swd-group-switch[aria-checked="true"] .swd-group-switch-track::after {
  transform: translateX(12px);
}
.swd-group-list-head,
.swd-shown-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 2px;
  color: var(--swd-quiet);
  font-size: 12px;
}
.swd-group-all,
.swd-shown-all {
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--swd-quiet);
  font-size: 12px;
}
.swd-group-rows,
.swd-shown-rows {
  display: flex;
  flex-direction: column;
}
.swd-group-row,
.swd-shown-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 6px;
}
.swd-group-row-label,
.swd-shown-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swd-group-row-label.swd-invalid {
  color: var(--danger-color, #c62828);
}
.swd-group-off .swd-group-row-label,
.swd-shown-off .swd-shown-label,
.swd-group-row-count {
  color: var(--swd-quiet);
}
.swd-group-grip {
  display: inline-flex;
  padding: 2px;
  color: var(--swd-quiet);
  cursor: grab;
  touch-action: none;
}
.swd-group-eye,
.swd-shown-eye {
  display: inline-flex;
  padding: 3px;
  border-radius: 4px;
  color: var(--swd-quiet);
}
.swd-group-eye[aria-pressed="true"],
.swd-shown-eye[aria-pressed="true"] {
  color: inherit;
}
.swd-group-grip svg,
.swd-group-eye svg,
.swd-shown-eye svg {
  width: 14px;
  height: 14px;
}

/* A select's value: a pill in its option's color, mixed from SilverBullet's text and page so it reads in light and dark */
.swd-pill {
  --swd-pill: 128, 128, 128;
  display: inline-block;
  max-width: 100%;
  /* (Within a line of the text around it, never taller: a table's row with one as high as one without) */
  margin: 0 4px 0 0;
  padding: 0 7px;
  overflow: hidden;
  border-radius: 4px;
  color: color-mix(in srgb, rgb(var(--swd-pill)) 55%, var(--root-color, #000));
  background: color-mix(in srgb, rgb(var(--swd-pill)) 16%, var(--root-background-color, #fff));
  font-size: 0.9em;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* (Its box from the line's top: on the baseline, its smaller font's box sat lower and the line grew) */
  vertical-align: top;
}
/* The palette (domain/colors.ts: gray, blue, green, yellow, orange, red, purple, pink), each `r, g, b`: a select's options
   and an item's color by their place in it. A space-style may set them anew */
:root {
  --swd-palette-0: 120, 120, 130;
  --swd-palette-1: 51, 126, 169;
  --swd-palette-2: 68, 131, 97;
  --swd-palette-3: 190, 135, 30;
  --swd-palette-4: 210, 105, 10;
  --swd-palette-5: 212, 76, 71;
  --swd-palette-6: 144, 101, 176;
  --swd-palette-7: 193, 76, 138;
}
.swd-pill[data-color="0"] { --swd-pill: var(--swd-palette-0); }
.swd-pill[data-color="1"] { --swd-pill: var(--swd-palette-1); }
.swd-pill[data-color="2"] { --swd-pill: var(--swd-palette-2); }
.swd-pill[data-color="3"] { --swd-pill: var(--swd-palette-3); }
.swd-pill[data-color="4"] { --swd-pill: var(--swd-palette-4); }
.swd-pill[data-color="5"] { --swd-pill: var(--swd-palette-5); }
.swd-pill[data-color="6"] { --swd-pill: var(--swd-palette-6); }
.swd-pill[data-color="7"] { --swd-pill: var(--swd-palette-7); }
/* An item's color (core/look.ts): `--swd-item` on the element drawing it, its place in the palette, else its own (set inline);
   how it shows is each view's (below with the view) */
[data-swd-item-color="0"] { --swd-item: var(--swd-palette-0); }
[data-swd-item-color="1"] { --swd-item: var(--swd-palette-1); }
[data-swd-item-color="2"] { --swd-item: var(--swd-palette-2); }
[data-swd-item-color="3"] { --swd-item: var(--swd-palette-3); }
[data-swd-item-color="4"] { --swd-item: var(--swd-palette-4); }
[data-swd-item-color="5"] { --swd-item: var(--swd-palette-5); }
[data-swd-item-color="6"] { --swd-item: var(--swd-palette-6); }
[data-swd-item-color="7"] { --swd-item: var(--swd-palette-7); }
/* An item's icon: a character as large as the text around it, the CSS of where it is sizing it */
.swd-item-icon {
  display: inline-block;
  margin-right: 0.35em;
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  text-decoration: none;
}
/* Its color in the views: a stripe by a table's name, a list's line and a card tinted, a calendar's and a timeline's bar too */
.swd-table tr[data-swd-item-color] > td[data-key="name"] {
  box-shadow: inset 3px 0 0 rgb(var(--swd-item));
}
.swd-list-item[data-swd-item-color] {
  background: color-mix(in srgb, rgb(var(--swd-item)) 9%, transparent);
}
.swd-board-card[data-swd-item-color],
.swd-cal-item[data-swd-item-color] {
  border-color: color-mix(in srgb, rgb(var(--swd-item)) 45%, transparent);
  background: color-mix(in srgb, rgb(var(--swd-item)) 14%, var(--root-background-color, #fff));
}
.swd-board-card[data-swd-item-color] {
  border-left: 3px solid rgb(var(--swd-item));
}
.swd-tl-bar[data-swd-item-color] {
  border-color: color-mix(in srgb, rgb(var(--swd-item)) 70%, transparent);
  background: color-mix(in srgb, rgb(var(--swd-item)) 26%, var(--root-background-color, #fff));
}
.swd-cal-item[data-swd-item-color]:hover,
.swd-board-card[data-swd-item-color]:hover {
  background: color-mix(in srgb, rgb(var(--swd-item)) 24%, var(--root-background-color, #fff));
}
.swd-tl-bar[data-swd-item-color]:hover,
.swd-tl-bar[data-swd-item-color]:focus-visible {
  background: color-mix(in srgb, rgb(var(--swd-item)) 38%, var(--root-background-color, #fff));
}
/* A card's icon a little larger */
.swd-board-name > .swd-item-icon {
  font-size: 1.15em;
}
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
/* A person: as SilverBullet draws a mention in the page (its variables, its border and corners), not in its option's color
   (which Color by still uses); pressed where the host shows where one is mentioned. One none of the options and not taken
   keeps the dashed edge of a value none of them */
.swd-pill.swd-mention {
  padding: 0 4px;
  /* (Its edge drawn inside it, as a pill's height is a line's) */
  box-shadow: inset 0 0 0 1px var(--editor-at-mention-border-color, currentColor);
  border-radius: 6px;
  color: var(--editor-at-mention-color, inherit);
  background: var(--editor-at-mention-background-color, none);
}
.swd-pill.swd-mention[role="link"] {
  cursor: pointer;
}
.swd-pill.swd-mention.swd-pill-none {
  box-shadow: none;
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
/* A value typed besides the options (a person's with Anyone): a field under the boxes, a value added there ticked above it */
.swd-editor-add {
  margin-top: 4px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 4px;
  padding: 2px 4px;
}
/* The table */
.swd-table-box {
  overflow-x: auto;
}
.swd-table {
  /* A body cell's room above and below its text (SilverBullet's own for its tables' cells, said here so what is laid over a
     cell, a row's Open, knows where its first line is) */
  --swd-cell-pad-y: 8px;
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
/* A table grouped: one table, a part per group, each its head over the whole width, its own header row (as a table's head
   looks: SilverBullet colors `thead tr`, which a group's is not), its rows and + New; a group folded its head alone, its rows
   kept in the layout unseen (folding moves no column). The group's head and its + New on the page's ground, not striped:
   SilverBullet stripes every other row of a body (`tbody tr:nth-of-type(even)`, its colors.scss), these too; :is() weighs
   as an id */
:is(#sb-main, html) .swd-place .swd-table .swd-table-headrow {
  background-color: var(--editor-table-head-background-color);
  color: var(--editor-table-head-color);
}
:is(#sb-main, html) .swd-place .swd-table :is(.swd-table-group-head, .swd-table-group-add) {
  background-color: transparent;
}
.swd-table .swd-table-group-head > th {
  padding: 18px 0 6px;
  border-bottom: 0;
  background: none;
  color: inherit;
  text-align: left;
  font-weight: inherit;
}
.swd-table .swd-table-group:first-child > .swd-table-group-head > th {
  padding-top: 0;
}
.swd-table .swd-table-group.swd-folded > tr:not(.swd-table-group-head) {
  visibility: collapse;
}
.swd-table .swd-table-group-add > td {
  padding: 4px 0;
  border-bottom: 0;
}
/* Long text wraps, as in Notion, a cell at most --swd-cell-max-width wide (a space-style may set it on .swd-place) and at
   least a few words (a wide table in a narrow page is not squeezed to a letter a line, it scrolls sideways); the row's grip,
   its actions and a checkbox as narrow as they are. SilverBullet keeps the editor's table cells on one line
   (`#sb-main .cm-editor td { white-space: nowrap }`, its editor.scss), which reaches a block's widget: :is() weighs as an id */
:is(#sb-main, html) .swd-place .swd-table :is(th, td) {
  white-space: normal;
}
:is(#sb-main, html) .swd-place .swd-table td {
  padding-top: var(--swd-cell-pad-y);
  padding-bottom: var(--swd-cell-pad-y);
}
.swd-table th:not(.swd-table-gripcol):not(.swd-table-actions):not([data-type="checkbox"]):not([colspan]),
.swd-table td:not(.swd-table-grip):not(.swd-table-actions):not([data-type="checkbox"]):not([colspan]) {
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
.swd-table td:not(.swd-readonly):not(.swd-table-actions):not([colspan]) {
  cursor: text;
}
/* A cell being edited keeps its size: what it showed stays under the editor, hidden (table.ts), and the editor lies over
   it on its first line, adding nothing to the row's height nor the column's width; a multiple select's list of boxes
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
/* The name's cell: its Open right after the last word, the two held on one line (a touch screen's); never narrower than a few words (a phone) */
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
/* A row's Open: with a mouse a chip at the right end of the name's cell, laid over the name (as Notion's: it takes no room
   of the column), shown as the row is hovered (below): its icon (a page) alone in a narrow cell, with "Open" where the cell
   has room (its box laid over the whole cell, measured as a container: a table's cell cannot be one without losing its
   width); on a touch screen its icon alone right after the name, with room for a finger round it */
.swd-table .swd-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: -0.15em;
}
.swd-table .swd-open svg {
  width: 14px;
  height: 14px;
}
@media (hover: hover) {
  /* (As high as the cell's first line and its room above and below: the button in its middle, by the name's first line
     where the row is taller, another value wrapping) */
  .swd-table td[data-key="name"] .swd-open-room {
    position: absolute;
    inset: 0 0 auto;
    height: min(100%, calc(1lh + 2 * var(--swd-cell-pad-y)));
    container-type: inline-size;
    pointer-events: none;
  }
  @container (min-width: 10em) {
    .swd-table-name .swd-open::after {
      content: "Open";
    }
  }
  .swd-table td[data-key="name"] .swd-open {
    position: absolute;
    /* (In the middle of its box: the cell's first line) */
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    margin: 0;
    padding: 4px 8px;
    border: 1px solid var(--swd-line);
    border-radius: 6px;
    color: var(--swd-quiet);
    /* (Opaque, over the name: the page's background a little lighter, as a surface of its own) */
    background: color-mix(in srgb, var(--root-color, currentColor) 6%, var(--root-background-color, #fff));
    font-size: 0.8em;
    line-height: 1.2;
    white-space: nowrap;
    pointer-events: auto;
    opacity: 1;
    transition: background-color 0.12s, border-color 0.12s, color 0.12s;
  }
  .swd-table td[data-key="name"] .swd-open:hover,
  .swd-table td[data-key="name"] .swd-open:focus-visible {
    border-color: var(--swd-accent);
    color: var(--swd-accent);
    background: color-mix(in srgb, var(--swd-accent) 12%, var(--root-background-color, #fff));
  }
}
@media (hover: none) {
  .swd-open-room {
    display: contents;
  }
  .swd-table .swd-open {
    margin: -10px -10px -10px -2px;
    padding: 10px;
    color: var(--swd-quiet);
    opacity: 1;
  }
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
/* With a mouse, a row's Open and ✕ show only as it is hovered or has the focus (a touch screen shows them always) */
@media (hover: hover) {
  .swd-table tbody tr:not(:hover):not(:focus-within) .swd-open,
  .swd-table tbody tr:not(:hover):not(:focus-within) .swd-remove {
    opacity: 0;
  }
}
/* A board column's head: its option's pill (another property's value: its text; none: its name, quiet) and how many cards */
.swd-board-none {
  color: var(--swd-quiet);
}
.swd-board-label.swd-invalid {
  color: var(--danger-color, #c62828);
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
  cursor: pointer;
}
/* + New (a table's, a list's, a board's column's, a calendar's day): quiet until the pointer is on it, then plainly a
   button, in the accent's color */
:is(.swd-table-add, .swd-board-add, .swd-cal-agenda-add) {
  transition: background-color 0.12s, border-color 0.12s, color 0.12s;
}
:is(.swd-table-add, .swd-board-add, .swd-cal-agenda-add):hover,
:is(.swd-table-add, .swd-board-add, .swd-cal-agenda-add):focus-visible {
  opacity: 1;
  border-style: solid;
  border-color: var(--swd-accent);
  color: var(--swd-accent);
  background: color-mix(in srgb, var(--swd-accent) 10%, transparent);
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
/* The calendar: a month of days, seven columns of equal width; its head (‹ month ›, Today, the property its days are of).
   How narrow it is is the place's width, not the window's (an editor's column, a page zoomed): a container */
.swd-cal {
  container-type: inline-size;
}
.swd-cal-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-bottom: 8px;
}
.swd-cal-title {
  min-width: 9em;
  margin: 0 4px;
  font-size: 1.1em;
  font-weight: 600;
  text-align: center;
  outline: none;
}
.swd-cal-step,
.swd-cal-today {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 2px 10px;
  border: 1px solid var(--swd-line);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-cal-step {
  padding: 2px 6px;
}
.swd-cal-step svg {
  width: 16px;
  height: 16px;
}
.swd-cal-step:hover,
.swd-cal-today:hover {
  background: var(--swd-hover);
}
.swd-cal-by {
  margin-left: auto;
  color: var(--swd-quiet);
  font-size: 0.85em;
}
.swd-cal-box {
  border: 1px solid var(--swd-line);
  border-radius: 8px;
  overflow: hidden;
}
.swd-cal-weekdays,
.swd-cal-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
/* A week: a row of seven days, each over the whole row (its rows: the days' heads, the lanes of bars, the room left: set
   inline, as many lanes as it shows), the items' bars over them, each across the days it lasts */
.swd-cal-week {
  row-gap: 2px;
  min-height: 7.5em;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--swd-line);
}
.swd-cal-week:last-child {
  border-bottom: 0;
}
.swd-cal-weekdays > span {
  padding: 4px 6px;
  border-bottom: 1px solid var(--swd-line);
  color: var(--swd-quiet);
  font-size: 0.8em;
  text-align: center;
}
/* A day: its number and + at its top, the week's bars over the rest of it */
.swd-cal-day {
  grid-row: 1 / -1;
  min-width: 0;
  margin-bottom: -4px;
  padding: 4px;
  transition: background 0.1s;
}
.swd-cal-day + .swd-cal-day {
  border-left: 1px solid var(--swd-line);
}
.swd-cal-weekend {
  background: var(--swd-surface);
}
.swd-cal-other > .swd-cal-day-head .swd-cal-date {
  opacity: 0.45;
}
.swd-cal-day.swd-drop {
  background: color-mix(in srgb, var(--swd-accent) 14%, transparent);
  outline: 2px dashed var(--swd-accent);
  outline-offset: -3px;
}
.swd-cal-day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}
.swd-cal-date {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border-radius: 12px;
  font-size: 0.85em;
}
/* Today: its number on the accent */
.swd-cal-now .swd-cal-date {
  color: var(--root-background-color, #fff);
  background: var(--swd-accent);
  font-weight: 600;
}
/* A day's +: shown as the day is hovered or its + focused; always on a touch screen, where nothing is hovered */
.swd-cal-add {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
}
.swd-cal-day:hover .swd-cal-add,
.swd-cal-add:focus-visible {
  opacity: 1;
}
.swd-cal-add:hover {
  color: inherit;
  background: var(--swd-hover);
}
@media (hover: none) {
  .swd-cal-add {
    opacity: 0.6;
  }
}
/* An item: its time, then its name, as one text on two lines at most, cut where it does not fit (its whole name its title) */
.swd-cal-item {
  position: relative;
  display: block;
  flex: none;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--swd-line);
  border-radius: 5px;
  color: inherit;
  background: var(--root-background-color, transparent);
  font: inherit;
  font-size: 0.85em;
  text-align: left;
  cursor: pointer;
}
.swd-cal-item[draggable="true"] {
  cursor: grab;
}
.swd-cal-item:hover {
  background: var(--swd-hover);
}
.swd-cal-dragged {
  opacity: 0.4;
}
/* A bar across days in a week, over the days; one going on before or after the week its square end at that edge */
.swd-cal-week > .swd-cal-item {
  z-index: 1;
  align-self: start;
  margin: 0 4px;
}
.swd-cal-week > .swd-cal-before {
  margin-left: 0;
  border-left-style: dashed;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.swd-cal-week > .swd-cal-after {
  margin-right: 0;
  border-right-style: dashed;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
/* A bar's ends: dragged to change its start or its end (shown as it is hovered) */
.swd-cal-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: ew-resize;
}
.swd-cal-handle-start {
  left: -1px;
  border-radius: 5px 0 0 5px;
}
.swd-cal-handle-end {
  right: -1px;
  border-radius: 0 5px 5px 0;
}
.swd-cal-item:hover > .swd-cal-handle {
  background: color-mix(in srgb, var(--swd-accent) 45%, transparent);
}
.swd-cal-week > .swd-cal-more {
  z-index: 1;
  justify-self: start;
  margin-left: 4px;
}
.swd-cal-days {
  color: var(--swd-quiet);
  font-size: 0.9em;
}
/* The properties a calendar shows (Visible properties in ⋯): a line each under the item's name, quiet, cut where long */
.swd-cal-value {
  display: block;
  overflow: hidden;
  color: var(--swd-quiet);
  font-size: 0.9em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swd-cal-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  white-space: normal;
  /* (A word broken only where it is longer than a line: else it goes whole to the next; SilverBullet's editor breaks words
     anywhere, and lines after any white space, which its lines inherit) */
  overflow-wrap: break-word;
  word-break: normal;
  line-break: auto;
}
.swd-cal-time {
  color: var(--swd-quiet);
  font-variant-numeric: tabular-nums;
}
/* The day picked: its items whole under the month (on a phone how they are reached) */

.swd-cal-agenda {
  display: none;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid var(--swd-line);
  border-radius: 8px;
}
.swd-cal-agenda.swd-drop {
  outline: 2px dashed var(--swd-accent);
  outline-offset: -3px;
}
.swd-cal-agenda-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}
.swd-cal-agenda-add {
  padding: 2px 8px;
  border: 1px dashed var(--swd-line);
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-weight: normal;
  cursor: pointer;
}
.swd-cal-agenda-none {
  margin: 0;
  color: var(--swd-quiet);
  font-size: 0.9em;
}
.swd-cal-agenda > .swd-cal-item {
  padding: 6px 8px;
  font-size: 0.95em;
}
.swd-cal-more {
  align-self: flex-start;
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.8em;
  cursor: pointer;
}
.swd-cal-more:hover {
  color: inherit;
  background: var(--swd-hover);
}
/* The items without a date: over the month, near every day they are dragged onto; a few rows at most, scrolled beyond */
.swd-cal-undated {
  margin-bottom: 8px;
}
.swd-cal-undated-label {
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.85em;
  cursor: pointer;
}
.swd-cal-undated-label::before {
  content: "▾ ";
}
.swd-cal-undated.swd-folded .swd-cal-undated-label::before {
  content: "▸ ";
}
.swd-cal-undated-label:hover {
  color: inherit;
  background: var(--swd-hover);
}
.swd-cal-undated-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 5.5em;
  margin-top: 4px;
  overflow-y: auto;
}
.swd-cal-undated-items > .swd-cal-item {
  max-width: 16em;
}
/* A phone, a narrow page: a day's items as marks (their names too narrow to read, their buttons too small to press: a
   press on the day picks it), its + and +N more left to the day's list under the month, which shows */
@container (max-width: 600px) {
  .swd-cal-week {
    min-height: 3.6em;
  }
  .swd-cal-day {
    padding: 2px;
    cursor: pointer;
  }
  .swd-cal-week > .swd-cal-item {
    margin: 0 2px;
  }
  .swd-cal-grid .swd-cal-item {
    height: 5px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: var(--swd-accent);
    pointer-events: none;
  }
  .swd-cal-grid .swd-cal-item > * {
    display: none;
  }
  .swd-cal-grid .swd-cal-item[data-swd-item-color] {
    background: rgb(var(--swd-item));
  }
  .swd-cal-grid :is(.swd-cal-add, .swd-cal-more) {
    display: none;
  }
  /* (A week opened whole where the calendar was wide: closed again here too) */
  .swd-cal-grid .swd-cal-fewer {
    display: block;
    justify-self: center;
  }
  .swd-cal-agenda {
    display: flex;
  }
  .swd-cal-picked {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--swd-accent) 55%, transparent);
  }
  .swd-cal-by {
    flex-basis: 100%;
    margin-left: 0;
  }
}
/* The timeline: a row an item, its name on the left (kept in view as the axis scrolls sideways: sticky), its bar on an axis
   of days; its head (Today, the scale, what the bars are of). Its width the place's: a container. The names' width in
   pixels: the same for every element using it, whatever its font size */
.swd-tl {
  container-type: inline-size;
  --swd-tl-names: 190px;
  --swd-tl-row: 34px;
}
.swd-tl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-bottom: 8px;
}
.swd-tl-today,
.swd-tl-scale {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 2px 10px;
  border: 1px solid var(--swd-line);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-tl-scales {
  display: inline-flex;
}
.swd-tl-scale {
  border-radius: 0;
}
.swd-tl-scale + .swd-tl-scale {
  margin-left: -1px;
}
.swd-tl-scale:first-child {
  border-radius: 6px 0 0 6px;
}
.swd-tl-scale:last-child {
  border-radius: 0 6px 6px 0;
}
.swd-tl-scale[aria-pressed="true"] {
  position: relative;
  border-color: var(--swd-accent);
  color: var(--swd-accent);
  background: color-mix(in srgb, var(--swd-accent) 12%, transparent);
}
.swd-tl-today:hover,
.swd-tl-scale:hover {
  background: var(--swd-hover);
}
.swd-tl-by {
  margin-left: auto;
  color: var(--swd-quiet);
  font-size: 0.85em;
}
/* (A stacking context of its own: its names, bars and today's line over each other, not over what is around it) */
.swd-tl-box {
  position: relative;
  isolation: isolate;
  overflow-x: auto;
  border: 1px solid var(--swd-line);
  border-radius: 8px;
}
.swd-tl-axis-row,
.swd-tl-row {
  display: flex;
  width: max-content;
}
/* The names' column: over the bars scrolled under it */
.swd-tl-corner,
.swd-tl-name {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  box-sizing: border-box;
  width: var(--swd-tl-names);
  border-right: 1px solid var(--swd-line);
  background: var(--root-background-color, #fff);
}
.swd-tl-corner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  padding: 4px 4px 4px 8px;
  border-bottom: 1px solid var(--swd-line);
  color: var(--swd-quiet);
  font-size: 0.8em;
}
.swd-tl-axis {
  flex: none;
  border-bottom: 1px solid var(--swd-line);
}
.swd-tl-months,
.swd-tl-units {
  position: relative;
  height: 22px;
}
.swd-tl-month,
.swd-tl-unit {
  position: absolute;
  top: 0;
  bottom: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 2px 6px;
  border-left: 1px solid var(--swd-line);
  font-size: 0.8em;
  white-space: nowrap;
}
.swd-tl-month {
  /* (Its name cut at the month's edge, never over the next month's: a clip, not overflow, which would end its stickiness;
     the browser places a sticky name anew only once the box scrolls, so drawn scrolled it may start past its place) */
  overflow: visible;
  clip-path: inset(0);
  font-weight: 600;
}
/* A month's name kept in view right of the names while the month is (sticky within its head) */
.swd-tl-month > span {
  position: sticky;
  left: calc(var(--swd-tl-names) + 6px);
}
.swd-tl-unit {
  padding: 2px 0;
  color: var(--swd-quiet);
  text-align: center;
}
.swd-tl-unit.swd-tl-weekend {
  background: color-mix(in srgb, var(--root-color, currentColor) 3%, transparent);
}
.swd-tl-unit.swd-tl-now {
  color: var(--root-background-color, #fff);
  background: var(--swd-accent);
  font-weight: 600;
}
/* The rows: today's line and the weekends (Days) or the weeks' starts (Weeks) each row's background, under its bar; the
   weekends quiet, as the axis' heads show them */
.swd-tl-rows {
  --swd-tl-quiet: color-mix(in srgb, var(--root-color, currentColor) 3%, transparent);
  --swd-tl-today: linear-gradient(
    to right,
    transparent calc(var(--swd-tl-now) - 1px),
    color-mix(in srgb, var(--swd-accent) 70%, transparent) calc(var(--swd-tl-now) - 1px) calc(var(--swd-tl-now) + 1px),
    transparent calc(var(--swd-tl-now) + 1px)
  );
}
.swd-tl-rows .swd-tl-track {
  background-image: var(--swd-tl-today), var(--swd-tl-rule);
}
.swd-tl-by-days .swd-tl-track {
  background-image:
    var(--swd-tl-today),
    var(--swd-tl-rule),
    repeating-linear-gradient(to right, transparent 0 calc(5 * var(--swd-tl-day)), var(--swd-tl-quiet) calc(5 * var(--swd-tl-day)) calc(7 * var(--swd-tl-day)));
}
.swd-tl-by-weeks .swd-tl-track {
  background-image:
    var(--swd-tl-today),
    var(--swd-tl-rule),
    repeating-linear-gradient(to right, var(--swd-line) 0 1px, transparent 1px calc(7 * var(--swd-tl-day)));
}
/* A row's line under it: its name's border, and in its track a background under today's line (a border of the row cut
   that line into a piece a row); every row of one height, the names shown or folded to a strip */
.swd-tl-row {
  --swd-tl-rule: linear-gradient(to top, var(--swd-line) 1px, transparent 1px);
  height: calc(var(--swd-tl-row) + 1px);
}
.swd-tl-row > :first-child {
  height: 100%;
  border-bottom: 1px solid var(--swd-line);
}
.swd-tl-row:last-child {
  --swd-tl-rule: linear-gradient(transparent, transparent);
}
.swd-tl-row:last-child > :first-child {
  border-bottom: 0;
}
.swd-tl-name {
  overflow: hidden;
  padding: 0 8px;
  border-radius: 0;
  border-top: 0;
  border-bottom: 0;
  border-left: 0;
  color: inherit;
  font: inherit;
  font-size: 0.9em;
  line-height: var(--swd-tl-row);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.swd-tl-name[data-swd-item-color] {
  box-shadow: inset 3px 0 0 rgb(var(--swd-item));
  background: color-mix(in srgb, rgb(var(--swd-item)) 9%, var(--root-background-color, #fff));
}
.swd-tl-name:hover {
  background: color-mix(in srgb, var(--root-color, #000) 5%, var(--root-background-color, #fff));
}
.swd-tl-track {
  position: relative;
  flex: none;
  height: 100%;
}
/* A row without a start: a press there gives it that day */
.swd-tl-empty {
  cursor: copy;
}
.swd-tl-empty:hover {
  background-color: color-mix(in srgb, var(--swd-accent) 4%, transparent);
}
/* The names' column folded to a strip (the corner's button, kept per browser; folded where the place is narrow): the items'
   icons alone, their names their titles (the bars name them), a group's title over its row, a row without a bar naming its
   item in what it says */
.swd-tl-fold {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: var(--swd-quiet);
  background: none;
  cursor: pointer;
}
.swd-tl-fold svg {
  width: 14px;
  height: 14px;
}
.swd-tl-fold:hover,
.swd-tl-fold:focus-visible {
  color: inherit;
  background: var(--swd-hover);
}
.swd-tl-folded .swd-tl-box {
  --swd-tl-names: 40px;
}
.swd-tl-folded .swd-tl-corner {
  justify-content: center;
  padding: 4px 0;
}
.swd-tl-folded :is(.swd-tl-count, .swd-tl-name-text) {
  display: none;
}
.swd-tl-name-initial {
  display: none;
}
.swd-tl-folded .swd-tl-name-initial {
  display: inline;
  color: var(--swd-quiet);
  font-size: 0.72em;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.swd-tl-folded .swd-tl-name {
  padding: 0;
  text-align: center;
}
.swd-tl-folded .swd-tl-name > .swd-item-icon {
  margin: 0;
}
.swd-tl-folded .swd-tl-group-cell {
  overflow: visible;
}
.swd-tl-folded .swd-tl-group-cell .swd-group-head {
  flex: none;
}
.swd-tl-folded .swd-tl-group-cell .swd-group-label {
  overflow: visible;
}
.swd-tl-hint-name {
  display: none;
}
.swd-tl-folded .swd-tl-hint-name {
  display: inline;
  color: var(--root-color, inherit);
  font-style: normal;
}
/* A group's head (views/groups.ts): its title in the names' column, held there as the axis scrolls, a quiet ground; the
   axis' days and today go on through it */
.swd-tl-group {
  background: var(--swd-surface);
}
.swd-tl-group-cell {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: var(--swd-tl-names);
  padding: 0 4px;
  border-right: 1px solid var(--swd-line);
  /* (Over the bars scrolled under it: never see-through, whatever the page's ground) */
  background: linear-gradient(var(--swd-surface), var(--swd-surface)), var(--root-background-color, #fff);
  overflow: hidden;
  white-space: nowrap;
}
.swd-tl-none {
  margin: 0;
  padding: 12px;
  color: var(--swd-quiet);
  font-size: 0.9em;
}
.swd-tl-group-cell .swd-group-head {
  min-width: 0;
}
.swd-tl-group-cell .swd-group-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.swd-tl-group-track {
  height: 30px;
}
/* What a row without a bar says, held in view right of the names as the axis scrolls */
.swd-tl-hint {
  position: sticky;
  left: calc(var(--swd-tl-names) + 8px);
  display: inline-block;
  padding: 0 8px;
  color: var(--swd-quiet);
  font-size: 0.8em;
  font-style: italic;
  line-height: var(--swd-tl-row);
  white-space: nowrap;
  pointer-events: none;
}
.swd-tl-hint.swd-invalid {
  border: 0;
  color: var(--danger-color, #c62828);
}
/* The day a press gives: a bar of one day, dashed, under the pointer */
.swd-tl-ghost {
  position: absolute;
  top: 5px;
  bottom: 5px;
  box-sizing: border-box;
  border: 1px dashed var(--swd-accent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--swd-accent) 12%, transparent);
  pointer-events: none;
}
.swd-tl-ghost[hidden] {
  display: none;
}
/* A bar: its name in it (seen past its end where it is short: the bar's own overflow shown) */
.swd-tl-bar {
  position: absolute;
  top: 5px;
  bottom: 6px;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-width: 6px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--swd-accent) 60%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--swd-accent) 20%, var(--root-background-color, #fff));
  font-size: 0.85em;
  white-space: nowrap;
  cursor: pointer;
  /* (A finger's move scrolls the timeline, either way, until it is held on a bar: timeline.ts takes it then) */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.swd-tl-bar.swd-tl-movable {
  cursor: grab;
}
.swd-tl-bar:hover,
.swd-tl-bar:focus-visible {
  background: color-mix(in srgb, var(--swd-accent) 32%, var(--root-background-color, #fff));
}
.swd-tl-bar.swd-invalid {
  border-style: dashed;
}
/* A bar going on past the axis' reach: its ends dashed */
.swd-tl-bar.swd-tl-beyond {
  border-left-style: dashed;
  border-right-style: dashed;
}
.swd-tl-dragging {
  z-index: 2;
  cursor: grabbing;
  box-shadow: 0 2px 8px rgb(0 0 0 / 20%);
}
.swd-tl-bar-text {
  overflow: visible;
  pointer-events: none;
}
/* The properties a timeline shows (Visible properties in ⋯): after its bar on its row, part of the bar so they go with it as
   it is dragged; quiet, on one line, taking no press. As wide as the axis leaves after the bar (set inline), cut past it:
   else they would widen the box past its days; none while the bar is dragged (a bar dragged past the axis widens it, so it
   scrolls on, its values not) */
.swd-tl-dragging .swd-tl-values {
  display: none;
}
.swd-tl-values {
  position: absolute;
  top: 50%;
  left: calc(100% + 8px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--swd-quiet);
  font-size: 0.85em;
  overflow: hidden;
  white-space: nowrap;
  transform: translateY(-50%);
  pointer-events: none;
}
.swd-tl-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* Its ends: dragged to change its start or its end (shown as it is hovered; on a touch screen always) */
.swd-tl-handle {
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 8px;
  cursor: ew-resize;
}
.swd-tl-handle-start {
  left: -1px;
  border-radius: 5px 0 0 5px;
}
.swd-tl-handle-end {
  right: -1px;
  border-radius: 0 5px 5px 0;
}
.swd-tl-bar:hover > .swd-tl-handle {
  background: color-mix(in srgb, var(--swd-accent) 55%, transparent);
}
@media (hover: none) {
  .swd-tl-handle {
    width: 10px;
    background: color-mix(in srgb, var(--swd-accent) 35%, transparent);
  }
}
/* A narrow place: the names' column narrower */
@container (max-width: 600px) {
  .swd-tl-box {
    --swd-tl-names: 110px;
  }
  .swd-tl-by {
    flex-basis: 100%;
    margin-left: 0;
  }
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
/* Deleting a database (core/deletedatabase.ts): what goes, its name typed, Delete in the danger color */
.swd-settings.swd-delete-database {
  width: min(520px, calc(100vw - 32px));
  height: auto;
}
.swd-delete-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.swd-delete-status:empty {
  display: none;
}
.swd-delete-status {
  margin: 0;
  color: var(--swd-quiet);
}
.swd-delete-status.swd-delete-problem {
  color: var(--danger-color, #c62828);
}
.swd-delete-lines {
  margin: 0;
  padding-left: 20px;
}
.swd-delete-lines li + li {
  margin-top: 4px;
}
.swd-delete-ask {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swd-delete-ask[hidden] {
  display: none;
}
.swd-delete-name {
  padding: 6px 8px;
  border: 1px solid var(--swd-settings-line);
  border-radius: 6px;
  color: inherit;
  background: var(--root-background-color);
  font: inherit;
}
.swd-settings-save.swd-delete-confirm {
  background: var(--danger-color, #c62828);
  border-color: var(--danger-color, #c62828);
}
/* The dialog of a write changed since it was shown (core/conflictdialog.ts): the lines writing it would change on each
   page, as Silverware Tags' review shows them (shared/diffview.ts: swd-diff-*) */
/* (Of the dialogs' one height, its body scrolling: as many items and pages as the conflict has, the dialog stays) */
.swd-settings.swd-conflict {
  width: min(760px, calc(100vw - 32px));
}
/* (Their buttons at the right of their foot, as the settings' are with a note beside them) */
.swd-settings:is(.swd-conflict, .swd-delete-database) .swd-settings-foot {
  justify-content: flex-end;
}
.swd-conflict-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}
.swd-conflict-section {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.swd-conflict-note {
  margin: 0;
  color: var(--swd-quiet);
}
.swd-conflict-document + .swd-conflict-document {
  margin-top: 8px;
}
.swd-conflict-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.swd-conflict-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.swd-conflict-open {
  margin-left: auto;
  text-decoration: none;
  padding: 2px 8px;
  border: 1px solid var(--swd-settings-line);
  border-radius: 6px;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
/* <shared-diff> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* A document's change as a review shows it (shared/diffview.ts): its runs of lines, each its first line's number, the
   lines removed and added */
.swd-diff {
  padding: 4px 10px 8px;
  font: 12px/1.5 var(--editor-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}
.swd-diff-run + .swd-diff-run {
  margin-top: 6px;
}
.swd-diff-line-number {
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 11px;
  opacity: 0.55;
}
.swd-diff-removed,
.swd-diff-added {
  padding: 0 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 3px;
}
.swd-diff-removed {
  background: color-mix(in srgb, var(--danger-color, #c62828) 14%, transparent);
}
.swd-diff-removed::before {
  content: "− ";
  opacity: 0.6;
}
.swd-diff-added {
  background: color-mix(in srgb, #2e9e4f 16%, transparent);
}
.swd-diff-added::before {
  content: "+ ";
  opacity: 0.6;
}
/* </shared-diff> */
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
  /* (Positioned: a picker of a property's, its icon's, opens in it under its button, past the list's clipped edge) */
  position: relative;
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
/* What the draft does to a property, after its name in the list until Save: Changed, New, Removed (its name struck) */
.swd-prop-mark {
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 4px;
  color: var(--swd-accent);
  background: color-mix(in srgb, var(--swd-accent) 12%, transparent);
  font-size: 0.75em;
  line-height: 1.6;
}
.swd-prop-mark-removed {
  color: var(--danger-color, #c62828);
  background: color-mix(in srgb, var(--danger-color, #c62828) 12%, transparent);
}
.swd-prop-removed .swd-prop-name,
.swd-prop-removed .swd-prop-type {
  text-decoration: line-through;
  opacity: 0.6;
}
/* Save, nothing changed: nothing to write */
.swd-properties-save:disabled {
  opacity: 0.45;
  cursor: default;
}
/* A property required: a * after its name in the list */
.swd-prop-required {
  margin-left: 3px;
  color: var(--danger-color, #c62828);
  font-weight: 600;
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
/* A property's own icon (an emoji) where its type's would be: as large as that, centered in its place */
.swd-prop-own-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
}
/* Its icon's field in its details: what is shown, and the way to change it */
.swd-property-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-self: start;
  padding: 4px 10px;
  border: 1px solid var(--swd-line);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-property-icon:hover,
.swd-property-icon[aria-expanded="true"] {
  background: var(--swd-hover);
}
.swd-property-icon-shown svg {
  width: 16px;
  height: 16px;
}
.swd-property-icon-text {
  color: var(--swd-quiet);
  font-size: 0.9em;
}
/* A table's header: a property's own icon before its name */
.swd-table-head-icon {
  margin-right: 0.35em;
  font-weight: normal;
}
/* A link (URL): opened in a tab of its own; its address without what says nothing, its path a little quieter */
.swd-link {
  color: var(--link-color, var(--swd-accent));
  text-decoration: none;
  overflow-wrap: anywhere;
}
.swd-link:hover {
  text-decoration: underline;
}
.swd-link-rest {
  opacity: 0.7;
}
/* A property's name before its value where the value stands alone (Name in views): quieter than the value */
.swd-field-name {
  margin-right: 4px;
  color: var(--swd-quiet);
}
/* A reference: a link to a page of the space, opened by a press, side by side with the others */
.swd-reference {
  margin-right: 6px;
  color: var(--link-color, var(--swd-accent));
  text-decoration: none;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.swd-reference:hover {
  text-decoration: underline;
}
.swd-reference-folder {
  opacity: 0.7;
}
/* References' editor: a search over the pages, the pages picked then those found, a box each; the list scrolls */
.swd-editor-documents {
  min-width: 16em;
  max-width: min(28em, 90vw);
}
.swd-editor-search {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 4px;
}
.swd-editor-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 16em;
  overflow-y: auto;
}
/* A document's row: its box and name (the label), its folder icon after them, its folder under its name */
.swd-editor-documents .swd-editor-choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 6px;
  align-items: start;
  padding: 2px 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.swd-editor-pick {
  display: contents;
}
.swd-editor-pick > input {
  margin-top: 0.25em;
}
.swd-editor-document-folder {
  grid-column: 2;
  justify-self: start;
  color: var(--swd-quiet);
  font-size: 0.8em;
}
.swd-editor-document-into {
  grid-column: 3;
  grid-row: 1;
}
/* A document's folder and its icon: each puts its path in the search (a new document made there), quiet until hovered */
button.swd-editor-document-folder,
.swd-editor-document-into {
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
button.swd-editor-document-folder {
  font-size: 0.8em;
  color: var(--swd-quiet);
}
.swd-editor-document-into {
  display: inline-flex;
  color: var(--swd-quiet);
  opacity: 0.5;
}
.swd-editor-document-into svg {
  width: 14px;
  height: 14px;
}
.swd-editor-choice:hover .swd-editor-document-into {
  opacity: 1;
}
button.swd-editor-document-folder:hover,
.swd-editor-document-into:hover {
  color: var(--swd-accent);
  background: var(--swd-hover);
}
.swd-editor-note {
  padding: 2px 4px;
  color: var(--swd-quiet);
  font-size: 0.9em;
}
.swd-editor-new {
  color: var(--swd-quiet);
  font-style: italic;
}
/* A link's editor: its address and its text, one under the other */
.swd-editor-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.swd-editor-link input {
  width: 100%;
  box-sizing: border-box;
}
/* A share done (Task progress): a short bar filled to it, before its percent */
.swd-progress {
  display: inline-block;
  width: 3em;
  height: 0.45em;
  margin-right: 0.4em;
  vertical-align: middle;
  border-radius: 999px;
  background: var(--swd-line);
  overflow: hidden;
}
.swd-progress-done {
  display: block;
  height: 100%;
  background: var(--swd-accent);
}
/* A system property's details: what gives its values, in place of its type and settings */
.swd-prop-system {
  margin: 0;
  color: var(--swd-quiet);
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
/* A setting turned by a switch (Required, Name in views, Locked in views): its name and hint across the width, the switch
   at the right, on a phone too (in the names' narrow column the hint broke every few words) */
.swd-prop-field.swd-prop-switch-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}
.swd-prop-switch-row .swd-prop-field-name {
  gap: 2px;
}
/* A property removed in the draft: whether its values go too, its label and hint across the width, its switch at the right,
   on a phone too */
.swd-prop-field.swd-property-values-off {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  padding: 0 4px;
}
.swd-property-values-off .swd-prop-field-name {
  gap: 2px;
  color: inherit;
  font-size: 1em;
}
.swd-property-values-off .swd-prop-field-name .swd-settings-hint {
  color: var(--swd-quiet);
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

/* A property added: its name, its type, Add, one line under the list */
.swd-property-adder {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swd-property-adder-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* Values outside the database: the way to them (a quiet link), and their screen, each key a row */
.swd-property-loose-open {
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.9em;
  text-decoration: underline dotted;
  cursor: pointer;
}
.swd-property-loose-open:hover {
  color: inherit;
}
.swd-loose {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.swd-loose-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.swd-loose-back {
  display: inline-flex;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: none;
  cursor: pointer;
}
.swd-loose-back:hover {
  background: var(--swd-hover);
}
.swd-loose-back svg {
  width: 16px;
  height: 16px;
}
.swd-loose-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.swd-loose-row {
  display: grid;
  grid-template-columns: minmax(8em, 1fr) minmax(0, 1.4fr) auto;
  gap: 4px 10px;
  align-items: center;
  padding: 6px 4px;
  border-bottom: 1px solid var(--swd-line);
}
.swd-loose-key {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.swd-loose-key code {
  overflow-wrap: anywhere;
}
.swd-loose-count,
.swd-loose-samples,
.swd-loose-reading,
.swd-loose-none {
  color: var(--swd-quiet);
  font-size: 0.9em;
}
.swd-loose-samples {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swd-loose-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.swd-loose-remove {
  color: var(--danger-color, #c62828);
}
@media (max-width: 600px) {
  .swd-loose-row {
    grid-template-columns: 1fr;
  }
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
/* A change shown before it is written: its summary, Back and Apply */
.swd-property-review-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
/* The item's icon and color over its name (modules/peek/look.ts): the icon large, a quiet button to add one where none,
   shown while the panel is hovered or a button of its focused; the color its swatch and name */
.swd-peek-look {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
}
.swd-peek-icon,
.swd-peek-color {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swd-peek-icon:hover,
.swd-peek-color:hover,
.swd-peek-icon[aria-expanded="true"],
.swd-peek-color[aria-expanded="true"] {
  background: var(--swd-hover);
}
.swd-peek-icon > .swd-item-icon {
  margin: 0;
  font-size: 2.2em;
}
.swd-peek-icon-none,
.swd-peek-color-none {
  color: var(--swd-quiet);
  font-size: 0.85em;
  opacity: 0;
  transition: opacity 0.1s;
}
.swd-peek:hover :is(.swd-peek-icon-none, .swd-peek-color-none),
.swd-peek-look:focus-within :is(.swd-peek-icon-none, .swd-peek-color-none),
:is(.swd-peek-icon-none, .swd-peek-color-none)[aria-expanded="true"] {
  opacity: 1;
}
@media (hover: none) {
  .swd-peek-icon-none,
  .swd-peek-color-none {
    opacity: 0.8;
  }
}
.swd-peek-color:not(.swd-peek-color-none) {
  font-size: 0.85em;
}
/* A color's swatch: its color, none a dashed ring */
.swd-peek-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1px dashed var(--swd-quiet);
}
.swd-peek-swatch[data-swd-item-color] {
  border: 0;
  background: rgb(var(--swd-item));
}
/* A picker under its button, over the panel's content */
.swd-pop {
  position: absolute;
  z-index: 5;
  display: flex;
  flex-direction: column;
  width: 340px;
  max-width: calc(100% - 16px);
  border: 1px solid var(--swd-line);
  border-radius: 8px;
  background: var(--root-background-color);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 14px;
}
.swd-pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 0;
}
.swd-pop-title {
  color: var(--swd-quiet);
  font-size: 0.85em;
  font-weight: 600;
}
.swd-pop-remove {
  padding: 2px 8px;
  border: 0;
  border-radius: 6px;
  color: var(--swd-quiet);
  background: none;
  font: inherit;
  font-size: 0.85em;
  cursor: pointer;
}
.swd-pop-remove:hover {
  color: inherit;
  background: var(--swd-hover);
}
.swd-pop-emoji {
  display: flex;
  flex-direction: column;
}
.swd-peek-pop-colors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 10px 10px;
}
.swd-peek-pop-color {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
.swd-peek-pop-color > .swd-peek-swatch {
  width: 20px;
  height: 20px;
}
.swd-peek-pop-color:hover,
.swd-peek-pop-color[aria-pressed="true"] {
  background: var(--swd-hover);
}
.swd-peek-pop-color[aria-pressed="true"] {
  box-shadow: inset 0 0 0 2px var(--swd-accent);
}
.swd-peek-pop-own {
  width: 30px;
  height: 30px;
  padding: 2px;
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
/* Its controls and the item's name: held at its top as the panel scrolls (its top padding above them) */
.swd-peek-top {
  position: sticky;
  top: -10px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: -10px;
  padding-top: 10px;
  padding-bottom: 4px;
  background: var(--root-background-color);
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
  /* (Open a link, to its page: a button's look, no underline) */
  text-decoration: none;
  cursor: pointer;
}
.swd-peek-button:hover {
  color: inherit;
  background: var(--swd-hover);
}
/* Remove: in the danger color as the pointer is on it (it takes the item away, Undo bringing it back) */
.swd-peek-remove:hover,
.swd-peek-remove:focus-visible {
  color: var(--danger-color, #c62828);
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
/* The properties' box: past this height it scrolls on its own, the content under it always in view (the room left of its
   rows, where their grips show, kept inside it: a box that scrolls clips what is outside it) */
.swd-peek-props-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: none;
  max-height: var(--swd-peek-properties-max-height, 45vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-left: -18px;
  padding-left: 18px;
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
/* Its name cut with an ellipsis, so the marks after it (*, hidden) stay in view */
.swd-peek-label-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* A property the view the peek was opened from hides: its name fainter, an eye struck through after it (its title names
   the view); the value as any other's, edited the same */
.swd-peek-hidden .swd-peek-label {
  opacity: 0.6;
}
.swd-peek-hidden button.swd-peek-label:hover,
.swd-peek-hidden button.swd-peek-label:focus-visible {
  opacity: 1;
}
.swd-peek-hidden-mark {
  display: inline-flex;
  flex: none;
}
.swd-peek-hidden-mark svg {
  width: 13px;
  height: 13px;
}
.swd-peek-type svg {
  width: 15px;
  height: 15px;
}
.swd-peek-value {
  position: relative;
  min-width: 0;
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
/* The pencil after a link: edits it, the link taking its own press; quiet until the value is hovered. The link
   narrowed to keep it on its line, however long */
.swd-peek-value > .swd-link {
  flex: 0 1 auto;
  min-width: 0;
}
.swd-peek-edit {
  display: inline-flex;
  flex: none;
  margin-left: auto;
  padding: 4px;
  border-radius: 4px;
  color: var(--swd-quiet);
  opacity: 0.6;
}
.swd-peek-edit svg {
  width: 14px;
  height: 14px;
}
.swd-peek-value:hover .swd-peek-edit {
  opacity: 1;
}
.swd-peek-edit:hover {
  background: color-mix(in srgb, currentColor 12%, transparent);
  color: var(--swd-accent);
}
/* An editor of choices in the peek (a select's boxes, references, a link's fields): in its row, not over it (a panel over
   the properties' box was cut by its edge), as narrow as the row is (a phone's), framed as a field rather than lifted */
.swd-peek-value > .swd-editor-choices {
  position: static;
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 2px 0;
  box-shadow: none;
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
}
.swd-peek-value > .swd-editor:not(.swd-editor-choices) {
  width: 100%;
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
