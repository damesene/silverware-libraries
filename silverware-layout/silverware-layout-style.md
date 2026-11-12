---
tags: meta
---
# Silverware Layout style

The look of [Silverware Layout](silverware-layout.md): its Page layout dialog. It is installed with the library.

```space-style
/* Silverware Layout (prefix swl-): the Page layout dialog ("Silverware Layout: Page layout"), over the page and
   SilverBullet's top bar, in the page's colors; over the part of the window an on-screen keyboard leaves
   (shared/dialog.ts sets where it is) */
.swl-dialog-backdrop {
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
.swl-dialog {
  --swl-dialog-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swl-dialog-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  display: flex;
  flex-direction: column;
  /* (Its border within the height: SilverBullet sets no box-sizing) */
  box-sizing: border-box;
  width: min(520px, calc(100vw - 24px));
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
.swl-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}
.swl-dialog-card {
  background: var(--swl-dialog-card);
  border: 1px solid var(--swl-dialog-line);
  border-radius: 8px;
}
.swl-dialog-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 9px 12px;
}
.swl-dialog-row + .swl-dialog-row {
  padding-top: 0;
}
.swl-dialog-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swl-dialog-name {
  font-weight: 500;
}
.swl-dialog-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
/* The default and the presets: a row of buttons, the one set pressed */
.swl-dialog-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swl-dialog-preset {
  padding: 4px 10px;
  background: var(--root-background-color);
  border: 1px solid var(--swl-dialog-line);
  border-radius: 6px;
}
.swl-dialog-preset:hover {
  border-color: var(--ui-accent-color);
}
.swl-dialog-preset[aria-pressed="true"] {
  color: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
  font-weight: 600;
}
/* A width: its number and its unit (px or %), side by side */
.swl-dialog-width {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swl-dialog-amount {
  width: 8em;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swl-dialog-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swl-dialog-amount:disabled {
  opacity: 0.5;
}
.swl-dialog-amount.swl-dialog-invalid {
  border-color: var(--danger-color, #c62828);
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
/* A phone: the whole screen */
@media (max-width: 480px) {
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
```
