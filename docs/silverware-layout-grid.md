# Silverware Layout: grid

Proposed 2026-11-13, built 2026-11-13 (*Steps*). Columns in a page: a part of the page laid out side by side (two columns to start, later any number, a matrix of images or of any markdown), drawn by Silverware Layout as a widget of its own. Implementation starts on the user's word.

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
<cell>

Cell 1

</cell>
<cell>

Cell 2

</cell>
</grid>
```

- `<grid …>` opens, `</grid>` closes; `<cell>` … `</cell>` is one cell. Attributes later: `<grid columns="1fr 2fr" gap="16">`, `<cell span="2" align="center">`, a width for Silverware Layout's handle.
- **Cells flow**: they fill the columns left to right and wrap, so a matrix of images is `<grid columns="3">` and nine `<cell>`s. A `<cell>` is a cell, not a whole column of the grid: it was named `<column>` until 2026-11-15, renamed (the user's choice) as Auto and more cells than columns made the name read wrongly; no grid was written with it yet, so `<column>` is not read any more.
- **Blank lines around a cell's content**: by CommonMark an HTML block runs to the next blank line and its content is not read as markdown. With the blank lines every renderer reads a cell's content as markdown (lists, images, links), the cells shown one under another; without them the whole grid is one raw HTML block, its markdown shown as text and its lines run together. `/grid` inserts the form with blank lines and the widget keeps them as it writes a cell; the compact form typed by hand is read too. Spaces at a line's end are ignored.
- Not `<col>`: a real HTML element (a table's, void: a browser drops it outside a table) and a CommonMark type-6 block tag.
- Not `<div class="grid">`: SilverBullet renders known block tags as HTML, so the grid would look different in SilverBullet without the plugin than in plain markdown.

### Without the plugin

- **Another renderer**: the tag lines are empty unknown elements (GitHub strips unknown tags); the cells' content renders as normal markdown, one cell under another.
- **SilverBullet**: only known block tags (`div`, `details`, …: `blockTagRe` in `client/markdown_parser/html_block.ts`) become structured HTML blocks. A `<grid>` or `<cell>` line is a flat HTML block of lezer's own parser, which SilverBullet's renderer (`markdown_render.ts`, case `HTMLBlock`) shows as text: the tags are visible, the content below them is markdown, stacked. As readable as plain markdown, and accepted (2026-11-12).
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
- **SilverBullet's widget menu is hidden** on the grid (decided 2026-11-13), as Silverware Chart and Database hide it on theirs: the widget gets the grid's class by `renderClass`, and the style page hides `.button-bar` (2.12.1), `.sb-widget-menu-bar` (main) and the touch screen's forced path within it; the grid's own menus are the ones (its cells' grips, its handle's: docs/silverware-layout-grid-handles.md). `silverbullet.spec.ts` checks it stays hidden.
- **The end is the first line matching `endMarker`**: the parser counts no nesting, so a grid in a grid would close at the inner `</grid>` (no nesting in the first version), and a `</grid>` line inside a cell's fenced code block would end the grid early (documented).
- A new definition is active after the editor's state is rebuilt (a page reload).
- **Not in the index**: the region's body node has no children (`markdown.parseMarkdown`, which the index uses, takes the user's syntax extensions), so links, hashtags and embeds inside a grid are not indexed. Without the plugin they would be. See *Indexing*: not only backlinks are lost.
- **Experimental API**: may change in a SilverBullet release; `ui-tests/silverbullet.spec.ts` gets a check of it, failing by name.
- `shared/markdown/` (lezer with SilverBullet's configuration) does not know the node: it reads a grid as HTML blocks and paragraphs. What reads blocks (Silverware Toolbar's Turn into, the page writer) must not take a grid apart; checked as each is touched.

## Indexing

Found in the review of 2026-11-13: what the index misses inside a grid is more than backlinks. SilverBullet updates links on a rename by its index (to be confirmed by the probe), so a page or an attachment renamed would leave the links and embeds in a grid pointing at the old name: an image in a cell broken, silently.

- **Decided (2026-11-13): the grid's first release indexes its content's links and embeds itself**, unless the probe shows a rename finds them anyway. A grid that silently breaks on a rename is not released.
- How (probed, it works: *Probe results*): a listener of `page:index` reads the page's grids (`shared/markdown/`) and adds their links and embeds by `index.indexObjects` as the relations SilverBullet itself makes (`plugs/index/relation.ts`), so its backlinks and its rename see them. The relations' shape is SilverBullet's, so it is known in the host alone and checked by `silverbullet.spec.ts` (a rename updating a grid's link).
- Hashtags inside a grid the same way: done (step 7).

## Editing

- **A click into a cell** edits that cell alone, in place: the cell shows its markdown in a growing text field in the cell's box, the other cells stay rendered, the grid keeps its shape. Leaving the cell (blur, Esc, a click elsewhere) writes the cell's text through the page writer, over the cell's range only: one edit, one undo step. As Silverware Table's cell editing.
- **Alt+click** moves SilverBullet's cursor (`moveCursor`) to the source position under the click, which shows the raw markdown. The position: each block of a cell is rendered on its own and marked with its offset in the source (`shared/markdown/parse.ts` gives the blocks); within a block, found by the text under the click. As Silverware Table's Edit markdown / Alt+click.
- Whether SilverBullet's widget takes a plain click or an Alt+click itself: probed (*Probe results*), both the grid's.
- **Since built** (2026-11-13): the field opens with the cursor where the click was, or with the text selected in the cell by a drag selected in it (`core/position.ts` follows the point's offset in its element's text through the markdown, its marks passed over; the drag's ends from the press and the release, as CodeMirror may clear the browser's selection in a widget); Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z undo and redo in the field (SilverBullet takes them at the window for its editor: the field's own then); a cell left by Esc gives the page's editor its focus back (unfocused, the next press in a grid let CodeMirror take the drag's selection, its cursor in the grid, the grid shown as its raw text); a task's box in a cell toggles it in the cell's markdown (*Rendering a cell*).
- A table in a cell is plain HTML: Silverware Table enhances SilverBullet's table widgets only. Later, if wanted.

## Layout

- Rendered as CSS grid: `grid-template-columns` from `columns` (a number: equal columns; else track sizes, `1fr 2fr`, `30% 70%`), a gap.
- **Its width** by Silverware Layout's handle, as any widget: the grid registers as a `LayoutProvider` (shared/layout.ts) and keeps its entries in an attribute of `<grid>` (its name decided when built).
- **On a narrow pane** (under `minPaneWidth`, as Silverware Layout lays nothing out there) the cells stack: by the mark Silverware Layout already sets there (`data-swl-narrow`, host/marks.ts), nothing measured anew.

## Rendering a cell

A cell's markdown is rendered by SilverBullet: on 2.12.1 `markdown.markdownToHtml(cell, { expand = true, annotationPositions = true })` (`renderToDom` is in SilverBullet's main only; *Probe results*), behind the host's interface so that `renderToDom` can take over where it is. A cell looks as the rest of the page (links, tags, embeds drawn by SilverBullet), and the grid writes no markdown renderer of its own.

- SilverBullet marks each rendered element with `data-pos`, its offset in the cell's text; the grid marks each cell with where its markdown is in the page (`data-swl-rendered`, `data-swl-pos`, `data-swl-end`): the convention of Silverware Layout's host for a block rendered outside the editor ([silverware-assets.md](silverware-assets.md), *SilverBullet draws, the plugin decorates*). The grid uses it for Alt+click and a click's cursor, the assets to find an embed's text in a cell; neither knows the other. **Replaced by an API 2026-11-13** (shared/rendered.ts: the grid tells what it drew and where; `data-swl-rendered` gone), ahead of the assets moving to a plugin of their own, Silverware Assets (docs/silverware-assets-split.md).
- What SilverBullet's `markdownToHtml` (2.12.1) draws otherwise than the page (the grid's SilverBullet host mends it): a PDF left out and any other file left as its text (drawn as a viewer and a place, `host/silverbullet/undrawn.ts`); a task drawn as one of another page (a link to `<page>@<offset>` before its text, the offset the cell's, its box disabled): the link and the ref taken off (`host/silverbullet/tasks.ts`), its box enabled again as SilverBullet disables it on attaching its handlers (`settleGridFrames`), and toggled by the grid in the cell's markdown (`Grids.toggleTask`).
- Writing anything in a grid (a cell, an embed's size in it) changes its body, so SilverBullet draws the whole widget anew (its cache key is the body's text) and every cell is rendered again. Its speed, and whether it flickers, are checked as the widget is built (step 3).

## Media in a grid

A matrix of images (or of PDFs as cards) is a grid of embeds. How an embed is decorated, resized and written (SilverBullet's own size in its text, the plugin's metadata in a third segment, the views, the link form by `defaultLinkStyle`): [silverware-assets.md](silverware-assets.md). The same decoration applies to the media SilverBullet draws in a cell; SilverBullet's `%` is of the medium's box, so `|100%` fills the cell; the grid's CSS keeps media within their cell (`max-width: 100%`).

## The grid's codec

What a grid looks like in a page (the tags, their attributes, the cells and their ranges in the source, the blank lines) is known in one place, as an image's is: read in `shared/markdown/`, written through `shared/pages/`. The widget, the cell editing and the menu work on the grid's model alone, so a change of the syntax is a change of the codec.

## Where it lives

A part of Silverware Layout (decided 2026-11-12): it is the page's layout, it uses the widget widths, the narrow-pane rule, the page writer and the markdown parser already in Layout's bundle. Its own area, `src/grid/`, with Silverware Layout's layers inside (`grid/model`, `grid/core`, `grid/ui`) under the same rules (`src/isolation.test.ts` gets them); it registers its width by the same `LayoutProvider` contract as Silverware Table or Chart, so Layout's core knows no grid by name; `app.ts` puts it together, `index.ts` binds it to SilverBullet (its `syntax.define`, the bridge). Its CSS classes `swl-grid-…`.

- **The grid and the assets know nothing of each other** ([silverware-assets.md](silverware-assets.md), *Layers*): the assets decorate the embeds SilverBullet draws in a cell as anywhere else, and size them by shares of their own box, which in a cell is the cell. No area imports another.
- What SilverBullet is (`syntax.define`, `markdown.markdownToHtml`, moving its cursor, the index's relations) is the host's (`host/silverbullet/`), behind an interface of the grid's own, so the grid runs in the playground and its tests over plain elements, as the rest of Layout does.

## The slash command and the menu

- `/grid` (`slashCommand.define`) inserts two cells in the form with blank lines, the cursor in the first cell's content (in the raw text: the widget shows once the cursor leaves).
- A "…" menu on each cell: built (*Building a grid from the page* below); replaced 2026-11-15 by a grip on each cell and the grid's handle's menu (docs/silverware-layout-grid-handles.md).

## Building a grid from the page (planned 2026-11-13; built 2026-11-13)

Agreed with the user: a grid is made and taken apart without typing its tags, with the mouse or a finger, for any markdown, not only images. The grid gets the effort (a row of images by CSS alone was weighed and dropped: SilverBullet draws each embed as a block, and the grid is the more general tool).

### The command: Wrap in grid

The commands were named *Put into grid* and *Move into grid* until 2026-11-15; renamed by the user's choice, as the two
said apart only by their verb what matters, a grid made or one there: *Wrap in new grid* and *Move into existing grid*
(on Silverware Toolbar *Wrap in grid* and *Move to grid*, the actions `layoutWrapInNewGrid` and
`layoutMoveIntoExistingGrid`; the old names among their keywords); the grid menu's *Remove the grid, its content kept* became
*Unwrap grid*. On 2026-11-16 the commands took the toolbar's names, one name for each thing
(docs/silverware-assets-names.md): `Silverware Layout: Wrap in grid` and `Silverware Layout: Move to grid`, the actions
`layoutWrapInGrid` and `layoutMoveToGrid`. Below, the older text keeps the names it was written with.

- **One command, `Silverware Layout: Wrap in grid`**, over the blocks the selection touches (none selected: the block at the cursor). Not `/grid` over a selection: typing `/` replaces the selection. Named for the grid, not for columns: both modes make a grid, and a later way of filling one is one more mode, not another command.
- **A block**: a paragraph, each item of a list (a task too), an image's embed, a heading, a table, a fenced code block, a quote; read by `shared/markdown/` (`readBlocks`/`parseBlocks`), never by lines.
- **It asks** the mode, then the number of columns (2 to 8 since 2026-11-15, as the grid's menu offers; 2, 3, 4 before; a gallery Auto first), each a pick list as SilverBullet's palette shows one (`editor.filterBox`), on a phone too.
- **Modes**:
  - **Gallery**: each block a cell of its own, in order, the grid `columns="N"`: N to a row, more rows as there are blocks (ten blocks in 3 columns: rows of 3, 3, 3, 1).
  - **Split**: the blocks kept in order and cut into N columns one after another, as a newspaper's: by the number of blocks (the user's choice: it keeps what belongs together together; by length can come later), the first columns one more where they do not divide (ten blocks in 3: 4, 3, 3).
- **Lists split**: a list's items in two columns are two lists; a numbered list goes on counting (`5.` in the second, not `1.`), tasks keep their state.
- **Silverware Toolbar**: Silverware Layout defines an action through Silverware Toolbar's public API (`silverware.toolbar.defineActions`, from its init page, where Silverware Toolbar is installed), *Put into grid* with a parameter *Mode* (Gallery, Split): a button with its mode set asks the number of columns alone. Without Silverware Toolbar, the command alone.
- Written by the page writer (the blocks' range replaced by the grid's text, one edit, one undo step).

### The grid's and a cell's "…" menu

*Replaced 2026-11-15*: the cells' "…" are gone; a column's items are its grip's menu, the grid's its handle's
(docs/silverware-layout-grid-handles.md). What follows is how the "…" was decided, its items the same.

- **Shown** at a cell's top right as the pointer is over it (always on a touch screen), as a medium's; one a cell, holding the grid's items too (built so: a grid's and a cell's at one corner would lie over each other).
- **The grid**: the number of columns (Auto, 2, 3, 4: its `columns`), add a column, **Remove grid**: its content without the grid, the cells one under another in their order (row by row: cell 1, 2, 3 of the first row, then the next row's), each cell's markdown as written, a blank line between. The inverse of both modes: Gallery's cells and Split's columns are in the blocks' order.
- **A cell**: move left, move right, add a column after it, move out of the grid (its content put under the grid, never lost; built as the one item, "remove the column" being the same).

### Built (2026-11-13)

- `shared/markdown/gridbuild.ts`: the blocks a range touches (`blocksIn`, by parse.ts: a list's items each), a grid of them by mode (`gridOfBlocks`, `splitCounts`, items of one list one list in a column, a blank line kept round the grid), a grid's text (`gridText`), a grid taken apart (`ungridded`: items split into two cells one list again; the inverse of both modes, tested). The page writer's `grids.put` (the range as read, else left alone) and `grids.changeCells` (move, add, takeOut: its content under the grid, ungrid).
- `src/grid/build.ts`: Put into grid over a `PutHost` (the selection, a pick, the writer); SilverBullet's (`silverBulletPutHost`: `editor.getSelection`, `editor.filterBox`); the command `Silverware Layout: Wrap in grid` (named so since 2026-11-16); Silverware Toolbar's action `layoutWrapInGrid` (its parameter *Mode*: Ask, Gallery, Split), defined by the init page through `silverware.toolbar.defineActions` where Silverware Toolbar is installed.
- `src/grid/ui/cellmenu.ts`: one "…" a cell (not one for the grid besides: they would lie at one corner), its sections the cell's (move left, move right, add a column after it, move out of the grid), the columns (automatic, 2, 3, 4: the attribute), the grid's (a column at the end, remove the grid). Silverware Layout's popup menu moved to `src/ui/popupmenu.ts`, the media's, the links' and the cells' alike.
- Fixed with it: SilverBullet's button bar of a grid's frame showed as the pointer was over the grid (2.12.1 puts it in a div of the frame, and draws the frame anew with a bar of its own): hidden now by one watcher of the document for every grid's frame (`settleGridFrames`, which also enables a task's box in a cell).
- Seen in SilverBullet 2.12.1: five tasks selected, Split into 2 columns (3 and 2, one list each, their states kept), Gallery into 2 (`columns="2"`, a cell each); a cell moved right, 3 columns set, a cell moved out under the grid, the grid removed (its cells in order); Silverware Toolbar knew the action.

### Moving text into a grid (built 2026-11-15)

Asked by the user (2026-11-15): the selection moved into a grid the page has, all in one cell or a cell each, at a place clicked in the grid, the place shown well as it is pointed at; built on Claude's recommendations, to be iterated.

- **The command `Silverware Layout: Move to grid`** (and Silverware Toolbar's action `layoutMoveToGrid`, its parameter *Mode*: Ask, Together, A cell each): the blocks the selection touches (`blocksIn`, as Put into grid; none selected: the block at the cursor). Refused where none, where the run of them takes in a grid (their lines are taken out whole: the grid would go with them), or where the page's text has no grid (Put into grid makes one; one not drawn yet, far down the page, is picked once scrolled to).
- **Modes**, asked by the filter box only where there are several blocks: **Together** (one cell of them, joined as they were apart: a line break where one was) and **A cell each** (Gallery's cells). One block: Together, nothing asked.
- **The place, picked by a click** (`src/grid/ui/placepicker.ts`, what a point picks pure in `src/grid/core/placepick.ts`): the grids outlined; the nearest grid within 16 px of the pointer and its nearest cell decide. New cells go before or after it by the half the pointer is in (side by side: left or right; one under another, a narrow pane: above or below), a line in the gap with a dot at each end and a label (*New cell*, *3 new cells*). With Together, only within 32 px of the cell's edge (a quarter of it at most); elsewhere in it the text goes **into the cell**: the cell outlined and tinted, a line where its blocks meet nearest the pointer (before its first, between two, after its last; its top-level rendered elements and their `data-pos`), labelled *Into this cell* on the outline's top edge. A bar at the window's top says what to do, with Cancel; Esc, Cancel or a click away from the grids gives up (that click the page's as ever). Every press over a grid is the picker's (taken at the window's capture: no cell opened, no divider dragged); the grids' own controls (grips, dividers, the width's handle) hidden meanwhile. **On a touch screen** a tap shows the line and a second tap on the same place of the same grid picks it (no hover to show it before); a scroll takes the line away. A page opened meanwhile gives the pick up.
- **Written as one edit** (the page writer's `grids.moveInto`, `movedIntoGrid` in shared/markdown/gridbuild.ts): the blocks' lines taken out (what was round them runs on, a line break, only where it did and the lines on both sides and the first taken out are of one kind, lines of text or a list's items: a paragraph's line or an item taken out of it; else a blank line, as a heading taken from between a paragraph's line and a grid left the grid unread, found in review), an indented code block from its line's start (its indent kept), the cells added before the cell picked (the grid's last: after it), or the content added to a cell at the start of the block picked (its end: after it), a blank line between; the range as read, the grid by its body and a cell added to by its content as drawn (its offset that content's), else left alone. Two lists a block apart become one list once it is taken out, as markdown reads them (kept so). In turn with the cells' writes (`Grids.moveInto`). A text holding a `<grid>` or `<cell>` line of its own is refused.
- Kept out for now: a place within a block (a list's items: the list is one block of the cell), a pick by the keyboard, a grid of another page.

### Open

- **A phone**: a grid's columns stack under each other in a narrow pane (`minPaneWidth`). Whether a gallery (or a grid that asks so, an attribute) keeps its columns there: the user is still thinking it over.
- **Later, an idea kept**: images uploaded several at once into a grid (a picker of several files, the camera on a phone, `space.writeDocument`, `maximumDocumentSize`; where the files go and how they are named to decide): postponed by the user for what serves any markdown first.

## Probe results (2026-11-13, SilverBullet 2.12.1, Chromium)

A scratch space, a `space-lua` block defining `<grid>` by `syntax.define`, Playwright driving the page.

- **`syntax.define` with `<grid>` works**: the region is a widget, classes `<renderClass> sb-lua-directive-block`; the raw text is not shown while the cursor is outside. A definition is active after the page is loaded again (twice in a fresh browser: the first load indexes before Space Lua runs).
- **`markdown.renderToDom` is not in 2.12.1** (SilverBullet's main only). **`markdown.markdownToHtml(cell, { expand = true, annotationPositions = true })`** is, and does what the plan needs: a cell's links (`a.wiki-link[data-ref]`), hashtags (`a.sb-hashtag`), bold, an image embed as `<img>` with SilverBullet's size (`|120` → `width: 120px`) and alt; every element carries **`data-pos`, its 0-based offset in the cell's text** (the text from the line after `<cell>`). The widget's handlers are attached by SilverBullet (`data-handlers-attached`), so its links are SilverBullet's. So a cell is rendered by `markdownToHtml` on 2.12.1, behind the host's interface; `renderToDom` where SilverBullet has it, later.
- **A plain click in the widget** leaves the widget and SilverBullet's cursor where they are: a click is the grid's. **An Alt+click** is SilverBullet's: the cursor goes to the region's start (the raw text shows), not to the place clicked; the grid's Alt+click is its own (a capture listener, the position by `data-pos` plus the cell's offset).
- **SilverBullet's widget menu** on the grid: Reload, Copy, Edit (`.button-bar`): hidden, as decided.
- **The index**: what a fresh browser indexes before Space Lua runs is parsed without the syntax extension, so a grid's links are indexed then; after a reindex with Space Lua loaded they are not (the body has no children). A rename (`Page: Rename`) updated a link outside a grid and **left the grid's link as it was**: the index decides what a rename sees.
- **The grid's own indexing works**: a Space Lua listener of `page:index` (the page in `event.data`: `name`, `text`; `event.name` is the event's) adding objects by `index.indexObjects(page, objects)` (SilverBullet clears a page's objects before the event, so they replace rather than accumulate); a relation as SilverBullet makes one (`ref` `Page@from`, `tag = "relation"`, `kind = "mention"`, `from`, `fromTag = "page"`, `to`, `toTag = "page"`, `page`, `range = { from, to }`, 0-based, end exclusive). With it the rename **updated the grid's link**. A Lua table and `js.tojs(…)` both arrive as an array.
- Not probed: SilverBullet's edge (after 2.12.1, `space-lua` only under `Library/`); how SilverBullet and GitHub show a grid without the plugin (as the plan reads them from the code); a page or a PDF embedded in a cell through `markdownToHtml` (only an image was).

## Steps

1. **Probe** (done 2026-11-13 on 2.12.1, *Probe results*; edge not yet) (SilverBullet 2.12.1 and edge, Chromium): `syntax.define` with `<grid>` in a page's `space-lua` (edge runs it only under `Library/`: docs/silverware-library-prefix.md); the widget shown, the cursor's entry, a plain click and an Alt+click on the widget, the reload needed; how SilverBullet and GitHub show a grid without the plugin (both forms); `renderToDom` of a cell and a grid drawn anew; **a rename of a page and of an attachment linked from a grid, and whether a library can add link objects to the index** (*Indexing*).
2. The grid's model and codec: read a body into attributes and cells with their source ranges (`shared/markdown/`), write a cell back through the page writer (blank lines kept); the isolation test's rules for the area; tests. **Done 2026-11-13**: `shared/markdown/attributes.ts` (HTML's attributes, smart quotes read), `shared/markdown/grid.ts` (`readGrids`), the page writer's `grids.replaceCell`, `src/grid/model/columns.ts` (the `columns` attribute as a CSS column template), the areas' rules in `src/isolation.test.ts`.
3. The widget: render the cells by `markdown.markdownToHtml` (each element's `data-pos` turned into `data-swl-pos` in the page), CSS grid, the narrow pane, SilverBullet's widget menu hidden; the playground. **Done 2026-11-13**: the init page's `syntax.define` (`renderGrid`), `src/grid/grids.ts` over a `GridHost` (SilverBullet's: `host/silverbullet/grid.ts`), the attributes read from the page's text (the renderer gets the body alone, and SilverBullet draws a grid anew only as its body changes: a `<grid>` line edited sets the columns again on the grids drawn, `refresh`), the style page's grid, its frame's border off by the class `swl-grid-widget`, its button bar hidden inline (important: SilverBullet's touch rule names `#sb-main`). Seen in SilverBullet 2.12.1: columns `1fr 2fr` drawn 244 and 487 px, links, tags, lists and an image in the cells. Left for later: `renderHtml` (a grid exported). (`data-swl-pos` came with step 4; a grid in an embedded page with step 7.)
4. Editing a cell in place; Alt+click to the source position; UI tests. **Done 2026-11-13**, its UI tests too (`ui-tests/grid.spec.ts`, against SilverBullet: /grid and its cursor, a cell edited and written on Esc, Alt+click's cursor, `columns`, a grid in an embedded page, its hashtags in the index; `gridsDrawn` loads the page again where the custom syntax is not active yet): `Grids.start` (a click in a cell, not on a link, a tag, a field: its field, `ui/celleditor.ts`; left by blur, Esc or Ctrl/Cmd+Enter, written by the page writer where it changed; an Alt+press taken in the capture phase before SilverBullet's, the cursor by `core/position.ts`: the element's `data-pos`, the point's offset in the element's text followed through the markdown; first by the word under the caret, which took a word for the same one earlier, "is" in "This": the user found it). Seen in SilverBullet 2.12.1: a cell edited and written as one edit, the grid drawn anew; an Alt+click on a word put the cursor in it. Known: a click into another cell while one is edited writes the first, the grid is drawn anew and the second click is lost (click again).
5. `/grid`. **Done 2026-11-13**: the init page's slash commands (`slashCommands`, `runSlashCommand`), a new grid's text by the codec (`newGridText`, `shared/markdown/grid.ts`), where it goes by `core/insert.ts` (a blank line before it after a paragraph's line, one after it where text follows), put in by `replaceRange` at the cursor (as Silverware Chart inserts its blocks), the cursor in the first cell. Seen in SilverBullet 2.12.1: offered as `/grid` is typed, inserted after a paragraph with a blank line between, what is typed next in the first cell.
6. The width by Silverware Layout's handle. **Done 2026-11-13**: `src/grid/provider.ts` registered by the binding as a widget plugin registers (widget: the frame, class `swl-grid-widget`; Layout's key `width` kept as the `<grid>` line's attribute of that name, `width="1100"`, read synchronously from the attributes a grid drawn keeps), written by the page writer's `grids.setAttributes` (the line rewritten in HTML's form, its other attributes kept); a width typed by hand lays the widgets out again (`Grids.onAttributes`, `LayoutApp.layOutWidgets`). Seen in SilverBullet 2.12.1: `width="900"` drew the grid 900 px wide over a text of 760.
7. The grid's content indexed (*Indexing*), unless the probe found it needless. **Done 2026-11-13**: `src/grid/core/links.ts` (wiki links and embeds by `shared/markdown/inline.ts`, local markdown links and images resolved from the page's folder; none in fenced code or a code span), their relations in SilverBullet's shape by `host/silverbullet/gridindex.ts`, added by the init page's `page:index` listener (`index.indexObjects`). Seen in SilverBullet 2.12.1: after a reindex a grid's `[[Target]]` and `![[cat.png]]` were relations of its page, and a rename of Target updated the grid's link. **Hashtags, done 2026-11-13**: `src/grid/core/tags.ts` reads each cell by `shared/pages/tags/scan.ts` (a task's, an item's, a table's, a heading's, a paragraph's), and its paragraphs holding one; `gridTagObjects` makes SilverBullet's objects of them (a `tag` per name and parent, `<name>:<parent>`, the same as SilverBullet's own of one outside a grid; a `paragraph` per paragraph, its `tags` and `itags`). Seen in SilverBullet 2.12.1: `index.tag "tag"` has a grid's `#gridonly` (page) and `#griditem` (item), `index.tag "gridonly"` its paragraph. Not indexed: a grid's items and tasks as objects of their own, and its hashtags in the page's own `tags` (the page's object is SilverBullet's).
   **A grid in an embedded page, done 2026-11-13**: SilverBullet (2.12.1 and its main) draws an embedded page's markdown without its custom syntax, the grid's lines as text with a `<br>` between each (its cells' markdown as written), so it showed as text (not the open page's columns, as feared). `host/silverbullet/embeddedgrids.ts` finds such a grid in `.sb-inline-content` (a text `<grid …>` to a text `</grid>`, siblings) and `Grids.drawText` draws it in its place by its own `<grid>` line, marked `swl-grid-shown`: no grid of the open page, so neither edited nor Alt+clicked there, no handle (the provider's frame is SilverBullet's of a custom syntax), its media not decorated (no place in the open page).
8. Library page (the syntax, what it looks like without the plugin, what is indexed), release. **Library page done 2026-11-13** (*Columns*); the release is proposed to the user, not made.

Later: attributes (`gap`, `span`, `align`), nesting, a grid exported (`renderHtml`), a grid's tasks and items indexed as objects of their own, a gallery keeping its columns on a phone (*Building a grid from the page*, *Open*). Next: the assets to a plugin of their own (docs/silverware-assets-split.md).

## Open

- The attribute names (`columns`, `gap`, the width's).
- The field a cell is edited in: a plain growing `textarea`, or something richer later.

## Its width: centred (2026-11-14)

A grid widened by its handle grows on both sides, centred on the text as a table: its first column moves away from the pointer while the others stand. Tried at the text's start (its first column standing, the others following the pointer): the user found it worse, a grid must grow both ways; back to centred the same day. What came of it stays: a widget at the text's start (a medium) is held within the pane's right edge (Layout's `widestWidth`). 

## Column widths (2026-11-14)

A divider between each two columns (`src/grid/ui/dividers.ts`): a quiet line in the gap as the pointer is over the grid, plain over it; dragged, the two columns' shares change (their sum kept, neither under a tenth of it, the others as they are), snapping to 1 : 1, 1 : 2, 2 : 1, 1 : 3, 3 : 1, 2 : 3, 3 : 2 within 8 px, and to the page's text's edges (a column lined up with the text above and below a grid wider than it: the first column's right edge on the text's right one, the second's left edge on its left one; Layout hands the text's place over, `Grids.textEdges`), each place a quiet dashed guide over the grid while it is dragged (the one snapped to plain and named, `Page width` for the text's), the ratio or the two shares said above it; shown at once (the grid's template), written on release as `columns`, as simply as it goes (`model/columns.ts` `columnsOf`: even ones their count, else the least whole shares within 1 % of the whole, `1fr 2fr`, else shares of the narrowest). A double click makes the two even (even columns as many as the cells would make anyway: the attribute taken off). Where the columns are is read from the grid as laid out (its computed template and gap): any `columns`, any rows. None in a narrow pane (one column), none on a grid of another page shown in this one. On a touch screen the dividers are placed as the grid is first touched, their target wider.

## Its edges (2026-11-14)

*Taken out the same day (docs/silverware-layout-align.md): a grid has the width's handle and the alignment of every widget; `shift` is gone.*

The user wanted a grid's left edge moved without its right one; asked how (a line on each edge, a second handle on the left, Alt and the handle), chose a line on each edge. Built in Silverware Layout for any widget whose provider asks (`edges: true` in shared/layout.ts; the grid's): a quiet line on each edge as its handle shows (`src/ui/edges.ts`), dragged, that edge alone moves (the handle's bar still widens it on both sides): the widget's place off the text's middle kept as Layout's entry `shift` beside `width` (px, its middle right of the text's; the grid's attribute `shift="-150"`), shown by `--swl-shift` (the style page's rule, held within the pane less half the gutter on either side), snapping to where the text's width and the guides put an edge (`draggedEdge`), their guides shown as for the bar. A double click on a line centres it again, its width kept; the bar's double click (the text's width) takes the shift off too.

## Blank lines (2026-11-14)

The editor shows each blank line of a page as a line of its own; SilverBullet's `markdownToHtml` (2.12.1, probed) keeps those between paragraphs (as `<br>`) and drops those next to a block (a list, a heading, a table, a code block) and between a loose list's items, so a cell looked tighter than its markdown in the editor (the user's report). Each element of a cell (by its `data-pos`, a list's items too) is given the blank lines before it in the cell's text that the rendering did not draw (`core/blanklines.ts`: the line breaks before it, the first only ending an inline element's line), as a `div.swl-grid-blank` of the cell's line height each (`ui/view.ts` `keepBlankLines`).

One element per line (2026-11-17, the user's report): a list and its first item start on one line, at one offset (`<ul data-pos="6"><li data-pos="6">`), and a quote and the list in it on one line (`> - a`), so a blank line before them was put back twice, the second inside the list (two lines of space in a cell where the editor shows one). The lines a cell's rendering starts are read in one place, by one rule (`ui/offsets.ts` `lineStarts`: of the elements marked where a line's own text starts, past its marks, the outermost, the first in the document's order; none in a line's text, a link or emphasis, which an unmarked block, HTML of more than one element, would have left standing for its line; none in an inline element, `ui/cellparts.ts` `inCellBlocks`: a page embedded, `![[Other page]]`, is expanded in the paragraph holding it, its elements marked with that page's offsets, probed 2026-11-17), what puts blank lines back and what finds a blank line clicked alike. A cell's lines are read once per its text as markdown's parser reads them (`ui/celllines.ts` `cellLines`, of `shared/markdown/parse.ts` `markedLines`: each line's quote marks, an item's marker, where its own text starts), not by a second reading of markdown of Layout's own. What a cell draws besides its markdown's blocks (the space between them, the grid's grip) is told in one place, `ui/cellparts.ts`, what takes a drawing over, picks a place and finds a cell's end reading its blocks by it. Whatever holds a block (the cell, a quote, a list's item: a code block, a heading, a second paragraph or a nested list after a blank line in an item, drawn by the rendering without it), its blank lines go before it. A quote's blank line is its mark alone (`>`): the editor shows it as an empty line of the quote, and SilverBullet's rendering keeps it as a line break but between a loose list's items (probed 2026-11-17). It counts for a place in a quote as deep or shallower (`core/blanklines.ts`: a deeper quote's last empty line ends that quote before the place; one shallower lies before the place's quote, that quote's own), its marks the parser's (a quote in a list's item indented as the item's content, none in a code block); an empty item's line (its marker alone) is no blank line. A click on a quote's empty line puts the caret past its mark (`caretOn`), so what is typed there stays in the quote; on a line of white space at its start (four spaces kept before what is typed would make it a code block). A blank line clicked is measured from what is drawn before the line after it (`ui/cellpoint.ts` `blankRoomTop`, by `ui/cellparts.ts` `spaceBefore`, what puts blank lines back reads the same: an element or text the host left unwrapped, past the space between), a margin between them the blank line's room too; where nothing is before it in what holds it (a quote's first block after its empty first lines), from the top of what holds it, the blank lines before that its holder's own (a click on an item's text over a nested list was taken for the blank line under it, and one in a theme's margin over the list was not).

The handle's bar beside a grid went the same day (the user's choice): two controls at its right edge did nearly the same. A widget with `edges` has its lines alone (the handle's box `swl-handle-bare`): an edge dragged alone; with Alt, both edges from its middle (`draggedBoth`, its width snapping as the bar's); a double click centres it, with Alt the page's width; focused, the arrow keys move the edge (Alt: both). Tables, charts and databases keep the bar.

A blank line clicked: nothing there is marked with its place, so the caret went to the cell's start (the user's report). Found by height now (`ui/cellpoint.ts` `blankLineAt`): a click between the element drawn before and the one after, where the markdown has blank lines before the one after, is on the nth of them (`core/blanklines.ts` `blankLinesAbove`), the field's caret on it past its marks (a quote's empty line: in the quote, 2026-11-17). The grid's edge lines lie outside its box (a press near the edge of a cell's content was the line's), and a cell has no outline as the pointer is over it (cut off at the grid's edges, on every column: the user found it noisy).

## Lines as blocks (2026-11-14)

The user's word: `1⏎2` is two blocks as `1⏎⏎2` is (the editor shows a paragraph's lines apart; three images on three lines were one cell of a gallery). Put into grid takes each line of a paragraph as a block (`blocksIn`, `shared/markdown/gridbuild.ts`); blocks in one cell are joined as they were apart in the text (a line break where one was). The grid taken apart joins a cell ending in a line of text and the next starting with one by a line break, so `1⏎2` comes back as it was; two paragraphs a blank line apart come back a line break apart (the grid keeps no more of what lay between its cells: its form puts a blank line round each cell's content, cut off as it is read; a mark per column was weighed and dropped by the user, as the difference lies only between cells).


## Borders (2026-11-14)

The user's wish: a grid's faint lines, on where asked, lined up with what is dragged. Kept as the grid's attribute `border="1"` (HTML's table's; `border` alone or any value but `0`, `false`, `no`, `none`, `off` asks for them too: `model/border.ts`), turned on and off in the cell's menu (*Borders*, checked), shown at once (`data-swl-border` on the grid, `ui/view.ts` `showBorder`; the body unchanged, so no new drawing). Drawn by the style page alone: the gap goes into each cell's padding (so a line between two columns lies where the gap's middle was, where the divider is placed), cells stretched to their row's height; the grid's ring an inset shadow on its first and last pixels, each cell's lines its right and bottom shadow (each cell closed, a last row's last cell not run into the empty place beside it). All within the grid's box: SilverBullet's frame cuts off what lies outside (a ring outside the box was seen gone). The edge lines (`ui/edges.ts`, any widget's) moved onto the widget's own first and last pixel, their target still outside its box; a divider's line, under borders, on the pixel after its column. One opaque colour (the text's mixed into the page's ground), so lines meeting are no darker. `grid.spec.ts` measures each line's place.

### Lines between the cells alone (2026-11-16)

The user's wish: a second style, the lines between the cells alone (first the columns' alone, then the rows' too the same day: the ring round the grid all that is missing). `border="inner"` (`model/border.ts` `BorderStyle`: `none`, `inner`, `all`; `all` still written `1`), shown as `data-swl-border-inner` (`showBorder` sets one of the two attributes). The menu's *Borders* is a row of two icon buttons (`LayoutMenuChoices`, segmented): the inner lines, all lines; the one chosen pressed again takes the lines off. Drawn by each cell's `::before` (a 1 px line half a gap left of the cell, run down through the row gap to meet the next row's) and `::after` (a line in the middle of the gap under it, half a gap past each side); what falls outside the grid (the first column's, the last row's, the ends) its `clip-path` cuts off. By the cells, not the dividers, so it is the same in a grid of columns as many as fit and in a narrow pane (no dividers in either); the layout (gaps, padding) unchanged. Not drawn while a cell is edited or the grid resized (all its lines are, by the same pseudo-elements) nor while a place is picked (the clip taken off).

**Every line while a grid is resized** (the user's report, 2026-11-16): a grid without borders whose width was dragged showed its ring alone where it had no dividers (columns as many as fit); it now draws every line as while a cell is edited (one rule for the three states: a cell edited, a divider dragged, its widget resized), the dividers' own lines no longer shown then (half a pixel off the cells').

## Dragging text (2026-11-14)

The user's wish: text dragged into a column as SilverBullet's editor takes a drag, and always moved, never copied.

- **Why it did not work**: a cell edited takes a drop in its field itself, but a drag begun in the page's editor leaves the cell edited (the press there): the drop lands on a cell's rendering, inside SilverBullet's widget, which its editor takes at the grid's start or not at all.
- **Where a drag began** (`src/grid/drag.ts`, as it begins): the page's own text (the host says which node is: `GridHost.isPageText`, its selection read as it is dropped: `pageSelection`), a cell's rendering (its selection as a range of its markdown, `ui/cellpoint.ts`, grown to take in the marks round it, `shared/markdown/marks.ts`: the markdown carried, not the rendered text), or a cell's field (its range).
- **Dropped on a cell not edited** (taken in the capture phase, before the host's editor): written where it was let go (as a click there puts the caret), and taken out of where it came from as **one edit** where the host writes moves (`GridHost.writeMove`: the page writer's `text.takeOut` and `grids.replaceCells` in one change of the page). Within one cell, moved in it; dropped where it was taken from, nothing. From a field: taken out of the field, written as it is left (two edits). From another window: copied (nothing to take out).
- **Dropped elsewhere** (the page's editor, another field): taken out of the cell or field it came from once a drop is seen in the page (or the browser says another window took it); a drag given up takes nothing out. Into the page it is two edits: the page's editor writes the drop itself, and taking it into the same edit would need its position at the point (`posAtCoords`, its internals).
- **Without the host's hooks** (another host, the playground): a drop on a cell copies, the cells written apart.
- Written in turn with the cells' writes (`inTurn`): a cell's write and a move do not cross; each finds its grid as it is drawn then.
- Tested in `ui-tests/grid.spec.ts`: a drag's start dispatched by the test (a selection is not dragged headless), the drop the browser's own (CDP `Input.dispatchDragEvent`).

## The cursor kept out (2026-11-14)

The grid's markdown shown in its place confused the user (it looks nothing like it drawn): it shows by Alt+click or the menu's *Edit markdown* alone.

- **Why it showed by a click**: a press in the grid, not stopped (the gap between two cells, its edge), or not taking the focus from SilverBullet's editor round it (the editor focused after a cell was left, a divider dragged), let the editor put its cursor into the grid's text, or take the browser's selection there. The grid now takes every press in it (cells, gaps, its edge; a field edited and links, buttons their own) and the focus itself (`tabindex="-1"` on the grid: a press focuses it, not the editor, which takes no selection while it has no focus). A press in a cell edited but beside its field keeps the field focused (a quick second click on a cell just opened closed it).
- **A cell being opened takes no second click** (its page's text read first): two fields were made for one cell, and the cell was left.
- **The arrows** (`src/host/silverbullet/cursor.ts`, SilverBullet's lines are its elements): an arrow that would take the cursor onto a grid's line (down or right from the line before it, up or left from the line after it) takes it to the line after the grid, or the end of the line before it. Searching, Home/End or a click into the grid's raw text elsewhere still reach it: the markdown shows then, as asked.
- **The menu** has *Edit markdown (Alt+click)*: the column's markdown shown, the cursor at its start.
- **A press beside it** (the user's report, 2026-11-14: as Silverware Table keeps a press beside a table): on its line beside a grid narrower than it, or in the editor's margin at its height, SilverBullet's editor put its cursor on the grid's line and showed its markdown. Such a press does nothing now (`GridHost.pressBesideGrid`, SilverBullet's lines in host/silverbullet/dom.ts); one beside a line of text is the text's as before.
