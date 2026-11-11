# Silverware Table: resizing columns

Agreed 2026-11-11. Dragging a column's edge changes that column and its neighbours only; the table keeps its width.

## Why the other columns moved

SilverBullet's table is `width: 100%` with automatic layout. A drag gave the dragged column a width and left the others automatic, so the browser spread the rest of the table's width over them: every other column changed as one was dragged, and after the release they stayed automatic.

## Behaviour

- **The table's width never changes.** Dragging the edge between columns `i` and `i + 1` moves only that edge: what one side gains the other loses.
- Dragging right: column `i` grows, column `i + 1` shrinks down to its minimum, then `i + 2`, and so on. Dragging left: column `i` shrinks to its minimum, then `i - 1`, and so on; column `i + 1` takes what they gave.
- **Everything is computed from the widths at the press**, never from what is shown now: dragging back gives a neighbour back its width exactly.
- **A column's minimum**: what its header needs to show its name and icons whole, at least 40 px (`MIN_WIDTH`). A column already narrower than that cannot shrink, only grow. A header being edited at the press counts as 40 px.
- The last column has no handle: its right edge is the table's (a table of one column has none; Auto width in its menu still applies).
- On release **every column keeps its width** (the widths shown at that moment, in whole pixels, each edge rounded down so their sum never passes the table's box), so nothing moves after the release: stored where the table can take it; with the metadata setting off, columns without a stored width keep theirs for the view only (as before).
- Double-click (Auto width) and Reset column widths stay: a table with some columns automatic is laid out as before.
- The sheet view is unchanged (its grid has widths of its own).

## How it is shown

- **Every column has a width** (after a drag, or a drag in progress): the adapter puts a `<colgroup>` in SilverBullet's table, `table-layout: fixed`, each `<col>` its share of the stored widths' sum (a percentage), the table at least that sum wide (`min-width`). On a wider page the columns grow in proportion; on a narrower one the table scrolls sideways, as a wide table does now. No cell gets a style: a frame of a drag changes a few `<col>`s, whatever the rows. Text too long for a cell is cut by CSS (an ellipsis with the longText module).
- **Some columns have a width**: as before (automatic layout, every cell of a sized column styled).
- **None**: automatic, no colgroup.
- What the headers need is read with a sized header's line let go of its width for the read (all headers in one layout), so a column sized in a partly sized table measures as it would be.
- largeTables keeps no header min-widths for a table laid out by its columns: they would hold the columns once it is laid out by its cells again.

## Code

- `features/widths.ts`: the drag. At the press it asks the host for the columns' widths and their headers' needs (`measureColumns`), then shows all widths each frame (`showColumnWidths`), and stores all of them on release.
- `ModelHost.measureColumns(info)` (new): each column's shown width and the width its header needs. `ModelHost.showColumnWidths(info, widths | undefined)` replaces `showColumnWidth`.
- The adapter's `applyColumnWidths` picks the fixed layout where every column has a width; `applyColumnWidth` goes.
