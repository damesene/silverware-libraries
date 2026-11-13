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
- Later a "…" menu on the grid (shared/menu): add or remove a cell, the column count and widths, move a cell. Planned in detail: *Building a grid from the page* below.

## Building a grid from the page (planned 2026-11-13; built 2026-11-13)

Agreed with the user: a grid is made and taken apart without typing its tags, with the mouse or a finger, for any markdown, not only images. The grid gets the effort (a row of images by CSS alone was weighed and dropped: SilverBullet draws each embed as a block, and the grid is the more general tool).

### The command: Put into grid

- **One command, `Silverware Layout: Put into grid`**, over the blocks the selection touches (none selected: the block at the cursor). Not `/grid` over a selection: typing `/` replaces the selection. Named for the grid, not for columns: both modes make a grid, and a later way of filling one is one more mode, not another command.
- **A block**: a paragraph, each item of a list (a task too), an image's embed, a heading, a table, a fenced code block, a quote; read by `shared/markdown/` (`readBlocks`/`parseBlocks`), never by lines.
- **It asks** the mode, then the number of columns (2, 3, 4), each a pick list as SilverBullet's palette shows one (`editor.filterBox`), on a phone too.
- **Modes**:
  - **Gallery**: each block a cell of its own, in order, the grid `columns="N"`: N to a row, more rows as there are blocks (ten blocks in 3 columns: rows of 3, 3, 3, 1).
  - **Split**: the blocks kept in order and cut into N columns one after another, as a newspaper's: by the number of blocks (the user's choice: it keeps what belongs together together; by length can come later), the first columns one more where they do not divide (ten blocks in 3: 4, 3, 3).
- **Lists split**: a list's items in two columns are two lists; a numbered list goes on counting (`5.` in the second, not `1.`), tasks keep their state.
- **Silverware Toolbar**: Silverware Layout defines an action through Silverware Toolbar's public API (`silverware.toolbar.defineActions`, from its init page, where Silverware Toolbar is installed), *Put into grid* with a parameter *Mode* (Gallery, Split): a button with its mode set asks the number of columns alone. Without Silverware Toolbar, the command alone.
- Written by the page writer (the blocks' range replaced by the grid's text, one edit, one undo step).

### The grid's and a cell's "…" menu

- **Shown** at the grid's top right as the pointer is over it (always on a touch screen), as a medium's; a cell's at the cell's top right.
- **The grid**: the number of columns (Auto, 2, 3, 4: its `columns`), add a column, **Remove grid**: its content without the grid, the cells one under another in their order (row by row: cell 1, 2, 3 of the first row, then the next row's), each cell's markdown as written, a blank line between. The inverse of both modes: Gallery's cells and Split's columns are in the blocks' order.
- **A cell**: move left, move right, add a column after it, remove the column (its content put under the grid, never lost), move out of the grid (the same, the cell gone).

### Built (2026-11-13)

- `shared/markdown/gridbuild.ts`: the blocks a range touches (`blocksIn`, by parse.ts: a list's items each), a grid of them by mode (`gridOfBlocks`, `splitCounts`, items of one list one list in a column, a blank line kept round the grid), a grid's text (`gridText`), a grid taken apart (`ungridded`: items split into two cells one list again; the inverse of both modes, tested). The page writer's `grids.put` (the range as read, else left alone) and `grids.changeCells` (move, add, takeOut: its content under the grid, ungrid).
- `src/grid/build.ts`: Put into grid over a `PutHost` (the selection, a pick, the writer); SilverBullet's (`silverBulletPutHost`: `editor.getSelection`, `editor.filterBox`); the command `Silverware Layout: Put into grid`; Silverware Toolbar's action `layoutPutIntoGrid` (its parameter *Mode*: Ask, Gallery, Split), defined by the init page through `silverware.toolbar.defineActions` where Silverware Toolbar is installed.
- `src/grid/ui/cellmenu.ts`: one "…" a cell (not one for the grid besides: they would lie at one corner), its sections the cell's (move left, move right, add a column after it, move out of the grid), the columns (automatic, 2, 3, 4: the attribute), the grid's (a column at the end, remove the grid). Silverware Layout's popup menu moved to `src/ui/popupmenu.ts`, the media's, the links' and the cells' alike.
- Fixed with it: SilverBullet's button bar of a grid's frame showed as the pointer was over the grid (2.12.1 puts it in a div of the frame, and draws the frame anew with a bar of its own): hidden now by one watcher of the document for every grid's frame (`hideGridBars`).
- Seen in SilverBullet 2.12.1: five tasks selected, Split into 2 columns (3 and 2, one list each, their states kept), Gallery into 2 (`columns="2"`, a cell each); a cell moved right, 3 columns set, a cell moved out under the grid, the grid removed (its cells in order); Silverware Toolbar knew the action.

### Open

- **A phone**: a grid's columns stack under each other in a narrow pane (`minPaneWidth`). Whether a gallery (or a grid that asks so, an attribute) keeps its columns there: the user is still thinking it over.
- **Later, an idea kept**: images uploaded several at once into a grid (a picker of several files, the camera on a phone, `space.writeDocument`, `maximumDocumentSize`; where the files go and how they are named to decide): postponed by the user for what serves any markdown first.

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
3. The widget: render the cells by `markdown.markdownToHtml` (each element's `data-pos` turned into `data-swl-pos` in the page), CSS grid, the narrow pane, SilverBullet's widget menu hidden; the playground. **Done 2026-11-13**: the init page's `syntax.define` (`renderGrid`), `src/grid/grids.ts` over a `GridHost` (SilverBullet's: `host/silverbullet/grid.ts`), the attributes read from the page's text (the renderer gets the body alone, and SilverBullet draws a grid anew only as its body changes: a `<grid>` line edited sets the columns again on the grids drawn, `refresh`), the style page's grid, its frame's border off by the class `swl-grid-widget`, its button bar hidden inline (important: SilverBullet's touch rule names `#sb-main`). Seen in SilverBullet 2.12.1: columns `1fr 2fr` drawn 244 and 487 px, links, tags, lists and an image in the cells. Left for later: `data-swl-pos` (step 4, where it is needed: SilverBullet leaves `data-pos="0"` out, so none means 0); `renderHtml` (a grid exported); a grid in a page embedded in another (`![[Page]]`) is drawn with the columns of the page open, not its own.
4. Editing a cell in place; Alt+click to the source position; UI tests. **Done 2026-11-13**, its UI tests too (`ui-tests/grid.spec.ts`, against SilverBullet: /grid and its cursor, a cell edited and written on Esc, Alt+click's cursor, `columns`, a grid in an embedded page, its hashtags in the index; `gridsDrawn` loads the page again where the custom syntax is not active yet): `Grids.start` (a click in a cell, not on a link, a tag, a field: its field, `ui/celleditor.ts`; left by blur, Esc or Ctrl/Cmd+Enter, written by the page writer where it changed; an Alt+press taken in the capture phase before SilverBullet's, the cursor by `core/position.ts`: the element's `data-pos`, the word under the caret found in the markdown from there). Seen in SilverBullet 2.12.1: a cell edited and written as one edit, the grid drawn anew; an Alt+click on a word put the cursor in it. Known: a click into another cell while one is edited writes the first, the grid is drawn anew and the second click is lost (click again).
5. `/grid`. **Done 2026-11-13**: the init page's slash commands (`slashCommands`, `runSlashCommand`), a new grid's text by the codec (`newGridText`, `shared/markdown/grid.ts`), where it goes by `core/insert.ts` (a blank line before it after a paragraph's line, one after it where text follows), put in by `replaceRange` at the cursor (as Silverware Chart inserts its blocks), the cursor in the first cell. Seen in SilverBullet 2.12.1: offered as `/grid` is typed, inserted after a paragraph with a blank line between, what is typed next in the first cell.
6. The width by Silverware Layout's handle. **Done 2026-11-13**: `src/grid/provider.ts` registered by the binding as a widget plugin registers (widget: the frame, class `swl-grid-widget`; Layout's key `width` kept as the `<grid>` line's attribute of that name, `width="1100"`, read synchronously from the attributes a grid drawn keeps), written by the page writer's `grids.setAttributes` (the line rewritten in HTML's form, its other attributes kept); a width typed by hand lays the widgets out again (`Grids.onAttributes`, `LayoutApp.layOutWidgets`). Seen in SilverBullet 2.12.1: `width="900"` drew the grid 900 px wide over a text of 760.
7. The grid's content indexed (*Indexing*), unless the probe found it needless. **Done 2026-11-13**: `src/grid/core/links.ts` (wiki links and embeds by `shared/markdown/inline.ts`, local markdown links and images resolved from the page's folder; none in fenced code or a code span), their relations in SilverBullet's shape by `host/silverbullet/gridindex.ts`, added by the init page's `page:index` listener (`index.indexObjects`). Seen in SilverBullet 2.12.1: after a reindex a grid's `[[Target]]` and `![[cat.png]]` were relations of its page, and a rename of Target updated the grid's link. **Hashtags, done 2026-11-13**: `src/grid/core/tags.ts` reads each cell by `shared/pages/tags/scan.ts` (a task's, an item's, a table's, a heading's, a paragraph's), and its paragraphs holding one; `gridTagObjects` makes SilverBullet's objects of them (a `tag` per name and parent, `<name>:<parent>`, the same as SilverBullet's own of one outside a grid; a `paragraph` per paragraph, its `tags` and `itags`). Seen in SilverBullet 2.12.1: `index.tag "tag"` has a grid's `#gridonly` (page) and `#griditem` (item), `index.tag "gridonly"` its paragraph. Not indexed: a grid's items and tasks as objects of their own, and its hashtags in the page's own `tags` (the page's object is SilverBullet's).
   **A grid in an embedded page, done 2026-11-13**: SilverBullet (2.12.1 and its main) draws an embedded page's markdown without its custom syntax, the grid's lines as text with a `<br>` between each (its cells' markdown as written), so it showed as text (not the open page's columns, as feared). `host/silverbullet/embeddedgrids.ts` finds such a grid in `.sb-inline-content` (a text `<grid …>` to a text `</grid>`, siblings) and `Grids.drawText` draws it in its place by its own `<grid>` line, marked `swl-grid-shown`: no grid of the open page, so neither edited nor Alt+clicked there, no handle (the provider's frame is SilverBullet's of a custom syntax), its media not decorated (no place in the open page).
8. Library page (the syntax, what it looks like without the plugin, what is indexed), release. **Library page done 2026-11-13** (*Columns*); the release is proposed to the user, not made.

Later: attributes (`gap`, `span`, `align`), nesting. Next: *Building a grid from the page* (the command Put into grid, the grid's and a cell's "…" menu).

## Open

- The attribute names (`columns`, `gap`, the width's).
- The field a cell is edited in: a plain growing `textarea`, or something richer later.
