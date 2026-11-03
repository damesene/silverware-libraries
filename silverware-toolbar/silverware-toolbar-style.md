---
tags: meta
---
# Silverware Toolbar style

The look of [Silverware Toolbar](silverware-toolbar.md): the toolbar, the list of every action and the settings. It is installed with the library.

```space-style
/* Silverware Toolbar (prefix swb-): the toolbar by the selection, the list
   of a button's choices under it, the popup of every action. Over the page and
   SilverBullet's top bar (z-index 20), under its dialogs. Hidden with
   display: none !important: themes set display on every button with
   !important (Tiniri does) */
.swb-floating {
  position: fixed;
  z-index: 60;
  display: none !important;
  box-sizing: border-box;
  font: 13px/1.3 var(--ui-font, system-ui, sans-serif);
  color: var(--root-color, #222);
  background: var(--root-background-color, #fff);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
}
.swb-floating.swb-visible {
  display: flex !important;
}
.swb-floating svg {
  width: 18px;
  height: 18px;
  flex: none;
}
/* The toolbar: icons in a row */
.swb-bar {
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 3px;
}
.swb-button {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-button:hover:not(:disabled),
.swb-button[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-button[aria-pressed="true"] {
  color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 14%, transparent);
}
.swb-button:disabled {
  opacity: 0.35;
  cursor: default;
}
/* A row of the favourites */
.swb-row {
  display: flex;
  align-items: center;
  gap: 2px;
}
/* Docked at the bottom (a phone): one row across the window over the keyboard, scrolled sideways, … at its end */
.swb-bar.swb-docked {
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
  width: 100vw;
  max-width: none;
  padding: 4px 4px 4px 6px;
  border-width: 1px 0 0;
  border-radius: 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.12);
}
/* Room for the toolbar docked always or while writing (its height on html, set while it shows so): SilverBullet's
   editor padded by it, so it covers no text and the editor keeps the cursor clear of it. The one place outside
   src/dom.ts that assumes SilverBullet's DOM: its editor's id, and its height (100%) */
#sb-editor {
  /* (Its height SilverBullet's 100%: the padding within it) */
  box-sizing: border-box;
  padding-top: var(--swb-docked-top, 0px);
  padding-bottom: var(--swb-docked-bottom, 0px);
}
/* Docked at the top: under SilverBullet's top bar, its line and shadow below it */
.swb-bar.swb-docked.swb-docked-top {
  border-width: 0 0 1px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
/* Its items in a box shaded at each end it scrolls further to (swb-more-left / -right) */
.swb-bar.swb-docked .swb-dock-scroll {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}
.swb-dock-shade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 18px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms;
}
.swb-dock-shade-left {
  left: 0;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.14), transparent);
}
.swb-dock-shade-right {
  right: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 0.14), transparent);
}
.swb-dock-scroll.swb-more-left .swb-dock-shade-left,
.swb-dock-scroll.swb-more-right .swb-dock-shade-right {
  opacity: 1;
}
.swb-bar.swb-docked .swb-dock-items {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  touch-action: pan-x;
}
.swb-bar.swb-docked .swb-dock-items::-webkit-scrollbar {
  display: none;
}
.swb-bar.swb-docked .swb-button {
  flex: none;
  width: 40px;
  height: 36px;
}
.swb-bar.swb-docked .swb-button.swb-labeled,
.swb-bar.swb-docked .swb-button.swb-choices {
  width: auto;
}
.swb-bar.swb-docked .swb-more {
  flex: none;
  margin-left: 2px;
}
/* Items pinned at an end, out of what scrolls: a line between them and it */
.swb-bar.swb-docked .swb-dock-pinned {
  flex: none;
}
.swb-bar.swb-docked .swb-dock-pinned-left {
  padding-right: 4px;
  margin-right: 4px;
  border-right: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
}
.swb-bar.swb-docked .swb-dock-pinned-right {
  padding-left: 4px;
  margin-left: 4px;
  border-left: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
}
.swb-bar.swb-docked .swb-dock-pinned-right .swb-more {
  margin-left: 0;
}
/* An action with its label, one offering choices with a chevron (its choice on) */
.swb-button.swb-labeled,
.swb-button.swb-choices {
  width: auto;
  gap: 6px;
  padding: 0 6px;
  font: inherit;
}
.swb-button.swb-labeled {
  max-width: 200px;
}
.swb-button .swb-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* A favourite's own icon: a character, an emoji, as large as an icon */
.swb-own-icon {
  display: inline-flex;
  justify-content: center;
  min-width: 18px;
  font-size: 16px;
  line-height: 1;
}
/* A label of a fixed width (--swb-width, in characters): as wide whatever it says, a longer one cut */
.swb-button.swb-fixed {
  max-width: none;
}
.swb-fixed .swb-label {
  flex: none;
  box-sizing: content-box;
  width: var(--swb-width);
  text-align: left;
}
.swb-button.swb-choices:not(.swb-labeled) {
  gap: 0;
  padding: 0 2px 0 6px;
}
.swb-button.swb-choices svg:last-child {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}
/* The gestures module's button: its faces in one cell (as wide as the widest), on a reel rolled by
   --swb-roll (0 the click's face, 1 the swipe up's, -1 the swipe down's), following the pointer while
   dragged (swb-rolling: no transition), settling once let go, the button tinted while letting go would
   run a swipe's action; each swipe's icon small in its top right corner (up) or its bottom right one
   (down), showing its action's state */
.swb-button.swb-gesture {
  --swb-roll: 0;
  --swb-rolled: 0;
  position: relative;
  overflow: hidden;
  touch-action: pan-x;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.swb-gesture-reel {
  display: grid;
  align-items: stretch;
  justify-items: stretch;
  height: 100%;
  min-width: 0;
}
.swb-gesture-face {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  box-sizing: border-box;
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}
.swb-gesture-tap {
  transform: translateY(calc(var(--swb-roll) * -100%));
}
.swb-gesture-up {
  transform: translateY(calc((1 - var(--swb-roll)) * 100%));
}
.swb-gesture-down {
  transform: translateY(calc((-1 - var(--swb-roll)) * 100%));
}
.swb-gesture.swb-rolling .swb-gesture-face {
  transition: none;
}
.swb-gesture-face.swb-off {
  opacity: 0.35;
}
.swb-gesture-up.swb-on,
.swb-gesture-down.swb-on {
  color: var(--ui-accent-color, #464cfc);
}
.swb-button.swb-gesture.swb-armed {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 14%, transparent);
}
.swb-button.swb-gesture[aria-disabled="true"] {
  cursor: default;
}
/* Quiet; on (in the accent, at full strength) where the swipe's action is on for the
   selection, so a swipe turns it off (bold already); gone as the button rolls (its faces go past it) */
.swb-gesture-hint {
  position: absolute;
  right: 2px;
  display: flex;
  --swb-hint: 0.45;
  opacity: max(0, var(--swb-hint) - var(--swb-rolled) * 3 * var(--swb-hint));
  pointer-events: none;
  transition: opacity 120ms;
}
/* In the page's color while off, also in a button pressed (its color the accent) */
.swb-gesture-hint:not(.swb-on) {
  color: var(--root-color, #222);
}
.swb-gesture-hint.swb-hint-up {
  top: 2px;
}
.swb-gesture-hint.swb-hint-down {
  bottom: 2px;
}
.swb-gesture-hint.swb-on {
  --swb-hint: 1;
  color: var(--ui-accent-color, #464cfc);
}
.swb-floating .swb-gesture-hint svg {
  width: 8px;
  height: 8px;
  stroke-width: 3;
}
/* Following the pointer: at once */
.swb-gesture.swb-rolling .swb-gesture-hint {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .swb-gesture-face {
    transition-duration: 1ms;
  }
}
.swb-divider {
  width: 1px;
  align-self: stretch;
  margin: 4px 3px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.35));
}
/* A list of choices (under a button), the popup's actions */
.swb-menu,
.swb-popup {
  flex-direction: column;
}
.swb-menu {
  min-width: 180px;
  padding: 4px;
}
.swb-menu-item,
.swb-option {
  display: flex !important;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-menu-item:hover:not(:disabled),
.swb-option.swb-current {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 14%, transparent);
}
.swb-menu-item:disabled,
.swb-option[aria-disabled="true"] {
  opacity: 0.4;
  cursor: default;
}
.swb-icon {
  display: inline-flex;
  opacity: 0.8;
}
.swb-label {
  flex: 1;
}
.swb-check {
  display: inline-flex;
  color: var(--ui-accent-color, #464cfc);
}
.swb-check:empty {
  width: 18px;
}
/* The popup: a search field over the actions found */
.swb-popup {
  width: 320px;
  max-height: min(420px, 70vh);
}
.swb-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  opacity: 0.9;
}
/* A text snippet's character, as an icon is shown */
.swb-glyph {
  display: inline-block;
  min-width: 18px;
  font-size: 16px;
  line-height: 1;
  text-align: center;
}
/* A panel of an action's own (the emoji picker), where the popup shows */
.swb-panel.swb-visible {
  flex-direction: column;
  width: 340px;
  max-width: calc(100vw - 16px);
}
/* Its groups as filters, over the search: All, then each by its first emoji */
.swb-emoji-tabs {
  display: flex;
  padding: 6px 6px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.swb-emoji-tabs::-webkit-scrollbar {
  display: none;
}
.swb-emoji-tab {
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
.swb-emoji-tab:first-child {
  font-size: 12px;
  font-weight: 600;
}
.swb-emoji-tab:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swb-emoji-tab[aria-checked="true"] {
  border-bottom-color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 10%, transparent);
}
.swb-emoji-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 6px 6px;
}
.swb-emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
}
.swb-emoji {
  height: 36px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-emoji.swb-current {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 16%, transparent);
}
.swb-emoji-name {
  min-height: 1.3em;
  padding: 6px 10px;
  border-top: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  opacity: 0.75;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* Icons by the search field (the settings) */
.swb-popup-tools {
  display: flex;
  gap: 2px;
}
.swb-popup-tool {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.7;
  cursor: pointer;
}
.swb-popup-tool:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-popup-tool svg {
  width: 16px;
  height: 16px;
}
.swb-search-field {
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
.swb-list {
  overflow-y: auto;
  padding: 4px;
}
.swb-group {
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.swb-none {
  padding: 12px 8px;
  opacity: 0.6;
}
/* An action's choices open in the popup: the way back over them, its label the title */
.swb-back {
  display: flex !important;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  font-weight: 600;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-back:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}

/* The settings dialog (Silverware Toolbar settings…, "Silverware Toolbar: Settings"):
   Silverware Table's settings' look, tabs, rows in cards, switches */
/* Over the part of the window an on-screen keyboard leaves (shared/dialog.ts sets where it is) */
.swb-settings-backdrop {
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
.swb-settings {
  --swb-settings-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swb-settings-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
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
  border: 1px solid var(--swb-settings-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swb-settings:focus {
  outline: none;
}
.swb-settings button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swb-settings-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swb-settings-titles {
  flex: 1;
  min-width: 0;
}
.swb-settings-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swb-settings-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
}
.swb-settings-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swb-settings-close:hover {
  opacity: 1;
  background: var(--swb-settings-card);
}
.swb-settings-close svg {
  width: 16px;
  height: 16px;
}
/* One row however many tabs: too wide for the dialog (a phone), it scrolls sideways */
.swb-settings-tabs {
  /* Never shrunk by a tall body (it scrolls sideways, so a column's flex would squeeze it: on a phone it slid under the body) */
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swb-settings-line);
}
.swb-settings-tab {
  flex: none;
  white-space: nowrap;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swb-settings-tab:hover {
  opacity: 1;
}
.swb-settings-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swb-settings-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
.swb-settings-panel[hidden] {
  display: none;
}
.swb-settings-group {
  margin: 14px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}
.swb-settings-panel > .swb-settings-card:first-child {
  margin-top: 12px;
}
.swb-settings-card {
  background: var(--swb-settings-card);
  border: 1px solid var(--swb-settings-line);
  border-radius: 8px;
}
.swb-settings-card > :not(:first-child) {
  border-top: 1px solid var(--swb-settings-line);
}
.swb-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
}
.swb-settings-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swb-settings-module-name,
.swb-settings-name {
  font-weight: 500;
}
.swb-settings-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.swb-settings-row select,
.swb-settings-row input[type="number"] {
  flex: none;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swb-settings-row select {
  max-width: 55%;
}
.swb-settings-row input[type="number"] {
  width: 6.5em;
}
.swb-settings-row input.swb-settings-invalid {
  border-color: var(--danger-color, #c62828);
}
/* A setting of each device's own: under its name and hint, a choice for Click and one for Touch side by side, each named above it */
.swb-settings-row.swb-settings-by-device {
  flex-wrap: wrap;
}
.swb-settings-by-device .swb-settings-label {
  flex: 1 1 100%;
}
.swb-settings-devices-pair {
  flex: 1 1 100%;
  display: flex;
  gap: 12px;
}
.swb-settings-device-choice {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.swb-settings-device-name {
  font-size: 12px;
  opacity: 0.62;
}
.swb-settings-row .swb-settings-devices-pair select {
  width: 100%;
  max-width: 100%;
}
/* A switch: the checkbox (invisible, still focusable) drawn as a track and a knob */
.swb-settings-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
}
.swb-settings-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swb-settings-knob {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--root-color) 22%, var(--root-background-color));
  transition: background 0.15s;
  pointer-events: none;
}
.swb-settings-knob::after {
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
.swb-settings-switch input:checked + .swb-settings-knob {
  background: var(--ui-accent-color);
}
.swb-settings-switch input:checked + .swb-settings-knob::after {
  transform: translateX(14px);
}
.swb-settings-switch input:focus-visible + .swb-settings-knob {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 2px;
}
.swb-settings-switch input:disabled + .swb-settings-knob {
  opacity: 0.5;
}
/* A module's own settings: under it, indented, while it is on */
.swb-settings-module-settings {
  margin: 0 12px 10px 24px;
  border-left: 2px solid var(--swb-settings-line);
}
.swb-settings-module-settings .swb-settings-row {
  padding: 6px 0 6px 12px;
}
.swb-settings-module-settings[hidden] {
  display: none;
}
.swb-settings-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swb-settings-line);
}
.swb-settings-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swb-settings-cancel,
.swb-settings-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swb-settings-line);
  background: var(--root-background-color);
}
.swb-settings-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swb-settings-save:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swb-settings {
    width: 100vw;
    height: 100vh;
    height: var(--sw-view-height, 100dvh);
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swb-settings-body {
    flex: 1 1 auto;
  }
  .swb-settings-tab {
    padding: 10px 12px;
  }
  .swb-settings-row {
    min-height: 44px;
  }
  .swb-settings-cancel,
  .swb-settings-save {
    padding: 10px 18px;
  }
  .swb-settings-row {
    flex-wrap: wrap;
  }
  /* The name keeps room to be read; a control that does not fit beside it goes under it, the row's width */
  .swb-settings-label {
    flex: 1 1 14em;
  }
  .swb-settings-row select {
    flex: 1 1 auto;
    max-width: 100%;
  }
  .swb-settings-row select,
  .swb-settings-row input[type="number"] {
    font-size: 16px;
  }
}

/* The settings' own controls: the key's field, the favourites' rows of items
   (dragged, moved with Alt+arrows), the search of actions to add */
.swb-settings-row input.swb-settings-key {
  width: 160px;
  flex: 0 0 auto;
  padding: 5px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-intro {
  margin: 0 0 12px;
  opacity: 0.75;
  font-size: 13px;
}
.swb-settings-favrow {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--swb-settings-card);
  border: 1px solid var(--swb-settings-line);
  border-radius: 8px;
}
.swb-settings-favhead {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}
.swb-settings-favhead > span {
  opacity: 0.7;
}
/* A row's ×, at the right end of its head */
.swb-settings-row-remove {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.6;
  cursor: pointer;
}
.swb-settings-row-remove:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-row-remove svg {
  width: 14px;
  height: 14px;
}
/* A row's handle: dragged, the row moves up or down */
.swb-settings-row-grip {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: -4px;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.6;
  cursor: grab;
  touch-action: none;
}
.swb-settings-row-grip:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-row-grip svg {
  width: 16px;
  height: 16px;
}
/* Dragged (an item or a row): its place held, dimmed, the others sliding aside; a copy following the pointer */
.swb-settings-placeholder {
  opacity: 0.3;
}
.swb-settings-ghost {
  position: fixed;
  z-index: 101;
  margin: 0;
  pointer-events: none;
  box-sizing: border-box;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  cursor: grabbing;
  opacity: 0.95;
}
/* The search of what to add: its field and its close button */
.swb-settings-pick-top {
  display: flex;
  gap: 6px;
  align-items: center;
}
.swb-settings-pick-close {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-pick-close svg {
  width: 16px;
  height: 16px;
}
.swb-settings-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 34px;
  padding: 2px;
  border-radius: 6px;
}
.swb-settings-empty {
  align-self: center;
  padding: 0 6px;
  opacity: 0.55;
  font-size: 13px;
}
.swb-settings-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 8px;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.swb-settings-item:focus-visible {
  outline: 2px solid var(--ui-accent-color, #464cfc);
  outline-offset: 1px;
}
.swb-settings-item.swb-settings-unknown {
  opacity: 0.5;
  border-style: dashed;
}
.swb-settings-item.swb-settings-separator .swb-settings-item-icon::before {
  content: "";
  display: block;
  width: 1px;
  height: 16px;
  margin: 0 auto;
  background: currentColor;
  opacity: 0.6;
}
.swb-settings-item-icon {
  display: inline-flex;
  width: 18px;
  justify-content: center;
}
.swb-settings-item-icon svg {
  width: 18px;
  height: 18px;
}
.swb-settings-remove {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.7;
}
.swb-settings-remove:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-remove svg {
  width: 16px;
  height: 16px;
}
/* An item as it shows in the toolbar: its icon alone (its name kept for a screen reader, in its tooltip),
   or its label too, of a fixed width (--swb-width, in characters) where it has one; its look's panel open: marked */
.swb-settings-item.swb-settings-iconly .swb-settings-item-name {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.swb-settings-item.swb-settings-fixed .swb-settings-item-name {
  flex: none;
  box-sizing: content-box;
  width: var(--swb-width);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.swb-settings-item[aria-expanded="true"] {
  border-color: var(--ui-accent-color, #464cfc);
}
/* An item's look, under its row: each setting on a line of its own (icon or icon and label; the label's
   width), its × in the top right corner */
.swb-settings-look {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 36px 8px 8px;
  font-size: 13px;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-look-shows {
  display: inline-flex;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  overflow: hidden;
}
.swb-settings-look-show {
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.swb-settings-look-show + .swb-settings-look-show {
  border-left: 1px solid var(--swb-settings-line);
}
.swb-settings-look-show[aria-checked="true"] {
  color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 12%, transparent);
}
.swb-settings-look-show svg {
  width: 14px;
  height: 14px;
}
.swb-settings-look-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.swb-settings-look-name {
  flex: none;
  width: 3.5em;
  opacity: 0.8;
}
.swb-settings-look-own-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* A slot's panel: its action and Change… */
.swb-settings-look-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.swb-settings-look-change {
  padding: 3px 10px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  cursor: pointer;
}
.swb-settings-look-own {
  width: 14em;
  max-width: 100%;
  padding: 3px 6px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-look-own-icon {
  width: 4.5em;
}
.swb-settings-look-reset {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.6;
  cursor: pointer;
}
.swb-settings-look-reset:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-look-reset svg {
  width: 14px;
  height: 14px;
}
.swb-settings-look-unit {
  opacity: 0.7;
}
.swb-settings-look-width {
  width: 4.5em;
  padding: 3px 6px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-look-close {
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.6;
  cursor: pointer;
}
.swb-settings-look-close svg {
  width: 14px;
  height: 14px;
}
/* Touch's pinned items: two boxes side by side (one under the other on a phone), above the rows */
.swb-settings-pins {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
}
.swb-settings-pins > .swb-settings-pin-box {
  flex: 1 1 200px;
  min-width: 0;
}
/* A kind's item (the gesture button): its name, look and × on the first line, its slots under them,
   side by side where they fit, else one under another (a phone) */
.swb-settings-item.swb-settings-kind {
  flex-wrap: wrap;
  max-width: 100%;
  box-sizing: border-box;
}
.swb-settings-kind .swb-settings-item-name {
  flex: 1 1 auto;
}
.swb-settings-slots {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  padding-bottom: 2px;
}
/* A slot of a kind's item (the gesture button's Click, Swipe up): the action picked for it */
/* The favourites for a mouse (Click) or for a finger (Touch): two segments; Touch the same as Click shown dimmed, not edited */
.swb-settings-devices {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 10px;
}
.swb-settings-devices-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.swb-settings-device-actions {
  display: flex;
  gap: 6px;
}
.swb-settings-reset,
.swb-settings-copy-from {
  padding: 4px 10px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  cursor: pointer;
}
.swb-settings-copy-from:disabled {
  opacity: 0.45;
  cursor: default;
}
.swb-settings-device-tabs {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px;
  border: 1px solid var(--swb-settings-line);
  border-radius: 7px;
}
.swb-settings-device {
  padding: 4px 14px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swb-settings-device[aria-checked="true"] {
  color: #fff;
  background: var(--ui-accent-color, #464cfc);
}
/* … not in the favourites: added at the end, said so */
.swb-settings-warning {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-left: 3px solid var(--ui-accent-color, #464cfc);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 8%, transparent);
}
.swb-settings-rows-same {
  opacity: 0.5;
}
.swb-settings-slot {
  display: inline-flex !important;
  flex: 1 1 200px;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 30px;
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 4px;
  cursor: pointer;
}
.swb-settings-slot:hover,
.swb-settings-slot[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swb-settings-slot[aria-expanded="true"] {
  border-color: var(--ui-accent-color, #464cfc);
}
.swb-settings-slot.swb-settings-unknown {
  border-style: dashed;
  opacity: 0.7;
}
.swb-settings-slot-name {
  flex: none;
  white-space: nowrap;
  font-size: 11px;
  opacity: 0.65;
}
.swb-settings-slot-action {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* A field of a kind's item (a snippet's text), typed in place */
.swb-settings-field {
  display: inline-flex;
  flex: 1 1 200px;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--swb-settings-line);
  border-radius: 4px;
}
.swb-settings-field.swb-settings-field-multiline {
  flex-basis: 100%;
  align-items: flex-start;
}
.swb-settings-field-input {
  flex: 1;
  min-width: 0;
  padding: 3px 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
  resize: vertical;
}
.swb-settings-field:focus-within {
  border-color: var(--ui-accent-color, #464cfc);
}
.swb-settings-slot .swb-settings-item-icon:empty {
  display: none;
}
.swb-settings-add,
.swb-settings-add-row {
  margin-top: 8px;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-add:hover,
.swb-settings-add-row:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swb-settings-picker {
  margin-top: 8px;
}
.swb-settings-pick-field {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-pick-list {
  max-height: 220px;
  margin-top: 4px;
  overflow-y: auto;
}
.swb-settings-pick {
  display: flex !important;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 6px;
}
.swb-settings-pick:hover,
.swb-settings-pick:focus-visible {
  background: color-mix(in srgb, currentColor 8%, transparent);
  outline: none;
}
.swb-settings-pick-label {
  flex: 1 1 auto;
}
.swb-settings-pick-group {
  font-size: 12px;
  opacity: 0.6;
}
.swb-settings-pick-separator .swb-settings-item-icon::before {
  content: "";
  display: block;
  width: 1px;
  height: 16px;
  margin: 0 auto;
  background: currentColor;
  opacity: 0.6;
}
.swb-settings-pick-none {
  padding: 8px;
  opacity: 0.6;
}
/* Advice under the settings (SilverBullet's keyboard bar on): its button as the dialog's others */
.swb-settings-advice {
  margin-top: 12px;
  border-color: color-mix(in srgb, var(--ui-accent-color, #464cfc) 45%, var(--swb-settings-line));
}
.swb-settings-advice + .swb-settings-card {
  margin-top: 12px;
}
.swb-settings-advice-button {
  flex: none;
  padding: 5px 12px;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-advice-button:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
```
