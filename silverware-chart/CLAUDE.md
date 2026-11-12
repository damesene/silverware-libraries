# Silverware Chart

Charts written in a format other tools draw (Mermaid's `xychart-beta` and `pie` now; Obsidian Charts' planned), drawn in SilverBullet by Chart.js; data from the block or from a markdown table, followed live. Prefix `swc-`, settings and API under `silverware.chart`. The plan, decisions, the proof of concept and what is next: [docs/silverware-chart.md](../docs/silverware-chart.md) (*Status and next*). User docs: `silverware-chart.md`; code pages `-init.md`, `-api.md` (`defineFormats`), `-style.md`.

## Mental model

- **A format** (core/format.ts) reads a block into a `ChartModel` (core/model.ts) and writes one back; `read` gives `undefined` for a block that is not its chart (handed on) or `Unreadable` (a problem said). What a format read and the model has no field for goes in `extra` and is written back.
- **A type** (core/type.ts) turns the model into Chart.js's configuration as data. Its `capabilities` (series, slices, axes, stacked, horizontal, lines) decide which settings show.
- **A source** (`ChartSource.read`) gives the data for `source.table`; `undefined` where it does not read that reference. `source.labels` is the labels' column (renamed from `x` on 2026-11-03: horizontal bars have labels on y).
- **Modules** give formats, types, sources, settings and ⋯ menu entries (by group of `MENU_GROUPS`). Off (`silverware.chart.modules.<name>.enabled`): not loaded. Custom formats from Space Lua (`silverware.chart.defineFormats`, src/custom.ts) go through the same checks, replaced as Space Lua loads again.
- The block's data are kept in the block (so other renderers draw it); where they differ from the source's, the chart says *Stale: update data* and writes them on request (`sameData`: no value and 0 alike).

## Invariants

- Isolation (`src/isolation.test.ts`): formats, types and `sources/` import only the core's shapes (model, format, type, blocks) and their own folder; the core imports no module, format, type, source, nor `bridge.ts` / `modules.ts`; modules import no other module nor the bridge.
- **Charts do not need Silverware Table.** The `tables` module reads markdown tables itself (`above`, `below`, `#Heading`, `[[Page#Heading]]`, sources/markdown.ts). Silverware Table is used only through its public API, by the `silverwareTable` module (`silverware.table.tables(text)` for named tables, `silverware.table.onWrite(fn)` to write the charts' data in the same edit as the table); nothing where it is not installed. Silverware Table knows nothing of charts.
- The one place the plugin assumes SilverBullet's DOM: the style page hides SilverBullet's widget menu and the block's Copy button on a chart's widget (`.swc-widget`), as the chart's own toolbar has them.
- Every write is one edit (settings applied in the settings' order, so a column is drawn before its color is set).

## Mermaid format (formats/mermaid.ts, pure)

- What Mermaid cannot say goes in `%% chart.<key>: <value>` comments (`chart.kinds` for a series' kind that is no bar or line, an area, points, steps); unknown keys, directives and other comments kept on writing.
- An axis' range goes in Mermaid's `y-axis` / `x-axis` only with both ends: one end alone is a syntax error in Mermaid's grammar (`xychart.jison`), so `chart.yFrom` / `yTo` / `xFrom` / `xTo` instead (decided 2026-11-03, so every comment of ours is `chart.*`).
- Mermaid blocks that are no chart (a flowchart) go to what drew `mermaid` before: the init page (priority -10, after SilverBullet's Mermaid library at 0 and Silverware Table's API at 50) keeps `config.get({"codeWidgets", language})` as the widget's `before`, ours marked `silverwareChart` so a reload of Space Lua does not wrap itself.

## Silverware Layout

- The charts are Silverware Layout's widgets where its API is handed over (`bridge.layout`, `layoutOf`): the controller's `layoutProvider`, selector `.swc-widget` (the widget the init page makes). Its entries are the model's `layout` (`ChartModel.layout`), written by the chart's format as it can: Mermaid `%% layout.<key>: <value>` (formats/mermaid.ts, after the `chart.*` comments, never doubled among the other comments). A format that drops them: the write is refused, said (`the <format> format keeps no layout`), nothing written. Never read their meaning.

## Gotchas

- Chart.js is a file of its own (`silverware-chart-chartjs.js`, built from src/chartjs.ts, in the library page's `files:`), imported by `new URL(…, import.meta.url)` the first time a chart is drawn.
- A chart's Chart.js instance is kept in private fields (`#chart` in core/drawn.ts): SilverBullet walks a widget's element and overflowed the stack on a public one. An instance out of the document 10 s is destroyed and made again as CodeMirror puts the same element back.
- `sources/values.ts`: `numberOf` (what is drawn: digits with units, a decimal comma) vs `plainNumberOf` (what conditions compare as numbers: A1 or Q1 stay text).

## Verified in SilverBullet (local 2.12.1 of main, 2026-11-01, unless said)

- A code widget is not rendered anew when what it read changes (unlike `${…}`): charts follow their tables through `editor:pageModified` (the init page hands the page's text to `pageModified`).
- SilverBullet renders each code widget twice, one element never attached.
- A click on a chart does not open its markdown; SilverBullet's widget menu shows at its top right (`.button-bar` in 2.12.1, verified 2026-11-03; `.sb-widget-menu-bar` in main; always shown on a touch screen, seen on a phone 2026-11-09).
- A page's cursor starts at its first line, so a block there shows its markdown (the UI tests start pages with a heading).
- A JS function handed to Lua and back to JS (`onWrite` through the bridge) is called as it was; a table's edit with the charts' blocks written in it is one Ctrl+Z.

## Tests

- `ui-tests/` runs against SilverBullet only (charts are code widgets, which the playground lacks): `open(text)`, `savedText`, `charts(page)` reading each chart through Chart.js's own registry (`Chart.getChart`).
