---
tags: meta
---
# Silverware Database init

What starts [Silverware Database](silverware-database.md) in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's editor, space, index and UI API, the code widget drawing each `silverware-database` block, its commands and the index's events it follows. It is installed with the library; its Space Lua API is [silverware-database-api](silverware-database-api.md).

```space-lua
-- priority: -10
-- (After the API page, priority 50, and the user's scripts, priority 0: their views and types are defined by now)
config.defineCategory {
  name = "Silverware Database",
  description = "Databases of pages, shown in your pages by views.",
  priority = 3,
}

config.define("silverware.database", {
  description = "Silverware Database settings",
  type = "object",
  properties = {
    -- Each view's own settings, by its name (enabled, and those the view declares): silverware.database.views.<view>.<key>
    views = { type = "object", additionalProperties = true },
  },
})

-- Silverware Database only uses the public editor, space, index, config and UI API, handed over here
if js and js.window then
  local silverwareDatabaseJs = js.importFromSpace("Library/damesene/silverware-database.js")
  silverwareDatabaseJs.init({
    getCurrentPage = editor.getCurrentPage,
    getText = editor.getText,
    replaceRange = editor.replaceRange,
    insertAtCursor = editor.insertAtCursor,
    moveCursor = editor.moveCursor,
    navigate = editor.navigate,
    readPage = space.readPage,
    writePage = space.writePage,
    deletePage = space.deletePage,
    listPages = function()
      local names = {}
      for _, page in ipairs(space.listPages()) do
        table.insert(names, page.name)
      end
      return names
    end,
    -- Links to the page followed (SilverBullet's Page: Rename); it answers the same whether it renamed or not: the JS checks
    renamePage = function(from, to)
      return system.invokeFunction("index.renamePageCommand", { oldPage = from, page = to })
    end,
    renamePrefix = function(from, to)
      return system.invokeFunction("index.renamePrefixCommand", { oldPrefix = from, newPrefix = to, disableConfirmation = true })
    end,
    queryTag = function(tag)
      return query[[from index.tag(tag)]]
    end,
    flash = function(message, type, options)
      editor.flashNotification(message, type, options)
    end,
    confirm = editor.confirm,
    prompt = editor.prompt,
    getConfig = config.get,
    -- The settings dialog: saved as SilverBullet's Configuration Manager saves (the CONFIG page, indexed, the configuration loaded again)
    saveConfigPage = function(text)
      space.writePage("CONFIG", text)
      local ok, err = pcall(function()
        if sync and sync.performFileSync then sync.performFileSync("CONFIG.md") end
        mq.send("indexQueue", "CONFIG.md")
        mq.awaitEmptyQueue("indexQueue")
        editor.reloadConfigAndCommands()
        if editor.rebuildEditorState then editor.rebuildEditorState() end
      end)
      if not ok then
        editor.flashNotification("Silverware Database: the settings are saved in CONFIG, but loading them failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
  })
  for _, name in ipairs(silverwareDatabaseJs.commandNames()) do
    command.define {
      name = name,
      run = function()
        silverwareDatabaseJs.runCommand(name)
      end,
    }
  end
  codeWidget.define {
    language = "silverware-database",
    render = function(body, pageName)
      return widget.new { html = silverwareDatabaseJs.render(body, pageName), display = "block", cssClasses = { "swd-widget" } }
    end,
  }
  -- A page indexed (written here or elsewhere, synced) or deleted: the databases showing it read it anew
  event.listen {
    name = "page:index",
    run = function(e)
      if e.data and e.data.name then silverwareDatabaseJs.pageIndexed(e.data.name, false) end
    end,
  }
  -- Another page opened in the editor: what shows beside the page (the peek) is closed
  event.listen {
    name = "editor:pageLoaded",
    run = function()
      silverwareDatabaseJs.pageLoaded()
    end,
  }
  event.listen {
    name = "page:deleted",
    run = function(e)
      if e.data then silverwareDatabaseJs.pageIndexed(type(e.data) == "string" and e.data or e.data.name, true) end
    end,
  }
end
```
