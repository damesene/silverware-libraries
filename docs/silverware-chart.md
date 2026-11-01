# Silverware Chart: plan

Status: decided on 2026-11-01, built on the branch `silverware-chart`. *Status and
next* at the end says what is done.

## The request

Charts in SilverBullet, drawn by Chart.js, written in a format other tools draw
too: Mermaid (GitHub and any Mermaid renderer) and Obsidian Charts' (Obsidian).
A chart's data may come from a named table of Silverware Table, its values then
following the table. The chart's type and its table are picked from a menu, not
typed.

## What SilverBullet offers (its source, local main, 2026-11-01)

- **Code widgets** (`libraries/Library/Std/APIs/Code Widget.md`):
  `codeWidget.define { language, render = function(bodyText, pageName) }`, its
  result what a `${…}` gives: markdown, or a widget (`widget.new`: `html` a
  string or an HTMLElement, `display = "block"`). Its docs say a Lua code widget
  renders anew when what it read changes; the proof of concept found it does
  not (below).
- **One renderer per language**: `codeWidget.define` is
  `config.set({"codeWidgets", language}, def)`, the hook a Map by language
  (`client/plugos/hooks/code_widget.ts`): the last definition wins; Space Lua
  blocks run by priority, highest first (`client/space_lua.ts`).
- **Mermaid** is SilverBullet's library `silverbullet-diagram/Mermaid.md`
  (installed apart, not in the core): it defines the `mermaid` code widget and
  `mermaid.diagram(source, opts)` in Space Lua.

## Decisions (proposed)

1. **Silverware Chart**: folder `silverware-chart/`, settings and API under
   `silverware.chart`, CSS prefix `swc-`, commands `Silverware Chart: …`.
2. **Two formats, one plugin** (decided 2026-11-01). A chart is read from its
   block into one model of a chart (its type, labels, series, axes, colors,
   legend, source: what Chart.js draws), and everything else (drawing, the
   table as a source, the menu, colors from the theme) works on that model
   only, knowing no format. A format is a parser (the block's text to the
   model) and a writer (the model to the block's text, as the menu and the
   table's data need), with the code block languages it reads:
   - **Mermaid** (` ```mermaid `): `xychart-beta` (bar and line series, an x
     axis of labels, a y axis's title and range) and `pie`. Mermaid's syntax is
     closed, so what it cannot say goes into its comments, one key a line,
     after the diagram: `%% chart.<key>: <value>` (Mermaid leaves `%%` lines
     out; not `%%{…}%%`, which Mermaid reads as its directive). Keys: `type`
     (where Mermaid has none: area, scatter, doughnut, radar, stacked bar…),
     `source`, `x`, `series`, `colors`, `legend`, `format`, `stacked`, `y2`. A
     key we do not know is kept as written.
   - **Obsidian Charts** (` ```chart `): YAML (`type`, `labels`, `series` of
     `title` and `data`, its own keys for colors, legend, stacking…), Chart.js
     underneath as ours. Its YAML is open, so nothing goes into comments: what
     it has no key for (a named table as the source) is a key of ours beside
     its own (Obsidian Charts expected to leave keys it does not know alone: to
     verify). Its own table source (a table's block reference `id`, `select`)
     read as a source where it maps. Its syntax to verify before it is built.
3. **The default format** is a setting (`silverware.chart.format`), Mermaid by
   default (it draws in the most places): the one a new chart is written in
   (*Insert chart…*). A block already in one format stays in it: nothing
   converts it by itself. *Convert to Mermaid* / *Convert to Obsidian Charts* in
   the chart's menu does it on request (read by one format, written by the
   other; what the target cannot say told before it is written).
4. **Formats are added without changing the plugin**: a registry of formats,
   the built-in ones and the user's alike (`silverware.chart.defineFormats`, the
   priority-50 API block, as the toolbar's formats and the table's functions: a
   JS module of the space, checked, a mistake a notification). Each built-in
   format is a module as any other (turned off: not loaded, its blocks shown as
   SilverBullet shows them).
5. **Only charts are ours**: for each language a format reads, the plugin
   defines its code widget; a block no format reads as a chart goes on to what
   drew it before: a ` ```mermaid ` flowchart to `mermaid.diagram` where
   SilverBullet's Mermaid library is installed (our block of a lower priority
   than its, so ours is the definition), else shown as code.
6. **Drawn by Chart.js**, loaded the first time a chart shows (a file beside
   the bundle, as the toolbar's emoji data); colors from SilverBullet's
   variables (light and dark, themes), the charts made anew as those change.
7. **Charts do not need Silverware Table** (decided 2026-11-01). A table as the
   source is read by the chart itself: a markdown table of the page (or of
   another), found by where it is, its columns by their names as SilverBullet's
   index keys them (`Unit price` is `unit_price`), live as the page is edited
   (see the proof of concept). `source:` says which table:
   - `above` / `below`: the nearest table above / below the chart;
   - `#Sales`: the first table under the heading "Sales" (`[[Page]]#Sales` on
     another page);
   - `sales`: a table named by Silverware Table (`[[Page]]sales` on another
     page): only where Silverware Table is installed, through its API (below);
     the chart does not read its metadata.
   `x:` the labels' column (left out: 1, 2, …), `series:` the values' columns.
   No table by its place among the page's tables (the second): an inserted one
   moves it.
8. **What Silverware Table adds, where it is installed**, a module of the
   chart's using only its public Space Lua API (Silverware Table knows no
   chart):
   - `silverware.table.tables(text)`: the tables of a markdown text, each with
     its name, its place (`from`, `to`) and its columns (name, key). A pure
     function of the text (the caller has it: the editor's, a page read, the
     text a write is making); the names are Silverware Table's, so the chart
     reads none of its metadata.
   - `silverware.table.onWrite(fn)`: `fn(text)` called in each of its writes
     with the page's text as the write leaves it, giving edits of the text
     outside the tables (`{ from, to, text }`); Silverware Table checks them
     (in the text, apart from its tables and each other) and writes them with
     its own in the one `replaceRange` (one undo step); an edit that fails the
     check is left out and logged, never failing the table's write. `fn` is
     fast and writes nothing itself. The chart gives its blocks reading that
     table their data anew, written by the block's format.
   - A formula as a series (`=sales![revenue] * 1.21`) through
     `silverware.table.evaluate`, later.
9. **The data in the block behind the source**: where the block's data are not
   the source's (the markdown edited by hand, a table edited without
   Silverware Table, or without it installed), the chart in SilverBullet is
   right (it reads live) and is marked *Stale* with *Update data*, which writes
   the source's data into the block through its format's writer: the core's,
   for any source. Viewing writes nothing.
10. **Without a source** the block's data are the chart's; Chart.js only draws
    them.
11. **A toolbar on the chart hovered**, as a table's (decided 2026-11-01): its
    place and look the table's toolbar's, beside SilverBullet's own widget
    menu; at first only its ⋯ menu, items to be added to the bar as they come.
    The ⋯ menu: *Type* (a gallery of the types with their icons: bar, stacked
    bar, horizontal bar, line, area, scatter, pie, doughnut, radar; written by
    the block's format), *Data* (the named tables, the page's first, then the
    space's, each with its columns; picked, its columns to tick: x, series),
    *Convert to …*, *Edit source*, *Copy as image*. (*Insert chart…* in a
    table's ⋯ menu would need Silverware Table to know charts: not so; the
    chart's own command or menu inserts one under a table instead.) A pick writes the block
    with one `editor.replaceRange`.
12. **Built as the others** (Silverware Table, Toolbar, Tags): a core that knows
    no module, no format and no type of chart, offering the modules an API (the
    chart's model, drawing, the toolbar and its menu, writing a block, reading
    a source); modules isolated, each with its own host, using the core and
    each other only through what is offered (`offer` / `offered`); each turned
    off (`silverware.chart.modules.<name>.enabled`) not loaded. Formats, types
    of charts and sources are registries the modules fill, the user's
    definitions joining them. Silverware Table is used only through its public
    API (no shared code at run time) by a module of its own. The modules:

    | Module | What it does | Needs |
    |---|---|---|
    | `mermaid` | the Mermaid format | nothing |
    | `types` | the built-in types of charts | nothing |
    | `tables` | markdown tables as sources: `above`, `below`, `#Heading`, other pages | nothing |
    | `silverwareTable` | tables named by Silverware Table, the block's data written with the table's writes (`onWrite`), formulas | Silverware Table's API (the bridge has it only where `silverware.table` exists) |

    What the plugin assumes about SilverBullet's DOM in one file.

## Open

- GitHub's Mermaid and `xychart-beta`: not verified that GitHub draws it (a
  beta syntax; each host bundles its own Mermaid). Left for later (2026-11-01).
- Obsidian Charts' syntax, its table source and whether it leaves unknown keys
  alone: from its documentation before its format is built.
- The *Data* menu's tables: the page's (by `tables` and, with Silverware
  Table, its named ones); the space's later.
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
   tests against SilverBullet); the core, the model and the format registry;
   the Mermaid format (`xychart-beta`, `pie`, its metadata) drawn by Chart.js;
   other Mermaid blocks handed on.
2. A named table as the source, read live (done through `evaluate`; to be
   made the `tables` and `silverwareTable` modules of decisions 7 and 8).
3. Silverware Table's `tables(text)` and `onWrite(fn)`; the `tables` module
   (`above`, `below`, `#Heading`) and the `silverwareTable` module (named
   tables, the block's data written with the table's writes); *Stale* and
   *Update data*.
4. The chart's toolbar: Type and Data menus; *Insert chart…* in a table's menu.
5. The Obsidian Charts format; the default format setting; *Convert to …*.

## Status and next

Started on 2026-11-01. Done: step 1 (the frame, the core, the model and the
format registry, the Mermaid format, the built-in types, Chart.js loaded beside
the bundle, other Mermaid blocks handed on to what drew them before, custom
formats) and step 2 (a named table as the source, followed live as the page is
edited; the table's `silverware.table.evaluate` takes the page's text for it).
Tested: unit tests (the format, the core, custom formats, isolation) and
Playwright against SilverBullet. Next: step 3 as decided on 2026-11-01
(decisions 7 to 9: charts without Silverware Table, its `tables(text)` and
`onWrite(fn)` used by a module of their own, *Stale*), then step 4 (the
toolbar and its menus).
