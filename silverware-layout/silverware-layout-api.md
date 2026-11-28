---
tags: meta
---
# Silverware Layout API

The Space Lua API of [Silverware Layout](silverware-layout.md): `silverware.layout.api`, what the other Silverware plugins register their widgets with, so Silverware Layout can lay them out. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Layout starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.layout = silverware_internal.layout or {}
silverware_internal.layout.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Layout needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Layout needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Layout works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Layout: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.layout.refused = problem
    editor.flashNotification(problem, "error")
  end
end
```

```space-lua
-- priority: 50
-- Silverware Layout's Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.layout.api, the JS object the other plugins are handed (the same object each time:
-- the module is imported once, so a plugin registering again replaces what it registered before)
silverware = silverware or {}
silverware.layout = silverware.layout or {}
if js and js.window and not silverware_internal.layout.refused then
  local silverwareLayoutJs = js.importFromSpace("Library/damesene/silverware-layout.js")
  silverware.layout.api = silverwareLayoutJs.api
elseif not silverware_internal.layout.refused then
  -- Space Lua without a window (nothing to lay out)
  silverware.layout.api = nil
end
```
