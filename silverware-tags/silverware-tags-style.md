---
tags: meta
---
# Silverware Tags style

The look of [Silverware Tags](silverware-tags.md): its window, the review of a change and the settings. It is installed with the library.

```space-style
/* Silverware Tags (prefix swg-): its dialogs, one over another (the preview
   over the manager), over the page and SilverBullet's top bar, in the
   page's colors */
.swg-dialog-backdrop {
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
.swg-dialog {
  --swg-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swg-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  --swg-accent: var(--ui-accent-color, #464cfc);
  --swg-danger: var(--danger-color, #c62828);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(820px, calc(100vw - 24px));
  max-height: min(760px, calc(var(--sw-view-height, 100dvh) - 32px));
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swg-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swg-dialog.swg-small {
  width: min(480px, calc(100vw - 24px));
}
.swg-dialog.swg-workspace {
  height: min(760px, calc(var(--sw-view-height, 100dvh) - 32px));
}
.swg-dialog *,
.swg-dialog *::before,
.swg-dialog *::after {
  box-sizing: border-box;
}
.swg-dialog:focus {
  outline: none;
}
.swg-dialog button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swg-dialog svg {
  width: 16px;
  height: 16px;
  flex: none;
}
.swg-dialog-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swg-dialog-titles {
  flex: 1;
  min-width: 0;
}
.swg-dialog-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.swg-dialog-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.7;
}
.swg-dialog-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swg-dialog-close:hover {
  opacity: 1;
  background: var(--swg-card);
}
.swg-dialog-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 16px 12px;
}
.swg-dialog-foot {
  padding: 10px 16px;
  border-top: 1px solid var(--swg-line);
}
.swg-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.swg-spacer {
  flex: 1;
}
.swg-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--swg-card);
  border: 1px solid var(--swg-line);
  border-radius: 6px;
}
.swg-button:hover:not(:disabled) {
  border-color: var(--swg-accent);
}
.swg-button:disabled {
  opacity: 0.5;
  cursor: default;
}
.swg-dialog .swg-primary {
  color: #fff;
  background: var(--swg-accent);
  border-color: var(--swg-accent);
}
.swg-dialog .swg-danger {
  color: var(--swg-danger);
}
.swg-dialog .swg-danger.swg-primary {
  color: #fff;
  background: var(--swg-danger);
  border-color: var(--swg-danger);
}
.swg-field,
.swg-chips {
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swg-line);
  border-radius: 6px;
}
.swg-field:focus,
.swg-chips:focus-within {
  outline: 2px solid color-mix(in srgb, var(--swg-accent) 45%, transparent);
  outline-offset: -1px;
}
.swg-field[aria-invalid="true"],
.swg-chips-input[aria-invalid="true"] {
  color: var(--swg-danger);
}
.swg-count {
  margin-left: auto;
  padding-left: 8px;
  font-size: 12px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.swg-empty,
.swg-note {
  margin: 8px 0;
  font-size: 13px;
  opacity: 0.75;
}
.swg-error {
  color: var(--swg-danger);
  opacity: 1;
}
.swg-section {
  margin: 14px 0 6px;
  font-size: 13px;
}

/* Fields of tags: the tags offered under one, chips */
.swg-field-wrap {
  position: relative;
  display: block;
}
.swg-suggest {
  position: absolute;
  z-index: 1;
  top: calc(100% + 2px);
  left: 0;
  min-width: 200px;
  max-width: 100%;
  margin: 0;
  padding: 3px;
  list-style: none;
  background: var(--root-background-color);
  border: 1px solid var(--swg-line);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
}
.swg-suggest[hidden] {
  display: none;
}
.swg-suggest-item {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.swg-suggest-item:hover,
.swg-suggest-item[aria-selected="true"] {
  background: color-mix(in srgb, var(--swg-accent) 15%, transparent);
}
.swg-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  cursor: text;
}
.swg-chips-list {
  display: contents;
}
.swg-chips-field {
  flex: 1;
  min-width: 120px;
}
.swg-chips-input {
  width: 100%;
  padding: 2px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
}
.swg-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 2px 1px 8px;
  background: color-mix(in srgb, var(--swg-accent) 14%, transparent);
  border-radius: 999px;
  overflow-wrap: anywhere;
}
/* A tag only in the pages' text: shown, not changed in this view (no ×) */
.swg-chip.swg-chip-text {
  padding-right: 8px;
  background: transparent;
  border: 1px dashed var(--swg-line);
  opacity: 0.8;
}
.swg-form-row[hidden] {
  display: none;
}
.swg-chips[data-swg-kind="remove"] .swg-chip {
  background: color-mix(in srgb, var(--swg-danger) 14%, transparent);
}
.swg-chip-remove {
  display: inline-flex;
  padding: 2px;
  background: none;
  border: 0;
  border-radius: 50%;
  opacity: 0.6;
}
.swg-chip-remove:hover {
  opacity: 1;
}
.swg-chip-remove svg {
  width: 12px;
  height: 12px;
}

/* Forms */
.swg-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.swg-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.swg-form-label {
  font-size: 12px;
  font-weight: 600;
}
.swg-form-hint {
  font-size: 12px;
  opacity: 0.65;
}
.swg-check {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swg-check[hidden] {
  display: none;
}
/* The review's choices: where from, how in the text, the subtags */
.swg-review-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 12px;
}
.swg-choice {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}
.swg-choice .swg-form-label {
  min-width: 7em;
}
.swg-choice-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
.swg-select {
  width: auto;
  max-width: 100%;
  padding: 4px 8px;
}

/* Trees: the manager's tags, the pages to tag */
.swg-tags,
.swg-tree,
.swg-tree-children {
  margin: 0;
  padding: 0;
  list-style: none;
}
.swg-tree-children {
  padding-left: 16px;
}
.swg-tag-row,
.swg-tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 6px 0 2px;
  border-radius: 5px;
}
.swg-tag-row {
  cursor: pointer;
}
.swg-tag-row:hover,
.swg-tree-row:hover {
  background: var(--swg-card);
}
.swg-tag-item[aria-selected="true"] > .swg-tag-row {
  background: color-mix(in srgb, var(--swg-accent) 16%, transparent);
}
.swg-tree-toggle {
  display: inline-flex;
  flex: none;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: 0;
  opacity: 0.6;
}
.swg-tree-toggle svg {
  width: 14px;
  height: 14px;
  transition: transform 0.1s;
}
.swg-tree-toggle[aria-expanded="true"] svg {
  transform: rotate(90deg);
}
.swg-tag-name,
.swg-tree-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swg-tag-name::before {
  content: "#";
  opacity: 0.45;
}
.swg-level {
  opacity: 0.7;
}
.swg-tree-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}
.swg-tree-icon {
  display: inline-flex;
  opacity: 0.55;
}

/* The window: its views as tabs under the title (By tag, By page), the view or a change's review in its body */
.swg-views {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 0 12px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--swg-line);
}
.swg-views[hidden] {
  display: none;
}
.swg-view-tab {
  flex: none;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swg-view-tab:hover {
  opacity: 1;
}
.swg-view-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--swg-accent);
}
.swg-workspace .swg-dialog-body {
  display: flex;
  padding-top: 12px;
  padding-bottom: 0;
}
.swg-workspace-body {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.swg-review {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding-bottom: 12px;
}
.swg-review-title {
  margin: 0 0 4px;
  font-size: 16px;
  overflow-wrap: anywhere;
}
/* Tags | Meta above the tags, as SilverBullet's tree has its segments */
.swg-segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--swg-card);
  border: 1px solid var(--swg-line);
  border-radius: 6px;
}
.swg-segment {
  flex: 1;
  padding: 3px 8px;
  font-size: 13px;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.75;
}
.swg-segment[aria-pressed="true"] {
  opacity: 1;
  font-weight: 600;
  background: var(--root-background-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
/* The tag's name, a field renaming it: as a heading until it is edited */
.swg-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 4px;
  margin: 0 0 4px;
}
.swg-name-hash {
  font-size: 18px;
  font-weight: 700;
  opacity: 0.45;
}
.swg-name > .swg-field-wrap {
  flex: 1;
  min-width: 160px;
}
.swg-dialog .swg-name-field {
  padding: 2px 6px;
  font-size: 18px;
  font-weight: 700;
  border-color: transparent;
  background: transparent;
}
.swg-dialog .swg-name-field:hover,
.swg-dialog .swg-name-field:focus {
  border-color: var(--swg-line);
  background: var(--root-background-color);
}
.swg-name-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-basis: 100%;
  padding-left: 16px;
}
.swg-name-actions[hidden] {
  display: none;
}
.swg-name-actions .swg-note {
  flex: 1;
  margin: 0;
}
/* The tags of the pages checked: how many of them have one, one to take off struck through */
/* Cleanup: each group of tags likely one, the tag to merge into picked among them */
.swg-cleanup-group {
  padding: 8px 10px;
  margin: 0 0 8px;
  border: 1px solid var(--swg-line);
  border-radius: 6px;
}
.swg-cleanup-group .swg-form-label {
  margin: 0 0 6px;
}
.swg-cleanup-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swg-dialog .swg-cleanup-chips {
  flex: 1;
  outline: none;
  border: 0;
  padding: 0;
  background: none;
}
.swg-cleanup-choice {
  cursor: pointer;
  padding-right: 8px;
}
.swg-cleanup-choice input {
  margin: 0 4px 0 0;
}
.swg-cleanup-once {
  border: 0;
  padding: 0;
  background: none;
}
.swg-dialog .swg-cleanup-tag {
  padding: 1px 8px;
  border: 0;
  cursor: pointer;
}
/* The Tags panel (SilverBullet's navigator): the page open's tags, shown first, their # (a level's folder) in the
   accent color */
.sb-nav-row.swg-here .sb-nav-icon,
.sb-nav-row.sb-nav-folder.swg-here > .sb-nav-icon {
  color: var(--ui-accent-color);
  opacity: 1;
}
/* Several tags picked: them as chips, an action asking for a name under its buttons */
.swg-chosen {
  margin: 0 0 12px;
  cursor: default;
}
.swg-ask:not(:empty) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 14px;
}
.swg-their-tags {
  min-height: 38px;
  cursor: default;
}
.swg-chip-count {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.65;
}
.swg-chip.swg-removing {
  background: color-mix(in srgb, var(--swg-danger) 14%, transparent);
}
.swg-chip.swg-removing .swg-chip-name {
  text-decoration: line-through;
  opacity: 0.7;
}
.swg-manager-body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
}
.swg-manager-tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 280px;
  min-height: 0;
}
.swg-tags {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 12px;
}
.swg-tags:focus {
  outline: none;
}
.swg-detail {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding-bottom: 12px;
}
.swg-detail-name {
  margin: 4px 0;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.swg-detail-uses {
  margin: 0 0 12px;
  font-size: 13px;
  opacity: 0.75;
}
.swg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.swg-pages {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--swg-line);
}
.swg-pages li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--swg-line);
}
.swg-page-link {
  padding: 0;
  text-align: left;
  background: none;
  border: 0;
  color: var(--swg-accent) !important;
  overflow-wrap: anywhere;
}
.swg-page-link:hover {
  text-decoration: underline;
}
.swg-page-contexts {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.6;
  white-space: nowrap;
}
.swg-more {
  margin-top: 8px;
}
.swg-progress {
  width: 100%;
  accent-color: var(--swg-accent);
}
.swg-foot-row .swg-undo {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* By page: Untagged, how many the search shows, Check all shown */
.swg-page-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}
/* (How many are shown on a line of its own under them: beside them it wrapped word by word) */
.swg-page-filters .swg-shown {
  order: 1;
  flex: 1 0 100%;
  margin: 0;
  font-size: 12px;
}
.swg-check-shown {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 12px;
  white-space: nowrap;
}

/* By page: the pages' tree in a box of its own, scrolled */
.swg-tree-box-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-bottom: 12px;
  border: 1px solid var(--swg-line);
  border-radius: 6px;
  padding: 4px;
}

/* The review: each page's lines before and after */
.swg-preview-page {
  margin: 0 0 6px;
  border: 1px solid var(--swg-line);
  border-radius: 6px;
}
.swg-preview-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
}
.swg-preview-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
/* <shared-diff> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */
/* A document's change as a review shows it (shared/diffview.ts): its runs of lines, each its first line's number, the
   lines removed and added */
.swg-diff {
  padding: 4px 10px 8px;
  font: 12px/1.5 var(--editor-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}
.swg-diff-run + .swg-diff-run {
  margin-top: 6px;
}
.swg-diff-line-number {
  font-family: var(--ui-font, system-ui, sans-serif);
  font-size: 11px;
  opacity: 0.55;
}
.swg-diff-removed,
.swg-diff-added {
  padding: 0 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 3px;
}
.swg-diff-removed {
  background: color-mix(in srgb, var(--danger-color, #c62828) 14%, transparent);
}
.swg-diff-removed::before {
  content: "− ";
  opacity: 0.6;
}
.swg-diff-added {
  background: color-mix(in srgb, #2e9e4f 16%, transparent);
}
.swg-diff-added::before {
  content: "+ ";
  opacity: 0.6;
}
/* </shared-diff> */
.swg-skipped {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

/* A phone: the whole screen, one part under the other */
@media (max-width: 640px) {
  .swg-dialog,
  .swg-dialog.swg-small {
    width: 100vw;
    max-height: none;
    height: var(--sw-view-height, 100dvh);
    border-radius: 0;
  }
  .swg-manager-body {
    flex-direction: column;
  }
  .swg-manager-tags {
    flex: 0 0 40%;
  }
}

/* The settings dialog ("Silverware Tags: Settings", the window's gear):
   the toolbar's settings' look: tabs, rows in cards, switches; of one height, so switching tabs moves nothing */
/* Over the part of the window an on-screen keyboard leaves (shared/dialog.ts sets where it is) */
.swg-settings-backdrop {
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
.swg-settings {
  --swg-settings-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swg-settings-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
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
  border: 1px solid var(--swg-settings-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swg-settings:focus {
  outline: none;
}
.swg-settings button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swg-settings-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swg-settings-titles {
  flex: 1;
  min-width: 0;
}
.swg-settings-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swg-settings-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
}
.swg-settings-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swg-settings-close:hover {
  opacity: 1;
  background: var(--swg-settings-card);
}
.swg-settings-close svg {
  width: 16px;
  height: 16px;
}
/* One row however many tabs: too wide for the dialog (a phone), it scrolls sideways */
.swg-settings-tabs {
  /* Never shrunk by a tall body (it scrolls sideways, so a column's flex would squeeze it: on a phone it slid under the body) */
  flex: none;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swg-settings-line);
}
.swg-settings-tab {
  flex: none;
  white-space: nowrap;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swg-settings-tab:hover {
  opacity: 1;
}
.swg-settings-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swg-settings-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
.swg-settings-panel[hidden] {
  display: none;
}
.swg-settings-group {
  margin: 14px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}
.swg-settings-panel > .swg-settings-card:first-child {
  margin-top: 12px;
}
.swg-settings-card {
  background: var(--swg-settings-card);
  border: 1px solid var(--swg-settings-line);
  border-radius: 8px;
}
.swg-settings-card > :not(:first-child) {
  border-top: 1px solid var(--swg-settings-line);
}
.swg-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
}
.swg-settings-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swg-settings-module-name,
.swg-settings-name {
  font-weight: 500;
}
.swg-settings-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.swg-settings-row select,
.swg-settings-row input[type="number"] {
  flex: none;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swg-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swg-settings-row select {
  max-width: 55%;
}
.swg-settings-row input[type="number"] {
  width: 6.5em;
}
.swg-settings-row input.swg-settings-invalid {
  border-color: var(--danger-color, #c62828);
}
/* A switch: the checkbox (invisible, still focusable) drawn as a track and a knob */
.swg-settings-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
}
.swg-settings-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swg-settings-knob {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--root-color) 22%, var(--root-background-color));
  transition: background 0.15s;
  pointer-events: none;
}
.swg-settings-knob::after {
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
.swg-settings-switch input:checked + .swg-settings-knob {
  background: var(--ui-accent-color);
}
.swg-settings-switch input:checked + .swg-settings-knob::after {
  transform: translateX(14px);
}
.swg-settings-switch input:focus-visible + .swg-settings-knob {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 2px;
}
.swg-settings-switch input:disabled + .swg-settings-knob {
  opacity: 0.5;
}
/* A module's own settings: under it, indented, while it is on */
.swg-settings-module-settings {
  margin: 0 12px 10px 24px;
  border-left: 2px solid var(--swg-settings-line);
}
.swg-settings-module-settings .swg-settings-row {
  padding: 6px 0 6px 12px;
}
.swg-settings-module-settings[hidden] {
  display: none;
}
.swg-settings-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swg-settings-line);
}
.swg-settings-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swg-settings-cancel,
.swg-settings-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swg-settings-line);
  background: var(--root-background-color);
}
.swg-settings-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swg-settings-save:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swg-settings {
    width: 100vw;
    height: 100vh;
    height: var(--sw-view-height, 100dvh);
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swg-settings-body {
    flex: 1 1 auto;
  }
  .swg-settings-tab {
    padding: 10px 12px;
  }
  .swg-settings-row {
    min-height: 44px;
  }
  .swg-settings-cancel,
  .swg-settings-save {
    padding: 10px 18px;
  }
  .swg-settings-row {
    flex-wrap: wrap;
  }
  /* The name keeps room to be read; a control that does not fit beside it goes under it, the row's width */
  .swg-settings-label {
    flex: 1 1 14em;
  }
  .swg-settings-row select {
    flex: 1 1 auto;
    max-width: 100%;
  }
  .swg-settings-row select,
  .swg-settings-row input[type="number"] {
    font-size: 16px;
  }
}
```
