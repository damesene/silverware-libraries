---
tags: meta
---
# Silverware Chart API

The Space Lua API of [Silverware Chart](silverware-chart.md): `silverware.chart.defineFormats` (your own formats). It is loaded before your scripts, so they can call it. It is installed with the library; see its page for how it is used, and [silverware-chart-init](silverware-chart-init.md) for what starts Silverware Chart.

```space-lua
-- priority: 50
-- Silverware Chart's Space Lua API, loaded before your scripts: silverware.chart.defineFormats, see "Custom formats"
silverware = silverware or {}
silverware.chart = silverware.chart or {}
if js and js.window then
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
else
  -- Space Lua without a window (nothing to draw): nothing to define
  function silverware.chart.defineFormats() end
end
```
