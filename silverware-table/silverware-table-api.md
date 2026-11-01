---
tags: meta
---
# Silverware Table API

The Space Lua API of [[Library/damesene/silverware-table|Silverware Table]]: `silverware.table.defineFunctions`, `defineTypes` and `defineSeries` (your own functions, column types and AutoFill series) `silverware.table.evaluate` (a formula calculated from Space Lua), with `silverware.table.evaluateAlias` giving it a shorter name, and for other plugins `silverware.table.tables` (a text's tables as data) and `silverware.table.onWrite` (edits of the page written with the tables' writes). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how each is used, and [[Library/damesene/silverware-table-init]] for what starts Silverware Table.

```space-lua
-- priority: 50
-- Silverware Table's Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.table.defineFunctions, silverware.table.defineTypes and
-- silverware.table.defineSeries, see "Custom functions", "Custom column types" and "Custom series";
-- silverware.table.evaluate and silverware.table.evaluateAlias, see "Formulas from Space Lua";
-- silverware.table.tables and silverware.table.onWrite, see "For other plugins"
silverware = silverware or {}
silverware.table = silverware.table or {}
-- What Silverware Table's Lua shares between its blocks (this page's and the init page's) and keeps across
-- loads of Space Lua, apart from the API: silverware_internal.<plugin>, as the API is silverware.<plugin>
silverware_internal = silverware_internal or {}
silverware_internal.table = silverware_internal.table or {}
local internal = silverware_internal.table
if js and js.window then
  local silverwareTableJs = js.importFromSpace("Library/damesene/silverware-table.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareTableJs.resetDefinitions()
  -- The pages whose space-lua blocks call silverware.table.<api> (the definitions do not say where they come from),
  -- each with its first such block's ref (Page@123)
  local function callers(api)
    local pages = {}
    local seen = {}
    for _, block in ipairs(query[[from index.tag "space-lua"]]) do
      local calls = string.find(block.script, "silverware.table." .. api .. "(", 1, true)
      local defines = string.find(block.script, "function silverware.table." .. api, 1, true)
      -- Its ref is the page and where the block starts (Page@123)
      local page = block.ref
      local at = string.find(page, "@", 1, true)
      while at do
        local next = string.find(page, "@", at + 1, true)
        if not next then break end
        at = next
      end
      if at then page = string.sub(page, 1, at - 1) end
      if calls and not defines and not seen[page] then
        seen[page] = true
        pages[#pages + 1] = { name = page, ref = block.ref }
      end
    end
    return pages
  end
  -- The others are defined; a mistake is shown until it is closed, with where it may come from and a way there,
  -- the rest of the script goes on
  local function shown(problem, api)
    if problem then
      local pages = callers(api)
      local names = {}
      local actions = {}
      for i, page in ipairs(pages) do
        names[i] = page.name
        if i <= 3 then
          actions[#actions + 1] = { name = "Open " .. page.name, run = function() editor.navigate(page.ref) end }
        end
      end
      if #pages > 0 then
        problem = problem .. " Called on " .. table.concat(names, ", ") .. "."
      else
        problem = problem .. " Search the space for silverware.table." .. api .. " to find the script."
      end
      editor.flashNotification(problem, "error", { timeout = 0, actions = actions })
    end
  end
  --- Your own functions for formulas, written in JavaScript in your space; they replace those defined before.
  --- A mistake in one is shown in a notification, the others are defined.
  --- @param definitions table a JS module's functions, e.g. js.importFromSpace("Library/me/functions.js")
  --- @see Library/damesene/silverware-table#Custom functions
  function silverware.table.defineFunctions(definitions)
    shown(silverwareTableJs.defineFunctions(definitions), "defineFunctions")
  end
  --- Your own column types (a header's hashtag), written in JavaScript in your space; they replace those
  --- defined before. A mistake in one is shown in a notification, the others are defined.
  --- @param definitions table a JS module's types, e.g. js.importFromSpace("Library/me/types.js")
  --- @see Library/damesene/silverware-table#Custom column types
  function silverware.table.defineTypes(definitions)
    shown(silverwareTableJs.defineTypes(definitions), "defineTypes")
  end
  --- Your own AutoFill series (words to go round, or a JS series), written in JavaScript in your space; they
  --- replace those defined before. A mistake in one is shown in a notification, the others are defined.
  --- @param definitions table a JS module's series, e.g. js.importFromSpace("Library/me/series.js")
  --- @see Library/damesene/silverware-table#Custom series
  function silverware.table.defineSeries(definitions)
    shown(silverwareTableJs.defineSeries(definitions), "defineSeries")
  end
  --- A table formula calculated on the page, outside any table: what it reads it names by a table's name
  --- (beans!B2, beans![price], beans!vat, [[Prices]]beans!B2). A ${…} showing it follows the tables.
  --- @param formula string the formula, its = optional, e.g. "=SUM(beans![price])"
  --- @param text string? the page's text to calculate it on (left out: the page's, as below)
  --- @param page string? the page's name (left out: the page it is on, else the page shown)
  --- @return string one value as its text, several as a list ["a","b"], an error as its code (#REF!)
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.evaluate(formula, text, page)
    -- On the page it is on (a ${…}'s, else the page shown). The page and the other pages it reads are read
    -- through SilverBullet, so a ${…} showing it is shown anew as they change. The editor's text only while
    -- it holds that page: a ${…} of a page being opened is evaluated before the editor has its text (the
    -- page's name already the new one), so the text must hold the formula itself, else the page is read
    -- (as saved). A caller that has the text (Silverware Chart, as the page is edited) gives it
    page = page or (_CTX and _CTX.currentPage and _CTX.currentPage.name)
    if text == nil then
      text = editor.getText()
      if page and (page ~= editor.getCurrentPage() or not string.find(text, formula, 1, true)) then
        text = space.readPage(page)
      end
    end
    local result = silverwareTableJs.evaluated(formula, text, page)
    for _, other in ipairs(result.pages) do
      space.pageExists(other)
    end
    return result.value
  end
  --- The tables of a markdown text (a page's, as you have it): each with its name (where Silverware Table
  --- named it), its place in the text, its columns (their names and keys) and its body's cells as they show.
  --- @param text string the text, e.g. editor.getText()
  --- @return table a list of { name, from, to, columns = { { name, key } }, rows = { { cell, … } } }
  --- @see Library/damesene/silverware-table#For other plugins
  function silverware.table.tables(text)
    return silverwareTableJs.tables(text)
  end
  --- A function told of each write of tables: given the page's text as the write leaves it and a context to ask
  --- what the write did, it gives edits of the text outside the tables ({ { from, to, text } }, offsets in that
  --- text), written in the same edit (one undo step). Fast, and writing nothing itself; an edit touching a table
  --- is left out. The context: renamed() whether a table or a column was renamed; table(name) the table that had
  --- that name before, tableAt(offset) the table written at that offset of the text, each with its name now
  --- (.name) and column(name) a column's name now (nil: deleted); nil where the write wrote no such table.
  --- @param fn function the function, given the text and the context
  --- @see Library/damesene/silverware-table#For other plugins
  function silverware.table.onWrite(fn)
    silverwareTableJs.onWrite(fn)
  end
  -- The names evaluateAlias gave silverware.table.evaluate, for completion in a formula given to one (the init
  -- page's listener reads them); made anew each time Space Lua loads, as the scripts calling it run again
  internal.evaluateAliases = {}
  -- The functions evaluateAlias made, by name, kept across loads: a name that holds one of them is made again,
  -- a name that holds anything else is refused
  internal.madeAliases = internal.madeAliases or {}
  local made = internal.madeAliases
  --- A shorter name for silverware.table.evaluate: a function of that name doing the same, completion
  --- included, e.g. after evaluateAlias("te"), ${te("=beans!vat")}. A name already taken is refused.
  --- @param name string the function's name, e.g. "te"
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.evaluateAlias(name)
    if type(name) ~= "string" or not string.match(name, "^[%a_][%w_]*$") then
      shown('Silverware Table: evaluateAlias needs a name a Lua function can have, not "' .. tostring(name) .. '".', "evaluateAlias")
      return
    end
    local existing = _G[name]
    if existing ~= nil and existing ~= made[name] then
      shown("Silverware Table: evaluateAlias did not make " .. name .. ": that name is taken by something else.", "evaluateAlias")
      return
    end
    local alias = function(formula)
      return silverware.table.evaluate(formula)
    end
    made[name] = alias
    _G[name] = alias
    table.insert(internal.evaluateAliases, name)
    -- Its formulas' references follow the tables' edits too (the init page's, once it has run)
    if internal.formulaCallsChanged then internal.formulaCallsChanged() end
  end
else
  -- Space Lua without a window (no tables to show): nothing to define
  function silverware.table.defineFunctions() end
  function silverware.table.defineTypes() end
  function silverware.table.defineSeries() end
  function silverware.table.evaluate() return "#N/A" end
  function silverware.table.evaluateAlias() end
  function silverware.table.tables() return {} end
  function silverware.table.onWrite() end
end
```
