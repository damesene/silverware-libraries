---
name: Library/damesene/silverware-tags
tags: meta/library
description: "Silverware Tags: manage the tags of your space in one window: rename and merge them everywhere (pages, items, tasks), delete them, give tags to many pages at once or to every page under a folder, edit a page's tags; every change reviewed first, and undone with one command."
files:
- silverware-tags.js
---
# Silverware Tags

A manager for the tags of your space. Rename a tag everywhere it is used, merge two tags into one, delete a tag, give tags to many pages at once (every page of a folder too), and edit the tags of the page you are on. Every change shows you what it changes first, and *Undo* takes it back.

## At a glance

Everything is in one window, **Silverware Tags: Manager**, with two views (tabs at its top) and nothing opening over it:

* **By tag**: every tag of the space as a tree (`project/alpha` is under `project`: a `/` in a tag's name makes levels). Type to find a tag, **↑ ↓** to go through them, **→ ←** to open and close a level; in the tree **F2** puts you in the tag's name to rename it, **Delete** deletes it (reviewed first). **Ctrl** (Cmd) and a click picks several tags (**Shift** and a click those between): *Merge into…* makes them one tag (the field offers your tags; a new name too), *Delete N tags…* deletes them all, each reviewed first. The tag you pick shows how many pages use it and where (on the page itself, in items, in tasks, in tables), its pages (click one to open it) and what you can do with it.
  * **Rename**: its name is a field: type the new name and press **Enter** (or *Rename…*). Every use of it changes: the pages' frontmatter, their tag lines, and their text, items, tasks, tables and headings. A name another tag has merges the two, which the field says as you type. A tag with tags under it renames them too (`project` to `work/project` makes `project/alpha` into `work/project/alpha`), unless you untick *Its subtags too* in the review. **Esc** puts the name back.
  * **Delete tag…**: takes it off every page using it (from the frontmatter, the tag lines and the text, with the space beside it); its subtags too if you tick that in the review.
  * **Add to pages…** and **Remove from pages…** take you to *By page* with the tag to add, or with the pages having it picked and the tag to take off.
* **By page** (the command **Silverware Tags: Tag pages**): your pages as a tree of folders. Tick pages, or a folder for every page under it (its own page too); type to find pages. On the right are the tags the pages you picked have, each with how many of them have it (`2/3`): **×** takes one off them all (click again to keep it), and the *Add* field gives tags to them all (the tags of your space are offered as you type: **↑ ↓** and **Enter**, or **Tab** for the first). Then *Review changes…*. Tags are added into each page's frontmatter (a page that has one already is left as it is) and taken off its frontmatter and its tag lines; a hashtag in a page's text stays (*Delete tag* takes those off).
* **Silverware Tags: Page tags** opens *By page* with the page you are on picked.
* **Cleanup** (a tab of the window): tags that are likely one, found by their names: the same but for capitals or a separator (`Todo`, `to-do`, `todo`), a plural of another (`ideas`, `idea`), or one letter apart at the same level (`meeting`, `meetnig`; names of five letters or more). Each group offers the tag to merge into (the most used, unless you pick another) and *Merge…*, reviewed first. Below them the tags used on one page only, each opening in *By tag*.
* **The Tags panel** (the command **Silverware Tags: Tags panel**): the tags as a tree in SilverBullet's right sidebar, beside your pages (its menu moves it to the left or the bottom; it stays open across reloads). Each tag shows how many pages use it, a level how many use a tag under it. **The tags of the page you are on come first, their # in the accent color** (and so does a level holding one); *This page* above it shows only them, *Page tags* and *Tasks* only those, and its filter field finds a tag. A click opens a level; the buttons of a row (shown as the pointer is over it) **add the tag to the page you are on** (+; at once, as one of its own tags; Undo takes it back), or where it is one of the page's own tags already **take it off** (−: from its frontmatter and tag lines), and **open it in the window**. **F2** opens it in the window with its name to type, and dragging a tag onto another level moves it there (`alpha` dropped on `work` becomes `work/alpha`, its subtags with it), reviewed in the window first.
* **SilverBullet's own pages are left alone** (*Hide and protect meta pages*, on by default): a page tagged `meta` or a tag under it (`meta/library`, `meta/template`…: libraries, templates, SilverBullet's API) is out of everything. Its tags show nowhere (a tag a library's documentation uses, `#VALUE!` written in its text, is not one of yours), and no change touches it: renaming `#auto` to `#automobile` renames it on every page but those. Turned off (*Silverware Tags: Settings*), they show, their tags apart (the panel's and the window's *Meta*, as SilverBullet's own tree has its meta pages apart), and changes reach them. **Enter** or a click opens the tag in the window, **F2** opens it with its name to type, and dragging a tag onto another level moves it there (`alpha` dropped on `work` becomes `work/alpha`, its subtags with it), reviewed in the window first.
* **Every change is reviewed first**, in the same window: each page that changes with its lines before and after (the first few open, click a page for its lines), and the pages left alone and why. *Apply* writes them and takes you back; *Back* (or **Esc**) changes nothing.
* **Undo**: the window's *Undo* at its bottom, the notification after a change (in SilverBullet's newer versions) and the command **Silverware Tags: Undo last change** take back the last change, reviewed as any change: you see each page going back to how it was, and a page you edited since is left as it is (named in the review). *Apply* writes them; the change before it is then the one to undo.

## Where tags are written

A page's own tags are its frontmatter's `tags` and its **tag lines** (a paragraph of nothing but hashtags, as SilverBullet reads them). Silverware Tags adds a page's tags into its frontmatter, in the form the page has them:

```yaml
---
tags:
  - project/alpha
  - meeting
---
```

A page without a frontmatter gets one; a page whose `tags` is written `tags: [a, b]` or `tags: a, b` keeps that form. The rest of the frontmatter stays as you wrote it, its comments too. A page whose tags it cannot read safely (a list in brackets over several lines) is left alone, and the review says so.

Hashtags are found as SilverBullet finds them: not in code (blocks and `inline`), links, URLs or HTML. Those in headings and tables count too.

**Which pages use a tag** comes from SilverBullet's index, so a page it has not indexed yet is not found: wait a moment after a large edit (or run *Space: Reindex*).

## Settings

**Silverware Tags: Settings** (or the gear at the bottom of the window): *Hide and protect meta pages* on the *General* tab, each part on the *Modules* tab. They are saved in CONFIG (shown in *Configuration: Open* too); a module turned on or off applies after a reload, which *Save and reload* does. In CONFIG:

```lua
config.set("silverware.tags.protectMeta", true)
config.set("silverware.tags.modules", {
  rename = { enabled = true }, -- Rename (and merge): the tag's name as a field
  pages = { enabled = true },  -- By page, Tag pages, Page tags, Add to pages, Remove from pages
  remove = { enabled = true }, -- Delete tag
  cleanup = { enabled = true }, -- Cleanup: tags likely one, tags used once
  panel = { enabled = true },  -- The Tags panel beside the page
  custom = { enabled = true }, -- Custom operations
})
```

## Custom operations

Things of your own done with a tag, in a JS file of your space, given to Silverware Tags in Space Lua:

```lua
silverware.tags.defineOperations(js.importFromSpace("Library/me/tag-operations.js"))
```

Each is a button of the tag you pick in the window, after the built-in ones, and works as they do: you see every change first, *Undo* takes it back, and SilverBullet's meta pages are left alone (*Hide and protect meta pages*). The file exports a list of operations, or a function that gets the helpers and returns them:

```js
export default (helpers) => [
  // The tag made lower case everywhere (merged with one of that name)
  {
    name: "lowerCase",
    label: "Lower case",
    when: (context) => context.tag !== context.tag.toLowerCase(),
    edit: (text, page, context) => helpers.renameTags(text, (name) => (name === context.tag ? name.toLowerCase() : undefined)),
  },
  // The tag given to every page that uses it in a task, as a page's own tag
  {
    name: "promote",
    label: "Make it the page's",
    pages: (context) => context.contexts(context.tag).task ?? [],
    edit: (text, page, context) => helpers.addPageTags(text, [context.tag]),
  },
];
```

* `name` (letters, digits, `_`), `label` (its button). `title(context)`: the review's title (else the label and the tag). `danger: true` shows it in the danger color (it takes something away).
* `when(context)`: whether it is offered for the tag (left out: always).
* `pages(context)`: the pages it may change (left out: those using the tag); the others are not read.
* `edit(text, page, context)` gets a page's text and gives the text it should have: a text, `{ text, changes }` (what the helpers give), or nothing (the page as it is). It may be `async`.
* `context`: `tag` (the tag the button is on), `tags` and `pages` (every tag and page of the space, meta pages left out while they are protected), `pagesWith(tag, children)` (the pages using a tag, with `children` its subtags' too), `contexts(tag)` (its pages by where it is used: `page`, `item`, `task`, `table`, `header`).
* Helpers, the functions the built-in operations are made of (text in, text out): `renameTags(text, rename)` (`rename(name)` gives a tag's new name, or nothing), `removeTags(text, match)`, `addPageTags(text, names)` (into the frontmatter), `removePageTags(text, names)` (from the frontmatter and the tag lines), `pageTags(text)`, `frontmatterTags(text)`, `hashtags(text)` (each with its `name`, place and `context`), `tagUses(text)`, `hashtagOf(name)`, `isMetaTag(name)`, `renamedTag(name, from, to, children)`, `matches(name, tag, children)`, `isWithin(name, root)`, `parentOf(name)`, `nameProblem(name)`, `applyEdits(text, edits)`.

A mistake in a definition is a notification; a page an operation's `edit` fails on is left alone and named in the review. Definitions are made again each time Space Lua loads. The *Custom operations* module (Settings) turns them off.

## Implementation

```space-lua
-- priority: 50
-- Silverware Tags' Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.tags.defineOperations, see "Custom operations"
silverware = silverware or {}
silverware.tags = silverware.tags or {}
if js and js.window then
  local silverwareTagsJs = js.importFromSpace("Library/damesene/silverware-tags.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareTagsJs.resetDefinitions()
  -- The others are defined; a mistake is shown, the rest of the script goes on
  function silverware.tags.defineOperations(definitions)
    local problem = silverwareTagsJs.defineOperations(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
else
  -- Space Lua without a window (nothing to show): nothing to define
  function silverware.tags.defineOperations() end
end
```

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
    protectMeta = {
      type = "boolean",
      default = true,
      description = "SilverBullet's own pages (tagged meta or a tag under it: libraries, templates, its API) are left out: their tags show nowhere and no change touches them. Off: they show, their tags apart (Meta), and changes reach them.",
      ui = { category = "Silverware Tags", label = "Hide and protect meta pages", priority = 1 },
    },
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        rename = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Rename a tag everywhere it is used; into a tag that exists, the two merge.", ui = { category = "Silverware Tags", label = "Rename", priority = 0.9 } } } },
        pages = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "The view by page: tags given to the pages picked in a tree of folders, and taken off them; the tags of the page you are on.", ui = { category = "Silverware Tags", label = "By page", priority = 0.8 } } } },
        remove = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Delete a tag everywhere it is used.", ui = { category = "Silverware Tags", label = "Delete a tag", priority = 0.6 } } } },
        cleanup = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "The window's Cleanup: tags likely one (case, a separator, a plural, a typo) to merge, tags used on one page only.", ui = { category = "Silverware Tags", label = "Cleanup", priority = 0.55 } } } },
        panel = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "The tags as a panel beside the page (SilverBullet's navigator): a tag opens the Tags window, F2 renames it, a tag dragged under another moves it there.", ui = { category = "Silverware Tags", label = "Tags panel", priority = 0.5 } } } },
        custom = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Your own operations on a tag, from a JS file of the space given with silverware.tags.defineOperations: a button of the tag, its changes reviewed first.", ui = { category = "Silverware Tags", label = "Custom operations", priority = 0.4 } } } },
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
    confirm = editor.confirm,
    -- The settings dialog: saved as SilverBullet's Configuration Manager saves
    -- (the CONFIG page, indexed, the configuration loaded again)
    saveConfigPage = function(text)
      space.writePage("CONFIG", text)
      -- Written: the rest only loads it; a failure there says so, the page is saved
      local ok, err = pcall(function()
        if sync and sync.performFileSync then sync.performFileSync("CONFIG.md") end
        mq.send("indexQueue", "CONFIG.md")
        mq.awaitEmptyQueue("indexQueue")
        editor.reloadConfigAndCommands()
        if editor.rebuildEditorState then editor.rebuildEditorState() end
      end)
      if not ok then
        editor.flashNotification("Silverware Tags: the settings are saved in CONFIG, but loading them failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
    reloadUI = editor.reloadUI,
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
  -- The tags' panel (the panel module): SilverBullet's navigator draws the rows the JS gives as a tree by "/",
  -- what is done with them goes back to the JS (the window); only where SilverBullet has views (view.define)
  -- As SilverBullet's own tree has its meta pages: SilverBullet's tags (meta and under it) in Meta alone, where
  -- they show (the setting protecting meta pages leaves them out); segments filter the rows before the tree is
  -- made of them, so a level shows where a row under it does
  local silverwareTagsSegments = {
    { label = "All", icon = "hash", default = true, where = function(obj) return obj.meta ~= true end },
    { label = "Page tags", icon = "file-text", where = function(obj) return obj.onPages == true and obj.meta ~= true end },
    { label = "Tasks", icon = "check-square", where = function(obj) return obj.inTasks == true and obj.meta ~= true end },
    { label = "This page", icon = "file", where = function(obj) return obj.here == true and obj.meta ~= true end },
  }
  if silverwareTagsJs.panelMetaApart() then
    table.insert(silverwareTagsSegments, { label = "Meta", icon = "settings", placeholder = "Meta tag", where = function(obj) return obj.meta == true end })
  end
  if view and view.define and silverwareTagsJs.panelOn() then
    view.define {
      name = "silverware.tags",
      title = "Tags",
      command = "Silverware Tags: Tags panel",
      dock = "rhs",
      supportedDocks = { "rhs", "lhs", "bhs" },
      -- Read again as the index changes, and as another page opens (its tags first)
      refreshOn = { "index", "navigate" },
      placeholder = "Tag",
      helpText = "+ / − the page open's tag · F2 renames · drag to move",
      source = function()
        return silverwareTagsJs.panelRows()
      end,
      presentation = {
        mode = "tree",
        -- The page open's tags first: the rows come in that order, which the tree keeps (a view's row priority is the
        -- built-in views' only in 2.12.1); folders among the others, else they would come first whatever
        foldersFirst = false,
        row = {
          cssClass = function(obj)
            if obj.here == true then
              return "swg-here"
            end
          end,
          -- A level of tags (no tag of its name) a folder; it has a row of its own, so it shows its count too
          icon = function(obj)
            if obj.level == true then
              return "folder"
            end
            return "hash"
          end,
          decorations = function(obj)
            if not obj.count then
              return {}
            end
            local title = "Pages using it"
            if obj.parent == true then
              title = "Pages using it or a tag under it"
            end
            return { { text = tostring(obj.count), position = "right", cssClass = "sb-nav-chip-hint", title = title } }
          end,
        },
      },
      segments = silverwareTagsSegments,
      -- A click opens a level (the navigator's own "expand", as its tree does), else does nothing: the window is
      -- an action of the row; the panel stays open
      onSelect = function(obj)
        if obj.parent == true then
          return "navigator:expand"
        end
        return false
      end,
      actions = {
        {
          icon = "plus",
          label = "Add to the page open",
          when = function(obj) return obj.level ~= true and obj.own ~= true end,
          run = function(obj)
            silverwareTagsJs.panelAddToPage(obj.name)
          end,
        },
        -- One of the page open's own tags: taken off it instead
        {
          icon = "minus",
          label = "Remove from the page open",
          when = function(obj) return obj.own == true end,
          run = function(obj)
            silverwareTagsJs.panelRemoveFromPage(obj.name)
          end,
        },
        {
          icon = "external-link",
          label = "Open in the Tags window",
          run = function(obj)
            silverwareTagsJs.panelSelect(obj.name)
          end,
        },
      },
      keymap = {
        F2 = function(obj)
          silverwareTagsJs.panelRename(obj.name)
        end,
      },
      onMove = function(obj, newName)
        silverwareTagsJs.panelMove(obj.name, newName)
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
