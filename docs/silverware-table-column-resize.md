# Silverware Table: resizing columns

Agreed 2026-11-11. Dragging a column's edge changes that column and its neighbours only; the table keeps its width. Widths set in one box (full screen, a wider window) show in proportion in another. Changing the table's own width comes later (see the end); nothing here may store widths in another measure.

## Why the other columns moved

SilverBullet's table is `width: 100%` with automatic layout. A drag gave the dragged column a width and left the others automatic, so the browser spread the rest of the table's width over them: every other column changed as one was dragged, and after the release they stayed automatic.

## Behaviour

- **The table's width does not change.** Dragging the edge between columns `i` and `i + 1` moves only that edge: what one side gains the other loses.
- Dragging right: column `i` grows, column `i + 1` shrinks down to its minimum, then `i + 2`, and so on. Dragging left: column `i` shrinks to its minimum, then `i - 1`, and so on; column `i + 1` takes what they gave.
- **Everything is computed from the widths at the press**, never from what is shown now: dragging back gives a neighbour back its width exactly.
- **A column's minimum**: what its header needs to show its name and icons whole, at least 40 px (`MIN_WIDTH`). A column already narrower than that cannot shrink, only grow. A header being edited at the press counts as 40 px.
- The last column has no handle: its right edge is the table's (a table of one column has none).
- **Double-click an edge, or *Fit to content* in a column's menu**: the column as wide as its widest text (body cells at most the longText module's maximum width) and at least its minimum, by moving the edge after it (the last column: the edge before it), the neighbours giving or taking as in a drag. Only rows in the document are measured (largeTables). It replaced *Auto width* for a column: a column without a width in a table whose others have one took whatever room was left, and laid the table out a second way.
- *Reset column widths* in the table's menu makes every column automatic again.
- On release **every column keeps its width** (in whole pixels, each edge rounded down so their sum never passes the table's box), and so does **the width of the box the table had** (`widths.box`): stored where the table can take them; with the metadata setting off, what the table cannot take holds for the view only.
- **A column inserted** into a table with a width for every column gets an equal share of their sum in the same write, the others narrower in proportion; **a column deleted** takes its width with it and the box shrinks alike, so the table fills as much of its box as before (`widthsAfterEdit`, the module's write step; widths held for the view and their box follow the same way, `columnsMoved`). Where only columns went, the step leaves the others' widths to the core's write step, which carries them (written by the step, a width equal to the one a column of the same name had would be taken for that column's). **One column left**: the table is automatic again (it has no handle and no Fit to content). With the metadata setting off a new column gets no width stored (the table is laid out by its cells again), the others' stored widths are made narrower all the same.
- The box is stored rounded up and the widths rounded down, so the table never passes its box by a rounding.
- A drag or fit whose box could not be measured keeps the box stored.
- The sheet view is unchanged (its grid has widths of its own; its handles set one column, a double-click makes it automatic).

## How it is shown

- **Every column has a width**: the adapter puts a `<colgroup>` in SilverBullet's table, `table-layout: fixed`, each `<col>` its share of the widths' sum (a percentage). The table is `sum / box` of the box it has now (100% without a stored box): where the widths were set it is exactly as it was then (wider than its box too, scrolling sideways), in a wider box (full screen) it widens in proportion, in a narrower one (another window, a phone) it narrows in proportion until its narrowest column would be under 80 px (`SHRINK_FLOOR`, or the column's width if less), then it scrolls sideways (`min-width`). Nothing is written when the box changes. No cell gets a style: a frame of a drag changes a few `<col>`s, whatever the rows. Text too long for a cell is cut by CSS (an ellipsis with the longText module) or wraps.
- **Some columns have a width** (stored before 2026-11-11, or a column added with the metadata setting off): as before, automatic layout, every cell of a sized column styled. The first drag gives every column a width.
- **None**: automatic, no colgroup.
- What the headers need is read with a sized header's line let go of its width for the read (all headers in one layout); what a column's text needs, with each body cell's box at `max-content` for the read.
- largeTables keeps no header min-widths for a table laid out by its columns: they would hold the columns once it is laid out by its cells again.

## Later: the table's own width

The stored widths are pixels of the box in `widths.box`, so their sum over the box is the table's share of it. A table of its own width (narrower or wider than its page) is that same data with a sum other than the box: dragging the table's edge would scale the widths (or change the last column) and keep the box. Whether such a table follows its box as one that fills it does (full screen) or keeps its pixels is decided then; it may need an attribute of its own. Nothing else changes.

## Code

- `features/widths.ts`: the drag (`movedEdge`, `wholePixels`), Fit to content (`fittedWidths`), the write step (`widthsAfterEdit`). It asks the host for the columns as shown (`measureColumns`: widths, what headers need, the box), what a column's text needs (`columnContentWidth`), and shows widths for now (`showColumnWidths`).
- The adapter's `applyColumnWidths` lays the table out by its colgroup where every column has a width (`fixColumns`).
