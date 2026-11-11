# Silverware Table: the core and the SilverBullet adapter

The model of layers, hosts and the write pipeline is in `silverware-table/CLAUDE.md`. Here: what the core's code must keep that the code does not say.

## Rules for the core

- The core names no module and touches no table's DOM itself: rendering is the adapter's (`core/adapter.ts`, `core/silverbullet/`), SilverBullet DOM assumptions are `dom.ts`'s. A module-specific need becomes a generic hook or host function in `core/feature.ts`.
- Modules get the host from `modulehost.ts` (members forwarded, methods bound once, fields read live, the module's own `offer`). Metadata access per owner is `metaaccess.ts` (`ownMeta`): an owner reads and writes only its own attributes.
- `core/silverbullet/modules/` may touch the rendered DOM; the same rules about rows apply (through `TableRows`, not queries).

## Tables and their rows

- `TableRows` (`rows.ts`) keeps each table's rows as SilverBullet rendered them, taken in the MutationObserver callback before layout (`tableAdded`), so `bodyRows`/`shownRows`/`cellAt` have every row in the document or not. `rowNeeded` puts one back before it is measured, `rowsAttached` tells rows came back, `holdInDocument` keeps a dragged row; `placeRows` lets a feature place rows itself (largeTables).
- `scan()` compares the tables enhanced with the last scan and calls `layoutChanged` where one is gone (another page opened, a table out of CodeMirror's viewport), so what features placed for it goes.
- Tables inside the core's own floating elements (a theme preview) are not enhanced (`ownTable`).
- A table drawn by a feature (`DRAWN_CLASS`, the sheet's) stands for SilverBullet's table of its key (`tableFor`, `widgetForKey`, `shownTables`). SilverBullet's table under it, rendered anew, is only registered and `enhanced` (`covered`: laying both out cost 210 → 160 ms for 400 rows); once the drawn one goes, every such table is shown as itself (`showEnhanced`, `drawnKeys`). `STAND_IN_CLASS` copies are left out by the core.

## Writing

- Writes go through `write()` in the controller; see the invariants in the parent file. Extras: `insertTable` (a new table after another or at a `TextPosition`, one edit, through `beforeWrite`), `deleteTable` (asks with `tableDeleteWarning`, deletes the blank line after it, other tables changed in the same edit), `editBeyond` (a cell past the last row/column, written with the table grown in one write; `claims` in WriteOptions; nothing written while empty), `takeEditor` (the editor's value saved in the caller's write), `pendingEdits` (edits a feature holds, applied to the table `write()` read so any write takes them along; `tableOf(info)` is the table with them).
- `structure.ts`: structural edits as functions over `ModelHost` (rows above bottom pins, columns left of right pins: `growTo`).
- History markers (`modules/history.ts`): the editor's cursor is put outside the table before each write (after it, else before it where the edit does not start): CodeMirror keeps a cursor before text inserted at its place, which would put it in the table and show its markdown.
- `anchor.ts`: a table written keeps its top's offset in the scroller, restored after it renders anew and for `ANCHOR_MS` or until the user wheels, touches, presses or types (CodeMirror scrolled while measuring the new rendering). Not for drawn tables: their feature places them.

## The page's view and floating controls

- `viewBounds` (geometry.ts) is CodeMirror's scroller (`.cm-scroller`, below SilverBullet's top bar) even when the page is too short to scroll (`scrollParentOf` finds nothing; the window's top would put the toolbar over the top bar), cut to the visual viewport (on-screen keyboard). A table laid over the window (position fixed) counts as in view across the window.
- The toolbar (`toolbar.ts`) is built at once and placed in the next frame; it keeps `BAR_CLEAR` clear of the + at the table's right edge and never goes out left of the view. Names in it follow the `toolbarNames` setting (`shift` by default: while Shift alone is held, `holdShift`); they are always in the ⋯ menu.
- Hovering a table includes `HOVER_ABOVE` (20 px) above its header, where its label tab is.
- **The +** (`insert.ts`): shown in a lane of its own beside the grips (`INSERT_LANE_*`), quiet until the pointer is on it; quiet + under the last row / right of the last column while a cell is hovered, selected or edited. Its press is taken on `mousedown` (SilverBullet would put the cursor into the table) except on a line of page text the band reaches over (`inTextLine`). Rows and columns scrolled under what is held over them (`heldBounds`) get no grip or +: the controls are in `body`, so CSS cannot put the held header above them. Recomputed on scroll (`followPointer`); none while a grip menu is open.
- `pressedWith` sets `data-swt-pointer` on `<html>`: CSS shows touch or mouse controls without modules knowing each other.
- `dialog.ts`: a feature's modal dialog keeps its keys and presses; the cell editor stays open meanwhile (`dialogOpen`: its blur is not leaving it).
- `editor.ts`: in the cell (input) or its popup (textarea in a floating panel, F2 / `toPopup`). In the popup the keys are the text's (Ctrl+arrows, Ctrl+Alt+arrows, Ctrl+Enter do nothing to the table). The popup is cut as its cell is (`shownPart`) and placed before features' `layoutChanged`, which place by it.

## Over the window (`overwindow.ts`: fullScreen, the sheet's board)

- One at a time per document (`claimWindow`/`releaseWindow`). The table stays where SilverBullet rendered it; CSS lays its box over the window (position fixed), so its scroll, sticky header and controls work as in a box. CodeMirror's scroller is a stacking context under SilverBullet's top bar, lifted while it holds such a table (`:has`).
- Rendered anew, the table is found by the same `data-pos`, else by its place among the page's tables, and shown so at once (`tableAdded`), confirmed by key once enhanced. Missing is not gone (several tables written are enhanced one by one): it ends on `pageLoaded` or after `GONE_MS` without a table of its key.
- CodeMirror removes the table from the DOM once the page under it scrolls far enough (its place in the text counts), see *Which tables are in the DOM* in the parent file.
- Letters above the header are an `OUT_OF_LINE` element per header cell (so they move with the sticky header); row numbers a fixed layer placed in `layoutChanged`.

## Sticky header and pinned rows (`modules/sticky.ts`)

- Native `position: sticky` for a table that fits its width (smooth on a phone, where a header moved after scroll events lags); a transform after each scroll for one that scrolls in its box; `position: sticky` against the box for a table laid over the window.
- Held `STICKY_GAP` (66 px, kept in step with the CSS) below the view's top, or less for a table near the page's top (`--swt-sticky-top`). Bottom rows subtract the scroller's bottom padding (`--swt-sticky-bottom`: SilverBullet's 360 px pushed them to the table's top).

## Cells and headers

- `layOutCells` (in `applyView`, after any feature replaced content) wraps each body cell's content in `div.swt-cell-content`; Silverware Table's own elements (`UI_CLASS`) stay outside. A header is always one line (`layOutHeaderCell`: `span.swt-head` with the name cut by an ellipsis and the inline icons); `OUT_OF_LINE_CLASS` elements (pin mark, width handle, fill handle) stay in the cell at its edge.
- Column widths (`applyColumnWidths`): with a width for every column the table is laid out by `colgroup.swt-fixed-columns` (`table-layout: fixed`, percentages of their sum, the sum as the table's `min-width`) and no cell is styled; with some, those columns' cells (and their content boxes) are. The sheet's drawn tables have a colgroup of their own (`swt-sheet-cols`).
- longText (`modules/longtext.ts`) sets the limits and marks overflowed cells `swt-cut` (after layout, on resize, by a ResizeObserver, after fonts load).
- largeTables (`modules/largetables.ts`): rows out of view replaced by spacer rows, taken out in `tableAdded` before layout; header min-widths keep columns from changing as rows come in. A row held in the document stays.
- `modules/expressions.ts` re-evaluates `${…}` cells after `page:index`.

## The sheet view (`modules/sheet.ts` + `features/sheets.ts` + `sheet/`)

Design, limits and decisions: docs/silverware-table-sheets.md. Not obvious from the code:

- The board draws each table of the sheet itself from the page's text (`drawn.ts`, cells by `cells.ts`: plain cells as text, the rest in one `bridge.markdownToHtml` call per table), so tables SilverBullet keeps out of the DOM show too; links go to `bridge.navigate`.
- The grid's reach only grows while the board shows (a column widened by a write would change how many empty columns follow, and the scrollbars jumped). Rows are one height; columns are the sheet's `sheet.width.*` (kept in the sheet's first table in the page, handed over in the same edit whenever that changes) else the widest table's, capped.
- After every write and on any page change, changed tables are drawn anew at their place before insertion (else a far table scrolled the board), with a stand-in copy until enhanced (SilverBullet enhances a frame later, as settings are read through Lua). Not under a cell being edited (`putOff`).
- Empty cells: a press selects or edits them; next to a table it grows that table (`editBeyond`), elsewhere it makes a new table (`writeNew` via `insertTable`, key reserved as the editor opens). A table alone becomes `Sheet1` in the same edit. Needs the metadata setting.
- A growing table moves the others on its sheet in the same edit (`roomFor` in sheet/layout.ts, the one place of that rule; nothing moves back). Moves over another table are refused (`validatePlace`).
- Tabs switch with Ctrl+Shift+PageUp/PageDown (a browser keeps Ctrl+PageUp/PageDown). Removing a sheet moves the board to the next tab first, else its refresh would end it.
- Formulas see the sheet's addresses through `addressFrame` (translated by the formulas module, `framedOut`/`framedIn`); a formula it cannot show so stays as stored.

## Touch

- `touch-keyboard.ts` is a workaround, not a feature (see the parent file): it takes the editor's focus on a touch in a table, does not hand it back, and scrolls the edited cell back for a moment after the editor opens or the view resizes.
- `press.ts` `watchPress` tells taps and long presses (`TAP_MS`, `LONG_PRESS_MS` 550) from pointer events.
