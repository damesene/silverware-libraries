---
tags: meta
---
# Silverware Assets API

The Space Lua API of [Silverware Assets](silverware-assets.md): `silverware.assets.api`, what other plugins register their kinds of file and their actions with. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Assets starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.assets = silverware_internal.assets or {}
silverware_internal.assets.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Assets needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Assets needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Assets works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Assets: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.assets.refused = problem
    editor.flashNotification(problem, "error")
  end
end
```

```space-lua
-- priority: 50
-- Silverware Assets' Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.assets.api, the JS object the other plugins are handed (the same object each time:
-- the module is imported once, so a plugin registering again replaces what it registered before)
silverware = silverware or {}
silverware.assets = silverware.assets or {}
if js and js.window and not silverware_internal.assets.refused then
  local silverwareAssetsJs = js.importFromSpace("Library/damesene/silverware-assets.js")
  silverware.assets.api = silverwareAssetsJs.api
elseif not silverware_internal.assets.refused then
  -- Space Lua without a window (nothing to show)
  silverware.assets.api = nil
end
```
