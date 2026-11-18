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
:root[data-swa-syntax-shown] [data-swa-type]:not(.swa-frame),
:root[data-swa-syntax-shown] :has(> [data-swa-type]:not(.swa-frame)) {
  display: none !important;
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
  /* (Its own size: a control, not the text's, which the font zoom makes larger or smaller; important, as SilverBullet
     gives a widget's buttons the editor's font, its size inherited, by a rule naming its editor) */
  font: 14px/1 var(--ui-font, system-ui, sans-serif) !important;
  color: inherit;
  background: var(--root-background-color);
  opacity: 0;
  cursor: pointer;
}
[data-swa-type]:hover > .swa-more,
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
/* The settings window as tall on each tab: switching tabs does not move it */
.swa-dialog.swa-settings-window {
  height: min(600px, calc(var(--sw-view-height, 100dvh) - 32px));
}
/* A file's Rename (src/ui/renamedialog.ts): its title and its file's name, each a field with its note; the name's folder
   and extension beside its field, not in it */
.swa-dialog.swa-rename-window {
  min-height: 0;
  width: min(460px, calc(100vw - 32px));
}
.swa-rename {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swa-rename-label {
  font-weight: 600;
}
.swa-rename-label:not(:first-child) {
  margin-top: 10px;
}
.swa-rename-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swa-rename-field {
  flex: 1;
  min-width: 140px;
  padding: 5px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swa-dialog-line);
  border-radius: 6px;
}
.swa-rename-field[aria-invalid] {
  border-color: var(--danger-color, #c62828);
}
/* (A long folder cut short, its whole path in its title: the name's field keeps its room) */
.swa-rename-fixed {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.75;
}
.swa-rename-clear {
  flex: 0 0 auto;
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--swa-dialog-line);
  border-radius: 6px;
  cursor: pointer;
}
.swa-rename-clear[hidden] {
  display: none;
}
.swa-rename-from-title {
  align-self: flex-start;
  padding: 0;
  font: inherit;
  font-size: 13px;
  color: var(--ui-accent-color);
  text-decoration: underline;
  text-underline-offset: 2px;
  background: none;
  border: none;
  cursor: pointer;
}
.swa-rename-from-title:disabled {
  opacity: 0.45;
  text-decoration: none;
  cursor: default;
}
.swa-rename-note {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
}
.swa-rename-note.swa-rename-problem {
  color: var(--danger-color, #c62828);
  opacity: 1;
}
/* The insert dialog (src/ui/insertdialog.ts): a row per file (its icon and path, its note, how it is inserted, the
   file as it will be, at most 320 px high); with several, a row for all of them above; picked in it to upload */
/* (Of one height, as the settings window: a source opened, a row added or its note changed does not move it; its rows
   scroll within) */
.swa-dialog.swa-insert-window {
  min-height: 0;
  height: min(560px, calc(var(--sw-view-height, 100dvh) - 32px));
}
.swa-insert {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.swa-insert-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--swa-dialog-line);
}
.swa-insert-all[hidden] {
  display: none;
}
.swa-insert-rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.swa-insert-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.swa-insert-row[data-swa-left-out] {
  opacity: 0.6;
}
.swa-insert-row-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
/* Its one field (a link, words of the space's files) and Browse… in a row; what the field offers under it, a line each */
.swa-insert-pickers {
  display: flex;
  gap: 6px;
  align-items: center;
}
.swa-insert-add-field {
  flex: 1;
  min-width: 0;
  font: inherit;
}
.swa-insert-found {
  display: flex;
  flex-direction: column;
  max-height: 10em;
  overflow-y: auto;
}
.swa-insert-found[hidden] {
  display: none;
}
.swa-insert-found-item {
  display: grid;
  justify-items: start;
  min-width: 0;
  padding: 3px 6px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.swa-insert-found-item > * {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swa-insert-found-detail {
  opacity: 0.65;
  font-size: 0.85em;
}
.swa-insert-found-item:hover,
.swa-insert-found-item:focus-visible {
  background: color-mix(in srgb, currentColor 10%, transparent);
}
/* A row: its title first, under it what happens to the file (Upload, Link, Already in your space), its name and ✎ */
.swa-insert-title {
  flex: 1;
  min-width: 0;
  font: inherit;
}
.swa-insert-row-what {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  opacity: 0.75;
  font-size: 0.85em;
}
.swa-insert-what {
  flex: none;
  font-weight: 600;
}
.swa-insert-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swa-insert-edit {
  flex: none;
  padding: 0 4px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.swa-insert-edit[hidden],
.swa-insert-path[hidden] {
  display: none;
}
.swa-insert-picture {
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
}
/* Files dragged over the dialog: it takes them */
.swa-dialog.swa-insert-over {
  outline: 2px dashed var(--ui-accent-color, #4a6cf7);
  outline-offset: -4px;
}
/* Another plugin's upload: a row of two lines, its file a small picture at its left */
[data-swa-compact] .swa-insert-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 4px 10px;
  align-items: start;
}
[data-swa-compact] .swa-insert-sample {
  width: 56px;
  height: 48px;
  overflow: hidden;
  border-radius: 4px;
}
[data-swa-compact] .swa-insert-sample :is(img, video, canvas) {
  max-width: 56px;
  max-height: 48px;
  object-fit: cover;
}
[data-swa-compact] .swa-insert-sample .swa-label-line {
  display: none;
}
/* An image of the web: its address in place of its name in the space, where it is linked; where it is kept */
.swa-insert-address {
  flex: 1;
  min-width: 0;
  padding: 5px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.swa-insert-address[hidden],
.swa-insert-path[hidden],
.swa-insert-choices[hidden] {
  display: none;
}
.swa-insert-kept {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swa-insert-kept-label {
  font-size: 12px;
  opacity: 0.85;
}
.swa-insert-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swa-insert-icon,
.swa-insert-link-icon {
  display: inline-flex;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
}
.swa-insert-icon > svg,
.swa-insert-icon > img,
.swa-insert-link-icon > svg,
.swa-insert-link-icon > img {
  width: 100%;
  height: 100%;
}
.swa-insert-path {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swa-dialog-line);
  border-radius: 6px;
}
.swa-insert-path[aria-invalid="true"] {
  border-color: var(--danger-color, #c62828);
}
.swa-insert-row-note {
  font-size: 12px;
  opacity: 0.85;
}
.swa-insert-row-note:empty {
  display: none;
}
.swa-insert-row[data-swa-problem] .swa-insert-row-note {
  color: var(--danger-color, #c62828);
  opacity: 1;
}
.swa-insert-row-note .swa-insert-choices {
  display: inline-flex;
  margin-left: 4px;
  vertical-align: middle;
}
.swa-insert-choices {
  display: inline-flex;
  flex-wrap: wrap;
  align-self: flex-start;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--root-color) 6%, transparent);
}
.swa-insert-choice {
  padding: 4px 10px;
  background: none;
  border: 0;
  border-radius: 4px;
}
.swa-insert-choice[aria-checked="true"] {
  color: var(--ui-accent-color);
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.swa-insert-choice[aria-disabled="true"] {
  opacity: 0.35;
  cursor: default;
}
.swa-insert-choice:focus-visible,
.swa-insert-fix:focus-visible {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 1px;
}
.swa-insert-fix {
  padding: 0;
  text-decoration: underline;
  background: none;
  border: 0;
}
/* The file as it will be: as wide as the dialog, at most 320 px high, what is taller cut off */
.swa-insert-sample {
  max-height: 320px;
  overflow: hidden;
}
.swa-insert-sample > .swa-frame {
  max-width: 100%;
}
/* An image or a video shown full, fitted whole (the dialog is outside the editor, whose rules size them in the
   page: a photo of the camera showed at its own size, its corner alone in view) */
.swa-insert-sample [data-swa-view="full"] :is(img, video):not(.swa-icon img) {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
}
.swa-insert-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--link-color, var(--ui-accent-color));
  text-decoration: underline;
}
.swa-insert-held {
  padding: 12px;
  font-size: 13px;
  border: 1px dashed var(--swa-dialog-line);
  border-radius: 6px;
}
.swa-insert-empty[hidden] {
  display: none;
}
.swa-insert-pickers {
  display: flex;
  gap: 8px;
}
.swa-insert-pickers > button,
.swa-insert-held > button {
  padding: 6px 12px;
  background: var(--swa-dialog-card);
  border: 1px solid var(--swa-dialog-line);
  border-radius: 6px;
}
@media (pointer: coarse) {
  .swa-insert-choice {
    padding: 8px 14px;
  }
}
/* Files being uploaded (src/ui/uploadprogress.ts): a panel at the window's bottom right, a row each (its name, its
   state, a bar running while it uploads: SilverBullet tells no bytes written), how many are done above them. Several
   uploads at once one above another in a column. Put into the body, outside SilverBullet's root, whose theme's colours
   are set here */
.swa-upload-progress-stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: var(--sw-layer-menu);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 300px;
  max-width: calc(100vw - 32px);
}
.swa-upload-progress {
  box-sizing: border-box;
  padding: 10px 12px;
  font: 13px var(--ui-font, system-ui, sans-serif);
  color: var(--root-color, inherit);
  background: var(--root-background-color, #fff);
  border: 1px solid color-mix(in srgb, var(--root-color, currentColor) 15%, transparent);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  transition: opacity 0.2s;
}
.swa-upload-progress-leaving {
  opacity: 0;
}
.swa-upload-progress-head {
  margin-bottom: 8px;
  font-weight: 600;
}
.swa-upload-progress-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 30vh;
  overflow-y: auto;
}
.swa-upload-progress-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  row-gap: 4px;
}
.swa-upload-progress-icon {
  display: inline-flex;
  width: 14px;
  height: 14px;
}
.swa-upload-progress-icon > :is(svg, img) {
  width: 100%;
  height: 100%;
}
.swa-upload-progress-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swa-upload-progress-status {
  font-size: 12px;
  opacity: 0.7;
}
.swa-upload-progress-row[data-swa-upload="failed"] .swa-upload-progress-status {
  color: var(--danger-color, #c62828);
  opacity: 1;
}
.swa-upload-progress-bar {
  grid-column: 1 / -1;
  height: 3px;
  overflow: hidden;
  background: color-mix(in srgb, var(--root-color, currentColor) 12%, transparent);
  border-radius: 2px;
}
.swa-upload-progress-bar-fill {
  width: 0;
  height: 100%;
  background: var(--ui-accent-color, #0969da);
}
.swa-upload-progress-row[data-swa-upload="uploading"] .swa-upload-progress-bar-fill {
  width: 35%;
  animation: swa-upload-progress-run 1.1s ease-in-out infinite;
}
.swa-upload-progress-row[data-swa-upload="done"] .swa-upload-progress-bar-fill {
  width: 100%;
}
.swa-upload-progress-row[data-swa-upload="failed"] .swa-upload-progress-bar-fill {
  width: 100%;
  background: var(--danger-color, #c62828);
}
@keyframes swa-upload-progress-run {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(300%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .swa-upload-progress-row[data-swa-upload="uploading"] .swa-upload-progress-bar-fill {
    width: 100%;
    opacity: 0.5;
    animation: none;
  }
}
/* The assets' settings tabs (src/ui/mediatab.ts): a line on top saying what the tab sets, then its sections; a grid
   of rows where all files and each type are set alike (their names at the left, all files' row first, set apart) */
.swa-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.swa-settings-intro {
  margin: 0;
  font-size: 0.9em;
  color: color-mix(in srgb, var(--root-color) 70%, transparent);
}
.swa-settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swa-settings-heading {
  font-weight: 600;
}
.swa-settings-note {
  margin: 0;
  font-size: 0.85em;
  color: color-mix(in srgb, var(--root-color) 65%, transparent);
}
/* The Files tab (docs/silverware-assets-files-tab.md): a setting a line, its name then its control (all files', an
   open type's), the insert dialog's box under Inserted as; a type's row closed says what it sets of its own */
.swa-files-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swa-files-line {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 4px 12px;
}
.swa-files-name {
  color: color-mix(in srgb, var(--root-color) 75%, transparent);
}
.swa-files-line > .swa-settings-select {
  justify-self: start;
  max-width: 100%;
}
/* (Under Inserted as, in its control's column: the name column's width and the gap) */
.swa-files-under {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding-left: 122px;
}
.swa-file-types .swa-type-details {
  padding-top: 6px;
}
.swa-type-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9em;
  text-align: right;
}
.swa-type-summary-none {
  color: color-mix(in srgb, var(--root-color) 55%, transparent);
}
/* Saved previews: the folder and the clean-up under the box they belong to */
.swa-settings-indent {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 26px;
}
.swa-settings-action {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.swa-settings-folder:disabled {
  opacity: 0.5;
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
.swa-settings-side {
  width: 5em;
}
/* The previews' folder: room for a path */
.swa-settings-folder {
  width: 22em;
  max-width: 100%;
  font: inherit;
}
/* Fields one under another: a name and its control */
.swa-settings-fields {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 12px;
  align-items: center;
  justify-items: start;
}
.swa-settings-field {
  display: contents;
}
.swa-settings-check {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* A preview's rows (src/ui/mediatab.ts), as Silverware Database's properties: one for all files and one per type,
   apart by a line, one open at a time (its chevron turned, its head shaded), a type's marked Own where it has a label
   or a size of its own (what, said as it is opened); open, its label and its size, each with its way back */
.swa-types {
  border: 1px solid var(--swa-dialog-line);
  border-radius: 8px;
  overflow: hidden;
}
.swa-type + .swa-type {
  border-top: 1px solid var(--swa-dialog-line);
}
.swa-type-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 4px 6px 4px 12px;
  border: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  cursor: pointer;
}
.swa-type-head:hover,
.swa-type-open > .swa-type-head {
  background: var(--swa-dialog-card);
}
.swa-type-head > .swa-icon {
  width: 16px;
  height: 16px;
  color: color-mix(in srgb, var(--root-color) 60%, transparent);
}
.swa-type-name {
  font-weight: 500;
}
.swa-type-mark {
  padding: 0 6px;
  border-radius: 4px;
  font-size: 0.75em;
  line-height: 1.6;
  color: var(--ui-accent-color, #4a90e2);
  background: color-mix(in srgb, var(--ui-accent-color, #4a90e2) 12%, transparent);
}
.swa-type-chevron {
  display: inline-flex;
  margin-left: auto;
  padding: 0 4px;
  color: color-mix(in srgb, var(--root-color) 55%, transparent);
  transition: transform 0.15s;
}
.swa-type-chevron svg {
  width: 16px;
  height: 16px;
}
.swa-type-open .swa-type-chevron {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: reduce) {
  .swa-type-chevron {
    transition: none;
  }
}
.swa-type-details {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 14px 14px;
}
/* A type's way back to all files' (shown where it differs), at the open row's top right */
.swa-type-reset {
  display: flex;
  justify-content: flex-end;
  margin-bottom: -6px;
}
.swa-type-reset[hidden] {
  display: none;
}
.swa-type-size {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.swa-settings-button {
  padding: 4px 10px;
  border: 1px solid var(--swa-dialog-line);
  border-radius: 6px;
  font: inherit;
  font-size: 0.9em;
  background: var(--root-background-color);
  cursor: pointer;
}
.swa-settings-button:hover {
  background: var(--swa-dialog-card);
}
/* The Appearance tab's samples (src/ui/sample.ts; the editors ui/labeleditor.ts, ui/cardeditor.ts): what is edited
   picked by a switch; the properties not shown a row of chips of their names; then, on a ground of its own, a sample
   as the page draws it (a preview and its label, a card, a sentence with a link), its properties shown as they show
   there. Pointed at, focused or chosen (a click, a tap), a property is outlined, a pill of its name and a × over it,
   nothing moving; a finger has no pointing, so its name shows as it is chosen. */
.swa-settings-looks {
  display: flex;
}
.swa-settings-look {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.swa-settings-look[hidden] {
  display: none;
}
.swa-sample-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.swa-sample-hidden {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.swa-sample-hidden-name {
  font-size: 0.85em;
  color: color-mix(in srgb, var(--root-color) 65%, transparent);
}
/* (The row of those not shown: as wide as what is left, somewhere to drop a property to hide it) */
.swa-sample-hidden .swa-sample-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 120px;
  min-height: 30px;
  border-radius: 8px;
}
.swa-sample-hidden .swa-sample-list:empty::before {
  content: "None: all are shown";
  font-size: 0.85em;
  color: color-mix(in srgb, var(--root-color) 50%, transparent);
}
.swa-sample-stage {
  display: flex;
  justify-content: center;
  /* (Room over the top line for a property's name) */
  padding: 26px 12px 18px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
}
.swa-sample-hint {
  font-size: 0.8em;
  text-align: center;
  color: color-mix(in srgb, var(--root-color) 60%, transparent);
}
/* A property shown */
.swa-sample-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  margin: 0 -2px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  user-select: none;
}
.swa-sample-item:is(:hover, :focus-visible, [aria-selected="true"]) {
  box-shadow: 0 0 0 1px var(--ui-accent-color, #4a90e2);
  background: color-mix(in srgb, var(--ui-accent-color, #4a90e2) 10%, transparent);
}
/* Its name and its ×, over it: a pill whose ground reaches down to the property (no gap, the pointer stays on it on the
   way to the ×) */
.swa-sample-bar {
  position: absolute;
  bottom: 100%;
  left: -1px;
  display: flex;
  padding-bottom: 3px;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-weight: normal;
  visibility: hidden;
}
.swa-sample-tag {
  padding: 0 5px;
  border-radius: 3px 0 0 3px;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  color: #fff;
  background: var(--ui-accent-color, #4a90e2);
}
.swa-sample-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-left: 1px solid color-mix(in srgb, #fff 45%, transparent);
  border-radius: 0 3px 3px 0;
  font-size: 12px;
  line-height: 1;
  /* (The dialog's buttons take the text's colour: white as Save's) */
  color: #fff !important;
  background: var(--ui-accent-color, #4a90e2);
  cursor: pointer;
}
.swa-sample-remove:hover {
  background: color-mix(in srgb, var(--ui-accent-color, #4a90e2) 80%, #000);
}
.swa-sample-item:is(:hover, :focus-visible, [aria-selected="true"]) > .swa-sample-bar {
  visibility: visible;
}
@media (pointer: coarse) {
  /* (A finger: the pill large enough to take its ×, room for it over the top line) */
  .swa-sample-stage {
    padding-top: 34px;
  }
  .swa-sample-tag {
    font-size: 12px;
    line-height: 24px;
  }
  .swa-sample-remove {
    width: 26px;
    height: 24px;
    font-size: 15px;
  }
}
/* A property not shown: a chip of its name, outlined and quiet */
.swa-sample-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px dashed color-mix(in srgb, var(--root-color) 35%, transparent);
  border-radius: 999px;
  font: inherit;
  font-size: 0.85em;
  color: color-mix(in srgb, var(--root-color) 70%, transparent);
  background: var(--root-background-color);
  cursor: pointer;
  user-select: none;
}
.swa-sample-chip::before {
  content: "+";
  font-weight: 600;
}
.swa-sample-chip:hover {
  color: var(--root-color);
  border-color: var(--ui-accent-color, #4a90e2);
}
.swa-sample-chip:focus-visible {
  outline: 2px solid var(--ui-accent-color, #4a90e2);
  outline-offset: 2px;
}
/* A card's sample: as the page's card (.swa-card), not pressed itself; its name always shown */
.swa-sample-card {
  cursor: default;
}
.swa-sample-card:hover {
  background: none;
}
.swa-sample-card .swa-card-meta {
  opacity: 1;
}
.swa-sample-card .swa-card-meta > .swa-sample-item {
  color: color-mix(in srgb, var(--root-color) 70%, transparent);
}
.swa-sample-card .swa-card-meta > * + *::before {
  margin-right: 0;
}
/* A link's sample: a sentence of the page's text, the link in the accent's colour */
.swa-sample-sentence {
  margin: 0;
}
.swa-sample-link {
  color: var(--ui-accent-color, #4a90e2);
}
/* (In a line of text the property on the line as on the page: a box of the line's own (a flex box set the icon by its
   bottom edge, on the baseline), so the icon inside sits as the page sets it) */
.swa-sample-link .swa-sample-item {
  display: inline-block;
}
/* (The marker's outline clear of the link's last letter) */
.swa-sample-link .swa-sample-item[data-swa-field="marker"] {
  margin-left: 0.05em;
}
/* A preview's label (src/ui/labeleditor.ts): its sample a preview's box, the label's lines as the page's (.swa-label-line),
   a property dragged within them, to the other, or up to the row; a line without a property a slot saying so, every
   place outlined while one is dragged */
.swa-label-edit-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.swa-label-edit-sample {
  display: flex;
  flex-direction: column;
  width: 240px;
  max-width: 100%;
}
.swa-label-edit-line {
  column-gap: 0.9em;
  row-gap: 2px;
  font-size: 0.85em;
  line-height: 1.5;
  color: color-mix(in srgb, var(--root-color) 85%, transparent);
}
.swa-label-edit-line-above {
  margin-bottom: 2px;
}
.swa-label-edit-line-below {
  margin-top: 2px;
}
.swa-label-edit-line > .swa-sample-item {
  display: inline;
  cursor: grab;
  touch-action: pan-y;
}
.swa-label-edit .swa-sample-chip {
  cursor: grab;
  touch-action: pan-y;
}
/* (After the icon no dot, the next property near it, as on the page) */
.swa-label-edit-line > .swa-sample-item[data-swa-field="icon"] {
  margin-right: calc(-0.9em + 0.35em - 2px);
}
.swa-label-edit-line > .swa-sample-item[data-swa-field="icon"] + .swa-sample-item::before {
  content: none;
}
.swa-label-edit-line > .swa-sample-item + .swa-sample-item::before {
  content: "·";
  position: absolute;
  left: -0.6em;
  color: color-mix(in srgb, var(--root-color) 40%, transparent);
  pointer-events: none;
}
.swa-label-edit-line > .swa-sample-item:is(.swa-label-size, .swa-label-modified) {
  color: color-mix(in srgb, var(--root-color) 60%, transparent);
}
.swa-label-edit-line:empty,
.swa-label-edit-dragging .swa-label-edit-line {
  min-height: 1.5em;
  border-radius: 4px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--root-color) 25%, transparent);
}
.swa-label-edit-line:empty::before {
  content: "Drag a property here";
  font-style: italic;
  color: color-mix(in srgb, var(--root-color) 45%, transparent);
  padding: 0 4px;
}
.swa-label-edit-dragging .swa-label-edit-list {
  outline: 1px dashed color-mix(in srgb, var(--root-color) 30%, transparent);
  outline-offset: 3px;
}
.swa-label-edit-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 110px;
  border-radius: 4px;
  color: color-mix(in srgb, var(--root-color) 45%, transparent);
  background: color-mix(in srgb, var(--root-color) 10%, var(--root-background-color));
}
.swa-label-edit-preview .swa-icon {
  width: 36px;
  height: 36px;
}
/* A property dragged: its place held, dimmed; a copy following the pointer, over the dialog */
.swa-label-edit-placeholder {
  opacity: 0.35;
}
.swa-label-edit-ghost {
  position: fixed;
  z-index: var(--sw-layer-dragged);
  pointer-events: none;
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 13px;
  color: var(--root-color);
  background: var(--root-background-color);
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.swa-label-edit-ghost > .swa-sample-bar {
  visibility: hidden;
}
/* Embedded media (docs/silverware-assets.md), marked by Silverware Assets on the host's frame of each
   (data-swa-type: its type, data-swa-view: card, preview or full): the host's own drawing hidden where Silverware
   Assets draws instead; a preview of the host's drawing kept small; a card; the mark of a render that failed */
.swa-native-hidden {
  display: none !important;
}
/* (The host's medium alone, .swa-medium: never what a type draws, a document's page or its pictures) */
[data-swa-view="preview"] :is(img, video, object).swa-medium {
  max-height: var(--swa-height, 160px);
  max-width: min(100%, var(--swa-preview-width, 100%));
  width: auto !important;
  object-fit: contain;
  cursor: pointer;
}
/* An image's or a video's preview as large as the content's scale makes it (shared/contentscale.ts), one smaller than
   the preview's height too: the host's medium alone zoomed (not a picture a type draws in its own), its limits in px
   (the scale in them already) taken back by it, so it is counted once; a percentage is the room's, which zoom leaves */
[data-swa-view="preview"] :is(img, video).swa-medium {
  zoom: var(--sw-content-scale, 1);
  max-height: calc(var(--swa-height, 160px) / var(--sw-content-scale, 1));
  max-width: min(100%, calc(var(--swa-preview-width, 100000px) / var(--sw-content-scale, 1)));
}
/* The frame as wide as what is shown in it, without the host's border round a widget: its "…" at the medium's corner,
   not the page's (a card's at the text's right). A PDF's viewer, as wide as its room, keeps the text's width */
[data-swa-type] {
  position: relative;
  width: fit-content;
  max-width: 100%;
  border: none !important;
  /* (SilverBullet after 2.12.1 draws an embed as a Lua directive's block, and one of no image, video, audio or object
     as an embedded page's card: padded, its ground and corners its own, its source named above it, which made the
     frame as wide as the file's path. A file is as wide as it shows, drawn as Silverware Assets draws it) */
  padding: 0 !important;
  background: none !important;
  border-radius: 0 !important;
  min-height: 0 !important;
}
[data-swa-type]::before {
  content: none !important;
}
/* A file's picture (the host's medium, an image or a video) and a preview a type draws (a document's first page) with
   the corners and outline the theme gives a picture in the page, wherever the file is drawn (the page, a grid's cell,
   a field): its variables (SilverBullet's after 2.12.1), else none (2.12.1). The preview's content cut to its corners */
[data-swa-type] :is(img, video).swa-medium,
[data-swa-type] .swa-preview-face {
  border-radius: var(--ui-radius-lg, 0);
  outline: 1px solid var(--ui-surface-border-color, transparent);
  outline-offset: -1px;
}
[data-swa-type] .swa-preview-face {
  overflow: hidden;
}
[data-swa-type]:has(object.swa-medium:not(.swa-native-hidden, .swa-native-hidden *), .swa-pdf) {
  display: block;
  width: auto;
}
/* A PDF's preview of a width the settings give: its frame as wide as the preview, its "…" at the preview's corner
   (none given: as wide as the text, the frame too) */
[data-swa-type][data-swa-view="preview"][data-swa-preview-width]:has(object.swa-medium:not(.swa-native-hidden, .swa-native-hidden *), .swa-pdf) {
  width: fit-content;
  max-width: 100%;
}
/* The host's PDF viewer shown full, without a size of its own: as wide as its frame (the text's), so the frame's
   edge, and Silverware Layout's handle beside it, is the viewer's (SilverBullet 2.12.1 draws it 300 px wide, its
   style `max-width: 100%;`; one with a size, `width: 200px` after it, keeps it) */
[data-swa-type][data-swa-view="full"] object.swa-medium:not([style*="; width"]) {
  width: 100% !important;
  max-width: 100% !important;
}
/* Its height: a full file's setting (`full.height`, 480 px, or its type's own: `full.types`), or its embed's own (`|600x800`): SilverBullet gives
   the viewer none, so the browser's 150 px of an object showed it as small as a preview */
[data-swa-type][data-swa-view="full"] object.swa-medium {
  height: var(--swa-height, 480px) !important;
}
/* A card's frame: the card alone in it (its menu's way in within the card: its icon, else an arrow after its name) */
[data-swa-view="card"] {
  display: flex !important;
  align-items: center;
  gap: 4px;
}
.swa-frame[data-swa-view="card"] {
  display: inline-flex !important;
}
/* A file shown full at its own size (an image, a video; no width laid out by Silverware Layout's handle, which follows the
   scale itself): as large as the content's scale makes it (shared/contentscale.ts, this device's font zoom where the
   files zoom with it), never wider than its room (a percentage is the room's, which zoom leaves as it is). The host's
   medium alone, not its frame (its "…" and label keep their size) nor a picture a type draws in its own */
[data-swa-type][data-swa-view="full"]:not([data-swl-width]) :is(img, video).swa-medium {
  zoom: var(--sw-content-scale, 1);
  max-width: 100%;
}
/* A medium in markdown rendered outside the editor (a grid's cell) in a frame of Silverware Assets' own */
.swa-frame {
  display: inline-block;
  max-width: 100%;
  vertical-align: top;
}
/* Its medium a block in it, as in the page's frame (a block of its own there): inline, the room of a line's descent
   showed under it (6 px, 2026-11-18) */
.swa-frame > :is(img, video).swa-medium {
  display: block;
}
/* Laid out by the handle (its width on the frame, data-swl-width): the host's medium fills the frame, its height by
   its ratio, so a drag shows at once what the width written will draw (its medium alone: a document's pictures, a
   type's own drawing, keep theirs) */
[data-swa-type][data-swl-width]:not([data-swa-view="preview"]) :is(img, video, object).swa-medium {
  width: 100% !important;
  max-width: 100% !important;
  height: auto;
}
.swa-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  /* (Its padding and border within its 100%: else 22 px past the frame, which SilverBullet's cuts off, its end and the
     arrow there with it, measured 2026-11-14) */
  box-sizing: border-box;
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
/* An asset shown by an action: in a panel at the window's right (the side panel, over part of the window: the sheet's layer), or
   enlarged over the dimmed page (the enlarged view, a dialog's layer); its head its name, Open in a new tab and ×, its body the
   asset as large as the panel lets it be */
.swa-side-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--sw-layer-sheet);
  display: flex;
  flex-direction: column;
  width: min(560px, 100vw);
  max-width: 100vw;
  color: var(--root-color);
  background: var(--root-background-color);
  border-left: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.4));
  box-shadow: -6px 0 24px rgba(0, 0, 0, 0.18);
}
/* Its left edge dragged to set its width: a zone to hit over its height, the cursor saying what it does, nothing drawn
   but a line in the accent's color while pointed at or focused */
.swa-side-panel-resize {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -5px;
  z-index: 1;
  width: 10px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}
.swa-side-panel-resize::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  background: var(--ui-accent-color, #4a90e2);
  opacity: 0;
  transition: opacity 0.12s;
}
.swa-side-panel-resize:is(:hover, :focus-visible)::before {
  opacity: 1;
}
.swa-enlarged {
  position: fixed;
  inset: 0;
  z-index: var(--sw-layer-dialog);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}
.swa-enlarged-box {
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
/* The side panel's × first, at the edge it opened from: the head's padding even */
.swa-side-panel .swa-panel-head {
  padding-left: 6px;
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
.swa-enlarged .swa-panel-body > :is(img, video) {
  max-height: calc(92vh - 70px);
}
/* A type's reader as wide as its line (shared/assets.ts, ASSET_WIDE_ATTRIBUTE: a document's, read at any width): its
   frame the line's width, not its content's; in a panel the panel's room, its height too */
[data-swa-type]:has(> [data-asset-wide]) {
  display: block;
  width: auto;
}
.swa-panel-body > [data-asset-wide] {
  flex: 1;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
}
.swa-panel-body > object {
  width: 100% !important;
  height: 100% !important;
  min-height: 60vh;
}
.swa-enlarged .swa-panel-body > object {
  width: 85vw !important;
  height: calc(92vh - 70px) !important;
}
/* A link to a file of the space: its type's icon before its text, as large as the text; a picture alone (its menu is
   the arrow's after the text) */
.swa-link-icon {
  display: inline-flex;
  width: 1em;
  height: 1em;
  margin-right: 0.2em;
  /* (A 1em box from just under the baseline to the capitals' height: centred on the text's letters; `middle`, the
     lowercase letters' middle, sat it visibly lower, measured 2026-11-14) */
  vertical-align: -0.125em;
}
/* A menu's marker (docs/silverware-assets-label.md, *A link's marker*; always, since 2026-11-16, the icon no way in):
   a small arrow after a link, or after a card's name within the card, its menu's way in. Quiet (the text's colour, faded) so it reads
   as part of what it follows, not a stray mark; lit as pointed at or its menu open. It takes more than it draws, around
   it, but of the text a few px at most */
.swa-menu-marker {
  position: relative;
  display: inline-flex;
  width: 0.75em;
  height: 0.75em;
  margin-left: 0.12em;
  vertical-align: middle;
  border-radius: 3px;
  opacity: 0.5;
  cursor: pointer;
  transition: opacity 0.12s, background-color 0.12s;
}
.swa-menu-marker > svg {
  width: 100%;
  height: 100%;
}
.swa-menu-marker::after {
  content: "";
  position: absolute;
  inset: -6px -6px -6px -3px;
}
.swa-menu-marker:hover,
.swa-menu-marker[aria-expanded="true"] {
  opacity: 1;
  background: color-mix(in srgb, currentColor 15%, transparent);
}
@media (pointer: coarse) {
  .swa-menu-marker {
    opacity: 0.65;
  }
  .swa-menu-marker::after {
    inset: -12px -12px -12px -4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .swa-menu-marker {
    transition: none;
  }
}
/* (In a card: after its name, the card's gap before it, not the text's) */
.swa-card > .swa-menu-marker {
  margin-left: 0;
}
/* A preview's label (docs/silverware-assets-label.md): a line above it and one under it, as wide as the preview (they
   give the frame no width of their own but a least one), cut with "…"; the name and the alt text in the text's colour, the size and
   the date quieter; a click on them the preview's. Its line above moves the "…" (and the mark of a render that failed)
   down to the preview's corner: the line is 0.85em × 1.5 high, 2px apart from the preview */
.swa-label-line {
  display: block;
  contain: inline-size;
  /* (A tiny image's label not cut to nothing: the frame at least this wide, its "…" then at the frame's corner; a
     preview of any usual width, 100 px and more, stays as wide as it is) */
  min-width: 4em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.85em;
  line-height: 1.5;
  color: color-mix(in srgb, var(--root-color) 85%, transparent);
  cursor: pointer;
}
.swa-label-above {
  margin-bottom: 2px;
}
.swa-label-below {
  margin-top: 2px;
}
.swa-label-line > span + span::before {
  content: " · ";
  color: color-mix(in srgb, var(--root-color) 40%, transparent);
}
/* (After the type's icon no dot, the next property beside it, as a card and the settings' sample draw it) */
.swa-label-line > .swa-label-icon + span::before {
  content: none;
}
/* The type's icon: as high as the text, no dot after it */
.swa-label-icon {
  display: inline-flex;
  margin-right: 0.35em;
  vertical-align: -0.2em;
  color: color-mix(in srgb, var(--root-color) 70%, transparent);
}
.swa-label-icon > .swa-icon {
  width: 1.2em;
  height: 1.2em;
}
.swa-label-size,
.swa-label-modified {
  color: color-mix(in srgb, var(--root-color) 60%, transparent);
}
[data-swa-label-above] > .swa-more,
[data-swa-label-above] > .swa-failed {
  top: calc(1.275em + 2px + 4px);
}
/* A layer over a preview showing a document (a PDF's viewer, which takes every click on it): the preview's click the
   action the settings give, as an image's preview's (the "…" over it) */
.swa-shield {
  position: absolute;
  inset: 0;
  cursor: pointer;
}
.swa-pdf {
  display: block;
  /* (A width of its own where the settings give one, not a share: its frame takes its width from it) */
  width: var(--swa-preview-width, 100%);
  max-width: 100%;
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
/* (No ground of a button focused or tapped: the tab chosen is told by its line) */
.swa-dialog .swa-dialog-tab:is(:focus, :active) {
  background: none;
  -webkit-tap-highlight-color: transparent;
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
/* The settings tabs' room */
.swa-dialog-panel {
  padding: 14px 2px 6px;
}
/* On a phone (as the other plugins' dialogs): over the whole screen, no corners; its tabs a row that scrolls sideways,
   what a finger presses larger; the Files tab's rows a type's name over its three choices (four columns have no room) */
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swa-dialog,
  .swa-dialog.swa-settings-window {
    width: 100vw;
    height: 100vh;
    height: var(--sw-view-height, 100dvh);
    min-height: 0;
    max-height: none;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .swa-dialog-tabs {
    overflow-x: auto;
    scrollbar-width: none;
  }
  .swa-dialog-tab {
    flex: none;
    padding: 10px 12px;
    white-space: nowrap;
  }
  .swa-dialog-cancel,
  .swa-dialog-save {
    padding: 10px 18px;
  }
  .swa-dialog-close {
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
  }
  /* (A setting's name over its control: the dialog as narrow as the phone) */
  .swa-files-line {
    grid-template-columns: minmax(0, 1fr);
  }
  .swa-files-under {
    padding-left: 0;
  }
  .swa-type-summary {
    display: none;
  }
  .swa-settings-select,
  .swa-settings-number {
    min-height: 36px;
  }
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
/* An item's icon its own size, centred on its line: a plugin's own rules for its class (Silverware Assets' file
   icons, 22 px) do not reach into its menus. Where any item of a menu has an icon, each item keeps its place, so
   their words line up (an item without one an empty place) */
.swa-menu .swa-icon {
  width: auto;
  height: auto;
  align-items: center;
}
.swa-menu:has(.swa-menu-item > .swa-icon > svg) .swa-menu-item > .swa-icon {
  flex: 0 0 16px;
  width: 16px;
}
/* A menu of no icons: no empty place before an item's words (with the gap after it, they began further in than a row
   of choices' label above them) */
.swa-menu:not(:has(.swa-menu-item > .swa-icon:not(:empty))) .swa-menu-item > .swa-icon:empty {
  display: none;
}
.swa-menu .swa-icon > svg {
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
/* A row of icon buttons after a label: a choice (Align) or a pair of actions (Move up, Move down). Its buttons under
   the label, at the right, where they do not fit beside it (a menu as wide as a phone lets it: a grid's columns, eight
   of them, ran out of the menu), on more lines where they do not fit on one */
.swa-menu-segmented {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  padding: 2px 4px 2px 8px;
}
.swa-menu-segmented > .swa-segments {
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}
/* A menu whose items have icons: a row's label where their words begin (the icon's place and the gap after it) */
.swa-menu:has(.swa-menu-item > .swa-icon > svg) .swa-menu-segmented {
  padding-left: 32px;
}
/* A long label (a sheet's name) cut, whole in its tooltip: the menu as wide as its items; a short one whole, never
   squeezed by the buttons beside it (Show as) */
.swa-menu-segmented > .swa-label {
  flex: 0 0 auto;
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
/* <shared-scrollbar> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* The boxes of the plugin's own that scroll (a view, a list, a panel, a dialog's body, a menu): a thin scrollbar, its
   thumb quiet in the text's color and its track clear, the same in every plugin (Silverware Table's first). The page's
   own scrollbar is SilverBullet's, left as it is. Of no weight of its own (`:where`): a rule of the plugin's for one of
   them (a strip whose scrollbar is hidden) still holds. A theme sets another thumb by `--sw-scrollbar-thumb` */
:where(.swa-panel-body, .swa-dialog-body, .swa-insert-found, .swa-upload-progress-rows, .swa-menu) {
  scrollbar-width: thin;
  scrollbar-color: var(--sw-scrollbar-thumb, color-mix(in srgb, var(--root-color, #333) 30%, transparent)) transparent;
}
/* </shared-scrollbar> */
```
