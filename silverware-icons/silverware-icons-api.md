---
tags: meta
---
# Silverware Icons API

The Space Lua API of [Silverware Icons](silverware-icons.md): `silverware.icons.defineSets` (sets of icons of your own), and `silverware.icons.api`, what the other Silverware plugins draw and pick icons with. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Icons starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.icons = silverware_internal.icons or {}
silverware_internal.icons.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Icons needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Icons needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Icons works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Icons: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.icons.refused = problem
    editor.flashNotification(problem, "error")
    -- Its API's functions refuse with the same message, so a script calling one says why
    local function refused() error(problem) end
    silverware.icons = {}
    silverware.icons.defineSets = refused
  end
end
```

```space-lua
-- priority: 50
-- Silverware Icons' Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.icons.defineSets, see "A set of your own"; silverware.icons.api, the JS object the
-- other plugins are handed (the same object each time: the module is imported once)
silverware = silverware or {}
silverware.icons = silverware.icons or {}
if js and js.window and not silverware_internal.icons.refused then
  local silverwareIconsJs = js.importFromSpace("Library/damesene/silverware-icons.js")
  -- Space Lua is loaded (again): the scripts' sets replace those of before (kept until then)
  silverwareIconsJs.resetDefinitions()
  silverware.icons.api = silverwareIconsJs.api
  function silverware.icons.defineSets(definitions)
    local problem = silverwareIconsJs.defineSets(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
elseif not silverware_internal.icons.refused then
  -- Space Lua without a window (nothing to draw): nothing to define
  silverware.icons.api = nil
  function silverware.icons.defineSets() end
end
```
