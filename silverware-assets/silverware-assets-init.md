---
tags: meta
---
# Silverware Assets init

What starts [Silverware Assets](silverware-assets.md) in SilverBullet: its settings, the JavaScript loaded and handed SilverBullet's space and editor API, its command. It is installed with the library; its Space Lua API is [silverware-assets-api](silverware-assets-api.md).

```space-lua
-- Settings: how files are shown (tables, kept in Silverware Assets' own block of CONFIG: the Configuration Manager
-- would lose them), and the markdown as written (shown in the Configuration Manager)
config.defineCategory({
  name = "Silverware Assets",
  description = "The files your pages embed and link: how they are shown, what a click on them does.",
  priority = 3,
})

config.define("silverware.assets", {
  description = "Silverware Assets settings",
  type = "object",
  properties = {
    views = { type = "object", description = "How a file is shown (icon, preview or embed): a default, and one per type." },
    actions = { type = "object", description = "What a click and a Shift+click on a file do (an action's name): a default, and one per type." },
    card = { type = "array", description = "What a file's card shows: icon, name, size, modified.", items = { type = "string" } },
    heights = { type = "object", description = "A preview's and an embed's height where nothing gives one (px)." },
    previews = { type = "object", description = "A preview's width for all files (width, px; none: as wide as it fits) and alignment (align: left, center or right), and per type its width, height and alignment (types)." },
    linkIcons = { type = "boolean", description = "A link to a file of the space shows its type's icon before its text." },
    previewFolder = { type = "string", description = "The folder previews are kept in, from the space's top (by default _silverware-asset-preview: a name starting with _ is hidden from SilverBullet's pickers). Changed in the settings window, the previews kept are moved there." },
    storePreviews = { type = "boolean", description = "A preview slow to make (a PDF's page) is kept in the space once made (_silverware-asset-preview); off, made each time it is shown, no Regenerate preview." },
    labels = { type = "object", description = "A preview's label: for all files (default) and per type (types), each { above = {...}, below = {...} }, a list of { field = icon, alt, name, size or modified, on = true or false }." },
    originalLabels = { type = "object", description = "An original's label, alike (none shown unless one is turned on)." },
    syntaxMode = {
      type = "object",
      additionalProperties = false,
      properties = {
        hideAssets = {
          type = "boolean",
          default = true,
          description = "While SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax Rendering), embedded files are hidden: their markdown alone.",
          ui = { category = "Silverware Assets", label = "Markdown as written: hide embedded files", priority = 0.6 },
        },
      },
    },
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
    -- A file's Delete (in its menu, once confirmed): the document deleted from the space, asked first in SilverBullet's
    -- dialog, its OK button the danger's
    deleteDocument = space.deleteDocument,
    -- Previews kept in the space (in _silverware-asset-preview/, made once): a file's time of change, a document read and written
    fileMeta = space.getFileMeta,
    readDocument = space.readDocument,
    writeDocument = space.writeDocument,
    -- Clean up previews: every file of the space (its previews' folder too)
    listFiles = space.listFiles,
    confirmDelete = function(message)
      return editor.confirm(message, { destructive = true })
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
  for _, name in ipairs(silverwareAssetsJs.commandNames()) do
    command.define({
      name = name,
      run = function()
        silverwareAssetsJs.runCommand(name)
      end,
    })
  end
end
```
