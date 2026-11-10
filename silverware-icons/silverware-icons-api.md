---
tags: meta
---
# Silverware Icons API

The Space Lua API of [Silverware Icons](silverware-icons.md): `silverware.icons.defineSets` (sets of icons of your own), and `silverware.icons.api`, what the other Silverware plugins draw and pick icons with. It is loaded before your scripts and before the other plugins start, so they can use it. It is installed with the library.

```space-lua
-- priority: 50
-- Silverware Icons' Space Lua API, loaded before your scripts (priority 0 unless they say otherwise) and the other
-- plugins' init pages: silverware.icons.defineSets, see "A set of your own"; silverware.icons.api, the JS object the
-- other plugins are handed (the same object each time: the module is imported once)
silverware = silverware or {}
silverware.icons = silverware.icons or {}
if js and js.window then
  local silverwareIconsJs = js.importFromSpace("Library/damesene/silverware-icons.js")
  -- Space Lua is loaded (again): the scripts' sets replace those of before (kept until then)
  silverwareIconsJs.resetDefinitions()
  silverware.icons.api = silverwareIconsJs.api
  function silverware.icons.defineSets(definitions)
    local problem = silverwareIconsJs.defineSets(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
else
  -- Space Lua without a window (nothing to draw): nothing to define
  silverware.icons.api = nil
  function silverware.icons.defineSets() end
end
```
