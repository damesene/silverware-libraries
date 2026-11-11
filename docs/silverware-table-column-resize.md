# Silverware Table: resizing columns

Agreed 2026-11-11. Dragging the edge between two columns changes them (and their neighbours) only, the table keeping its width; the last column's edge is the table's. Widths set in one box (full screen, a wider window) show in proportion in another. Changing the table's own width comes later (see the end); nothing here may store widths in another measure.

## Why the other columns moved

SilverBullet's table is `width: 100%` with automatic layout. A drag gave the dragged column a width and left the others automatic, so the browser spread the rest of the table's width over them: every other column changed as one was dragged, and after the release they stayed automatic.

## Behaviour

- **The table's width does not change.** Dragging the edge between columns `i` and `i + 1` moves only that edge: what one side gains the other loses.
- Dragging right: column `i` grows, column `i + 1` shrinks down to its minimum, then `i + 2`, and so on. Dragging left: column `i` shrinks to its minimum, then `i - 1`, and so on; column `i + 1` takes what they gave.
- **Everything is computed from the widths at the press**, never from what is shown now: dragging back gives a neighbour back its width exactly.
- **A column's minimum is 80 px** (`MIN_WIDTH`), whatever its header: a header narrower than its name is cut with an ellipsis and shows its name as its title (changed 2026-11-11: the header's need held the column first, so a column with a long name could not be made narrower). A column already narrower than 80 px cannot shrink, only grow.
- **The last column's handle is the table's right edge** (added 2026-11-11: a table wider than its box, set so somehow, could not be made narrower but by Reset column widths or its metadata): it changes the last column alone, and the table's width with it. Dragged right the table gets wider than its box and scrolls sideways (the one way large tables work in markdown); dragged left it narrows down to its box, not below (a table already narrower than its box: not below what it is), the column not under 80 px (`movedTableEdge`).
- **Double-click an edge, or *Fit to content* in a column's menu**: the column as wide as its widest text (body cells at most the longText module's maximum width) and its header whole, by moving the edge after it, as a drag of it would (the last column: the table wider, or narrower down to its box). Only rows in the document are measured (largeTables). It replaced *Auto width* for a column: a column without a width in a table whose others have one took whatever room was left, and laid the table out a second way.
- *Reset column widths* in the table's menu makes every column automatic again.
- On release **every column keeps its width** (in whole pixels, each edge rounded down so their sum never passes the table's box), and so does **the width of the box the table had** (`widths.box`): stored where the table can take them; with the metadata setting off, what the table cannot take holds for the view only.
- **A column inserted** into a table with a width for every column gets an equal share of their sum in the same write, the others narrower in proportion; **a column deleted** takes its width with it and the box shrinks alike, so the table fills as much of its box as before (`widthsAfterEdit`, the module's write step; widths held for the view and their box follow the same way, `columnsMoved`). Where only columns went, the step leaves the others' widths to the core's write step, which carries them (written by the step, a width equal to the one a column of the same name had would be taken for that column's). **One column left**: the table is automatic again (its width is the table's; a share of the box kept from the columns gone would mean nothing). With the metadata setting off a new column gets no width stored (the table is laid out by its cells again), the others' stored widths are made narrower all the same.
- The box is stored rounded up and the widths rounded down, so the table never passes its box by a rounding.
- A drag or fit whose box could not be measured keeps the box stored.
- The sheet view is unchanged (its grid has widths of its own; its handles set one column, a double-click makes it automatic).

## How it is shown

- **Every column has a width**: the adapter puts a `<colgroup>` in SilverBullet's table, `table-layout: fixed`, each `<col>` its share of the widths' sum (a percentage). The table is `sum / box` of the box it has now (100% without a stored box): where the widths were set it is exactly as it was then (wider than its box too, scrolling sideways), in a wider box (full screen) it widens in proportion. In a narrower one (the page after full screen, another window, a phone) it narrows in proportion, but **no column below the least of its header's need (at least 80 px, at most 160 px: `HEADER_FLOOR_MIN`, `HEADER_FLOOR_MAX`) and the width it was set to**: those columns are held there and the others share the rest (`shrunkWidths`); where the held columns alone are wider than the table, the table is their sum wide and scrolls sideways (`min-width`). So a header that showed whole where its widths were set shows whole on the page, a long name does not take the others' room, and a column set narrower than its header stays so. Nothing is written when the box changes. No cell gets a style: a frame of a drag changes a few `<col>`s, whatever the rows. Text too long for a cell is cut by CSS (an ellipsis with the longText module) or wraps.
- **Some columns have a width** (stored before 2026-11-11, or a column added with the metadata setting off): as before, automatic layout, every cell of a sized column styled. The first drag gives every column a width.
- **None**: automatic, no colgroup.
- The holding is done after layout (`core/silverbullet/columns.ts`: in the next frame after the table's view is applied, and when its box resizes, a ResizeObserver): the headers' needs read for every table due, then the columns' shares written, one layout. The same pass gives each header cut (an ellipsis, whatever cut it) its name as its title (with a look's title of the header cell after it), and takes it back once it shows whole. Where it changed the columns, what is placed by them follows (the pinned columns' offsets, longText's cut cells: `columnsResized`). What a table's widths and box came to is kept and shown at once when it is rendered anew after a write, so it is laid out once, not first by its shares and then held.
- What the headers need is read with a sized header's line let go of its width for the read (all headers in one layout); what a column's text needs, with each body cell's box at `max-content` for the read.
- largeTables keeps no header min-widths for a table laid out by its columns: they would hold the columns once it is laid out by its cells again.

## Later: the table's room

The stored widths are pixels of the box in `widths.box`, so their sum over the box is the table's share of it (more than all of it for a table wider than its box). Making the room a table is rendered into wider than the page's text (as Confluence's wide and full-width tables) is a feature of its own, not done: the box is that room, so a table filling its box fills the wider room, its columns in proportion. Nothing here changes for it.

## Code

- `features/widths.ts`: the drag (`movedEdge`, `wholePixels`), Fit to content (`fittedWidths`), the write step (`widthsAfterEdit`). It asks the host for the columns as shown (`measureColumns`: widths, what headers need, the box), what a column's text needs (`columnContentWidth`), and shows widths for now (`showColumnWidths`).
- The adapter's `applyColumnWidths` lays the table out by its colgroup where every column has a width (`fixColumns`).
