---
tags: meta
---
# Silverware Assets PDF init

What starts [Silverware Assets PDF](silverware-assets-pdf.md) in SilverBullet: the JavaScript loaded and handed Silverware Assets' API, with which it registers how a PDF is drawn. It is installed with the library.

```space-lua
-- Silverware Assets PDF draws PDFs through Silverware Assets' API (its API page, priority 50, loaded before this): without it,
-- nothing is drawn
if js and js.window then
  local silverwareAssetsPdfJs = js.importFromSpace("Library/damesene/silverware-assets-pdf.js")
  silverwareAssetsPdfJs.init({
    assets = silverware and silverware.assets and silverware.assets.api,
  })
end
```
