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
    views = { type = "object", description = "How a file is shown (card, preview or full): a default, and one per type." },
    actions = { type = "object", description = "What a click and a Shift+click on a file do (an action's name: open-tab, open-panel, open-enlarged, download, copy-image): a default, and one per type." },
    insert = { type = "object", description = "Files pasted, dropped and uploaded through Silverware Assets' dialog (enabled) and how each is inserted (as: shown, link, card, preview or full): a default, and one per type." },
    preview = { type = "object", description = "A preview: its width (px; none: as wide as it fits) and height for all files, per type its width and height (types), its label (labels: for all files, default, and per type, types; each { above = {...}, below = {...} }, a list of { field = icon, alt, name, size or modified, on = true or false })." },
    full = { type = "object", description = "A file shown full: its height where nothing gives one (a PDF's, px) and its label (labels, as a preview's; none shown unless one is turned on)." },
    card = { type = "object", description = "What a file's card shows (fields: icon, name, size, modified)." },
    link = { type = "object", description = "What a link to a file of the space shows besides its text (fields: icon, its type's icon; none: a small arrow after it)." },
    previewFolder = { type = "string", description = "The folder previews are kept in, from the space's top (by default _silverware-assets-previews: a name starting with _ is hidden from SilverBullet's pickers). Changed in the settings window, the previews kept are moved there." },
    storePreviews = { type = "boolean", description = "A preview slow to make (a PDF's page) is kept in the space once made (_silverware-assets-previews); off, made each time it is shown, no Regenerate preview." },
    syntaxMode = {
      type = "object",
      additionalProperties = false,
      properties = {
        hideAssets = {
          type = "boolean",
          default = true,
          description = "Changes SilverBullet's own behaviour. In the plain markdown view (Editor: Toggle Markdown Syntax Rendering) SilverBullet still draws embedded files under their markdown; on, they stay plain text like the rest of the page. Off: SilverBullet's own.",
          ui = { category = "Silverware Assets", label = "Plain markdown view: hide embedded files", priority = 0.6 },
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
    -- Files inserted: the selection they go into
    getSelection = editor.getSelection,
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
    -- Previews kept in the space (in _silverware-assets-previews/, made once): a file's time of change, a document read and written
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
    -- Silverware Editor's API, where it is installed: a file pasted or dropped into another plugin's field (a grid's cell)
    editor = silverware.editor and silverware.editor.api,
    -- File: Upload turned off in the settings: SilverBullet's own, its plug's function
    invokeFunction = system.invokeFunction,
    -- A file renamed from its menu: the page read again, SilverBullet's rename having rewritten its links on disk
    reloadPage = editor.reloadPage,
  })
  -- File: Upload (the toolbar's paperclip, /upload, the File menu's Insert File…) through Silverware Assets' dialog
  -- (docs/silverware-assets-insert.md): a command of Space Lua replaces SilverBullet's of the same name. Turned off in
  -- the settings, or the page read-only: SilverBullet's own
  command.define({
    name = "File: Upload",
    run = function()
      silverwareAssetsJs.upload()
    end,
  })
  -- Upload file as a button of Silverware Toolbar (through its public API, where it is installed): into the field it is
  -- run in (a grid's cell, a database's peek), else the page
  if silverware.toolbar and silverware.toolbar.defineActions then
    silverware.toolbar.defineActions(silverwareAssetsJs.toolbarActions)
  end
  -- The page opened, handed over as it loads: where files inserted go, known at once (not asked as they are pasted)
  silverwareAssetsJs.pageLoaded(editor.getCurrentPage())
  event.listen({
    name = "editor:pageLoaded",
    run = function()
      silverwareAssetsJs.pageLoaded(editor.getCurrentPage())
    end,
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
