---
tags: meta
---
# Silverware Tags API

The Space Lua API of [Silverware Tags](silverware-tags.md): `silverware.tags.defineOperations` (your own operations). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-tags-init](silverware-tags-init.md) for what starts Silverware Tags.

```space-lua
-- priority: 50
-- Silverware Tags' Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.tags.defineOperations, see "Custom operations"
silverware = silverware or {}
silverware.tags = silverware.tags or {}
if js and js.window then
  local silverwareTagsJs = js.importFromSpace("Library/damesene/silverware-tags.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareTagsJs.resetDefinitions()
  -- The others are defined; a mistake is shown, the rest of the script goes on
  function silverware.tags.defineOperations(definitions)
    local problem = silverwareTagsJs.defineOperations(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
else
  -- Space Lua without a window (nothing to show): nothing to define
  function silverware.tags.defineOperations() end
end
```
