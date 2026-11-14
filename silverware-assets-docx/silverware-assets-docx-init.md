---
tags: meta
---
# Silverware Assets DOCX init

What starts [Silverware Assets DOCX](silverware-assets-docx.md) in SilverBullet: the JavaScript loaded and handed Silverware Assets' API, with which it registers how a Word document is drawn. It is installed with the library.

```space-lua
-- Silverware Assets DOCX draws documents through Silverware Assets' API (its API page, priority 50, loaded before this):
-- without it, nothing is drawn
if js and js.window then
  local silverwareAssetsDocxJs = js.importFromSpace("Library/damesene/silverware-assets-docx.js")
  silverwareAssetsDocxJs.init({
    assets = silverware and silverware.assets and silverware.assets.api,
  })
end
```
