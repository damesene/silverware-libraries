---
tags: meta
---
# Silverware Assets API

The Space Lua API of [Silverware Assets](silverware-assets.md): `silverware.assets.api`, what other plugins register their kinds of file and their actions with. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- priority: 50
-- Silverware Assets' Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.assets.api, the JS object the other plugins are handed (the same object each time:
-- the module is imported once, so a plugin registering again replaces what it registered before)
silverware = silverware or {}
silverware.assets = silverware.assets or {}
if js and js.window then
  local silverwareAssetsJs = js.importFromSpace("Library/damesene/silverware-assets.js")
  silverware.assets.api = silverwareAssetsJs.api
else
  -- Space Lua without a window (nothing to show)
  silverware.assets.api = nil
end
```
