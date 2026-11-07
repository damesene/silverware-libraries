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

/* A place: the switcher of its views above what the view draws */
.swd-place {
  margin: 0.5em 0;
}
.swd-place-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.swd-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
  cursor: pointer;
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
  border-color: var(--ui-accent-color);
  color: var(--ui-accent-color);
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
/* What every view has beside the switcher: the filter, the sort, Undo */
.swd-tools {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
}
.swd-tool {
  padding: 3px 8px;
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 6px;
  color: inherit;
  background: none;
  font: inherit;
}
.swd-tool:disabled {
  opacity: 0.4;
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
.swd-table-actions {
  width: 1px;
}
.swd-table-foot,
.swd-list-head,
.swd-kanban-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.swd-table-add,
.swd-kanban-add,
.swd-list-properties {
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
}
.swd-list-name,
.swd-kanban-name {
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
.swd-kanban-value {
  font-size: 0.85em;
  opacity: 0.8;
}
.swd-list-head {
  position: relative;
}
.swd-list-chooser {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.swd-list-chooser[hidden] {
  display: none;
}
/* The kanban: columns side by side, scrolled sideways where they are more than the page's width */
.swd-kanban {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.swd-kanban-column {
  flex: 0 0 15em;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--root-color) 5%, var(--root-background-color));
}
.swd-kanban-column.swd-drop {
  outline: 2px dashed var(--ui-accent-color);
}
.swd-kanban-title {
  margin: 0;
  font-size: 0.9em;
}
.swd-kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 1.5em;
}
.swd-kanban-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  background: var(--root-background-color);
  cursor: grab;
}
.swd-kanban-by {
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--button-border-color, currentColor);
  border-radius: 6px;
  padding: 2px 6px;
}
.swd-kanban-move {
  align-self: flex-start;
  font: inherit;
  font-size: 0.8em;
  color: inherit;
  background: none;
  border: 0;
  opacity: 0.6;
}/* The settings dialog (the command "Silverware Database: Settings"):
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
/* The properties' dialog (the Properties module): a property's row of label, type, read only, order, removal; its key and options under it */
.swd-properties {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
}
.swd-property {
  flex-wrap: wrap;
}
.swd-property-label {
  flex: 1 1 10em;
  font-weight: 500;
}
.swd-properties input,
.swd-properties select,
.swd-properties textarea {
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swd-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swd-properties textarea {
  flex: 1 1 12em;
  resize: vertical;
}
.swd-property-locked {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.swd-properties button:not(.swd-settings-save):not(.swd-settings-cancel) {
  padding: 4px 8px;
  border: 1px solid var(--swd-settings-line);
  border-radius: 6px;
  background: var(--root-background-color);
}
.swd-properties button:disabled {
  opacity: 0.4;
}
.swd-property-review {
  padding: 4px 12px;
}
.swd-property-review .swd-settings-row {
  justify-content: flex-end;
}

/* The peek: an item beside the page, over the right of the editor's area */
.swd-peek {
  position: fixed;
  z-index: 50;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  overflow: auto;
  background: var(--root-background-color);
  color: var(--root-color);
  border-left: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.18);
}
.swd-peek-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swd-peek-name {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 1.3em;
  font-weight: 600;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 2px 6px;
}
.swd-peek-name:hover,
.swd-peek-name:focus {
  border-color: var(--button-border-color, currentColor);
}
.swd-peek-close {
  display: inline-flex;
  padding: 4px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.swd-peek-close svg {
  width: 16px;
  height: 16px;
}
.swd-peek-properties {
  display: grid;
  grid-template-columns: minmax(6em, max-content) 1fr;
  gap: 4px 12px;
  align-items: center;
}
.swd-peek-row {
  display: contents;
}
.swd-peek-label {
  opacity: 0.7;
  font-size: 0.9em;
}
.swd-peek-value {
  min-height: 1.6em;
  padding: 2px 6px;
  border-radius: 4px;
}
.swd-peek-value[role="button"] {
  cursor: pointer;
}
.swd-peek-value[role="button"]:hover {
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swd-peek-empty {
  opacity: 0.4;
}
.swd-peek-note p {
  margin: 0 0 6px;
  color: var(--danger-color, #c62828);
}
.swd-peek-body {
  flex: 1 1 12em;
  min-height: 12em;
  resize: none;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  border-radius: 6px;
  padding: 8px;
}
```
