---
tags: meta
---
# Silverware Assets init

What starts [Silverware Assets](silverware-assets.md) in SilverBullet: the JavaScript loaded and handed SilverBullet's space and editor API. It is installed with the library; its Space Lua API is [silverware-assets-api](silverware-assets-api.md).

```space-lua
-- Settings: tables, kept in Silverware Assets' own block of CONFIG (the Configuration Manager would lose them)
config.define("silverware.assets", {
  description = "Silverware Assets settings",
  type = "object",
  properties = {
    views = { type = "object", description = "How a file is shown (icon, preview or embed): a default, and one per type." },
    actions = { type = "object", description = "What a click and a Shift+click on a file do (an action's name): a default, and one per type." },
    card = { type = "array", description = "What a file's card shows: icon, name, size, modified.", items = { type = "string" } },
    heights = { type = "object", description = "A preview's and an embed's height where nothing gives one (px)." },
    anchor = { type = "string", description = "Where a file stays as its width is dragged: start (it grows to the right) or center." },
    linkIcons = { type = "boolean", description = "A link to a file of the space shows its type's icon before its text." },
  },
})

-- Silverware Assets only uses the public space, editor and config API, handed over here; Silverware Layout's API
-- where it is installed (silverware.layout.api: a file's width by its handle, what its grids draw)
if js and js.window then
  local silverwareAssetsJs = js.importFromSpace("Library/damesene/silverware-assets.js")
  silverwareAssetsJs.init({
    getCurrentPage = editor.getCurrentPage,
    getText = editor.getText,
    replaceRange = editor.replaceRange,
    readPage = space.readPage,
    writePage = space.writePage,
    listPages = space.listPages,
    flash = function(message, type)
      editor.flashNotification(message, type)
    end,
    getConfig = config.get,
    confirm = editor.confirm,
    -- Whether SilverBullet shows the markdown's syntax (Editor: Toggle Markdown Syntax Rendering)
    getUiOption = editor.getUiOption,
    -- A file's card: its size and date (an error where it is not in the space: the card shows its name alone)
    documentMeta = space.getDocumentMeta,
    -- How a link written new is written: SilverBullet's own setting, the one place naming it
    linkStyle = function()
      return config.get("defaultLinkStyle", "wikilink")
    end,
    -- The settings window: saved as SilverBullet's Configuration Manager saves (the CONFIG page, indexed, the
    -- configuration loaded again)
    saveConfigPage = function(text)
      space.writePage("CONFIG", text)
      -- Written: the rest only loads it; a failure there says so, the page is saved
      local ok, err = pcall(function()
        if sync and sync.performFileSync then sync.performFileSync("CONFIG.md") end
        mq.send("indexQueue", "CONFIG.md")
        mq.awaitEmptyQueue("indexQueue")
        editor.reloadConfigAndCommands()
      end)
      if not ok then
        editor.flashNotification("Silverware Assets: the setting is saved in CONFIG, but loading it failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
    layout = silverware.layout and silverware.layout.api,
  })
end
```
