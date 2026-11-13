# Silverware Layout: grid

Proposed 2026-11-13, nothing built. Columns in a page: a part of the page laid out side by side (two columns to start, later any number, a matrix of images or of any markdown), drawn by Silverware Layout as a widget of its own. Implementation starts on the user's word.

## Requirements

- Works in SilverBullet only, but stays readable as plain markdown, and breaks nothing in another renderer (GitHub, Obsidian, CommonMark).
- Edited in the layout: clicking into a column edits that column's markdown where it is, the grid does not fall apart into raw markdown. Alt+click (SilverBullet's own gesture, as on a link or a table) shows the raw markdown with the cursor where the click was.
- Inserted by a slash command `/grid`.
- Two columns first; configurable later (column count and widths, a matrix of cells).
- A menu later, in Silverware Table's spirit, probably a single "…".

## The syntax

HTML-like tags, each on a line of its own; the configuration is the tags' attributes (HTML's syntax, nothing invented):

```markdown
<grid>
<column>

Column 1

</column>
<column>

Column 2

</column>
</grid>
```

- `<grid …>` opens, `</grid>` closes; `<column>` … `</column>` is one cell. Attributes later: `<grid columns="1fr 2fr" gap="16">`, `<column span="2" align="center">`, a width for Silverware Layout's handle.
- **Cells flow**: they fill the columns left to right and wrap, so a matrix of images is `<grid columns="3">` and nine `<column>`s. A `<column>` is therefore a cell, not a whole column of the grid (a `<cell>` alias may come later if that reads badly).
- **Blank lines around a column's content**: by CommonMark an HTML block runs to the next blank line and its content is not read as markdown. With the blank lines every renderer reads a column's content as markdown (lists, images, links), the columns shown one under another; without them the whole grid is one raw HTML block, its markdown shown as text and its lines run together. `/grid` inserts the form with blank lines and the widget keeps them as it writes a cell; the compact form typed by hand is read too. Spaces at a line's end are ignored.
- Not `<col>`: a real HTML element (a table's, void: a browser drops it outside a table) and a CommonMark type-6 block tag.
- Not `<div class="grid">`: SilverBullet renders known block tags as HTML, so the grid would look different in SilverBullet without the plugin than in plain markdown.

### Without the plugin

- **Another renderer**: the tag lines are empty unknown elements (GitHub strips unknown tags); the columns' content renders as normal markdown, one column under another.
- **SilverBullet**: only known block tags (`div`, `details`, …: `blockTagRe` in `client/markdown_parser/html_block.ts`) become structured HTML blocks. A `<grid>` or `<column>` line is a flat HTML block of lezer's own parser, which SilverBullet's renderer (`markdown_render.ts`, case `HTMLBlock`) shows as text: the tags are visible, the content below them is markdown, stacked. As readable as plain markdown, and accepted (2026-11-12).
- **Plain markdown**: text with a few tag lines.

### Weighed and dropped

- **A fenced block** (` ```grid `, by `codeWidget.define` as Silverware Chart and Database): a code block elsewhere, its markdown (images) not rendered.
- **Pandoc's / Quarto's fenced divs** (`:::: {.columns}` / `::: {.column}`): the one existing standard, rendered as columns by Pandoc and Quarto; dropped for the user's preference of the tags.
- **Wiki conventions** (MediaWiki's `{{col-begin}}` / `{{col-break}}` / `{{col-end}}`, DokuWiki's `<columns>` / `<newcolumn>`, Hugo's `<--->`), Obsidian's plugins (Multi-Column Markdown's `--- start-multi-column`, callouts with CSS): conventions of one tool each.
- **A one-row markdown table**: a cell holds no multi-line markdown.
- **Laying SilverBullet's own lines out in columns**: CodeMirror's lines are siblings; columns would need CodeMirror's internals, which no plugin here touches.

## How SilverBullet draws it

**`syntax.define` in block mode** (SilverBullet's custom syntax, experimental, since 2.6; in 2.12.1: `client/markdown_parser/custom_syntax.ts`, `client/codemirror/widgets/custom_syntax_widget.ts`, docs `API/syntax.md`):

- `startMarker` a regex for the opening line (`^<grid(\s[^>]*)?>\s*$`), `endMarker` for the closing line (`^</grid>\s*$`); `renderWidget(body, pageName)` gives the widget of the live preview, `renderHtml(body, pageName)` the HTML of an export.
- Its block parser is placed before `HorizontalRule`, so before lezer's HTML block and SilverBullet's own (`before: "HTMLBlock"`): the whole `<grid>…</grid>` is ours, SilverBullet's HTML preview does not touch it. The cells are read by our own code from the body.
- The region is replaced by the widget (a `LuaWidget`, the same as a code widget's) while the cursor is outside it; with the cursor inside SilverBullet shows the raw text.
- **SilverBullet's widget menu is hidden** on the grid (decided 2026-11-13), as Silverware Chart and Database hide it on theirs: the widget gets the grid's class by `renderClass`, and the style page hides `.button-bar` (2.12.1), `.sb-widget-menu-bar` (main) and the touch screen's forced path within it; the grid's own "…" menu is the one menu. `silverbullet.spec.ts` checks it stays hidden.
- **The end is the first line matching `endMarker`**: the parser counts no nesting, so a grid in a grid would close at the inner `</grid>` (no nesting in the first version), and a `</grid>` line inside a column's fenced code block would end the grid early (documented).
- A new definition is active after the editor's state is rebuilt (a page reload).
- **Not in the index**: the region's body node has no children (`markdown.parseMarkdown`, which the index uses, takes the user's syntax extensions), so links, hashtags and embeds inside a grid are not indexed. Without the plugin they would be. See *Indexing*: not only backlinks are lost.
- **Experimental API**: may change in a SilverBullet release; `ui-tests/silverbullet.spec.ts` gets a check of it, failing by name.
- `shared/markdown/` (lezer with SilverBullet's configuration) does not know the node: it reads a grid as HTML blocks and paragraphs. What reads blocks (Silverware Toolbar's Turn into, the page writer) must not take a grid apart; checked as each is touched.

## Indexing

Found in the review of 2026-11-13: what the index misses inside a grid is more than backlinks. SilverBullet updates links on a rename by its index (to be confirmed by the probe), so a page or an attachment renamed would leave the links and embeds in a grid pointing at the old name: an image in a cell broken, silently.

- **Decided (2026-11-13): the grid's first release indexes its content's links and embeds itself**, unless the probe shows a rename finds them anyway. A grid that silently breaks on a rename is not released.
- How (probed, it works: *Probe results*): a listener of `page:index` reads the page's grids (`shared/markdown/`) and adds their links and embeds by `index.indexObjects` as the relations SilverBullet itself makes (`plugs/index/relation.ts`), so its backlinks and its rename see them. The relations' shape is SilverBullet's, so it is known in the host alone and checked by `silverbullet.spec.ts` (a rename updating a grid's link).
- Hashtags inside a grid the same way, if the probe shows it is as cheap; else later.

## Editing

- **A click into a cell** edits that cell alone, in place: the cell shows its markdown in a growing text field in the cell's box, the other cells stay rendered, the grid keeps its shape. Leaving the cell (blur, Esc, a click elsewhere) writes the cell's text through the page writer, over the cell's range only: one edit, one undo step. As Silverware Table's cell editing.
- **Alt+click** moves SilverBullet's cursor (`moveCursor`) to the source position under the click, which shows the raw markdown. The position: each block of a cell is rendered on its own and marked with its offset in the source (`shared/markdown/parse.ts` gives the blocks); within a block, found by the text under the click. As Silverware Table's Edit markdown / Alt+click.
- Whether SilverBullet's widget takes a plain click or an Alt+click itself (moves the cursor in) is a probe.
- A table in a cell is plain HTML: Silverware Table enhances SilverBullet's table widgets only. Later, if wanted.

## Layout

- Rendered as CSS grid: `grid-template-columns` from `columns` (a number: equal columns; else track sizes, `1fr 2fr`, `30% 70%`), a gap.
- **Its width** by Silverware Layout's handle, as any widget: the grid registers as a `LayoutProvider` (shared/layout.ts) and keeps its entries in an attribute of `<grid>` (its name decided when built).
- **On a narrow pane** (under `minPaneWidth`, as Silverware Layout lays nothing out there) the cells stack: by the mark Silverware Layout already sets there (`data-swl-narrow`, host/marks.ts), nothing measured anew.

## Rendering a cell

A cell's markdown is rendered by SilverBullet: on 2.12.1 `markdown.markdownToHtml(cell, { expand = true, annotationPositions = true })` (`renderToDom` is in SilverBullet's main only; *Probe results*), behind the host's interface so that `renderToDom` can take over where it is. A cell looks as the rest of the page (links, tags, embeds drawn by SilverBullet), and the grid writes no markdown renderer of its own.

- SilverBullet marks each rendered element with `data-pos`, its offset in the cell's text; the grid adds the cell's offset in the page and sets it as `data-swl-pos` on the cell's elements: the convention of Silverware Layout's host for a block rendered outside the editor ([silverware-layout-assets.md](silverware-layout-assets.md), *SilverBullet draws, the plugin decorates*). The grid uses it for Alt+click, the assets to find an embed's text in a cell; neither knows the other.
- Writing anything in a grid (a cell, an embed's size in it) changes its body, so SilverBullet draws the whole widget anew (its cache key is the body's text) and every cell is rendered again. Its speed, and whether it flickers, are checked as the widget is built (step 3).

## Media in a grid

A matrix of images (or of PDFs as cards) is a grid of embeds. How an embed is decorated, resized and written (SilverBullet's own size in its text, the plugin's metadata in a third segment, the views, the link form by `defaultLinkStyle`): [silverware-layout-assets.md](silverware-layout-assets.md). The same decoration applies to the media SilverBullet draws in a cell; SilverBullet's `%` is of the medium's box, so `|100%` fills the cell; the grid's CSS keeps media within their cell (`max-width: 100%`).

## The grid's codec

What a grid looks like in a page (the tags, their attributes, the cells and their ranges in the source, the blank lines) is known in one place, as an image's is: read in `shared/markdown/`, written through `shared/pages/`. The widget, the cell editing and the menu work on the grid's model alone, so a change of the syntax is a change of the codec.

## Where it lives

A part of Silverware Layout (decided 2026-11-12): it is the page's layout, it uses the widget widths, the narrow-pane rule, the page writer and the markdown parser already in Layout's bundle. Its own area, `src/grid/`, with Silverware Layout's layers inside (`grid/model`, `grid/core`, `grid/ui`) under the same rules (`src/isolation.test.ts` gets them); it registers its width by the same `LayoutProvider` contract as Silverware Table or Chart, so Layout's core knows no grid by name; `app.ts` puts it together, `index.ts` binds it to SilverBullet (its `syntax.define`, the bridge). Its CSS classes `swl-grid-…`.

- **The grid and the assets know nothing of each other** ([silverware-layout-assets.md](silverware-layout-assets.md), *Layers*): the assets decorate the embeds SilverBullet draws in a cell as anywhere else, and size them by shares of their own box, which in a cell is the cell. No area imports another.
- What SilverBullet is (`syntax.define`, `markdown.markdownToHtml`, moving its cursor, the index's relations) is the host's (`host/silverbullet/`), behind an interface of the grid's own, so the grid runs in the playground and its tests over plain elements, as the rest of Layout does.

## The slash command and the menu

- `/grid` (`slashCommand.define`) inserts two columns in the form with blank lines, the cursor in the first column's content (in the raw text: the widget shows once the cursor leaves).
- Later a "…" menu on the grid (shared/menu): add or remove a cell, the column count and widths, move a cell.

## Probe results (2026-11-13, SilverBullet 2.12.1, Chromium)

A scratch space, a `space-lua` block defining `<grid>` by `syntax.define`, Playwright driving the page.

- **`syntax.define` with `<grid>` works**: the region is a widget, classes `<renderClass> sb-lua-directive-block`; the raw text is not shown while the cursor is outside. A definition is active after the page is loaded again (twice in a fresh browser: the first load indexes before Space Lua runs).
- **`markdown.renderToDom` is not in 2.12.1** (SilverBullet's main only). **`markdown.markdownToHtml(cell, { expand = true, annotationPositions = true })`** is, and does what the plan needs: a cell's links (`a.wiki-link[data-ref]`), hashtags (`a.sb-hashtag`), bold, an image embed as `<img>` with SilverBullet's size (`|120` → `width: 120px`) and alt; every element carries **`data-pos`, its 0-based offset in the cell's text** (the text from the line after `<column>`). The widget's handlers are attached by SilverBullet (`data-handlers-attached`), so its links are SilverBullet's. So a cell is rendered by `markdownToHtml` on 2.12.1, behind the host's interface; `renderToDom` where SilverBullet has it, later.
- **A plain click in the widget** leaves the widget and SilverBullet's cursor where they are: a click is the grid's. **An Alt+click** is SilverBullet's: the cursor goes to the region's start (the raw text shows), not to the place clicked; the grid's Alt+click is its own (a capture listener, the position by `data-pos` plus the cell's offset).
- **SilverBullet's widget menu** on the grid: Reload, Copy, Edit (`.button-bar`): hidden, as decided.
- **The index**: what a fresh browser indexes before Space Lua runs is parsed without the syntax extension, so a grid's links are indexed then; after a reindex with Space Lua loaded they are not (the body has no children). A rename (`Page: Rename`) updated a link outside a grid and **left the grid's link as it was**: the index decides what a rename sees.
- **The grid's own indexing works**: a Space Lua listener of `page:index` (the page in `event.data`: `name`, `text`; `event.name` is the event's) adding objects by `index.indexObjects(page, objects)` (SilverBullet clears a page's objects before the event, so they replace rather than accumulate); a relation as SilverBullet makes one (`ref` `Page@from`, `tag = "relation"`, `kind = "mention"`, `from`, `fromTag = "page"`, `to`, `toTag = "page"`, `page`, `range = { from, to }`, 0-based, end exclusive). With it the rename **updated the grid's link**. A Lua table and `js.tojs(…)` both arrive as an array.
- Not probed: SilverBullet's edge (after 2.12.1, `space-lua` only under `Library/`); how SilverBullet and GitHub show a grid without the plugin (as the plan reads them from the code); a page or a PDF embedded in a cell through `markdownToHtml` (only an image was).

## Steps

1. **Probe** (done 2026-11-13 on 2.12.1, *Probe results*; edge not yet) (SilverBullet 2.12.1 and edge, Chromium): `syntax.define` with `<grid>` in a page's `space-lua` (edge runs it only under `Library/`: docs/silverware-library-prefix.md); the widget shown, the cursor's entry, a plain click and an Alt+click on the widget, the reload needed; how SilverBullet and GitHub show a grid without the plugin (both forms); `renderToDom` of a cell and a grid drawn anew; **a rename of a page and of an attachment linked from a grid, and whether a library can add link objects to the index** (*Indexing*).
2. The grid's model and codec: read a body into attributes and cells with their source ranges (`shared/markdown/`), write a cell back through the page writer (blank lines kept); the isolation test's rules for the area; tests. **Done 2026-11-13**: `shared/markdown/attributes.ts` (HTML's attributes, smart quotes read), `shared/markdown/grid.ts` (`readGrids`), the page writer's `grids.replaceCell`, `src/grid/model/columns.ts` (the `columns` attribute as a CSS column template), the areas' rules in `src/isolation.test.ts`.
3. The widget: render the cells by `markdown.markdownToHtml` (each element's `data-pos` turned into `data-swl-pos` in the page), CSS grid, the narrow pane, SilverBullet's widget menu hidden; the playground.
4. Editing a cell in place; Alt+click to the source position; UI tests.
5. `/grid`.
6. The width by Silverware Layout's handle.
7. The grid's content indexed (*Indexing*), unless the probe found it needless.
8. Library page (the syntax, what it looks like without the plugin, what is indexed), release.

Later: attributes (`columns`, `gap`, `span`, `align`), the "…" menu, nesting.

## Open

- The attribute names (`columns`, `gap`, the width's).
- The field a cell is edited in: a plain growing `textarea`, or something richer later.
