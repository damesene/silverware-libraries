---
tags: meta
---
# Silverware Assets style

The look of [Silverware Assets](silverware-assets.md): a file's frame, card, menu, side panel and enlarged view, a link's icon, the settings window. It is installed with the library.

```space-style
/* Silverware Assets (prefix swa-): its classes and attributes under swa- (data-swa-…). The width of a file laid out by
   Silverware Layout's handle is Layout's (its marks on the frame, its rules). */
/* SilverBullet showing the markdown as written (Editor: Toggle Markdown Syntax Rendering): the embedded files it still
   draws there hidden, their markdown alone shown; the host's box round each too (an empty one is a line's height). A
   file in markdown rendered outside the editor (a grid's cell, in a frame of Silverware Assets' own) is its drawer's */
:root[data-swa-syntax-shown] [data-swa-asset]:not(.swa-frame),
:root[data-swa-syntax-shown] :has(> [data-swa-asset]:not(.swa-frame)) {
  display: none !important;
}
/* There, a click on a link placing the cursor alone: the text's pointer over it, not a hand (a widget's own, its
   buttons, kept) */
:root[data-swa-syntax-clicks] [data-swa-text] :not([contenteditable="false"], [contenteditable="false"] *) {
  cursor: text !important;
}
/* A file's "…" button, at its frame's top right as the pointer is over it (always on a touch screen), its menu
   under it */
.swa-more {
  position: absolute;
  top: 4px;
  right: 4px;
  /* (A step up: over another control at the same corner, a grid's cell's "…") */
  z-index: calc(var(--sw-layer-control) + 1);
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
[data-swa-asset]:hover > .swa-more,
.swa-more:focus-visible,
.swa-more[aria-expanded="true"] {
  opacity: 1;
}
@media (hover: none) {
  .swa-more {
    opacity: 0.8;
  }
}
/* The box of a popup menu (shared/popupmenu.ts), over the page */
.swa-popup {
  position: fixed;
  z-index: var(--sw-layer-menu);
}
/* The box of Silverware Assets' menus (the shared menu's look is its template's, below) */
.swa-menu {
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
/* The Media tab of the settings window: All files' fields in rows, then a row per type (its icon and name, how
   it is shown, its click, its Shift+click) */
.swa-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.swa-settings-all {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 12px;
  align-items: center;
}
.swa-settings-heading {
  grid-column: 1 / -1;
  font-weight: 600;
}
.swa-settings-field {
  display: contents;
}
.swa-settings-checks {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
}
.swa-settings-check {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swa-settings-types {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.swa-settings-type {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) repeat(3, minmax(0, 1fr));
  gap: 6px;
  align-items: center;
}
.swa-settings-type-head {
  font-size: 0.85em;
  opacity: 0.7;
}
.swa-settings-type-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.swa-settings-type-name .swa-icon {
  width: 16px;
  height: 16px;
}
.swa-settings-select {
  min-width: 0;
  font: inherit;
}
.swa-settings-unit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.swa-settings-number {
  width: 6em;
  font: inherit;
}
/* Embedded media (docs/silverware-assets.md), marked by Silverware Assets on the host's frame of each
   (data-swa-asset: its type, data-swa-view: icon, preview or embed): the host's own drawing hidden where Silverware
   Assets draws instead; a preview of the host's drawing kept small; a card; the mark of a render that failed */
.swa-native-hidden {
  display: none !important;
}
[data-swa-view="preview"] :is(img, video, object):not(.swa-icon img, .swa-pdf) {
  max-height: var(--swa-height, 160px);
  max-width: 100%;
  width: auto !important;
  object-fit: contain;
  cursor: pointer;
}
/* The frame as wide as what is shown in it, without the host's border round a widget: its "…" at the medium's corner,
   not the page's (a card's at the text's right). A PDF's viewer, as wide as its room, keeps the text's width */
[data-swa-asset] {
  position: relative;
  width: fit-content;
  max-width: 100%;
  border: none !important;
}
[data-swa-asset]:has(object, .swa-pdf) {
  display: block;
  width: auto;
}
/* The host's PDF viewer as the original, without a size of its own: as wide as its frame (the text's), so the frame's
   edge, and Silverware Layout's handle beside it, is the viewer's (SilverBullet 2.12.1 draws it 300 px wide, its
   style `max-width: 100%;`; one with a size, `width: 200px` after it, keeps it) */
[data-swa-asset][data-swa-view="embed"] object:not(.swa-icon *, [style*="; width"]) {
  width: 100% !important;
  max-width: 100% !important;
}
/* A card: its "…" beside it, not over its name */
[data-swa-view="icon"] {
  display: flex !important;
  align-items: center;
  gap: 4px;
}
.swa-frame[data-swa-view="icon"] {
  display: inline-flex !important;
}
[data-swa-view="icon"] > .swa-more {
  position: static;
  order: 1;
  flex: none;
}
/* A medium in markdown rendered outside the editor (a grid's cell) in a frame of Silverware Assets' own */
.swa-frame {
  display: inline-block;
  max-width: 100%;
  vertical-align: top;
}
/* Laid out by the handle (its width on the frame, data-swl-width): the host's medium fills the frame, its height by
   its ratio, so a drag shows at once what the width written will draw */
[data-swa-asset][data-swl-width]:not([data-swa-view="preview"]) :is(img, video, object):not(.swa-icon img) {
  width: 100% !important;
  max-width: 100% !important;
  height: auto;
}
.swa-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 6px 12px 6px 8px;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}
.swa-card:hover {
  background: color-mix(in srgb, currentColor 6%, transparent);
}
.swa-card:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 40%, transparent);
}
.swa-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: none;
}
.swa-icon > svg,
.swa-icon > img {
  width: 100%;
  height: 100%;
}
.swa-card-text {
  display: inline-flex;
  flex-direction: column;
  min-width: 0;
}
.swa-card-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* A file's size and date, under its name: quieter, apart by a dot */
.swa-card-meta {
  display: inline-flex;
  gap: 6px;
  font-size: 0.8em;
  opacity: 0.7;
  white-space: nowrap;
}
.swa-card-meta > * + *::before {
  content: "·";
  margin-right: 6px;
}
/* An asset shown by an action: in a panel at the window's right (peek, over part of the window: the sheet's layer), or
   enlarged over the dimmed page (popover, a dialog's layer); its head its name, Open in a new tab and ×, its body the
   asset as large as the panel lets it be */
.swa-peek {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--sw-layer-sheet);
  display: flex;
  flex-direction: column;
  width: min(560px, 100vw);
  color: var(--root-color);
  background: var(--root-background-color);
  border-left: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  box-shadow: -6px 0 24px rgba(0, 0, 0, 0.18);
}
.swa-popover {
  position: fixed;
  inset: 0;
  z-index: var(--sw-layer-dialog);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}
.swa-popover-box {
  display: flex;
  flex-direction: column;
  max-width: 92vw;
  max-height: 92vh;
  min-width: min(320px, 92vw);
  color: var(--root-color);
  background: var(--root-background-color);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.swa-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 14px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 13px;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.25));
}
.swa-panel-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swa-panel-button,
.swa-panel-close {
  padding: 3px 10px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 4px;
  cursor: pointer;
}
.swa-panel-close {
  padding: 0 8px;
  font-size: 18px;
  line-height: 24px;
  border-color: transparent;
}
.swa-panel-body {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}
.swa-panel-body > :is(img, video) {
  max-width: 100%;
  max-height: 100%;
  width: auto !important;
  height: auto !important;
  object-fit: contain;
}
.swa-popover .swa-panel-body > :is(img, video) {
  max-height: calc(92vh - 70px);
}
.swa-panel-body > object {
  width: 100% !important;
  height: 100% !important;
  min-height: 60vh;
}
.swa-popover .swa-panel-body > object {
  width: 85vw !important;
  height: calc(92vh - 70px) !important;
}
/* A link to a file of the space: its type's icon before its text, as large as the text */
.swa-link-icon {
  display: inline-flex;
  width: 1em;
  height: 1em;
  margin-right: 0.2em;
  vertical-align: -0.125em;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.12s, transform 0.12s;
}
/* On a touch screen it takes a finger: its box larger than the icon, not the text's */
@media (pointer: coarse) {
  .swa-link-icon {
    position: relative;
  }
  .swa-link-icon::after {
    content: "";
    position: absolute;
    inset: -10px -6px;
  }
}
/* An icon opening its asset's menu (a link's, a card's): pointed at (or its menu open), it shows plainly it is a
   button of its own, apart from the text beside it: filled, a little larger */
.swa-menu-icon {
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.12s, transform 0.12s;
}
.swa-menu-icon:hover,
.swa-menu-icon[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 22%, transparent);
  transform: scale(1.2);
}
@media (prefers-reduced-motion: reduce) {
  .swa-menu-icon {
    transition: none;
  }
}
.swa-pdf {
  display: block;
  width: 100%;
  height: var(--swa-height, 160px);
  border: none;
}
.swa-failed {
  position: absolute;
  top: 4px;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  background: #c0392b;
  cursor: help;
}
/* The settings window ("Silverware Assets: Settings"): the shared dialog (shared/dialog.ts) over the page, in the
   page's colors; over the part of the window an on-screen keyboard leaves (shared/dialog.ts sets where it is) */
.swa-dialog-backdrop {
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
.swa-dialog {
  --swa-dialog-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swa-dialog-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  display: flex;
  flex-direction: column;
  /* (Its border within the height: SilverBullet sets no box-sizing) */
  box-sizing: border-box;
  width: min(640px, calc(100vw - 24px));
  /* (As high on either tab: it does not jump as they are switched, the footer where it was) */
  min-height: min(520px, calc(var(--sw-view-height, 100dvh) - 32px));
  max-height: min(600px, calc(var(--sw-view-height, 100dvh) - 32px));
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swa-dialog-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swa-dialog *,
.swa-dialog *::before,
.swa-dialog *::after {
  box-sizing: border-box;
}
.swa-dialog:focus {
  outline: none;
}
.swa-dialog button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swa-dialog-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swa-dialog-titles {
  flex: 1;
  min-width: 0;
}
.swa-dialog-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swa-dialog-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
  overflow-wrap: anywhere;
}
.swa-dialog-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swa-dialog-close:hover {
  opacity: 1;
  background: var(--swa-dialog-card);
}
.swa-dialog-close svg {
  width: 16px;
  height: 16px;
}
.swa-dialog-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
/* The tabs (Assets, Markdown) under the head */
.swa-dialog-tabs {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swa-dialog-line);
}
.swa-dialog-tab {
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swa-dialog-tab:hover {
  opacity: 1;
}
.swa-dialog-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swa-dialog-panel[hidden] {
  display: none;
}
.swa-dialog-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swa-dialog-line);
}
.swa-dialog-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swa-dialog-note.swa-dialog-problem {
  color: var(--danger-color, #c62828);
  opacity: 1;
}
.swa-dialog-cancel,
.swa-dialog-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swa-dialog-line);
  background: var(--root-background-color);
}
.swa-dialog-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swa-dialog-save:disabled {
  opacity: 0.45;
  cursor: default;
}
/* The Assets and Markdown tabs' room */
.swa-dialog-panel {
  padding: 14px 2px 6px;
}
/* The Markdown tab: its boxes one under another */
.swa-settings-markdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swa-settings-note {
  margin: 0 0 4px;
  opacity: 0.8;
}
/* <shared-menu> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The look of shared/menu.ts's menus: one template for every plugin drawing them, its classes those renderMenu gives
   (`<base>-menu-item`…) with a placeholder for the base; scripts/sharedstyles.mjs writes it, the plugin's base (`swt`,
   `swc`, `swd`) in place, into each plugin's style page (between its marks; npm run build), and check-build fails where
   one differs.
   The menu's box (where it shows, its size, its font, its background) is the plugin's own, `.<base>-menu`. */

/* The menu's entries one under another */
[role="menu"].swa-menu,
.swa-menu > [role="menu"] {
  display: flex;
  flex-direction: column;
  outline: none;
}
/* The title centered; a submenu's back arrow at the left */
.swa-menu-title {
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
.swa-menu-title-text {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* A submenu's way back: an arrow before its title */
.swa-menu-back {
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
.swa-menu-back:hover,
.swa-menu-back:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swa-menu .swa-menu-back svg {
  width: 14px;
  height: 14px;
}
/* The × closing the menu, at the title's right */
.swa-menu-close {
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
.swa-menu-close:hover,
.swa-menu-close:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swa-menu .swa-menu-close svg {
  width: 14px;
  height: 14px;
}
/* What the menu is about named in its title: a pencil after the title, the title a field once pressed */
.swa-menu-rename {
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
.swa-menu-rename:hover,
.swa-menu-rename:focus-visible {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swa-menu-rename[aria-disabled] {
  opacity: 0.3;
  cursor: default;
  background: none;
}
.swa-menu .swa-menu-rename svg {
  width: 14px;
  height: 14px;
}
.swa-menu-title.swa-naming {
  display: block;
  padding: 2px 6px 6px;
}
.swa-menu-name {
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
.swa-menu-name-clear {
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
.swa-menu-name-problem {
  max-width: 260px;
  padding: 0 8px 6px;
  font-size: 12px;
  color: var(--danger-color, #c62828);
}
/* An item: its icon, its label (and its value), a mark where it opens a submenu or is checked */
.swa-menu-item {
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
.swa-menu-item:hover,
.swa-menu-item:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
/* A list opened in the menu's place: its choice highlighted (focusMenu), not
   the item that came under the pointer, until the pointer moves */
.swa-menu.swa-menu-still .swa-menu-item:hover:not(:focus-visible),
.swa-menu-still .swa-menu-item:hover:not(:focus-visible) {
  background: none;
}
.swa-menu-item.swa-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
}
.swa-menu-item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swa-menu-item[aria-disabled="true"]:hover {
  background: none;
}
.swa-menu-item .swa-label {
  flex: 1;
}
.swa-menu-item.swa-menu-sub::after {
  content: "\203A";
  opacity: 0.6;
}
.swa-menu-item[aria-checked="true"]::after {
  content: "\2713";
  color: var(--ui-accent-color);
}
.swa-menu-item.swa-danger {
  color: var(--danger-color, #c62828);
}
.swa-icon {
  display: inline-flex;
}
.swa-menu svg {
  width: 16px;
  height: 16px;
}
/* An item's detail: a bubble beside the menu, at the item's height */
.swa-menu-detail {
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
.swa-menu-detail.swa-left {
  left: auto;
  right: calc(100% + 8px);
}
.swa-menu-detail[hidden] {
  display: none;
}
.swa-menu-detail-title {
  margin-bottom: 4px;
  font-weight: 600;
}
.swa-menu-detail-code {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.swa-menu-detail-code code {
  padding: 1px 5px;
  font-size: 11px;
  background: color-mix(in srgb, var(--ui-accent-color) 12%, transparent);
  border-radius: 4px;
}
.swa-menu-detail p {
  margin: 0;
}
.swa-menu-detail .swa-menu-detail-note {
  margin-top: 6px;
  opacity: 0.7;
}
/* The icon of an item's value: Type: ☆ Stars */
.swa-menu-value-icon {
  display: inline-flex;
  margin-right: 3px;
  vertical-align: -2px;
}
.swa-menu .swa-menu-value-icon svg {
  width: 14px;
  height: 14px;
}
.swa-menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.3));
}
/* A row of icon buttons after a label: a choice (Align) or a pair of actions (Move up, Move down) */
.swa-menu-segmented {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 2px 8px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items */
.swa-menu-segmented > .swa-label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Something missing (a table shown as a sheet on none): its label in the danger color */
.swa-menu-segmented .swa-label.swa-attention {
  font-weight: 600;
  color: var(--danger-color, #c62828);
  opacity: 1;
}
/* (Its buttons, swa-segments and swa-segment, are shared/segments.css's) */
.swa-action[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A bar of actions, a caption under each icon (Copy, Cut, Paste): first in a menu */
.swa-menu-actions {
  display: flex;
  gap: 2px;
  padding: 2px;
}
.swa-action {
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
.swa-action .swa-icon {
  display: inline-flex;
}
.swa-action:not([aria-disabled="true"]):hover,
.swa-action:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 15%, transparent);
  outline: none;
}
.swa-action-caption {
  white-space: nowrap;
  opacity: 0.85;
}
/* Choices laid out as tiles, an icon over each label (a gallery: a chart's types) */
.swa-menu-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.swa-menu-tile {
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
.swa-menu-tile[aria-checked="true"] {
  border-color: var(--ui-accent-color);
}
.swa-menu-tile[aria-checked="true"] .swa-label::after {
  content: " \2713";
  color: var(--ui-accent-color);
}
.swa-menu-tile[aria-disabled="true"] {
  cursor: default;
  opacity: 0.45;
}
.swa-menu-tile:not([aria-disabled="true"]):hover,
.swa-menu-tile:focus-visible,
.swa-menu-tile.swa-menu-current {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swa-menu-tile svg {
  width: 22px;
  height: 22px;
}
/* </shared-menu> */
/* <shared-segments> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* Joined buttons side by side, one of them pressed: a choice (a menu's Align,
   a width's unit px or %) or a pair of actions (Move up, Move down). Drawn
   by a menu's segmented entry (shared/menu.ts) and by segmentedControl
   (shared/controls.ts) */
.swa-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swa-segment {
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
.swa-segment:not([aria-disabled="true"]):hover,
.swa-segment:focus-visible {
  background: color-mix(in srgb, var(--ui-accent-color) 14%, transparent);
  outline: none;
}
.swa-segment[aria-checked="true"] {
  color: var(--ui-accent-color);
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.swa-segment[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
/* A finger's targets: bigger buttons in a row */
@media (pointer: coarse) {
  .swa-segment {
    padding: 8px 10px;
  }
}
/* </shared-segments> */
```
