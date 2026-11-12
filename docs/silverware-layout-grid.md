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
- **The end is the first line matching `endMarker`**: the parser counts no nesting, so a grid in a grid would close at the inner `</grid>` (no nesting in the first version), and a `</grid>` line inside a column's fenced code block would end the grid early (documented).
- A new definition is active after the editor's state is rebuilt (a page reload).
- **Not in the index**: the region's body node has no children (`markdown.parseMarkdown`, which the index uses, takes the user's syntax extensions), so links and hashtags inside a grid are not indexed: no backlinks from a grid's content. Without the plugin they would be. A later probe may look at indexing them ourselves (the body parsed, links and tags added as objects).
- **Experimental API**: may change in a SilverBullet release; `ui-tests/silverbullet.spec.ts` gets a check of it, failing by name.
- `shared/markdown/` (lezer with SilverBullet's configuration) does not know the node: it reads a grid as HTML blocks and paragraphs. What reads blocks (Silverware Toolbar's Turn into, the page writer) must not take a grid apart; checked as each is touched.

## Editing

- **A click into a cell** edits that cell alone, in place: the cell shows its markdown in a growing text field in the cell's box, the other cells stay rendered, the grid keeps its shape. Leaving the cell (blur, Esc, a click elsewhere) writes the cell's text by one `replaceRange` over the cell's range only: one edit, one undo step. As Silverware Table's cell editing.
- **Alt+click** moves SilverBullet's cursor (`moveCursor`) to the source position under the click, which shows the raw markdown. The position: each block of a cell is rendered on its own and marked with its offset in the source (`shared/markdown/parse.ts` gives the blocks); within a block, found by the text under the click. As Silverware Table's Edit markdown / Alt+click.
- Whether SilverBullet's widget takes a plain click or an Alt+click itself (moves the cursor in) is a probe.
- A table in a cell is plain HTML: Silverware Table enhances SilverBullet's table widgets only. Later, if wanted.

## Layout

- Rendered as CSS grid: `grid-template-columns` from `columns` (a number: equal columns; else track sizes, `1fr 2fr`, `30% 70%`), a gap.
- **Its width** by Silverware Layout's handle, as any widget: the grid registers as a `LayoutProvider` (shared/layout.ts) and keeps its entries in an attribute of `<grid>` (its name decided when built).
- **On a narrow pane** (under `minPaneWidth`, as Silverware Layout lays nothing out there) the cells stack.

## Where it lives

A part of Silverware Layout (decided 2026-11-12): it is the page's layout, it uses the widget widths, the narrow-pane rule, the page writer and the markdown parser already in Layout's bundle. Its own area, `src/grid/`; it registers its width by the same `LayoutProvider` contract as Silverware Table or Chart, so Layout's core knows no grid by name. Its CSS classes `swl-grid-…`.

## The slash command and the menu

- `/grid` (`slashCommand.define`) inserts two columns in the form with blank lines, the cursor in the first column's content (in the raw text: the widget shows once the cursor leaves).
- Later a "…" menu on the grid (shared/menu): add or remove a cell, the column count and widths, move a cell.

## Steps

1. **Probe** (SilverBullet 2.12.1 and edge, Chromium): `syntax.define` with `<grid>` in a page's `space-lua` (edge runs it only under `Library/`: docs/silverware-library-prefix.md); the widget shown, the cursor's entry, a plain click and an Alt+click on the widget, the reload needed; how SilverBullet and GitHub show a grid without the plugin (both forms).
2. The grid's model, pure: read a body into attributes and cells with their source ranges, write a cell back (blank lines kept); tests.
3. The widget: render the cells (each block marked with its offset), CSS grid, the narrow pane; the playground.
4. Editing a cell in place; Alt+click to the source position; UI tests.
5. `/grid`.
6. The width by Silverware Layout's handle.
7. Library page (the syntax, what it looks like without the plugin, that a grid's links are not indexed), release.

Later: attributes (`columns`, `gap`, `span`, `align`), the "…" menu, nesting, indexing a grid's content.

## Open

- The attribute names (`columns`, `gap`, the width's).
- Whether indexing a grid's links and tags is worth our own indexing (a probe).
- The field a cell is edited in: a plain growing `textarea`, or something richer later.
