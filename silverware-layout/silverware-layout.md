---
name: Library/damesene/silverware-layout
tags: meta/library
version: 2.0.4
description: "Silverware Layout: Columns in a page (/grid), the width of a page's text (its own or a default for every page) and of its tables, databases, charts and grids, wider or narrower than the text by a handle beside them that snaps to guides of your own, and placed at the left, in the middle or at the right; the editor's font size, and font zoom with Ctrl + scroll or a pinch, files zooming with the text."
files:
- silverware-layout.js
- silverware-layout-init.md
- silverware-layout-api.md
- silverware-layout-style.md
---
# Silverware Layout

The layout of your pages: columns side by side, how wide a page's text is, how wide each of its tables, databases and charts is and where it stands, and how large the editor's font is. Give one page a wider text (a page of tables), all of them a width of your own without touching your theme, one table or chart more room than the text has or put it at the right, or zoom the text with Ctrl + scroll or a pinch, its files with it.

## Page width

Run **Silverware Layout: Settings** from the command palette. Its **Page width** tab has two rows:

- **All pages**: the width of every page without its own.
- **This page**: the width of this page alone.

Set a width with its slider, marked with your guides (it snaps to them), or type it, in **px** or in **%** of the editor's width (the px / % switch beside the number). A row without a width of its own shows the width it uses in grey, and says where it comes from (*Uses all pages' width*, *Uses your theme's width*); **↺** beside a width of its own takes it back.

Every row of the dialog works this way, the **Font** tab's too. The page shows each change at once; while you hold a slider, the dialog all but disappears, its slider alone left, so you see the page under it as it changes (on a phone too, where the dialog takes the screen). **Save** keeps it, **Cancel** (or Esc) puts the page back.

A page's own width is kept in its frontmatter:

```yaml
_layout:
  width: 1100
```

or `width: "90%"`. You can type it there too: the page follows as you type. Taking the width away (**↺** in the dialog) takes `_layout` away with it, where it holds nothing else.

## A widget's width

A table of Silverware Table, a database of Silverware Database and a chart of Silverware Chart can each be wider than the page's text, or narrower, as tables in Confluence: point at one (on a tablet, tap it), and a bar shows beside its right edge.

- **Drag the bar**: it grows (or shrinks) on both sides, staying centred on the text. While you drag, a faint line each side shows the page's width and each of your guides (900 px, 1200 px and Full width, unless you change them); the bar snaps to one as you come near it, and its lines darken a little. Let go, and the width is saved. Esc while dragging puts it back.
- **Double-click the bar** (double-tap it): it is as wide as the text again.

A width is never wider than the editor: in a narrower window, or on a phone, it is as wide as there is room (a table's columns in proportion, a chart drawn smaller). Each keeps its width itself:

- a table in its metadata (`layout.width='1200'`), so it needs Silverware Table's *Store table metadata* setting;
- a database in its block, a line `layout.width: 1200`;
- a chart in its block, a comment `%% layout.width: 1200` (in the Mermaid format; a format of your own that keeps no such line says so, and the width holds until the chart is drawn again);
- a grid on its line, `<grid width="1100">` (see *Columns*);
- an embedded file as its size, `![[photo.png|Photo|300]]` (with Silverware Assets, see *Embedded files*).

Without Silverware Layout, each is as wide as the text, its width still kept.

## Where a widget stands

Click the bar beside a table, a database, a chart, a grid or an embedded file (a preview's too: its bar has no width to drag), and its menu puts it at the **left**, in the **middle** or at the **right** of the page's text (of its cell, in a grid), or makes it as wide as the text again. Where there is no width to drag (a preview, or anything on a phone), the bar is fainter and opens the menu alone; on a phone it shows beside a widget narrower than the screen (an image), not beside one as wide as it. A widget at the left grows to the right as you drag its bar, one at the right to the left (its bar beside its left edge), a centred one both ways. It is kept with its width, as `layout.align` (a file's in its embed, `{ align: right }`; a grid's on its line, `<grid align="right">`).

A widget without its own stands as the **Alignment** tab of **Silverware Layout: Settings** says for its kind (a table, a chart, a database, a grid, a file's preview, a file shown full): tables, charts, databases and grids centred, files at the left, unless you change them there. The one marked *(default)* in a widget's menu is that one; choosing it keeps nothing of the widget's own, so the widget follows the tab as it changes.

## Columns

Put part of a page side by side: type **/grid** where it should go. A grid of two cells side by side comes in, the cursor in the first:

```markdown
<grid>
<cell>

The first cell: any markdown, lists, links, images.

</cell>
<cell>

The second cell.

</cell>
</grid>
```

- **Wrap what you have in a new grid**: select paragraphs, lines, list items, tasks, images (or put the cursor in one), and run **Silverware Layout: Wrap in grid**. Each line is a block of its own, as you see it in the editor, with or without a blank line between (three images on three lines: three blocks). Pick how:
  - **Gallery**: each block a cell of its own, as many to a row as the columns you pick (Auto, or 2 to 8): a row of images, a board of notes.
  - **Split**: the blocks in their order, cut into the columns you pick by their number (ten tasks in three columns: 4, 3, 3), a list staying a list in each column.

  With Silverware Toolbar, add **Wrap in grid** to a toolbar and set its *Mode*: the button then asks the number of columns alone.
- **Move text into a grid you have**: select the blocks (or put the cursor in one) and run **Silverware Layout: Move to grid** (also a toolbar's button). With several blocks, pick how:
  - **Together**: all of it in one cell.
  - **A cell each**: each block a new cell of its own.

  Then click in a grid where it goes (the grids on the page are outlined, a bar at the top says what to do). A line follows the pointer: between two cells it puts new cells there (its label says how many); with Together, inside a cell (away from its edges) it shows where the cell's blocks meet, and the text is added to that cell there. The text is taken out of where it was, all in one step: Ctrl+Z puts it back. Esc, **Cancel** or a click away from the grids gives up. On a phone, a tap shows where it would go and a second tap on the same place moves it. With Silverware Toolbar, **Move to grid** can be a button, its *Mode* set or asked.
- **Change a cell by its grip**: point at a cell, and a short grip shows at the middle of its top edge (on a phone, once you tap into the grid). Click it to move the cell left or right, add a cell after it, move it out of the grid (its content goes under the grid), **Clear cell…** (everything in it goes, the cell stays) or **Delete cell…** (its content with it); both ask first, and Ctrl+Z brings it back.
- **Change the whole grid by its handle**: the bar beside the grid (the one you drag its width by) opens, on a click, the grid's menu: where it stands, its **Columns** (Auto, or 2 to 8; with Auto its **Min width**: XS, S, M, L, or your own in px), its **Borders** (two buttons: lines between its cells alone, or lines round the grid and between all its cells; the one chosen pressed again takes them off), a cell added at the end, or **Unwrap grid**: the grid goes, its content stays, the cells one under another in their order (row by row), as it was before you wrapped it in a grid. On a phone, where no bar shows beside a grid as wide as the screen, each cell's grip menu has **Grid…**, which opens the same menu.
- **Edit a cell where it is**: click into it, and its markdown shows in a field of its own, the cursor where you clicked (or the text you selected in it by a drag, selected there too), the rest of the grid as it was. Click elsewhere, or press Esc (or Ctrl+Enter), and it is saved. With [Silverware Editor](https://github.com/damesene/silverware-libraries/blob/main/silverware-editor/silverware-editor.md) installed, the field shows the markdown as the page does (highlighted, tasks as boxes, images drawn); without it, a plain text field. A click on a link or a tag in it still follows it, while you edit it too (the cell saved first; Alt+click to edit the link). SilverBullet's shortcuts (Ctrl+K, Ctrl+/, …) do nothing while you edit a cell; one pressed there says so.
- **See the raw text**: Alt+click a cell, or choose **Edit markdown** in its grip's menu, and the page shows its markdown, the cursor where you clicked (or at the cell's start). Otherwise the grid keeps the cursor out of its markdown, as a table does: a click anywhere in it is the grid's, and the arrow keys move the cursor over it, from the line before it to the line after it and back.
- **Drag text into a cell, or out of it**: select text in the page and drag it onto a cell (it is outlined as you hold it there), and it moves there, written where you let it go; drag text selected in a cell onto another cell, or within it, and it moves too, its formatting with it (a bold word stays bold). A move into a cell is one change: one undo takes it back. Text dragged out of a cell into the page moves as well (two undos take it back: the page's and the cell's). Text dragged from another app is copied in.
- **A grid's width and place**: point at a grid, and a bar shows beside it, as beside a table: drag it to widen or narrow the grid, double-click it for the page's width, click it to put the grid at the left, in the middle or at the right (see *Where a widget stands*).
- **Columns' widths by dragging**: point at a grid, and a line shows between its columns. Drag it to make one column wider and its neighbour narrower; it snaps to 1 : 1, 2 : 1, 1 : 2, 3 : 1, 1 : 3, 3 : 2 and 2 : 3, and in a grid wider than the page's text to the text's edges (a column lined up with the text above and below it), showing a guide for each and saying where it snapped as you drag, and is saved as the grid's `columns` (`<grid columns="2fr 1fr">`). Double-click the line to make the two even again.
- **More columns, or other widths**: give the grid a `columns` attribute: `<grid columns="3">` for three of the same width, or their widths, `<grid columns="1fr 2fr">` (the second twice as wide), `30% 70%`, `200px 1fr`. More cells than columns make more rows: nine cells in `<grid columns="3">` are three rows of three, a gallery of images. Without it, each `<cell>` is a column of its own, eight at most in a row.
- **Auto: as many columns as fit** (a gallery of images): `<grid columns="auto">` shows as many columns of the same width in a row as fit, none narrower than its min width (fewer columns than fit share the whole width), so a wider page shows more of them and a phone fewer. The min width is `min-width`: `xs` (100 px), `s` (160 px), `m` (240 px, the default), `l` (360 px), or px (`<grid columns="auto" min-width="180">`). Its columns are not resized by dragging. Wrap in grid's Gallery offers Auto too.
- **Borders**: two kinds, chosen in the grid's menu. *Lines between the cells alone*: a faint line in the middle of each space between two columns and between two rows, nothing round the grid, the text where it was; kept on its line as `<grid border="inner">`. *Lines round the grid and between its cells*: as a table's, the cells' text a little in from them; kept as `<grid border="1">`. The lines you drag between its columns lie on them.
- **The grid's width and place** are kept on its line too, `<grid width="1100" align="right">`.
- **On a phone** (an editor narrower than the setting *Narrowest editor laid out*), the cells are shown one under another (an Auto grid keeps as many to a row as fit).

Keep the blank lines round a cell's text, as /grid writes them: without them other markdown renderers show its markdown as plain text. Without Silverware Layout, and in other renderers (GitHub, VS Code), the cells are shown one under another and the `<grid>` and `<cell>` lines as text: nothing is lost.

What you should know:

- A grid in a page you embed in another (`![[Other page]]`) is shown with its columns there too; edit it on its own page.
- A grid ends at the first line `</grid>`, wherever it is: a code block in a cell that holds such a line ends the grid there. Grids in grids are not supported yet.
- Links and images in a grid show in their pages' backlinks, and a renamed page or image is renamed in a grid too. Its hashtags are known to SilverBullet (completed, listed, and a paragraph holding one found by a query of its tag); its tasks and list items are not indexed yet.
- A task in a cell is toggled by its box there, as in the page.
- A grid starts on a line of its own, not straight after a paragraph's line: leave a blank line before it (/grid does).

Both settings below change how SilverBullet itself behaves; turn one off to get SilverBullet's own behaviour back. They are in the **Markdown** tab of **Silverware Layout: Settings**.

**Links shown as markdown** (the cursor in a link, so you see its `[[`, `]]` or `](…)`, and every link in the plain markdown view): SilverBullet opens such a link on a click too, which makes it hard to edit. With *A click only places the cursor; Ctrl+click opens the link* on, a click places the cursor there and Ctrl+click opens it; off, a click opens it. A link drawn as a link opens on a click as ever (or `silverware.layout.links.clickPlacesCursor` in your configuration page (`Library/Config`; `CONFIG` in SilverBullet 2.12 and before)).

**Plain markdown view** (SilverBullet shows a page as plain markdown, without formatting: *Editor: Toggle Markdown Syntax Rendering*): SilverBullet still draws grids there, under their markdown. With *Hide grids in this view* on, `<grid>` and `<cell>` stay plain text, like the rest of the page; off, the grid is drawn under its markdown (or `silverware.layout.syntaxMode.hideGrids` in your configuration page).

## Embedded files

Images, videos, PDFs and other files your pages embed or link are drawn by [Silverware Assets](https://github.com/damesene/silverware-libraries/blob/main/silverware-assets/silverware-assets.md), a library of its own: shown full, as a preview or as a card, with a menu. With both installed, a file's width is dragged by the same bar as a table's, and files in a grid's cells are shown as in the page. In a grid's cell the bar is inside the file, at its edge (beside it is the line between the columns), also while you edit the cell; it snaps to a quarter, a half, three quarters and the whole of the cell, and a width snapped to one is saved as that share (`![[photo.png|Photo|50%]]`), so the file follows its cell as the cell grows or shrinks.

## Font size

The dialog's **Font** tab sets the editor's font size: **All pages** for every page (your theme's size until you set one), by its slider or typed in px. Headings, code, tables and charts grow with it.

**Font zoom**: hold Ctrl and scroll over the page, and its font grows or shrinks a pixel a step, as the browser zooms. A label at the bottom left says the size for a moment, and says *default* where it is back at your default. **Ctrl+0** puts the default back. The size you zoom to is this device's alone, kept as the browser keeps its zoom, and never written into your space. On the Font tab, **This device** sets it too, by its slider or typed (on a phone, which has no Ctrl + scroll, that is how you zoom), and **↺** takes it off. Untick *Ctrl + scroll zooms the text*, and Ctrl + scroll zooms the browser again. With the dialog open, Ctrl + scroll and Ctrl+0 set its **This device** row, as its slider does: **Save** keeps it, **Cancel** puts it back.

**Pinch to zoom** (a touch screen): spreading or closing two fingers over the page makes its font larger or smaller, as Ctrl + scroll does. A tap with two fingers still opens the page picker, as SilverBullet does without it (as you lift your fingers, not as they touch); moving two fingers together still scrolls. Untick *Pinch with two fingers zooms the text* on the Font tab to leave two fingers to SilverBullet.

**Files zoom with the text**: the files your pages show (images, previews, PDFs; with Silverware Assets) grow and shrink with this device's zoom, by the share of **This device** in the size of **All pages** (18 px for all pages, 27 px on this device: the files at 150 %). Their sizes in your pages stay as written: an image of `|300` shows 450 px wide at 150 %, and one you widen by its handle meanwhile is written as it would be at 100 %. The **…** of a file and the bar keep their size. Untick *Files zoom with the text* on the Font tab to keep them at their own size.

## Guides

The widths a widget snaps to, and the page's sliders are marked with. Change them in the dialog's **Guides** tab: set a width in its row by its slider (held, it shows the guides on the page as it moves) or type it, in **px** or in **%** of the editor's width (the px / % switch beside it), × takes one away, **+ Add guide** adds one. They show from the narrowest; the last row, **Full width**, is the editor's whole width (the whole pane), a box to tick. A widget snapped to a guide in % keeps that share of the editor (`layout.width: 80%`): in a wider or narrower window it is still at the guide. Saved into your configuration page, in a block of Silverware Layout's own.

Press and hold **Hold to preview** (or hold Space or Enter on it) to see the guides on the page as you typed them, the dialog out of the way meanwhile. **Restore defaults** puts the default ones back (900 px, 1200 px and Full width) once you confirm; **Save** keeps them, as everything in the dialog.

## Settings

In the Configuration Manager (Configuration: Open), under Silverware Layout, or in your configuration page:

```lua
config.set("silverware.layout.textWidth", "1100px")
config.set("silverware.layout.minPaneWidth", 600)
config.set("silverware.layout.guides", { "900px", "1200px", "full" })
config.set("silverware.layout.fontSize", "18px")
config.set("silverware.layout.fontZoom.enabled", true)
```

- `textWidth`: the default text width, in px or % (empty: your theme's).
- `minPaneWidth`: where the editor is narrower than this (px), as on a phone, Silverware Layout sets no width: the text is as wide as the screen. Wider again (a phone turned), the widths come back.
- `guides`: the guides (see above), each a width in px (`"1200px"`), in % of the editor's width (`"80%"`), or `full` for the editor's whole width.
- `fontSize`: the editor's font size on every page, in px (empty: your theme's).
- `fontZoom.enabled`: whether Ctrl + scroll and Ctrl+0 zoom the font (see above).
- `fontZoom.pinch`: whether a pinch with two fingers zooms the font (see above); on by default.
- `fontZoom.scaleFiles`: whether the files a page shows zoom with the font (see above); on by default.
- `links.clickPlacesCursor`: whether a click on a link shown as markdown only places the cursor (see above); on by default.
- `syntaxMode.hideGrids`: whether grids stay plain text in the plain markdown view (see above); on by default.
- `alignments`: where each kind of widget stands without its own, as the **Alignment** tab sets it (kept in a block of Silverware Layout's own in your configuration page).

## Good to know

- A page's own width wins over your theme's, even where your theme sets its width with `!important`.
- As a page is opened in a new window (or the window is reloaded), it shows at your theme's width for a moment, until SilverBullet has loaded its scripts.
