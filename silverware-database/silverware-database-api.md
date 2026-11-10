---
tags: meta
---
# Silverware Database API

The Space Lua API of [Silverware Database](silverware-database.md): `silverware.database.defineViews` (your own views), `silverware.database.defineTypes` (your own property types) and `silverware.database.defineConverters` (your own converters of selected text). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-database-init](silverware-database-init.md) for what starts Silverware Database.

```space-lua
-- priority: 50
-- Silverware Database's Space Lua API, loaded before your scripts: see "Your own views and types"
silverware = silverware or {}
silverware.database = silverware.database or {}
if js and js.window then
  local silverwareDatabaseJs = js.importFromSpace("Library/damesene/silverware-database.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before
  silverwareDatabaseJs.resetDefinitions()
  --- Your own views, from a JS module of the space; a mistake is shown, the others are defined.
  --- @param definitions table a JS module's views, e.g. js.importFromSpace("Library/me/board.js")
  --- @see Library/damesene/silverware-database#Your own views and types
  function silverware.database.defineViews(definitions)
    local problem = silverwareDatabaseJs.defineViews(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
  --- Your own property types, from a JS module of the space; a mistake is shown, the others are defined.
  --- @param definitions table a JS module's types, e.g. js.importFromSpace("Library/me/rating.js")
  --- @see Library/damesene/silverware-database#Your own views and types
  function silverware.database.defineTypes(definitions)
    local problem = silverwareDatabaseJs.defineTypes(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
  --- Your own converters of selected text into a database, from a JS module of the space; a mistake is shown, the others are defined.
  --- @param definitions table a JS module's converters, e.g. js.importFromSpace("Library/me/converters.js")
  --- @see Library/damesene/silverware-database#Your own views and types
  function silverware.database.defineConverters(definitions)
    local problem = silverwareDatabaseJs.defineConverters(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
else
  -- Space Lua without a window (nothing to draw): nothing to define
  function silverware.database.defineViews() end
  function silverware.database.defineTypes() end
  function silverware.database.defineConverters() end
end
```
