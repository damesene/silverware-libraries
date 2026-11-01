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

## Steps

1. The plugin's frame (library page, API block, build, deploy, playground,
   tests against SilverBullet); `xychart-beta` and `pie` drawn by Chart.js;
   the metadata read; other Mermaid blocks handed on.
2. A named table as the source, read live.
3. The block's data written with the table's writes; *Stale* and *Update data*.
4. The chart's toolbar: Type and Data menus; *Insert chart…* in a table's menu.

## Status and next

Proposed, nothing built.
