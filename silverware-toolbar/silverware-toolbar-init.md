---
tags: meta
---
# Silverware Toolbar init

What starts [[Library/damesene/silverware-toolbar|Silverware Toolbar]] in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's editor and config API, and its commands. It is installed with the library; its Space Lua API is [[Library/damesene/silverware-toolbar-api]].

```space-lua
-- Settings, shown in the Configuration Manager (Configuration: Open)
config.defineCategory {
  name = "Silverware Toolbar",
  description = "A toolbar beside the text selected.",
  priority = 4,
}

config.define("silverware.toolbar", {
  description = "Silverware Toolbar settings",
  type = "object",
  properties = {
    -- No default for either favourites: left out they are told as not set (SilverBullet would copy a default in,
    -- client/config.ts applySchemaDefaults); the toolbar's own defaults apply then (the library page says them)
    favorites = {
      type = "array",
      items = {
        type = "array",
        items = {
          type = "object",
          -- An item of a module's kind (the gestures module's button) has fields of its own, which its kind reads;
          -- a slot of it (tap, up, down) an action's id, or { id, icon, label }: the action with its own icon and label
          properties = {
            type = { type = "string" },
            id = { type = "string" },
            show = { type = "string", enum = { "icon", "label" } },
            -- (Kept within 3 and 30 as it is read: not refused here, which would fail the whole setting)
            width = { type = "number" },
            pin = { type = "string", enum = { "left", "right" } },
            -- An item's own icon (up to 3 characters, an emoji too) and label: an action's, a snippet's
            icon = { type = "string" },
            label = { type = "string" },
          },
        },
      },
      description = "The toolbar's rows, each a list of items: { id = <its id>, show = \"icon\" or \"label\", width = <its label's width in characters, 3 to 30>, pin = \"left\" or \"right\" (where the toolbar is docked at the bottom), icon = <up to 3 characters, an emoji too>, label = <its own label> }, { type = \"separator\" }, or a module's kind: { type = \"gesture\", tap = <an id>, up = <an id>, down = <an id> } (every action is in the list of the … button).",
      ui = { category = "Silverware Toolbar", label = "Favourite actions", priority = 2 },
    },
    ["favorites-touch"] = {
      type = "array",
      items = {
        type = "array",
        items = {
          type = "object",
          -- An item of a module's kind (the gestures module's button) has fields of its own, which its kind reads;
          -- a slot of it (tap, up, down) an action's id, or { id, icon, label }: the action with its own icon and label
          properties = {
            type = { type = "string" },
            id = { type = "string" },
            show = { type = "string", enum = { "icon", "label" } },
            -- (Kept within 3 and 30 as it is read: not refused here, which would fail the whole setting)
            width = { type = "number" },
            pin = { type = "string", enum = { "left", "right" } },
            -- An item's own icon (up to 3 characters, an emoji too) and label: an action's, a snippet's
            icon = { type = "string" },
            label = { type = "string" },
          },
        },
      },
      description = "The toolbar's rows where the screen is worked by finger (a phone, a tablet), as the favourites are written (gesture buttons need the Gestures module).",
      ui = { category = "Silverware Toolbar", label = "Favourite actions for touch", priority = 1.9 },
    },
    -- No default either: left out, on unless the favourites are the space's own and those for touch are not
    ["favorites-touch-enabled"] = {
      type = "boolean",
      description = "Whether the favourite actions for touch show where the screen is worked by finger; off, the favourite actions show there, those for touch kept. Not set: on, unless the favourite actions are your own and those for touch are not.",
      ui = { category = "Silverware Toolbar", label = "Own favourites for touch", priority = 1.8 },
    },
    shortcut = {
      type = "string",
      default = "Ctrl-Shift-q",
      description = "The key that shows every action (with nothing selected, the toolbar at the cursor), as SilverBullet writes keys. Applies after a reload.",
      ui = { category = "Silverware Toolbar", label = "Key for every action", priority = 1 },
    },
    placement = {
      type = "string",
      enum = { "selection", "bottom", "top" },
      default = "selection",
      description = "Where the toolbar shows on a computer: by the selection, or docked at the bottom or at the top (as wide as the editor, not over SilverBullet's sidebars).",
      ui = { category = "Silverware Toolbar", label = "Where the toolbar shows", priority = 0.95 },
    },
    ["placement-touch"] = {
      type = "string",
      enum = { "selection", "bottom", "top" },
      default = "bottom",
      description = "Where the toolbar shows where the screen is worked by finger (a phone, a tablet): docked at the bottom over the keyboard (the system's Cut / Copy / Paste menu is by the selection), at the top, or by the selection.",
      ui = { category = "Silverware Toolbar", label = "Where the toolbar shows by touch", priority = 0.945 },
    },
    show = {
      type = "string",
      enum = { "always", "writing", "selection" },
      default = "selection",
      description = "When the toolbar shows on a computer: always, also where the page's text has no focus; while you write (by the cursor, or docked); or only after selecting text.",
      ui = { category = "Silverware Toolbar", label = "When the toolbar shows", priority = 0.94 },
    },
    ["show-touch"] = {
      type = "string",
      enum = { "always", "writing", "selection" },
      default = "writing",
      description = "When the toolbar shows where the screen is worked by finger: always, also where the page's text has no focus; while you write; or only after selecting text.",
      ui = { category = "Silverware Toolbar", label = "When the toolbar shows by touch", priority = 0.935 },
    },
    wordAtCaret = {
      type = "boolean",
      default = true,
      description = "With nothing selected, Bold (any inline format) and Clear formatting work on the word the cursor is in or touches (what spaces separate), the cursor staying where it was.",
      ui = { category = "Silverware Toolbar", label = "A word at the cursor as if selected", priority = 0.93 },
    },
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        inline = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Bold, italic, strikethrough, highlight, code, links and wiki links.", ui = { category = "Silverware Toolbar", label = "Inline formats", priority = 0.9 } } } },
        blocks = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Turn lines into a paragraph, a heading, a list, a task or a quote.", ui = { category = "Silverware Toolbar", label = "Turn into", priority = 0.8 } } } },
        clear = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Remove the inline formats of the selection.", ui = { category = "Silverware Toolbar", label = "Clear formatting", priority = 0.6 } } } },
        commands = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Every SilverBullet command, found by typing its name in the list of every action, and as a favourite.", ui = { category = "Silverware Toolbar", label = "Commands", priority = 0.5 } } } },
        keyboard = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "On a phone or tablet: an action hiding the on-screen keyboard, the selection kept as it is (to see more of the page while you format it).", ui = { category = "Silverware Toolbar", label = "Hide the keyboard", priority = 0.4 } } } },
        emoji = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "An action picking an emoji to write at the cursor, found by its name and keywords.", ui = { category = "Silverware Toolbar", label = "Emoji", priority = 0.1 } } } },
        snippets = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "A text snippet among the favourites: a button of your own character (an emoji too) and label writing your text at the cursor, {s} in it the text selected, {c} where the cursor goes.", ui = { category = "Silverware Toolbar", label = "Snippets", priority = 0.2 } } } },
        gestures = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "A gesture button among the favourites: two actions in one, a click runs the first, swiping it up the second.", ui = { category = "Silverware Toolbar", label = "Gestures", priority = 0.3 } } } },
      },
    },
  },
})

-- Silverware Toolbar only uses the public editor and config API, handed over here
if js and js.window then
  local silverwareToolbarJs = js.importFromSpace("Library/damesene/silverware-toolbar.js")
  silverwareToolbarJs.init({
    getSelection = editor.getSelection,
    setSelection = editor.setSelection,
    replaceRange = editor.replaceRange,
    getText = editor.getText,
    flash = editor.flashNotification,
    focus = editor.focus,
    getConfig = config.get,
    confirm = editor.confirm,
    readPage = space.readPage,
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
        editor.flashNotification("Silverware Toolbar: the settings are saved in CONFIG, but loading them failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
    reloadUI = editor.reloadUI,
    -- The commands module: SilverBullet's commands, run on the editor's selection
    listCommands = system.listCommands,
    invokeCommand = editor.invokeCommand,
    -- Actions that open a page (custom ones' perform)
    navigate = editor.navigate,
    -- Whether SilverBullet's keyboard bar is on (the settings offer to turn it off on a phone)
    getUiOption = editor.getUiOption,
  })
  command.define {
    name = "Silverware Toolbar: Settings",
    run = function()
      silverwareToolbarJs.openSettings()
    end,
  }
  -- Every script loaded (the toolbar started before the scripts after it): their commands read, as actions
  event.listen {
    name = "system:ready",
    run = function()
      silverwareToolbarJs.scriptsLoaded()
    end,
  }
  -- The key is the command's: SilverBullet handles it (and shows it in the command palette)
  command.define {
    name = "Silverware Toolbar: Show actions",
    key = config.get("silverware.toolbar.shortcut", "Ctrl-Shift-q"),
    run = function()
      silverwareToolbarJs.showActions()
    end,
  }
end
```
