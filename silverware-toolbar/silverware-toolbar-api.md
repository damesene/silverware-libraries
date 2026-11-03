---
tags: meta
---
# Silverware Toolbar API

The Space Lua API of [[Library/damesene/silverware-toolbar|Silverware Toolbar]]: `silverware.toolbar.defineFormats` and `silverware.toolbar.defineActions` (your own formats and actions). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how each is used, and [[Library/damesene/silverware-toolbar-init]] for what starts Silverware Toolbar.

```space-lua
-- priority: 50
-- Silverware Toolbar's Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.toolbar.defineFormats and
-- silverware.toolbar.defineActions, see "Custom formats" and "Custom actions"
silverware = silverware or {}
silverware.toolbar = silverware.toolbar or {}
if js and js.window then
  local silverwareToolbarJs = js.importFromSpace("Library/damesene/silverware-toolbar.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareToolbarJs.resetDefinitions()
  -- The others are defined; a mistake is shown, the rest of the script goes on
  local function shown(problem)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
  function silverware.toolbar.defineFormats(definitions)
    shown(silverwareToolbarJs.defineFormats(definitions))
  end
  function silverware.toolbar.defineActions(definitions)
    shown(silverwareToolbarJs.defineActions(definitions))
  end
else
  -- Space Lua without a window (no toolbar to show): nothing to define
  function silverware.toolbar.defineFormats() end
  function silverware.toolbar.defineActions() end
end
```
