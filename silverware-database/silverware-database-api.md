---
tags: meta
---
# Silverware Database API

The Space Lua API of [Silverware Database](silverware-database.md): `silverware.database.items` (a database's items, its formulas' values among them), `silverware.database.defineViews` (your own views), `silverware.database.defineTypes` (your own property types) and `silverware.database.defineConverters` (your own converters of selected text). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-database-init](silverware-database-init.md) for what starts Silverware Database.

```space-lua
-- priority: 50
-- Silverware Database's Space Lua API, loaded before your scripts: see "Your own views and types"
silverware = silverware or {}
silverware.database = silverware.database or {}
if js and js.window then
  local silverwareDatabaseJs = js.importFromSpace("Library/damesene/silverware-database.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before
  silverwareDatabaseJs.resetDefinitions()
  --- A database's items, in their order by hand: each its values by their properties' keys (a formula's
  --- calculated, an error's as its code: "#DIV/0!"; Created and Modified among them), its name and its page (ref).
  --- @param id string the database's id, as its block names it (id: tasks)
  --- @return table? the items, a list; nil where there is no such database, or not yet (Silverware Database
  --- starting, the index not having it yet: a ${…} is shown anew once it has it)
  --- @see Library/damesene/silverware-database#Reading a database from Space Lua
  function silverware.database.items(id)
    return silverwareDatabaseJs.items(id)
  end
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
  -- Space Lua without a window (nothing to draw): nothing to define, no database read
  function silverware.database.items() return nil end
  function silverware.database.defineViews() end
  function silverware.database.defineTypes() end
  function silverware.database.defineConverters() end
end
```
