---
name: Library/damesene/silverware-tags
tags: meta/library
description: "Silverware Tags: manage the tags of your space: rename and merge them everywhere (pages, items, tasks), delete them, give tags to many pages at once or to every page under a folder, edit a page's tags; every change previewed first, and undone with one command."
files:
- silverware-tags.js
---
# Silverware Tags

A manager for the tags of your space. Rename a tag everywhere it is used, merge two tags into one, delete a tag, give tags to many pages at once (every page of a folder too), and edit the tags of the page you are on. Every change across pages shows you what it changes first, and *Undo* takes it back.

## At a glance

* **Silverware Tags: Manager** shows every tag of the space as a tree: `project/alpha` is under `project` (a `/` in a tag's name makes levels). Type to find a tag, **↑ ↓** to go through them, **→ ←** to open and close a level. The tag you pick shows how many pages use it and where (on the page itself, in items, in tasks), the pages (click one to open it), and what you can do with it: *Rename…*, *Add to pages…*, *Remove from pages…*, *Delete…*.
* **Rename** a tag (*Rename…* in the manager, or the command **Silverware Tags: Rename tag**): every use of it changes, in the pages' frontmatter, on their tag lines, and in their text, items, tasks and tables. Renaming into a tag that exists merges the two. *With its subtags* renames the tags under it too: `project` to `work/project` makes `project/alpha` into `work/project/alpha`.
* **Tag pages** (the command **Silverware Tags: Tag pages**, or *Add to pages…* in the manager): pick pages in a tree of your folders (a folder's box picks every page under it, its own page too; type to find pages), then the tags to add and the tags to remove. Tags are added into each page's frontmatter (a page that has one already is left as it is); removed from the frontmatter and from the page's tag lines.
* **Page tags** (the command **Silverware Tags: Page tags**): the tags of the page you are on, to remove (×) or add (type, **Enter**; the tags of your space are offered as you type, **↑ ↓** and **Enter** or **Tab** to take one). *Save* writes them at once; **Ctrl+Z** in the page undoes it too.
* **Delete** a tag (*Delete…* in the manager): it is taken off every page using it: from the frontmatter, the tag lines, and the text (with the space beside it).
* **Before anything is written** you see each page that changes, its lines before and after, and the pages left alone and why. *Apply* writes them; *Cancel* writes nothing.
* **Undo**: the notification after a change has an *Undo* button (in SilverBullet's newer versions), the manager has one at its bottom, and the command **Silverware Tags: Undo last change** takes back the last change: every page goes back to how it was, unless you edited it since (that page is left as it is and named).

## Where tags are written

A page's own tags are its frontmatter's `tags` and its **tag lines** (a paragraph of nothing but hashtags, as SilverBullet reads them). Silverware Tags adds a page's tags into its frontmatter, in the form the page has them:

```yaml
---
tags:
  - project/alpha
  - meeting
---
```

A page without a frontmatter gets one; a page whose `tags` is written `tags: [a, b]` or `tags: a, b` keeps that form. The rest of the frontmatter stays as you wrote it, its comments too. A page whose tags it cannot read safely (a list in brackets over several lines) is left alone, and the preview says so.

Hashtags are found as SilverBullet finds them: not in code (blocks and `inline`), links, URLs or HTML. Those in headings and tables count too.

**Which pages use a tag** comes from SilverBullet's index, so a page it has not indexed yet is not found: wait a moment after a large edit (or run *Space: Reindex*).

## Settings

Each part can be turned off (CONFIG, or *Configuration: Open*); a change applies after a reload:

```lua
config.set("silverware.tags.modules", {
  rename = { enabled = true },   -- Rename (and merge)
  assign = { enabled = true },   -- Tag pages, Add to pages, Remove from pages
  pageTags = { enabled = true }, -- Page tags
  remove = { enabled = true },   -- Delete a tag
})
```

## Implementation

```space-lua
-- Settings, shown in the Configuration Manager (Configuration: Open)
config.defineCategory {
  name = "Silverware Tags",
  description = "A manager of the space's tags.",
  priority = 3,
}

config.define("silverware.tags", {
  description = "Silverware Tags settings",
  type = "object",
  properties = {
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        rename = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Rename a tag everywhere it is used; into a tag that exists, the two merge.", ui = { category = "Silverware Tags", label = "Rename", priority = 0.9 } } } },
        assign = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Give tags to pages picked in a tree of folders, and take them off.", ui = { category = "Silverware Tags", label = "Tag pages", priority = 0.8 } } } },
        pageTags = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Edit the tags of the page you are on.", ui = { category = "Silverware Tags", label = "Page tags", priority = 0.7 } } } },
        remove = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Delete a tag everywhere it is used.", ui = { category = "Silverware Tags", label = "Delete a tag", priority = 0.6 } } } },
      },
    },
  },
})

-- Silverware Tags only uses the public space, editor, index and config API, handed over here
if js and js.window then
  local silverwareTagsJs = js.importFromSpace("Library/damesene/silverware-tags.js")
  silverwareTagsJs.init({
    listPages = function()
      local names = {}
      for _, page in ipairs(space.listPages()) do
        table.insert(names, page.name)
      end
      return names
    end,
    -- The index's tags: one object per tag, page and context (the collection also holds objects tagged #tag);
    -- a table row's and a heading's hashtags are in none: the rows' and the headings' own tags
    queryTags = function()
      local records = {}
      for _, t in ipairs(query[[from index.tag "tag"]]) do
        if t.tag == "tag" then
          table.insert(records, { name = t.name, page = t.page, parent = t.parent })
        end
      end
      for _, kind in ipairs({ "table", "header" }) do
        for _, o in ipairs(query[[from index.tag(kind)]]) do
          for _, name in ipairs(o.tags or {}) do
            table.insert(records, { name = name, page = o.page, parent = kind })
          end
        end
      end
      return records
    end,
    readPage = space.readPage,
    writePage = space.writePage,
    getCurrentPage = editor.getCurrentPage,
    getText = editor.getText,
    replaceRange = editor.replaceRange,
    navigate = editor.navigate,
    flash = function(message, type, options)
      editor.flashNotification(message, type, options)
    end,
    -- Written pages indexed before the tags are read again
    awaitIndex = function()
      mq.awaitEmptyQueue("indexQueue")
    end,
    getConfig = config.get,
  })
  -- The commands of the core and of the modules turned on
  for _, name in ipairs(silverwareTagsJs.commandNames()) do
    command.define {
      name = name,
      run = function()
        silverwareTagsJs.runCommand(name)
      end,
    }
  end
end
```

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
.swg-dialog.swg-manager {
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

/* The manager: the tags left, the tag picked right (one under the other where it is narrow) */
.swg-manager .swg-dialog-body {
  display: flex;
  padding-bottom: 0;
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

/* Tag pages: the pages left, the tags right */
.swg-assign-body {
  display: flex;
  gap: 16px;
  min-height: 0;
}
.swg-assign-pages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 55%;
  min-width: 0;
}
.swg-tree-box-list {
  height: min(420px, calc(var(--sw-view-height, 100dvh) - 300px));
  overflow: auto;
  border: 1px solid var(--swg-line);
  border-radius: 6px;
  padding: 4px;
}
.swg-assign-body > .swg-form {
  flex: 1 1 45%;
  min-width: 0;
}

/* The preview: each page's lines before and after */
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
  background: color-mix(in srgb, var(--swg-danger) 14%, transparent);
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
  .swg-manager-body,
  .swg-assign-body {
    flex-direction: column;
  }
  .swg-manager-tags {
    flex: 0 0 40%;
  }
  .swg-tree-box-list {
    height: 40vh;
  }
}
```
