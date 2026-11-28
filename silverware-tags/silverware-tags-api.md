---
tags: meta
---
# Silverware Tags API

The Space Lua API of [Silverware Tags](silverware-tags.md): `silverware.tags.defineOperations` (your own operations). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-tags-init](silverware-tags-init.md) for what starts Silverware Tags.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Tags starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.tags = silverware_internal.tags or {}
silverware_internal.tags.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Tags needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Tags needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Tags works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Tags: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.tags.refused = problem
    editor.flashNotification(problem, "error")
    -- Its API's functions refuse with the same message, so a script calling one says why
    local function refused() error(problem) end
    silverware.tags = {}
    silverware.tags.defineOperations = refused
  end
end
```

```space-lua
-- priority: 50
-- Silverware Tags' Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.tags.defineOperations, see "Custom operations"
silverware = silverware or {}
silverware.tags = silverware.tags or {}
if js and js.window and not silverware_internal.tags.refused then
  local silverwareTagsJs = js.importFromSpace("Library/damesene/silverware-tags.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareTagsJs.resetDefinitions()
  -- The others are defined; a mistake is shown, the rest of the script goes on
  function silverware.tags.defineOperations(definitions)
    local problem = silverwareTagsJs.defineOperations(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
elseif not silverware_internal.tags.refused then
  -- Space Lua without a window (nothing to show): nothing to define
  function silverware.tags.defineOperations() end
end
```
