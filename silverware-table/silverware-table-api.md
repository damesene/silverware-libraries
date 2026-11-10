---
tags: meta
---
# Silverware Table API

The Space Lua API of [Silverware Table](silverware-table.md): `silverware.table.defineFunctions`, `defineTypes`, `defineSeries`, `defineConditions` and `defineFormats` (your own functions, column types, AutoFill series, and conditions and formats of conditional formatting), `silverware.table.defineSource` (a table of the space formulas read as \@name, from a query), `silverware.table.evaluate` and `evaluateText` (a formula calculated from Space Lua: its values for a script, its text for a page), with `silverware.table.evaluateAlias` and `evaluateTextAlias` giving them shorter names, `silverware.table.errors` and `errorsText` (the formula errors of a page or the space), and for other plugins `silverware.table.tables` (a text's tables as data) and `silverware.table.onWrite` (edits of the page written with the tables' writes). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how each is used, and [silverware-table-init](silverware-table-init.md) for what starts Silverware Table.

```space-lua
-- priority: 50
-- Silverware Table's Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.table.defineFunctions, silverware.table.defineTypes and
-- silverware.table.defineSeries, see "Custom functions", "Custom column types" and "Custom series";
-- silverware.table.defineMenuEntries, see "Custom menu entries";
-- silverware.table.defineSource, see "Sources of the space";
-- silverware.table.defineConditions and silverware.table.defineFormats, see "Custom conditions and formats";
-- silverware.table.evaluate, evaluateText, evaluateAlias, evaluateTextAlias, errors and errorsText, see
-- "Formulas from Space Lua";
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
  --- Your own conditions for conditional formatting (which cells a rule formats), written in JavaScript in
  --- your space; they replace those defined before. A mistake in one is shown in a notification.
  --- @param definitions table a JS module's conditions, e.g. js.importFromSpace("Library/me/conditions.js")
  --- @see Library/damesene/silverware-table#Custom conditions and formats
  function silverware.table.defineConditions(definitions)
    shown(silverwareTableJs.defineConditions(definitions), "defineConditions")
  end
  --- Your own formats for conditional formatting (how the cells a rule picks look: one style, levels, a
  --- look of each cell), written in JavaScript in your space; they replace those defined before.
  --- @param definitions table a JS module's formats, e.g. js.importFromSpace("Library/me/formats.js")
  --- @see Library/damesene/silverware-table#Custom conditions and formats
  function silverware.table.defineFormats(definitions)
    shown(silverwareTableJs.defineFormats(definitions), "defineFormats")
  end
  --- Your own entries in a row's or a column's menu (another plugin's too), written in JavaScript: each a
  --- name and its lineMenu(context, menu), given the menu's line and its table as data and the menu's builder.
  --- Calls add up (yours and a plugin's alike); a name given again replaces its entries. A mistake is shown.
  --- @param definitions table a JS module's definitions, e.g. js.importFromSpace("Library/me/menus.js")
  --- @see Library/damesene/silverware-table#Custom menu entries
  function silverware.table.defineMenuEntries(definitions)
    shown(silverwareTableJs.defineMenuEntries(definitions), "defineMenuEntries")
  end
  --- A source of the space: a table formulas, views and pivots read as @name (@tasks[due], @tasks[#Data]).
  --- Its data function gives its rows (a query's, usually); it runs now and again a moment after SilverBullet
  --- indexes a page. A mistake is shown, the source keeping the rows it had.
  --- @param definition table { name = "tasks", data = function() … end, columns = { "name", "due" } }:
  --- name the source's, as a table's (letters, digits and _); data a function giving a list of records (each a row)
  --- or of values (one column, value), e.g. function() return query[[from t = index.tag "task" select { name = t.name, due = t.due }]] end;
  --- columns (optional) its columns in this order, or some of them
  --- @see Library/damesene/silverware-table#Sources of the space
  function silverware.table.defineSource(definition)
    shown(silverwareTableJs.defineSource(definition), "defineSource")
  end
  -- A formula calculated by the JS's function `calculate` (evaluated or evaluatedText) on the page it is on
  -- (a ${…}'s, else the page shown), its result as that function gives it.
  local function calculated(calculate, formula, text, page)
    -- The page and the other pages it reads are read
    -- through SilverBullet, so a ${…} showing it is shown anew as they change. The editor's text only while
    -- it holds that page: a ${…} of a page being opened is evaluated before the editor has its text (the
    -- page's name already the new one), so the text must hold the formula itself, else the page is read
    -- (as saved). A caller that has the text (Silverware Chart, as the page is edited) gives it.
    -- _CTX is the ${…}'s own: in this function, defined on this page, it has no page (verified in 2.12.1), so
    -- the editor's page, already the one being opened, is the page (else a ${…} of a page opened from
    -- another was calculated on that other page's text: #REF!)
    page = page or (_CTX and _CTX.currentPage and _CTX.currentPage.name) or editor.getCurrentPage()
    if text == nil then
      text = editor.getText()
      if page and (page ~= editor.getCurrentPage() or not string.find(text, formula, 1, true)) then
        text = space.readPage(page)
      end
    end
    local result = calculate(formula, text, page)
    for _, other in ipairs(result.pages) do
      space.pageExists(other)
    end
    return result
  end
  --- A table formula calculated on the page, outside any table, its values for Lua: what it reads it names by
  --- a table's name (beans!B2, beans![price], beans!vat, [[Prices]]beans!B2). For a page's text, evaluateText.
  --- @param formula string the formula, its = optional, e.g. "=SUM(beans![price])"
  --- @param text string? the page's text to calculate it on (left out: the page's)
  --- @param page string? the page's name (left out: the page it is on, else the page shown)
  --- @return any one value (a number, true or false, a text; a date or a time as text; nil where empty), a range
  --- as a list ("" where empty, an error's cell as { code, detail }); an error: nil, { code = "#REF!", detail }
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.evaluate(formula, text, page)
    local result = calculated(silverwareTableJs.evaluated, formula, text, page)
    if result.error then return nil, result.error end
    return result.value
  end
  --- A table formula calculated on the page, outside any table, as text for the page: ${evaluateText(…)}
  --- shows it as a cell would, several values joined by ", ", an error as \#REF! (no hashtag). A ${…}
  --- showing it follows the tables.
  --- @param formula string the formula, its = optional, e.g. "=SUM(beans![price])"
  --- @param text string? the page's text to calculate it on (left out: the page's)
  --- @param page string? the page's name (left out: the page it is on, else the page shown)
  --- @return string the result as text
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.evaluateText(formula, text, page)
    return calculated(silverwareTableJs.evaluatedText, formula, text, page).value
  end
  -- The errors of the formula cells of `page`, else of every page whose tables hold a formula (the index's
  -- table rows keep a cell's raw text, its hidden tags too), by the JS's function `calculate` (errorsIn
  -- or errorsTextIn) given each page's text: the page shown as the editor has it, the others read through
  -- SilverBullet, as are the other pages they read, so a ${…} showing them is shown anew as they change
  local function formulaErrors(calculate, page)
    local names = {}
    local shown = editor.getCurrentPage()
    if page then
      names[1] = page
    else
      -- The page shown always (its formulas typed since it was indexed count too), then the pages whose
      -- table rows in the index hold a formula, as the JS tells them (a row's cells are their raw text)
      names[1] = shown
      for _, name in ipairs(silverwareTableJs.formulaPagesIn(query[[from index.tag "table"]])) do
        if name ~= shown then names[#names + 1] = name end
      end
    end
    local pages = {}
    for _, name in ipairs(names) do
      if name == shown then
        pages[#pages + 1] = { page = name, text = editor.getText() }
      else
        -- A page the index still has but the space no longer does is left out, not the whole list
        local ok, text = pcall(space.readPage, name)
        if ok and text then pages[#pages + 1] = { page = name, text = text } end
      end
    end
    local result = calculate(pages)
    for _, other in ipairs(result.pages) do
      space.pageExists(other)
    end
    return result
  end
  --- The errors formula cells show, calculated now: on one page, or on every page of the space with formulas.
  --- For a page's text, errorsText.
  --- @param page string? the page's name, e.g. "Budget" or editor.getCurrentPage() (left out: every page)
  --- @return table? a list of { page, ref (its cell in the markdown, "Budget@1234"), table (nil: unnamed), cell ("C3"), column,
  --- code ("#REF!"), detail, formula }; nil and { code, detail } with the formulas module off
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.errors(page)
    local result = formulaErrors(silverwareTableJs.formulaErrorsIn, page)
    if result.error then return nil, result.error end
    return result.errors
  end
  --- The errors formula cells show, for a page's text: ${silverware.table.errorsText()} shows them as a table,
  --- each page and cell a link (the cell's to its text in the markdown), the error as \#REF! (no hashtag), why.
  --- @param page string? the page's name (left out: every page with formulas)
  --- @return any the records the table shows, or the line "No formula errors"
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.errorsText(page)
    return formulaErrors(silverwareTableJs.formulaErrorsTextIn, page).errors
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
  -- The names evaluateAlias and evaluateTextAlias made, for completion in a formula given to one (the init
  -- page's listener reads them); made anew each time Space Lua loads, as the scripts calling them run again
  internal.evaluateAliases = {}
  -- The functions they made, by name, kept across loads: a name that holds one of them is made again (of
  -- either kind), a name that holds anything else is refused
  internal.madeAliases = internal.madeAliases or {}
  local made = internal.madeAliases
  -- A global function `name` calling `calls` (made by the API function `maker`, which a refusal names)
  local function alias(maker, name, calls)
    if type(name) ~= "string" or not string.match(name, "^[%a_][%w_]*$") then
      shown("Silverware Table: " .. maker .. ' needs a name a Lua function can have, not "' .. tostring(name) .. '".', maker)
      return
    end
    local existing = _G[name]
    if existing ~= nil and existing ~= made[name] then
      shown("Silverware Table: " .. maker .. " did not make " .. name .. ": that name is taken by something else.", maker)
      return
    end
    local fn = function(formula)
      return calls(formula)
    end
    made[name] = fn
    _G[name] = fn
    table.insert(internal.evaluateAliases, name)
    -- Its formulas' references follow the tables' edits too (the init page's, once it has run)
    if internal.formulaCallsChanged then internal.formulaCallsChanged() end
  end
  --- A shorter name for silverware.table.evaluate (values, for Lua): a function of that name doing the same,
  --- its formulas followed and completed, e.g. after evaluateAlias("ev"), ev("=beans!vat"). A name already
  --- taken is refused. For a page's text, evaluateTextAlias.
  --- @param name string the function's name, e.g. "ev"
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.evaluateAlias(name)
    alias("evaluateAlias", name, function(formula) return silverware.table.evaluate(formula) end)
  end
  --- A shorter name for silverware.table.evaluateText (text, for a page): a function of that name doing the
  --- same, its formulas followed and completed, e.g. after evaluateTextAlias("te"), ${te("=beans!vat")}. A
  --- name already taken is refused.
  --- @param name string the function's name, e.g. "te"
  --- @see Library/damesene/silverware-table#Formulas from Space Lua
  function silverware.table.evaluateTextAlias(name)
    alias("evaluateTextAlias", name, function(formula) return silverware.table.evaluateText(formula) end)
  end
else
  -- Space Lua without a window (no tables to show): nothing to define
  function silverware.table.defineFunctions() end
  function silverware.table.defineTypes() end
  function silverware.table.defineSeries() end
  function silverware.table.defineConditions() end
  function silverware.table.defineFormats() end
  function silverware.table.defineMenuEntries() end
  function silverware.table.defineSource() end
  function silverware.table.evaluate() return nil, { code = "#N/A", detail = "formulas are off" } end
  function silverware.table.evaluateText() return "\\#N/A" end
  function silverware.table.evaluateAlias() end
  function silverware.table.evaluateTextAlias() end
  function silverware.table.errors() return nil, { code = "#N/A", detail = "formulas are off" } end
  function silverware.table.errorsText() return "No formula errors" end
  function silverware.table.tables() return {} end
  function silverware.table.onWrite() end
end
```
