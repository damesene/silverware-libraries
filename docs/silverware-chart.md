# Silverware Chart: plan

Status: proposed on 2026-11-01, on the branch `silverware-chart`. *Status and
next* at the end says what is done.

## The request

Charts in SilverBullet written as Mermaid, so that GitHub (and any Mermaid
renderer) draws them too, drawn in SilverBullet by Chart.js, with metadata of
our own for what Mermaid cannot say (Chart.js's wider setup). A chart's data may
come from a named table of Silverware Table, its values then following the
table. The chart's type and its table are picked from a menu, not typed.

## What SilverBullet offers (its source, local main, 2026-11-01)

- **Code widgets** (`libraries/Library/Std/APIs/Code Widget.md`):
  `codeWidget.define { language, render = function(bodyText, pageName) }`, its
  result what a `${…}` gives: markdown, or a widget (`widget.new`: `html` a
  string or an HTMLElement, `display = "block"`). Lua code widgets render
  through the same pipeline as `${…}`, so they render anew when what they read
  changes (`dependsOn` of their syscalls, as `silverware.table.evaluate`'s
  result does: verified for it on 2026-10-24).
- **One renderer per language**: `codeWidget.define` is
  `config.set({"codeWidgets", language}, def)`, the hook a Map by language
  (`client/plugos/hooks/code_widget.ts`): the last definition wins.
- **Mermaid** is SilverBullet's library `silverbullet-diagram/Mermaid.md`
  (installed apart, not in the core): it defines the `mermaid` code widget and
  `mermaid.diagram(source, opts)` in Space Lua.

## Decisions (proposed)

1. **Silverware Chart**: folder `silverware-chart/`, settings and API under
   `silverware.chart`, CSS prefix `swc-`, commands `Silverware Chart: …`.
2. **The block is Mermaid.** A ` ```mermaid ` block of `xychart-beta` (bar and
   line series, an x axis of labels, a y axis's title and range) or `pie`. What
   Mermaid draws from it is the chart as far as Mermaid can say it.
3. **Our metadata are Mermaid comments**, one key a line, after the diagram:
   `%% chart.<key>: <value>` (Mermaid leaves `%%` lines out; not `%%{…}%%`,
   which Mermaid reads as its directive). Keys: `type` (Chart.js's type where
   Mermaid has none: area, scatter, doughnut, radar, stacked bar…), `source`,
   `x`, `series`, `colors`, `legend`, `format`, `stacked`, `y2`. A key we do
   not know is kept as written.
4. **Only charts are ours**: the plugin defines the `mermaid` code widget and
   draws `xychart-beta` and `pie` blocks; any other Mermaid block goes to
   `mermaid.diagram` where SilverBullet's Mermaid library is installed, else
   shows as code. (To verify: the order of the two definitions, ours after
   Mermaid's.)
5. **Drawn by Chart.js**, loaded the first time a chart shows (a file beside
   the bundle, as the toolbar's emoji data); colors from SilverBullet's
   variables (light and dark, themes).
6. **A named table as the source**: `chart.source: sales` (`[[Page]]sales` on
   another page), `chart.x: month` (the labels' column), `chart.series:
   revenue, cost` (the values' columns), columns by their key as formulas read
   them (a rename or a move breaks nothing). In SilverBullet the chart reads
   the table live, through Silverware Table's public API, so it follows the
   table as it is written, on any page.
7. **The data in the block follow the table** where Silverware Table writes it:
   a write of the table writes the block's series anew in the same edit (one
   undo step), through a generic place in Silverware Table's write (as formulas
   in Space Lua calls are written today: `defineFormulaPlaces`), which knows no
   chart. Changed otherwise (the markdown edited by hand, the table on another
   page), the chart in SilverBullet is right (it reads live) and the block's
   data are behind: the chart is marked *Stale* with *Update data*. Viewing
   writes nothing.
8. **Without a source** the block's data are the chart's; Chart.js only draws
   them.
9. **Picked from a menu**: a chart hovered shows a toolbar (as a table's):
   - *Type*: a gallery of the types with their icons (bar, stacked bar,
     horizontal bar, line, area, scatter, pie, doughnut, radar); the one picked
     writes the block (the Mermaid part as far as it can say it, `chart.type`
     for the rest);
   - *Data*: the named tables (the page's first, then the space's), each with
     its columns; picked, its columns to tick (x, series), written as
     `chart.source`, `chart.x`, `chart.series` and the data;
   - *Edit source* (the block's markdown), *Copy as image*.
   - *Insert chart…* in a named table's ⋯ menu (Silverware Table) puts a chart
     of it under the table, through the chart's public API.
   A pick writes the block with one `editor.replaceRange`.
10. **Modular as the others**: a core that knows no type; types of charts are a
    registry (built-in and the user's, `silverware.chart.defineTypes`, the
    priority-50 API block); a module turned off is not loaded. Silverware Table
    is used only through its public API (no shared code at run time); without
    it, charts of the block's data only.

## Open

- GitHub's Mermaid and `xychart-beta`: not verified that GitHub draws it (a
  beta syntax; each host bundles its own Mermaid). To try in a GitHub file or a
  comment's preview first; else the fallback for GitHub is `pie` only, or a
  table beside the chart.
- The space's named tables for the *Data* menu: the index has every table's
  rows with their raw cells (the metadata row's `<meta core.table core.name>`
  among them); a query of it, or the page's tables only at first.
- The menu: Silverware Table's menus (core/menu.ts) are its own; the chart's
  toolbar and menus would share them through `shared/`.

## What the proof of concept showed (2026-11-01, local SilverBullet 2.12.1 of main)

A throwaway space (a `space-lua` page defining the `mermaid` code widget, a JS
module, Chart.js from a CDN) with six blocks: the request's example, stacked
bars, an area, a pie and a doughnut, a chart of a named table, a flowchart.

- **The block reads well and draws**: `xychart-beta` and `pie` drawn by
  Chart.js from the block as Mermaid writes it, the `%% chart.*` lines read;
  Mermaid's own range (`0 --> 198.2`) and axis titles taken over.
- **Taking `mermaid` over works**: a block of `-- priority: -10` loads after
  the Mermaid library (scripts run by priority, highest first:
  `client/space_lua.ts`), so its definition wins; a flowchart handed to
  `mermaid.diagram` drew as before.
- **The widget may be an element**: `widget.new { html = <HTMLElement> }`; the
  element is made before SilverBullet attaches it, and Chart.js (responsive)
  sizes its canvas once it is attached.
- **A code widget is not rendered anew when what it read changes**, unlike
  `${…}` (verified with a probe: a `${silverware.table.evaluate(…)}` and a code
  widget calling `editor.getText()` and the same evaluate, a table cell edited:
  the `${…}` showed the new value, the code widget not, even 12 s later). Its
  cache key is its language, page and text (`fenced_code.ts`); why its
  triggers do not refresh it is not found. So the chart follows its table
  itself: on `editor:pageModified` (an event listener in Space Lua) the charts
  shown read their tables again through Silverware Table's JS (`evaluated`,
  the module imported by its path, the same instance) and update the Chart.js
  instance in place (`chart.update()`, animated): 1.5 ms for one chart, the
  chart changed 130 ms after a cell's edit through Silverware Table and after
  an edit of the markdown alike. A source on another page would need its
  `page:saved` too (not tried).
- **SilverBullet renders each code widget twice** (12 renders for 6 blocks on
  opening the page), one element never attached: a chart made for it is to be
  destroyed (kept in a registry, let go once detached).
- **A click on the chart** does not open the block's markdown (unlike a
  table); SilverBullet's own widget menu (⋯: Edit source, Reload, Copy) shows
  at its top right on hover: our toolbar has to sit beside it.
- **Colors** are read from SilverBullet's variables when a chart is made: a
  change of the theme or dark mode needs the charts made anew (not done in
  the PoC). The table's border color is too strong for a grid: a light gray.
- **Chart.js orders datasets** by `order`: a line drawn over bars needs a lower
  one.

## Steps

1. The plugin's frame (library page, API block, build, deploy, playground,
   tests against SilverBullet); `xychart-beta` and `pie` drawn by Chart.js;
   the metadata read; other Mermaid blocks handed on.
2. A named table as the source, read live.
3. The block's data written with the table's writes; *Stale* and *Update data*.
4. The chart's toolbar: Type and Data menus; *Insert chart…* in a table's menu.

## Status and next

Proposed, nothing built.
