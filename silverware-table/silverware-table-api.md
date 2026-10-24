---
tags: meta
---
# Silverware Table API

The Space Lua API of [[Library/damesene/silverware-table|Silverware Table]]: `silverware.table.defineFunctions`, `defineTypes` and `defineSeries` (your own functions, column types and AutoFill series), `silverware.table.evaluate` (a formula calculated from Space Lua), and completion in a formula given to it. It is installed with the library; see its page for how each is used.

```space-lua
-- priority: 50
-- Silverware Table's Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.table.defineFunctions, silverware.table.defineTypes and
-- silverware.table.defineSeries, see "Custom functions", "Custom column types" and "Custom series";
-- silverware.table.evaluate, see "Formulas from Space Lua"
silverware = silverware or {}
silverware.table = silverware.table or {}
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
  function silverware.table.defineFunctions(definitions)
    shown(silverwareTableJs.defineFunctions(definitions), "defineFunctions")
  end
  function silverware.table.defineTypes(definitions)
    shown(silverwareTableJs.defineTypes(definitions), "defineTypes")
  end
  function silverware.table.defineSeries(definitions)
    shown(silverwareTableJs.defineSeries(definitions), "defineSeries")
  end
  -- A formula calculated on the page it is on (a ${…}'s, else the page shown): one value as its text, several
  -- as ["a","b"]. The page and the other pages it reads are read through SilverBullet, so a ${…} showing it is
  -- shown anew as they change. The editor's text only while it holds that page: a ${…} of a page being opened
  -- is evaluated before the editor has its text (the page's name already the new one), so the text must hold
  -- the formula itself, else the page is read (as saved)
  function silverware.table.evaluate(formula)
    local page = _CTX and _CTX.currentPage and _CTX.currentPage.name
    local text = editor.getText()
    if page and (page ~= editor.getCurrentPage() or not string.find(text, formula, 1, true)) then
      text = space.readPage(page)
    end
    local result = silverwareTableJs.evaluated(formula, text, page)
    for _, other in ipairs(result.pages) do
      space.pageExists(other)
    end
    return result.value
  end
  -- Completion in a formula given to silverware.table.evaluate (the line before the caret ends in one,
  -- in either quotes), as a cell's editor offers it
  event.listen {
    name = "editor:complete",
    run = function(e)
      local at = e.data
      local formula = string.match(at.linePrefix, 'silverware%.table%.evaluate%(%s*"([^"]*)$')
        or string.match(at.linePrefix, "silverware%.table%.evaluate%(%s*'([^']*)$")
      if not formula then return end
      local found = silverwareTableJs.completions(formula, editor.getText())
      if not found then return end
      local options = {}
      for _, choice in ipairs(found.choices) do
        options[#options + 1] = {
          label = choice.text,
          apply = choice.text,
          detail = choice.syntax or choice.kind,
          info = choice.description,
          type = choice.kind == "function" and "function" or choice.kind == "table" and "class" or "variable",
        }
      end
      return { from = at.pos - found.typed, options = options }
    end,
  }
else
  -- Space Lua without a window (no tables to show): nothing to define
  function silverware.table.defineFunctions() end
  function silverware.table.defineTypes() end
  function silverware.table.defineSeries() end
  function silverware.table.evaluate() return "#N/A" end
end
```
