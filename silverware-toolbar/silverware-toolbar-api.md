---
tags: meta
---
# Silverware Toolbar API

The Space Lua API of [Silverware Toolbar](silverware-toolbar.md): `silverware.toolbar.defineFormats` and `silverware.toolbar.defineActions` (your own formats and actions). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how each is used, and [silverware-toolbar-init](silverware-toolbar-init.md) for what starts Silverware Toolbar.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Toolbar starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.toolbar = silverware_internal.toolbar or {}
silverware_internal.toolbar.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Toolbar needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Toolbar needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Toolbar works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Toolbar: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.toolbar.refused = problem
    editor.flashNotification(problem, "error")
    -- Its API's functions refuse with the same message, so a script calling one says why
    local function refused() error(problem) end
    silverware.toolbar = {}
    silverware.toolbar.defineFormats = refused
    silverware.toolbar.defineActions = refused
  end
end
```

```space-lua
-- priority: 50
-- Silverware Toolbar's Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.toolbar.defineFormats and
-- silverware.toolbar.defineActions, see "Custom formats" and "Custom actions"
silverware = silverware or {}
silverware.toolbar = silverware.toolbar or {}
if js and js.window and not silverware_internal.toolbar.refused then
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
elseif not silverware_internal.toolbar.refused then
  -- Space Lua without a window (no toolbar to show): nothing to define
  function silverware.toolbar.defineFormats() end
  function silverware.toolbar.defineActions() end
end
```
