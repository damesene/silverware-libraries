---
tags: meta
---
# Silverware Chart API

The Space Lua API of [Silverware Chart](silverware-chart.md): `silverware.chart.defineFormats` (your own formats). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-chart-init](silverware-chart-init.md) for what starts Silverware Chart.

```space-lua
-- Silverware Core's gate (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority
-- 55: after the core's API page, 60, before the plugins' API pages, 50): Silverware Chart starts only with a core of major
-- 1, minor 0 or later; else it says so once, its API's functions say the same, its blocks do nothing
-- priority: 55
silverware = silverware or {}
silverware_internal = silverware_internal or {}
silverware_internal.chart = silverware_internal.chart or {}
silverware_internal.chart.refused = nil
if js and js.window then
  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")
  local installed = ok and core and core.VERSION or nil
  local problem = nil
  if not installed then
    problem = "Silverware Chart needs Silverware Core 1.0 or later (not installed): run Library: Update All, then reload the page"
  else
    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")
    major, minor = tonumber(major), tonumber(minor)
    if not major or not minor or major < 1 or (major == 1 and minor < 0) then
      problem = "Silverware Chart needs Silverware Core 1.0 or later (installed " .. installed .. "): run Library: Update All, then reload the page"
    elseif major > 1 then
      problem = "Silverware Chart works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Chart: run Library: Update All, then reload the page"
    end
  end
  if problem then
    silverware_internal.chart.refused = problem
    editor.flashNotification(problem, "error")
    -- Its API's functions refuse with the same message, so a script calling one says why
    local function refused() error(problem) end
    silverware.chart = {}
    silverware.chart.defineFormats = refused
  end
end
```

```space-lua
-- priority: 50
-- Silverware Chart's Space Lua API, loaded before your scripts: silverware.chart.defineFormats, see "Custom formats"
silverware = silverware or {}
silverware.chart = silverware.chart or {}
if js and js.window and not silverware_internal.chart.refused then
  local silverwareChartJs = js.importFromSpace("Library/damesene/silverware-chart.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareChartJs.resetDefinitions()
  --- Your own formats of charts, from a JS module of the space; a mistake is shown, the others are defined.
  --- @param definitions table a JS module's formats, e.g. js.importFromSpace("Library/me/csv-chart.js")
  --- @see Library/damesene/silverware-chart#Custom formats
  function silverware.chart.defineFormats(definitions)
    local problem = silverwareChartJs.defineFormats(definitions)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
elseif not silverware_internal.chart.refused then
  -- Space Lua without a window (nothing to draw): nothing to define
  function silverware.chart.defineFormats() end
end
```
