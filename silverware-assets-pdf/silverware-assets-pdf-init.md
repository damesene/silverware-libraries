---
tags: meta
---
# Silverware Assets PDF init

What starts [Silverware Assets PDF](silverware-assets-pdf.md) in SilverBullet: the JavaScript loaded and handed Silverware Assets' API, with which it registers how a PDF is drawn. It is installed with the library.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Assets PDF starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.assets_pdf = silverware_internal.assets_pdf or {}
silverware_internal.assets_pdf.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Assets PDF needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Assets PDF needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Assets PDF works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Assets PDF: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.assets_pdf.refused = problem
    editor.flashNotification(problem, "error")
  end
end
```

```space-lua
-- Silverware Assets PDF draws PDFs through Silverware Assets' API (its API page, priority 50, loaded before this): without it,
-- nothing is drawn
if js and js.window and not silverware_internal.assets_pdf.refused then
  local silverwareAssetsPdfJs = js.importFromSpace("Library/damesene/silverware-assets-pdf.js")
  silverwareAssetsPdfJs.init({
    assets = silverware and silverware.assets and silverware.assets.api,
  })
end
```
