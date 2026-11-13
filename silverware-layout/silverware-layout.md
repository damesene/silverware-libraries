---
name: Library/damesene/silverware-layout
tags: meta/library
version: 1.0.0
description: "Silverware Layout: Columns in a page (/grid), embedded files shown as the original, as a preview or as a card, the width of a page's text (its own or a default for every page) and of its tables, databases, charts and grids, wider or narrower than the text by a handle beside them that snaps to guides of your own; the editor's font size, and font zoom with Ctrl + scroll."
files:
- silverware-layout.js
- silverware-layout-init.md
- silverware-layout-api.md
- silverware-layout-style.md
---
# Silverware Layout

The layout of your pages: columns side by side, how wide a page's text is, how wide each of its tables, databases and charts is, and how large the editor's font is. Give one page a wider text (a page of tables), all of them a width of your own without touching your theme, one table or chart more room than the text has, or zoom the text with Ctrl + scroll.

## Page width

Run **Silverware Layout: Page layout** from the command palette. Its **Page width** tab has two rows:

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
- a chart in its block, a comment `%% layout.width: 1200` (in the Mermaid format; a format of your own that keeps no such line says so, and the width holds until the chart is drawn again).

Without Silverware Layout, each is as wide as the text, its width still kept.

## Columns

Put part of a page side by side: type **/grid** where it should go. A grid of two columns comes in, the cursor in the first:

```markdown
<grid>
<column>

The first column: any markdown, lists, links, images.

</column>
<column>

The second column.

</column>
</grid>
```

- **Put what you have into a grid**: select paragraphs, list items, tasks, images (or put the cursor in one), and run **Silverware Layout: Put into grid**. Pick how:
  - **Gallery**: each block a cell of its own, as many to a row as the columns you pick (2, 3 or 4): a row of images, a board of notes.
  - **Split**: the blocks in their order, cut into the columns you pick by their number (ten tasks in three columns: 4, 3, 3), a list staying a list in each column.

  With Silverware Toolbar, add **Put into grid** to a toolbar and set its *Mode*: the button then asks the number of columns alone.
- **Edit a column where it is**: click into it, and its markdown shows in a field of its own, the rest of the grid as it was. Click elsewhere, or press Esc (or Ctrl+Enter), and it is saved. A click on a link or a tag in it still follows it.
- **See the raw text**: Alt+click a column, and the page shows its markdown, the cursor where you clicked.
- **More columns, or other widths**: give the grid a `columns` attribute: `<grid columns="3">` for three of the same width, or their widths, `<grid columns="1fr 2fr">` (the second twice as wide), `30% 70%`, `200px 1fr`. More columns than you give make more rows: nine columns in `<grid columns="3">` are three rows of three, a gallery of images. Without it, each `<column>` is a column of its own, four at most in a row.
- **The grid's width**: point at it, and the bar beside its right edge makes it wider or narrower, as a table's (see *A widget's width* above); it is kept on its line, `<grid width="1100">`.
- **On a phone** (an editor narrower than the setting *Narrowest editor laid out*), the columns are shown one under another.

Keep the blank lines round a column's text, as /grid writes them: without them other markdown renderers show its markdown as plain text. Without Silverware Layout, and in other renderers (GitHub, VS Code), the columns are shown one under another and the `<grid>` and `<column>` lines as text: nothing is lost.

What you should know:

- A grid in a page you embed in another (`![[Other page]]`) is shown with its columns there too; edit it on its own page.
- A grid ends at the first line `</grid>`, wherever it is: a code block in a column that holds such a line ends the grid there. Grids in grids are not supported yet.
- Links and images in a grid show in their pages' backlinks, and a renamed page or image is renamed in a grid too. Its hashtags are known to SilverBullet (completed, listed, and a paragraph holding one found by a query of its tag); its tasks and list items are not indexed yet.
- A grid starts on a line of its own, not straight after a paragraph's line: leave a blank line before it (/grid does).

## Media

Images, videos, audio, PDFs and other files you embed (`![[photo.png]]`, `![Photo](photo.png)`) can each be shown three ways:

- **Original**: the file itself, as SilverBullet shows it (the image, a player, a viewer).
- **Preview**: smaller (a PDF in a small viewer).
- **Card**: a small card with the file's icon and name, the file itself not shown. A file SilverBullet cannot show (a zip, a document) is a card instead of an error.

Point at a medium, and a **…** button shows at its top right: choose how it is shown there, or open it in a new tab, in a side panel or enlarged. A click on a card or a preview opens the file in a new tab; Shift+click does the same, unless you set otherwise: either can instead show the file in a panel at the window's right (**Show in a side panel**, the page still beside it) or enlarged over the page (**Show enlarged**). Esc or × closes them, and a click beside the enlarged file.

**Its width**: point at an image (or a video, a PDF as the original or as a preview), and the bar beside its right edge makes it wider or narrower, as a table's; it stays where it is and grows to the right (*Width dragged* below sets it centred instead). Let go, and the width is saved as SilverBullet's own size: `![[photo.png|Photo|300]]`.

**Links to files** (`[[report.pdf]]`) show the file's icon before their text, in a grid too (a markdown link, `[report](report.pdf)`, only in a grid). Click the icon for what you can do with the file: open it in a new tab, show it in a side panel or enlarged, or **Show as embedded** (`[[report.pdf]]` becomes `![[report.pdf]]`); a click on the link's text opens it as SilverBullet does. An embedded file's **…** menu has **Show as a link** the other way (its alt text kept as the link's, its size and view left out). The Media tab turns the icons off.

What you choose is kept in the embed itself, after SilverBullet's own size:

```markdown
![[report.pdf|Report||{ view: icon }]]
![Photo|300|{ view: preview }](photo.png)
```

SilverBullet reads only the alt text and the size, so without Silverware Layout every file shows as SilverBullet shows it, at its size: nothing is lost. Keep the three parts, even an empty one (`||`): with two, SilverBullet would take the size for the alt text.

**For all files, or for one kind of file**: run **Silverware Layout: Page layout** and open its **Media** tab. Set how files are shown, what a click and a Shift+click do, whether a width dragged stays at the start or is centred, a preview's height (one with a height of its own, `|200x120`, keeps it), and what a card shows besides the file's name (its icon, its size, its date), for all files; then, per kind (image, video, audio, PDF, file), anything other than that ("Default" follows all files). What a file's own `view` says wins over both.

Media in a grid's columns are shown the same way, and their bar makes them wider or narrower within their column: it snaps to a quarter, a half, three quarters and the whole of the column's width.

**SilverBullet's markdown as written** (*Editor: Toggle Markdown Syntax Rendering*): SilverBullet still draws embedded files and grids in that mode; Silverware Layout hides them there, so you see their markdown alone.

## Font size

The dialog's **Font** tab sets the editor's font size: **All pages** for every page (your theme's size until you set one), by its slider or typed in px. Headings, code, tables and charts grow with it.

**Font zoom**: hold Ctrl and scroll over the page, and its font grows or shrinks a pixel a step, as the browser zooms. A label at the bottom left says the size for a moment, and says *default* where it is back at your default. **Ctrl+0** puts the default back. The size you zoom to is this device's alone, kept as the browser keeps its zoom, and never written into your space. On the Font tab, **This device** sets it too, by its slider or typed (on a phone, which has no Ctrl + scroll, that is how you zoom), and **↺** takes it off. Untick *Ctrl + scroll zooms here*, and Ctrl + scroll zooms the browser again. With the dialog open, Ctrl + scroll and Ctrl+0 set its **This device** row, as its slider does: **Save** keeps it, **Cancel** puts it back.

## Guides

The widths a widget snaps to, and the page's sliders are marked with. Change them in the dialog's **Guides** tab: set a width in its row by its slider (held, it shows the guides on the page as it moves) or type it, in **px** or in **%** of the editor's width (the px / % switch beside it), × takes one away, **+ Add guide** adds one, **Full width** is the editor's whole width. They show from the narrowest. A widget snapped to a guide in % keeps that share of the editor (`layout.width: 80%`): in a wider or narrower window it is still at the guide. Saved into your CONFIG, in a block of Silverware Layout's own.

Hold **Preview** (press it, or hold Space or Enter on it) to see the guides on the page as you typed them, the dialog out of the way meanwhile. **Default guides** puts the default ones back (900 px, 1200 px and Full width) once you confirm; **Save** keeps them, as everything in the dialog.

## Settings

In the Configuration Manager (Configuration: Open), under Silverware Layout, or in your CONFIG:

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

## Good to know

- A page's own width wins over your theme's, even where your theme sets its width with `!important`.
- As a page is opened in a new window (or the window is reloaded), it shows at your theme's width for a moment, until SilverBullet has loaded its scripts.
