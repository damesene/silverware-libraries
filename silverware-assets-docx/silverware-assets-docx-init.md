---
tags: meta
---
# Silverware Assets DOCX init

What starts [Silverware Assets DOCX](silverware-assets-docx.md) in SilverBullet: the JavaScript loaded and handed Silverware Assets' API, with which it registers how a Word document is drawn. It is installed with the library.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Assets DOCX starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.assets_docx = silverware_internal.assets_docx or {}
silverware_internal.assets_docx.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Assets DOCX needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Assets DOCX needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Assets DOCX works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Assets DOCX: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.assets_docx.refused = problem
    editor.flashNotification(problem, "error")
  end
end
```

```space-lua
-- Silverware Assets DOCX draws documents through Silverware Assets' API (its API page, priority 50, loaded before this):
-- without it, nothing is drawn
if js and js.window and not silverware_internal.assets_docx.refused then
  local silverwareAssetsDocxJs = js.importFromSpace("Library/damesene/silverware-assets-docx.js")
  silverwareAssetsDocxJs.init({
    assets = silverware and silverware.assets and silverware.assets.api,
    -- A notification, and SilverBullet's commands and their shortcuts: one pressed in a reader, where it does nothing, told
    flash = function(message, type)
      editor.flashNotification(message, type)
    end,
    listCommands = system.listCommands,
  })
end
```
