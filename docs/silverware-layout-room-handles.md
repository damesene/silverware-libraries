# Silverware Layout: a widget's handle in a grid's cell, its width a share of the cell

Decided with the user 2026-11-16, after a file's handle in a grid's cell was found taken over by the grid as the
pointer crossed the cell to it (fixed apart: `fix(layout): a file's handle in a grid's cell kept as the pointer crosses
the cell to it`).

## Why

- **A widget's handle stood on the cell's divider.** A widget's bar is beside its right edge, 6 px out; a file as wide as
  its cell (or nearly) had its bar exactly on the grip between the grid's columns, both alike: neither told which was
  which, nor which answered.
- **A width of a whole cell did not follow the cell.** A drag in a cell writes pixels (`![[photo.png|Photo|340]]`); the
  cell widened (its columns, the window), the file kept 340 px, though it was set as wide as its cell.
- **No handle in a cell being edited.** Its field is Silverware Editor's, drawn in a shadow root: Silverware Layout
  looks for widgets in the page's content, and the pointer's events reach it from the field as a whole (the grid's);
  Silverware Assets writes no width or alignment from a field.

## Decided (the user, 2026-11-16)

1. **In a cell, a widget's handle inside it, at its right edge** (its left one where it stands at the right), of a look
   apart from the column's grip, so the gap between cells is the grid's alone; outside a grid, as it is (beside it).
   Every file in a cell has its own, each on its own edge.
2. **A width snapped to a quarter of the cell (25, 50, 75, 100 %) written as a percent**, so the file follows its cell as
   it changes; a width not snapped stays in px. Outside a grid, as it is.
3. **The percent in SilverBullet's own size** (`![[photo.png|Photo|50%]]`): SilverBullet reads it since 2026-10-12
   (main); 2.12.1 reads `50%` as 50 px, which matters only without Silverware Layout and Assets (a grid needs them
   anyway). Not in Silverware Assets' metadata.
4. **A handle in a cell being edited** too, after 1 and 2.

## Column dividers (the user, 2026-11-16)

A grid's divider had the widget handle's grip, a short grey bar in the gap at the grid's middle; beside a grid, at the
same height, the grid's own handle, alike: the two read as a pair, neither told from the other. Decided:

- **A boundary is a line**, as a table's column border is (Google Docs, Notion's columns): the divider draws no grip,
  nothing at rest; pointed at or dragged, a line over the grid's height in the accent, the column's cursor
  (`col-resize`). Its guides and ratios while dragged as before.
- **A grip is a widget's width**: the handle beside a grid (a table, a database, a chart alike), a light one inside a
  file in a cell (a preview's grey and fainter: its menu alone). Its click opens its menu.
- **A cell's grip** stays at its top edge, lying: its menu.
- **A touch screen** (no pointing): while the grid has the focus, each divider's line faint with a round knob at the
  middle of the grid in view, what a finger takes.
- Files in a cell keep their handle inside them: outside, a full cell's file has its bar in the gap, where the divider
  is taken, and a right column's file beside the grid's own handle.

## Steps

1. [x] The handle inside a widget in a room (`ui/handle.ts` `place`), its look (style page); UI test.
2. [x] A snapped width in a room written as a percent, read and shown as a share of the room (Layout's width model,
   the drag; Assets' provider writing and reading `NN%`); unit and UI tests.
3. [x] The handle in a cell being edited (the pointer's real target through a field's shadow root; a file of a field a
   widget whose width and alignment are written into the field's text).
4. [x] Screenshots, review, commits on the user's word.
5. [x] A column divider a line alone, its grip gone (*Column dividers*).

## Findings

- **A share of a medium is of the box it is in**, as SilverBullet's own `|50%` is: Layout shows a share of a widget of
  its own size (`unsized: "own"`) and one in a room as that share, not of the pane (`host/widgets.ts` `show`). Outside
  a grid a medium's guides are written as the pixels they show (`snapTargets`), so no share of the pane reaches
  SilverBullet's size, which would read it as of the medium's box.
- **A cell's width follows the window only past a point**: at 900 px the text's width held the grid's columns as they
  were (366 px); at 700 they narrowed (309 px) and the file with them. The UI test narrows to 700.
- **What is drawn in a field is in its shadow root**: the document's events, `elementFromPoint`, `contains` and
  `closest` stop at its host (the field as a whole, the grid's). `shared/shadow.ts` reads past it (the event's composed
  path, the element at a point in an open root, what a node is in through its root's host); Layout's widgets watch the
  open shadow roots in the content (a MutationObserver stops at them too) and lay out what is drawn there, marked
  `data-swl-in-shadow`, sized by rules of their own (the field puts the page's rules naming `swl-` in its root; those
  of the content do not reach in).
- **The editor draws an embed in an inline block shrunk to it**: a share of it was of itself (1 px). Its box is marked
  as the line's (`data-swl-align-holder`, as an aligned widget's in the page) whatever its alignment, so a share is of
  the field's line, the room Assets gives (`blockAround`).
- **The handle acts on the field**: marked as its companion (`shared/editor.ts`) while it is for a widget in a shadow
  root, and its menu with it (`showPopup` takes a companion's as a field's: the focus given back as it closes), so a
  press on it does not leave the cell; what it writes goes into the field's text (`EmbedEdit`), the cell written as it
  is left.
