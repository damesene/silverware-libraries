---
tags: meta
---
# Silverware Layout init

What starts [Silverware Layout](silverware-layout.md) in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's space and editor API, its command, and the events it follows. It is installed with the library; its Space Lua API is [silverware-layout-api](silverware-layout-api.md).

```space-lua
-- SB-2.12-COMPAT: the configuration page, CONFIG in SilverBullet 2.12.1 and older, Library/Config from its 3.0 (edge),
-- told by index.toolPages (tool pages under Library/ came with the move); once 2.12.1 is dropped, "Library/Config" alone
local configPage = index.toolPages and "Library/Config" or "CONFIG"

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
        pinch = {
          type = "boolean",
          default = true,
          description = "A pinch with two fingers makes the font larger or smaller on this device; a tap with two fingers still opens the page picker.",
          ui = { category = "Silverware Layout", label = "Font zoom by a pinch", priority = 0.69 },
        },
        scaleFiles = {
          type = "boolean",
          default = true,
          description = "The files a page shows (images, previews, PDFs) grow and shrink with this device's font zoom, as the text does.",
          ui = { category = "Silverware Layout", label = "Files zoom with the text", priority = 0.68 },
        },
      },
    },
    syntaxMode = {
      type = "object",
      additionalProperties = false,
      properties = {
        hideGrids = {
          type = "boolean",
          default = true,
          description = "Changes SilverBullet's own behaviour. SilverBullet can show a page as plain markdown, without formatting (command Editor: Toggle Markdown Syntax Rendering). It still draws grids there, under their markdown. On: <grid> and <cell> stay plain text, like the rest of the page. Off (SilverBullet's own): the grid is drawn under its markdown.",
          ui = { category = "Silverware Layout", label = "Plain markdown view: hide grids", priority = 0.6 },
        },
      },
    },
    links = {
      type = "object",
      additionalProperties = false,
      properties = {
        clickPlacesCursor = {
          type = "boolean",
          default = true,
          description = "Changes SilverBullet's own behaviour. A link shows as markdown while the cursor is in it, and in the plain markdown view. SilverBullet opens it on a click there too, which makes it hard to edit. On: a click only places the cursor; Ctrl+click opens the link. Off (SilverBullet's own): a click opens it.",
          ui = { category = "Silverware Layout", label = "Links shown as markdown: a click only places the cursor; Ctrl+click opens the link", priority = 0.59 },
        },
      },
    },
    guides = {
      type = "array",
      description = "The widths a drag snaps to and shows a guide at, in px (\"1200px\"), in % of the editor's width (\"80%\"), or full (the editor's width). Set in the settings dialog (Guides), kept in Silverware Layout's own block of the configuration page.",
      items = { type = "string" },
    },
    alignments = {
      type = "object",
      description = "Where each kind of widget stands where it says nothing itself, by its plugin and kind (\"silverware-assets/preview\" = \"right\"): left, center or right. Set in the settings dialog (Alignment), kept in Silverware Layout's own block of the configuration page.",
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
    -- A tap with two fingers given back to SilverBullet where the pinch zooms the font (its command doing the same)
    invokeCommand = editor.invokeCommand,
    confirm = editor.confirm,
    -- A grid's min width in px asked
    prompt = editor.prompt,
    -- A grid's cell deleted: asked in SilverBullet's dialog, its OK button the danger's
    confirmDelete = function(message)
      return editor.confirm(message, { destructive = true })
    end,
    -- A grid's cell: its markdown rendered as SilverBullet renders a page, its embeds expanded, each element marked with
    -- its offset in the text
    renderMarkdown = function(text)
      return markdown.markdownToHtml(text, { expand = true, annotationPositions = true })
    end,
    -- A grid's Alt+click: the cursor where the click was in its markdown; /grid: where the cursor is
    moveCursor = editor.moveCursor,
    getCursor = editor.getCursor,
    -- Wrap in grid: the selection, and a pick (its mode, its number of columns)
    getSelection = editor.getSelection,
    filterBox = function(label, options)
      return editor.filterBox(label, options, "", "Type to filter")
    end,
    -- Whether SilverBullet shows the markdown's syntax (Editor: Toggle Markdown Syntax Rendering): grids hidden then
    getUiOption = editor.getUiOption,
    -- A link pressed in a cell's field: SilverBullet goes to its page or file
    navigate = editor.navigate,
    -- SilverBullet's commands and their shortcuts: one pressed in a cell's field, where it does nothing, told
    listCommands = system.listCommands,
    -- A grid's cell edited in Silverware Editor's editor where it is installed (else a plain text field)
    editor = silverware.editor and silverware.editor.api,
    -- The dialog's default text width: saved as SilverBullet's Configuration Manager saves
    -- (the configuration page, indexed, the configuration loaded again)
    configPage = configPage,
    saveConfigPage = function(text)
      space.writePage(configPage, text)
      -- Written: the rest only loads it; a failure there says so, the page is saved
      local ok, err = pcall(function()
        if sync and sync.performFileSync then sync.performFileSync(configPage .. ".md") end
        mq.send("indexQueue", configPage .. ".md")
        mq.awaitEmptyQueue("indexQueue")
        editor.reloadConfigAndCommands()
      end)
      if not ok then
        editor.flashNotification("Silverware Layout: the setting is saved in " .. configPage .. ", but loading it failed (" .. tostring(err) .. "): reload the page", "error")
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
  -- Wrap in grid and Move to grid as buttons of Silverware Toolbar, their mode a parameter (through its public API, where it is installed)
  if silverware.toolbar and silverware.toolbar.defineActions then
    silverware.toolbar.defineActions(silverwareLayoutJs.toolbarActions)
  end
  for _, slash in ipairs(silverwareLayoutJs.slashCommands()) do
    local name = slash.name
    slashCommand.define({
      name = name,
      description = slash.description,
      run = function()
        silverwareLayoutJs.runSlashCommand(name)
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
  -- A page indexed: the links in its grids indexed too (SilverBullet's index sees nothing in a grid), so backlinks and
  -- a rename of a page or an attachment find them. SilverBullet clears a page's objects before this event: these
  -- replace, never pile up
  event.listen({
    name = "page:index",
    run = function(event)
      local page = event.data
      local objects = silverwareLayoutJs.gridIndexObjects(page.name, page.text, page.meta and page.meta.lastModified)
      if objects then
        index.indexObjects(page.name, objects)
      end
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
