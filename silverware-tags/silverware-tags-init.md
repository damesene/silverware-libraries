---
tags: meta
---
# Silverware Tags init

What starts [[Library/damesene/silverware-tags|Silverware Tags]] in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's space and editor API, its commands and the Tags panel. It is installed with the library; its Space Lua API is [[Library/damesene/silverware-tags-api]].

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
    newTagsForm = {
      type = "string",
      enum = { "flow", "block", "string" },
      default = "flow",
      description = "How a page's tags are written where it has none yet: flow on one line in brackets (tags: [a, b]), block as - lines, string as tags: a, b (a tag with a space in it makes it [ ]). A page that has tags keeps their form.",
      ui = { category = "Silverware Tags", label = "How new tags are written", priority = 0.97 },
    },
    panelPageFirst = {
      type = "boolean",
      default = false,
      description = "Tags used on the page you are viewing appear at the top. Off: all tags are sorted by name, folders first.",
      ui = { category = "Silverware Tags", label = "List this page's tags first in the Tags panel", priority = 0.95 },
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
  -- The panel's row actions and their keys, as the modules turned on give them
  local silverwareTagsActions = {}
  local silverwareTagsKeys = {}
  if silverwareTagsJs.panelOn() then
    for _, action in ipairs(silverwareTagsJs.panelActionList()) do
      local id = action.id
      table.insert(silverwareTagsActions, {
        icon = action.icon,
        label = action.label,
        when = function(obj) return obj.can ~= nil and obj.can[id] == true end,
        run = function(obj)
          silverwareTagsJs.panelRun(id, obj.name)
        end,
      })
      if action.key then
        silverwareTagsKeys[action.key] = function(obj)
          if obj.can ~= nil and obj.can[id] == true then
            silverwareTagsJs.panelRun(id, obj.name)
          end
        end
      end
    end
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
      source = function()
        return silverwareTagsJs.panelRows()
      end,
      presentation = {
        mode = "tree",
        -- The page open's tags first where the setting says so: the rows come in that order, which the tree keeps (a
        -- view's row priority is the built-in views' only in 2.12.1), folders among the others, else they would come
        -- first whatever; else by name, folders first, as SilverBullet's own tree
        foldersFirst = not silverwareTagsJs.panelPageFirst(),
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
      -- A click opens a level (the navigator's own "expand", as its tree does), else does nothing; two on a row soon
      -- after (the navigator has no double click: each is told) open the window at it; the panel stays open
      onSelect = function(obj)
        silverwareTagsJs.panelClicked(obj.name)
        if obj.parent == true then
          return "navigator:expand"
        end
        return false
      end,
      -- Every module's row actions (the panel's +, − and Open, the rename module's Rename…): a button of a row where
      -- the JS offers it for that row (its `can`), a key where one has it
      actions = silverwareTagsActions,
      keymap = silverwareTagsKeys,
      onMove = function(obj, newName)
        silverwareTagsJs.panelMove(obj.name, newName)
      end,
    }
  end
end
```
