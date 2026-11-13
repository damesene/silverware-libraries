---
tags: meta
---
# Silverware Layout init

What starts [Silverware Layout](silverware-layout.md) in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's space and editor API, its command, and the events it follows. It is installed with the library; its Space Lua API is [silverware-layout-api](silverware-layout-api.md).

```space-lua
-- Settings, shown in the Configuration Manager (Configuration: Open)
config.defineCategory({
  name = "Silverware Layout",
  description = "The layout of a page: the width of its text, its widgets' widths and the editor's font size.",
  priority = 3,
})

config.define("silverware.layout", {
  description = "Silverware Layout settings",
  type = "object",
  properties = {
    textWidth = {
      type = "string",
      default = "",
      description = "The width of the text of pages without their own, in px (1100px) or in % of the editor's pane (90%). Empty: your theme's.",
      ui = { category = "Silverware Layout", label = "Default text width", priority = 1 },
    },
    minPaneWidth = {
      type = "number",
      default = 600,
      description = "Where the editor is narrower than this (px), as on a phone, Silverware Layout sets no width: the text is as wide as the screen.",
      ui = { category = "Silverware Layout", label = "Narrowest editor laid out (px)", priority = 0.9 },
    },
    fontSize = {
      type = "string",
      default = "",
      description = "The editor's font size on every page, in px (18px). Empty: your theme's.",
      ui = { category = "Silverware Layout", label = "Font size", priority = 0.8 },
    },
    fontZoom = {
      type = "object",
      additionalProperties = false,
      properties = {
        enabled = {
          type = "boolean",
          default = true,
          description = "Ctrl + scroll over the page makes its font larger or smaller on this device, as the browser zooms; Ctrl+0 puts it back.",
          ui = { category = "Silverware Layout", label = "Font zoom", priority = 0.7 },
        },
      },
    },
    guides = {
      type = "array",
      description = "The widths a drag snaps to and shows a guide at, in px (\"1200px\"), in % of the editor's width (\"80%\"), or full (the editor's width). Set in the Page layout dialog (Guides), kept in Silverware Layout's own block of CONFIG.",
      items = { type = "string" },
    },
  },
})

-- Silverware Layout only uses the public space, editor and config API, handed over here
if js and js.window then
  local silverwareLayoutJs = js.importFromSpace("Library/damesene/silverware-layout.js")
  silverwareLayoutJs.init({
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
    -- A grid's cell: its markdown rendered as SilverBullet renders a page, its embeds expanded, each element marked with
    -- its offset in the text
    renderMarkdown = function(text)
      return markdown.markdownToHtml(text, { expand = true, annotationPositions = true })
    end,
    -- A grid's Alt+click: the cursor where the click was in its markdown
    moveCursor = editor.moveCursor,
    -- The dialog's default text width: saved as SilverBullet's Configuration Manager saves
    -- (the CONFIG page, indexed, the configuration loaded again)
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
        editor.flashNotification("Silverware Layout: the setting is saved in CONFIG, but loading it failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
  })
  for _, name in ipairs(silverwareLayoutJs.commandNames()) do
    command.define({
      name = name,
      run = function()
        silverwareLayoutJs.runCommand(name)
      end,
    })
  end
  -- Columns: a grid's lines, from <grid …> alone on its line to the first </grid>, drawn as its cells side by side
  -- (SilverBullet's custom syntax: active once the page is loaded again after it is first defined)
  syntax.define({
    name = "SilverwareLayoutGrid",
    startMarker = "^<grid(\\s[^>]*)?>\\s*$",
    endMarker = "^</grid>\\s*$",
    mode = "block",
    renderClass = "swl-grid-widget",
    renderWidget = function(body, pageName)
      return widget.new({ html = silverwareLayoutJs.renderGrid(body), display = "block" })
    end,
  })
  -- Another page opened: its own text width read here from its meta (one call) and handed over, so it is set before
  -- the page is painted (verified: a few ms ahead; read from JS, each call of the bridge a promise, it took frames)
  event.listen({
    name = "editor:pageLoaded",
    run = function()
      local meta = editor.getCurrentPageMeta()
      local layout = meta and meta._layout
      silverwareLayoutJs.pageLoaded(editor.getCurrentPage(), type(layout) == "table" and layout.width or nil)
    end,
  })
  -- The page edited: its frontmatter read again once it is still a moment (a width typed by hand)
  event.listen({
    name = "editor:pageModified",
    run = function()
      silverwareLayoutJs.pageEdited()
    end,
  })
end
```
