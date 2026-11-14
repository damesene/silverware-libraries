---
tags: meta
---
# Silverware Editor API

The Space Lua API of [Silverware Editor](silverware-editor.md): `silverware.editor.api`, what the other Silverware plugins make their markdown editors with. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- priority: 50
-- Silverware Editor's Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.editor.api, the JS object the other plugins are handed (the same object each time:
-- the module is imported once)
silverware = silverware or {}
silverware.editor = silverware.editor or {}
if js and js.window then
  local silverwareEditorJs = js.importFromSpace("Library/damesene/silverware-editor.js")
  silverware.editor.api = silverwareEditorJs.api
else
  -- Space Lua without a window (nothing to edit in)
  silverware.editor.api = nil
end
```
