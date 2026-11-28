---
tags: meta
---
# Silverware Database API

The Space Lua API of [Silverware Database](silverware-database.md): `silverware.database.items` (a database's items, its formulas' values among them), `silverware.database.defineViews` (your own views), `silverware.database.defineTypes` (your own property types) and `silverware.database.defineConverters` (your own converters of selected text). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-database-init](silverware-database-init.md) for what starts Silverware Database.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Database starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.database = silverware_internal.database or {}
silverware_internal.database.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Database needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Database needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Database works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Database: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.database.refused = problem
    editor.flashNotification(problem, "error")
    -- Its API's functions refuse with the same message, so a script calling one says why
    local function refused() error(problem) end
    silverware.database = {}
    silverware.database.items = refused
    silverware.database.defineViews = refused
    silverware.database.defineTypes = refused
    silverware.database.defineConverters = refused
  end
end
```

```space-lua
-- priority: 50
-- Silverware Database's Space Lua API, loaded before your scripts: see "Your own views and types"
silverware = silverware or {}
silverware.database = silverware.database or {}
if js and js.window and not silverware_internal.database.refused then
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
elseif not silverware_internal.database.refused then
  -- Space Lua without a window (nothing to draw): nothing to define, no database read
  function silverware.database.items() return nil end
  function silverware.database.defineViews() end
  function silverware.database.defineTypes() end
  function silverware.database.defineConverters() end
end
```
