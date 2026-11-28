---
tags: meta
---
# Silverware Core API

The Space Lua API of [Silverware Core](silverware-core.md): `silverware.core.version`, the version installed. It is loaded before the Silverware plugins' own API pages, which check it before they start. It is installed with the library.

```space-lua
-- priority: 60
-- Silverware Core's Space Lua API, loaded before the plugins' API pages (priority 50), whose gates check its version
-- (docs/silverware-core.md, *Loading and the version gate*): silverware.core.version
silverware = silverware or {}
silverware.core = silverware.core or {}
if js and js.window then
  local silverwareCoreJs = js.importFromSpace("Library/damesene/silverware-core.js")
  silverware.core.version = silverwareCoreJs.VERSION
else
  -- Space Lua without a window (no plugin starts)
  silverware.core.version = nil
end
```
