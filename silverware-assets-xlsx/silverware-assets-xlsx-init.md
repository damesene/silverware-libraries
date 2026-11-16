---
tags: meta
---
# Silverware Assets XLSX init

What starts [Silverware Assets XLSX](silverware-assets-xlsx.md) in SilverBullet: the JavaScript loaded and handed Silverware Assets' API, with which it registers how an Excel workbook is drawn. It is installed with the library.

```space-lua
-- Silverware Assets XLSX draws workbooks through Silverware Assets' API (its API page, priority 50, loaded before this):
-- without it, nothing is drawn
if js and js.window then
  local silverwareAssetsXlsxJs = js.importFromSpace("Library/damesene/silverware-assets-xlsx.js")
  silverwareAssetsXlsxJs.init({
    assets = silverware and silverware.assets and silverware.assets.api,
    -- A notification, and SilverBullet's commands and their shortcuts: one pressed in a reader, where it does nothing, told
    flash = function(message, type)
      editor.flashNotification(message, type)
    end,
    listCommands = system.listCommands,
  })
end
```
