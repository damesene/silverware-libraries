---
tags: meta
---
# Silverware Layout API

The Space Lua API of [Silverware Layout](silverware-layout.md): `silverware.layout.api`, what the other Silverware plugins register their widgets with, so Silverware Layout can lay them out. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- priority: 50
-- Silverware Layout's Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.layout.api, the JS object the other plugins are handed (the same object each time:
-- the module is imported once, so a plugin registering again replaces what it registered before)
silverware = silverware or {}
silverware.layout = silverware.layout or {}
if js and js.window then
  local silverwareLayoutJs = js.importFromSpace("Library/damesene/silverware-layout.js")
  silverware.layout.api = silverwareLayoutJs.api
else
  -- Space Lua without a window (nothing to lay out)
  silverware.layout.api = nil
end
```
