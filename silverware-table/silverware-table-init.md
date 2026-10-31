---
tags: meta
---
# Silverware Table init

What starts [[Library/damesene/silverware-table|Silverware Table]] in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's editor and config API, the events it follows, its commands, and completion in a formula given to `silverware.table.evaluate`. It is installed with the library; its Space Lua API is [[Library/damesene/silverware-table-api]].

```space-lua
-- Settings, shown in the Configuration Manager (Configuration: Open)
config.defineCategory {
  name = "Silverware Table",
  description = "Interactive markdown tables.",
  priority = 5,
}

config.defineCategory {
  name = "Silverware Table: Modules",
  description = "Parts of Silverware Table that can be turned off. A change applies when the page is loaded again.",
  priority = 4.9,
}

-- Settings of whole tables are silverware.table.<setting>; those of a part of
-- Silverware Table are silverware.table.<part>.<setting>, and those of a module (a part that can
-- be turned off) silverware.table.modules.<module>.<setting>. A part is set in one go
-- with config.set("silverware.table.<part>", { … }): settings left out keep their defaults
config.define("silverware.table", {
  description = "Silverware Table settings",
  type = "object",
  properties = {
    metadata = {
      type = "boolean",
      default = true,
      description = "Allow storing table settings (sorting, filters, pinned rows and columns, names) in a hidden last row <meta …> of tables, and pinning. Off: nothing new is stored (sorting and filters are a view only), what a table has may change or go: its sorting, a column's filter or width, its theme, name and pins at an edge that has them. Formulas are stored in cells (<meta formulas.f>) and need it too: off, a typed formula is saved as text; existing formulas keep working, calculated columns too.",
      ui = { category = "Silverware Table", label = "Store table metadata", priority = 6 },
    },
    maxHeight = {
      type = "number",
      default = 0,
      description = "Maximum table height in pixels; a taller table gets its own vertical scrollbar. 0: no limit.",
      ui = { category = "Silverware Table", label = "Maximum table height (px)", priority = 5 },
    },
    autoFormat = {
      type = "boolean",
      default = true,
      description = "Write tables edited with Silverware Table with aligned pipes, as formatLong says. Off: each table keeps its own style (aligned or compact).",
      ui = { category = "Silverware Table", label = "Format edited tables", priority = 4 },
    },
    formatLong = {
      type = "string",
      enum = { "limit", "compact" },
      default = "limit",
      description = "How a table is formatted where cells are long (a link), edited with Format edited tables or by Format table in its ⋯ menu. limit: its columns padded up to formatCellWidth, a longer cell sticking out. compact: the whole table written compact where a line of it padded would be longer than formatLineWidth.",
      ui = { category = "Silverware Table", label = "Long content", priority = 3.9 },
    },
    formatCellWidth = {
      type = "number",
      default = 40,
      description = "With formatLong limit: each column is padded to its longest cell of at most this many characters. A longer cell, such as a long link, is written as it is, past the column's |, so the other rows and the delimiter do not widen. 0: no limit.",
      ui = { category = "Silverware Table", label = "Longest cell aligned (characters)", priority = 3.8 },
    },
    formatLineWidth = {
      type = "number",
      default = 80,
      description = "With formatLong compact: a table whose longest line would be longer than this, its columns padded, is written compact: no padding, the delimiter row --- (as Prettier does with proseWrap never). 0: no limit.",
      ui = { category = "Silverware Table", label = "Compact when wider than (characters)", priority = 3.7 },
    },
    toolbarNames = {
      type = "string",
      enum = { "never", "always", "shift" },
      default = "shift",
      description = "A table's toolbar shows the sheet it is on and its name (each after its icon: the sheet view, the full screen), as its ⋯ menu does: always, or (shift) while you hold Shift alone. never: they are in the menu only.",
      ui = { category = "Silverware Table", label = "Names in the toolbar", priority = 3.5 },
    },
    editor = {
      type = "object",
      additionalProperties = false,
      properties = {
        enterKey = {
          type = "string",
          enum = { "save", "moveDown" },
          default = "moveDown",
          description = "What Enter does in a cell editor. save: save the value. moveDown: save it and edit the cell below (Shift+Enter: opened with its text selected, or the reverse with selectOnClick).",
          ui = { category = "Silverware Table", label = "Enter in a cell editor", priority = 3 },
        },
        selectOnClick = {
          type = "boolean",
          default = false,
          description = "A click on a cell, Enter, Tab and Ctrl+arrows open its editor with all its text selected, Shift+Enter with the cursor at the end. Off: the reverse.",
          ui = { category = "Silverware Table", label = "Click selects the cell's text", priority = 2.5 },
        },
        ctrlEnterAddsRow = {
          type = "boolean",
          default = true,
          description = "Ctrl+Enter in a cell editor saves the cell, adds an empty row below and edits it. Off: Ctrl+Enter works like Enter.",
          ui = { category = "Silverware Table", label = "Ctrl+Enter adds a row", priority = 2 },
        },
      },
    },
    expressions = {
      type = "object",
      additionalProperties = false,
      properties = {
        refreshDelay = {
          type = "number",
          default = 500,
          description = "After you edit a table, a cell that holds a Lua expression (${…}) reading the page index (a query, or a formula of a spreadsheet library) shows its new result once SilverBullet has indexed the page again: this is how many milliseconds it waits for that. Raise it if such cells still show old results (a slow device, a large space).",
          ui = { category = "Silverware Table", label = "Cells with Lua expressions: delay before refreshing (ms)", priority = 0.5 },
        },
      },
    },
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        formulas = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Formulas in cells (=SUM(B1:B3)): typing them, their help and references, Recalculate, and recalculating every table edited and the tables referring to it. Off: nothing is recalculated, results stay as written; a typed formula is saved as text, a formula cell edited keeps its formula for when formulas are on again.",
              ui = { category = "Silverware Table: Modules", label = "Formulas", priority = 13 },
            },
          },
        },
        names = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Naming tables, columns, rows and cells (the pencil in the title of the table's ⋯ menu, a column's, a row's or a cell's menu), so formulas refer to them by name; named headers and cells show a mark. Off: none of these; names already in tables are kept and formulas still use them.",
              ui = { category = "Silverware Table: Modules", label = "Names", priority = 12 },
            },
          },
        },
        pageLinks = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Formulas referring to tables and named cells on other pages ([[Prices]]fruit!B2), which Silverware Table reads for them. Off: no other page is read; formulas referring to one keep the results they have, a new one shows #REF!.",
              ui = { category = "Silverware Table: Modules", label = "Links to other pages", priority = 11 },
            },
          },
        },
        filters = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Filtering rows: the filter row (the toolbar's filter icon), a column's filter (Filter in its menu), filters stored in the table with the metadata setting. Off: no filtering; filters stored in a table are kept but not used.",
              ui = { category = "Silverware Table: Modules", label = "Filters", priority = 10 },
            },
            smart = {
              type = "boolean",
              default = true,
              description = "Filter fields understand >10 <10 >=10 <=10 (numbers), /pattern/ (regular expressions), =text (whole cell), a|b (either) and !filter (not). Off: everything typed is text to find.",
              ui = { category = "Silverware Table: Modules", label = "Smart filters", priority = 9 },
            },
          },
        },
        columnTypes = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Column types from a header's hashtag (#currency, #stars, #date…): cells shown as the type, the type's values in the cell editor, Type in the column menu. Off: cells show as written.",
              ui = { category = "Silverware Table: Modules", label = "Column types", priority = 8 },
            },
          },
        },
        selection = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "A click selects a cell (a second click edits it; the Edit mode button in the toolbar edits on the first click); dragging, Shift+click and Shift+arrows select more; Ctrl+C copies them for a spreadsheet, Delete empties them. Off: a click edits.",
              ui = { category = "Silverware Table: Modules", label = "Cell selection", priority = 7 },
            },
          },
        },
        autofill = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "A square at the bottom right corner of the cells selected: drag it to fill the cells after them (1, 2 → 3, 4; Mon → Tue; Item 1 → Item 2; formulas with their references moved), double-click it to fill down as far as the column beside has values.",
              ui = { category = "Silverware Table: Modules", label = "AutoFill", priority = 6.95 },
            },
          },
        },
        lazy = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "An icon in a table's toolbar switches it to lazy saving: the cells edited are saved together, a moment after no cell is being edited (quicker typing in large tables); the icon is highlighted while edits are not saved. Clicking it again saves at once and turns it off.",
              ui = { category = "Silverware Table: Modules", label = "Lazy saving", priority = 6.9 },
            },
            delay = {
              type = "number",
              default = 500,
              description = "In lazy saving, the cells edited are saved this many milliseconds after no cell is being edited.",
              ui = { category = "Silverware Table: Modules", label = "Saves after (ms)", priority = 6.8 },
            },
          },
        },
        themes = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Tables look as their theme sets (header, lines, stripes, spacing): the Theme setting, or a table's own from Theme in its ⋯ menu. Off: tables look as SilverBullet shows them.",
              ui = { category = "Silverware Table: Modules", label = "Themes", priority = 6.7 },
            },
            theme = {
              type = "string",
              default = "native",
              description = "The theme of every table (a table's ⋯ menu can choose another for it). Built in: native (SilverBullet's look), plain, playground, minimal, slate, grid, ocean, paper, contrast, compact, bold, soft, ledger; or the name of your own theme (see the library page, Themes).",
              ui = { category = "Silverware Table: Modules", label = "Theme", priority = 6.6 },
            },
            stripes = {
              type = "string",
              enum = { "none", "rows", "columns" },
              default = "rows",
              description = "Every other row (rows, as SilverBullet does) or column (columns) of a table is tinted, in its theme's color, or nothing (none). The icons in Theme in a table's ⋯ menu can choose otherwise for that table.",
              ui = { category = "Silverware Table: Modules", label = "Stripes", priority = 6.5 },
            },
          },
        },
        paste = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Copy, Cut and Paste in the cell menu; Ctrl+X cuts cells (they move where they are pasted); Ctrl+V pastes cells copied from a spreadsheet over the table, Ctrl+Shift+V as new rows. Off: a paste goes into the cell editor as text, no Cut or Paste in the cell menu (Copy and Ctrl+C stay, with the selection module).",
              ui = { category = "Silverware Table: Modules", label = "Copy, cut and paste", priority = 6 },
            },
          },
        },
        export = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Copy as CSV and Copy as Markdown in a table's ⋯ menu: the whole table, its rows as shown.",
              ui = { category = "Silverware Table: Modules", label = "Export", priority = 5 },
            },
          },
        },
        excel = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Export to Excel… in a table's ⋯ menu: copy for Excel (numbers and dates as Excel's values), or download an .xlsx file with the formulas.",
              ui = { category = "Silverware Table: Modules", label = "Excel", priority = 4.9 },
            },
            functions = {
              -- No default: an empty Lua table could read as a list
              type = "object",
              description = "How your custom functions are written in an Excel file: a template by the function's name, {1}, {2}… its arguments (VAT = \"ROUND(({1})*1.21,2)\"), or false: its cells as their values.",
            },
          },
        },
        handles = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "The handles beside rows and above columns: drag them to move rows and columns, click them for the row and column menus (insert, duplicate, pin, sort, type, delete…).",
              ui = { category = "Silverware Table: Modules", label = "Row and column handles", priority = 4 },
            },
          },
        },
        longText = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Long text in cells: it wraps (up to a maximum cell height) or is cut with an ellipsis at a maximum column width, and a cell whose text is cut shows an expand button for its popup. Off: cells show as SilverBullet renders them, on one line, as wide as their text.",
              ui = { category = "Silverware Table: Modules", label = "Long text in cells", priority = 3.45 },
            },
            overflow = {
              type = "string",
              enum = { "wrap", "ellipsis" },
              default = "wrap",
              description = "Text longer than a column's maximum width. wrap: it wraps onto more lines, up to the maximum cell height. ellipsis: it stays on one line, cut with …. A cell whose text is cut shows an expand button that shows it whole (F2 while editing it).",
              ui = { category = "Silverware Table: Modules", label = "Text that does not fit", priority = 3.4 },
            },
            maxWidth = {
              type = "number",
              default = 500,
              description = "A column's maximum width in pixels: longer text wraps or is cut (Long text in cells). 0: no limit, a cell is as wide as its text.",
              ui = { category = "Silverware Table: Modules", label = "Maximum column width (px)", priority = 3.3 },
            },
            maxHeight = {
              type = "number",
              default = 200,
              description = "A wrapped cell's maximum height in pixels; the rest is cut (the expand button shows it). 0: no limit.",
              ui = { category = "Silverware Table: Modules", label = "Maximum cell height (px)", priority = 3.2 },
            },
          },
        },
        widths = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Column widths: drag the right edge of a column's header to set its width, double-click it (or Auto width in the column's menu) for the automatic width; with Store table metadata the width is stored in the table. Off: columns are as wide as their text; stored widths are kept but not used.",
              ui = { category = "Silverware Table: Modules", label = "Column widths", priority = 3.5 },
            },
          },
        },
        sticky = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "A table's header (and rows pinned to the top) stays in view while the page scrolls past the table, rows pinned to the bottom stay at the bottom of the view.",
              ui = { category = "Silverware Table: Modules", label = "Sticky header", priority = 3 },
            },
          },
        },
        autoscroll = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "Pressing the middle mouse button over a table scrolls it in the direction the pointer moves.",
              ui = { category = "Silverware Table: Modules", label = "Middle-button scrolling", priority = 2 },
            },
          },
        },
        largeTables = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = false,
              description = "Tables with many rows scroll in a box of their own (Maximum table height, else the window's height), and only the rows in view are in the page, so editing them stays quick. The browser's find (Ctrl+F) sees only those rows.",
              ui = { category = "Silverware Table: Modules", label = "Large tables", priority = 1.9 },
            },
            minRows = {
              type = "number",
              default = 200,
              description = "A table with at least this many rows is a large table (Large tables).",
              ui = { category = "Silverware Table: Modules", label = "Large tables: applies from (rows)", priority = 1.8 },
            },
          },
        },
        fullScreen = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "An icon in a table's toolbar shows the table over the whole window (not the browser's full screen); the same icon or Esc closes it.",
              ui = { category = "Silverware Table: Modules", label = "Full screen", priority = 1.7 },
            },
          },
        },
        sheet = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "An icon in a table's toolbar shows the table as a spreadsheet over the whole window, with empty rows and columns past it: a value typed into one grows the table.",
              ui = { category = "Silverware Table: Modules", label = "Sheet view", priority = 1.75 },
            },
          },
        },
        tableLabels = {
          type = "object",
          additionalProperties = false,
          properties = {
            enabled = {
              type = "boolean",
              default = true,
              description = "A named table shows its name in a small tab at its top right corner, in the page and on the sheet, while it is not hovered.",
              ui = { category = "Silverware Table: Modules", label = "Table labels", priority = 1.8 },
            },
          },
        },
      },
    },
  },
})

-- Silverware Table only uses the public editor and config API, handed over here
if js and js.window then
  local silverwareTableJs = js.importFromSpace("Library/damesene/silverware-table.js")
  silverwareTableJs.init({
    getText = editor.getText,
    replaceRange = editor.replaceRange,
    moveCursor = editor.moveCursor,
    getCurrentPage = editor.getCurrentPage,
    flash = editor.flashNotification,
    getConfig = config.get,
    setSelection = editor.setSelection,
    getCursor = editor.getCursor,
    undo = editor.undo,
    redo = editor.redo,
    evalExpression = lua.evalExpression,
    confirm = editor.confirm,
    readPage = space.readPage,
    writePage = space.writePage,
    -- Tables Silverware Table draws itself (the sheet): cells rendered as SilverBullet's
    -- tables render them, `${…}` evaluated; their links followed by SilverBullet
    markdownToHtml = function(text)
      return markdown.markdownToHtml(text, { expand = true })
    end,
    navigate = editor.navigate,
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
        editor.flashNotification("Silverware Table: the settings are saved in CONFIG, but loading them failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
    reloadUI = editor.reloadUI,
  })
  -- Another page in the editor: edits held for the page left (lazy saving) go into its file
  event.listen {
    name = "editor:pageLoaded",
    run = function()
      silverwareTableJs.pageLoaded()
    end,
  }
  -- Once the page is re-indexed, `${…}` cells show results from the new index
  event.listen {
    name = "page:index",
    run = function(e)
      silverwareTableJs.pageIndexed(e.data.name)
    end,
  }
  command.define {
    name = "Silverware Table: Settings",
    run = function()
      silverwareTableJs.openSettings()
    end,
  }
  command.define {
    name = "Silverware Table: Remove table metadata",
    run = function()
      silverwareTableJs.removeAllMetadata()
    end,
  }
  -- Formulas written in a page's text, in a call of silverware.table.evaluate or an alias of it: their places
  -- found by the finder made for those names (the JS's Lua side, host/lua.ts), so their references follow the
  -- edits of tables made with Silverware Table, in the same edit. Made again when an alias is added (the API
  -- page's evaluateAlias, which may run before or after this block)
  silverware_internal = silverware_internal or {}
  silverware_internal.table = silverware_internal.table or {}
  function silverware_internal.table.formulaCallsChanged()
    local names = { "silverware.table.evaluate" }
    for _, name in ipairs(silverware_internal.table.evaluateAliases or {}) do
      names[#names + 1] = name
    end
    silverwareTableJs.defineFormulaPlaces(silverwareTableJs.luaCallPlaces(table.unpack(names)))
  end
  silverware_internal.table.formulaCallsChanged()
  -- Whether a call's function is silverware.table.evaluate, by its name or one evaluateAlias gave it
  local function evaluates(callee)
    if callee == "silverware.table.evaluate" then return true end
    local internal = silverware_internal and silverware_internal.table or {}
    for _, name in ipairs(internal.evaluateAliases or {}) do
      if callee == name then return true end
    end
    return false
  end
  -- Completion in a formula given to silverware.table.evaluate or an alias of it (the line before the caret
  -- ends in one, in either quotes), as a cell's editor offers it: the whole formula given, the caret's place
  -- in it, so a name the caret is in the middle of is not completed again. The call's whole name before its
  -- "(", so an alias te is not found in paste(
  event.listen {
    name = "editor:complete",
    run = function(e)
      local at = e.data
      local quote = '"'
      local callee, before = string.match(at.linePrefix, '([%w_%.]+)%(%s*"([^"]*)$')
      if not callee then
        quote = "'"
        callee, before = string.match(at.linePrefix, "([%w_%.]+)%(%s*'([^']*)$")
      end
      if not callee or not evaluates(callee) then return end
      local text = editor.getText()
      -- The rest of the formula: after the caret, up to its closing quote
      local after = string.match(string.sub(text, at.pos + 1), "^([^" .. quote .. "\n]*)") or ""
      local found = silverwareTableJs.completions(before .. after, text, #before)
      if not found then return end
      local options = {}
      for _, choice in ipairs(found.choices) do
        options[#options + 1] = {
          label = choice.text,
          apply = choice.text,
          detail = choice.syntax or choice.kind,
          info = choice.description,
          type = choice.kind == "function" and "function" or choice.kind == "table" and "class" or "variable",
        }
      end
      return { from = at.pos - found.typed, options = options }
    end,
  }
end
```
