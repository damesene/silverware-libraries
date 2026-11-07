---
tags: meta
---
# Silverware Database style

The look of [Silverware Database](silverware-database.md): a database's place (its views' switcher, its notes). Its classes start with `swd-`. It is installed with the library.

```space-style
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
```
