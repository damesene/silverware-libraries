# Silverware Database: changelog

## 1.3.1 (2026-11-21)

- Shares updated code with Silverware Table 1.4.0; nothing changes in use.

## 1.3.0 (2026-11-19)

- New property type **Files & media**: images, PDFs, documents, any file of your space or an address of the web, several in one value. Tables, lists and cards show them as small pictures (a PDF, Word or Excel file as its first page with Silverware Assets and its viewer), the item's panel larger; a press opens a file in Silverware Assets' side panel.
- Files are added in a small panel by the value (each with a menu: view the original, download, remove; dragged to reorder), dropped on a cell, a card or the item's panel, or pasted on a cell. Uploads go through Silverware Assets' dialog into the database's own `files` folder; each file may get a title.
- Files are kept in the item's page as wiki links, so renaming a file or the database keeps them linked, and queries read them as any link.
- Removing an item offers to delete the uploaded files only it used; deleting a database can delete its uploaded files too (a box, not ticked by default).
- Files zoom with the text where Silverware Layout zooms files.
- **Convert selection to database** reads links to files as a Files & media property.
- A table's row grip no longer takes a column of its own: it shows at the left edge of the name, on its first line, so names start close to the table's edge.
- Fixed: letting go of a dragged row (or cancelling the drag with Esc) over a name no longer starts renaming it; a file's card in a cell reacts to the pointer on the card alone, not up to the cell's end.
- Panels, the peek's sidebar and its properties box scroll with a thin scrollbar, the same in every Silverware plugin.

## 1.2.2 (2026-11-18)

- In an item's peek, files zoom with the text, as in the page.
- Headings, bold text, code and `---` in an item's content drawn as in the page.

## 1.2.1 (2026-11-18)

- Fixes: a database block shows its database once SilverBullet has indexed it (opened before that, it stayed "not found" until reloaded); moving properties quickly in the peek with Alt+↑/↓ no longer fails with "changed elsewhere"; the full screen icon works when pressed right after Esc.
- The peek's content keeps the page's line spacing and list layout.

## 1.2.0 (2026-11-17)

- Works with SilverBullet's next version (3.0) as well as 2.12.1: settings are saved in `Library/Config` there, SilverBullet's own pages (under `Library/`) are not offered as references, and your own views and types go in a `space-lua` block on a page under `Library/`.
- The peek's content is edited in Silverware Editor where it is installed (markdown highlighted, tasks you tick, lists continued, links to pages completed), drawn in your page's look.
- Images and other files in an item's content are drawn in the peek as in the page (by Silverware Assets where installed, else images alone); a link clicked there opens its page or file (Ctrl+click: a new tab).
- With Silverware Toolbar, its toolbar shows for text selected in the peek.
- A SilverBullet shortcut pressed in the peek (Ctrl+K, Ctrl+/, …) now says it does nothing there.
- With Silverware Layout: a database placed at the left, in the middle or at the right of the text, from the menu of the bar beside it.
- Fixed: a row's remove button kept its size at a smaller font; the peek's content is written when it closes after a file's view changed in it.

## 1.1.1 (2026-11-12)

- Fixed: a database's menus, value editors and suggestions show over a table's header and over other plugins' controls (a table's tab, the width handle of Silverware Layout).

## 1.1.0 (2026-11-12)

- With Silverware Layout: a database wider or narrower than the text, by the bar beside it; its width a line of its block.
- Rows follow the editor's font size, as a table's do; the grip keeps its size.
- Fixed: a table's + and a chart's toolbar no longer show over a database's peek.

## 1.0.0 (2026-11-11)

First versioned release, still in development.

- Databases of pages: an item a page, its properties the page's frontmatter.
- Shown as a table, a list or a board, or by views of your own; made, changed and undone safely.
- Converting existing markdown (lists, tasks) into items, and items copied back as tasks.
