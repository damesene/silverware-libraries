---
tags: meta
---
# Silverware Assets init

What starts [Silverware Assets](silverware-assets.md) in SilverBullet: the JavaScript loaded and handed SilverBullet's space and editor API. It is installed with the library; its Space Lua API is [silverware-assets-api](silverware-assets-api.md).

```space-lua
-- Silverware Assets only uses the public space, editor and config API, handed over here; Silverware Layout's API
-- where it is installed (silverware.layout.api: a medium's width by its handle, what its grids draw)
if js and js.window then
  local silverwareAssetsJs = js.importFromSpace("Library/damesene/silverware-assets.js")
  silverwareAssetsJs.init({
    getCurrentPage = editor.getCurrentPage,
    getText = editor.getText,
    flash = function(message, type)
      editor.flashNotification(message, type)
    end,
    layout = silverware.layout and silverware.layout.api,
  })
end
```
