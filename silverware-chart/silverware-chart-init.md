---
tags: meta
---
# Silverware Chart init

What starts [Silverware Chart](silverware-chart.md) in SilverBullet: its settings (shown in the Configuration Manager), the JavaScript loaded and handed SilverBullet's editor and space API, a code widget for each language charts are written in, its commands and the events it follows. It is installed with the library; its Space Lua API is [silverware-chart-api](silverware-chart-api.md).

```space-lua
-- priority: -10
-- (After the libraries of priority 0, SilverBullet's Mermaid among them: the code widgets defined here are the ones
-- used, and what drew a language before is kept to draw what is no chart)
config.defineCategory {
  name = "Silverware Chart",
  description = "Charts written as Mermaid, drawn with Chart.js.",
  priority = 3,
}

config.define("silverware.chart", {
  description = "Silverware Chart settings",
  type = "object",
  properties = {
    height = {
      type = "string",
      default = "300px",
      description = "A chart's height where its block says none (CSS: 300px, 20em).",
      ui = { category = "Silverware Chart", label = "Chart height", priority = 1 },
    },
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        mermaid = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Charts written as Mermaid (```mermaid blocks of xychart-beta and pie), which other Mermaid renderers can draw too.", ui = { category = "Silverware Chart", label = "Mermaid", priority = 0.9 } } } },
        types = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "The built-in types of charts: bar, line, area, scatter, pie, doughnut, polar area, radar.", ui = { category = "Silverware Chart", label = "Chart types", priority = 0.8 } } } },
        settings = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "The settings every chart has, in its settings dialog: title, height, legend, stacked, smooth lines, the axes, each series' name, color and how it is drawn.", ui = { category = "Silverware Chart", label = "Chart settings", priority = 0.75 } } } },
        tables = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "A markdown table as a chart's data, found by its place (above or below the chart, under a heading), followed as it is edited.", ui = { category = "Silverware Chart", label = "Tables as sources", priority = 0.7 } } } },
        silverwareTable = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Where Silverware Table is installed: a table it named as a chart's data, and the chart's data written into its block with each edit of the table.", ui = { category = "Silverware Chart", label = "Silverware Table", priority = 0.6 } } } },
        insert = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "The command Silverware Chart: Insert chart (a chart under a table of the page) and the slash command /chart (a chart at the cursor), the table picked from a list.", ui = { category = "Silverware Chart", label = "Insert a chart", priority = 0.5 } } } },
      },
    },
  },
})

-- Silverware Chart only uses the public editor, space and config API (and Silverware Table's), handed over here
if js and js.window then
  local silverwareChartJs = js.importFromSpace("Library/damesene/silverware-chart.js")
  local bridge = {
    getText = editor.getText,
    getCurrentPage = editor.getCurrentPage,
    readPage = space.readPage,
    replaceRange = editor.replaceRange,
    getCursor = editor.getCursor,
    moveCursor = editor.moveCursor,
    flash = function(message, type)
      editor.flashNotification(message, type)
    end,
    filterBox = function(label, options)
      return editor.filterBox(label, options, "", "Type to find a table")
    end,
    getConfig = config.get,
  }
  -- Silverware Table's API, where it is installed (its API page has priority 50: defined before this block)
  if silverware.table and silverware.table.tables and silverware.table.onWrite then
    bridge.tables = silverware.table.tables
    bridge.onWrite = silverware.table.onWrite
  end
  silverwareChartJs.init(bridge)
  -- The commands and slash commands of the modules turned on
  for _, name in ipairs(silverwareChartJs.commandNames()) do
    command.define {
      name = name,
      run = function()
        silverwareChartJs.runCommand(name)
      end,
    }
  end
  for _, slash in ipairs(silverwareChartJs.slashCommandNames()) do
    local name = slash.name
    slashCommand.define {
      name = name,
      description = slash.description,
      run = function()
        silverwareChartJs.runSlashCommand(name)
      end,
    }
  end
  -- A code widget for each language a format reads; a block that is no chart goes to what drew that language before
  for _, language in ipairs(silverwareChartJs.languages()) do
    local before = config.get({ "codeWidgets", language }, nil)
    if before and before.silverwareChart then before = before.before end
    codeWidget.define {
      language = language,
      silverwareChart = true,
      before = before,
      render = function(body, pageName)
        local element = silverwareChartJs.render(language, body, pageName)
        if element then
          return widget.new { html = element, display = "block", cssClasses = { "swc-widget" } }
        end
        if before and before.render then
          return before.render(body, pageName)
        end
        return widget.new { html = silverwareChartJs.codeBlock(language, body), display = "block" }
      end,
    }
  end
  -- SilverBullet renders a code widget anew only when its text changes, not when what it read does: the charts shown
  -- follow their sources as the page is edited
  event.listen {
    name = "editor:pageModified",
    run = function()
      silverwareChartJs.pageModified(editor.getText(), editor.getCurrentPage())
    end,
  }
end
```
