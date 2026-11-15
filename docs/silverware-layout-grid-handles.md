# Silverware Layout: a grid's handles in place of its cells' "…"

Agreed with the user 2026-11-15 and built the same day. A grid's menus move from a "…" on each cell (in the way,
a phone's above all, where it is always shown) to handles, one for each level of the grid, as Layout's handle already
is for any widget's width. Files (Silverware Assets) keep their "…" as it is: the user's choice, it works well there.

## Now (2026-11-15)

- **A cell's "…"** (`src/grid/ui/cellmenu.ts`), at its top right as the pointer is over it, always on a touch screen.
  Its menu, titled *Column n of m*:
  - Edit markdown (Alt+click)
  - Move left, Move right, Add a column after it, Move out of the grid
  - Columns: a row of choices, Auto, 2 to 8 (the one set active; changed 2026-11-15, see *Columns redone*)
  - Borders (checked where on), Add a column at the end, Remove the grid, its content kept
- **The grid's handle** (Layout's for any widget, `src/ui/handle.ts`): dragged, its width; clicked, its menu: Align
  (left, centre, right), Width: as the page's.
- **A divider between two columns** (`src/grid/ui/dividers.ts`): dragged, the two columns' shares, snapping; a double
  click makes them even. Its grip rides in the part of the grid in view.

## Proposed

Each level of the grid its own handle, a click its menu, a drag what the level's size is:

| Level | Handle | Drag | Click |
| --- | --- | --- | --- |
| The grid | Layout's handle beside it (as now) | its width | the grid's menu |
| A column | **new**: a small grip at the middle of the column's top edge, half outside the grid | none (moving a column by it: later) | the column's menu |
| Two columns' border | the divider (as now) | their shares | double click: even (no menu) |

**The grid's menu** (the handle's, Layout's own sections first):

```
Align   [ left | centre | right ]
Width: as the page's                  (where it has one)
───
Columns [ Auto | 2 | 3 | … | 8 ]      (the one set active)
Min width [ XS | S | M | L | px… ]    (Auto alone; px… its own, asked, shown as 180px once set)
───
Borders                               (checked where on)
Add a column at the end
───
Remove the grid, its content kept
```

**A column's menu**, titled *Column n of m*:

```
Edit markdown (Alt+click)
───
Move left
Move right
Add a column after it
───
Move out of the grid
```

Later, the column's own settings go in it (its background colour, the user's wish): a column, not a border between
two, so the last column has its handle as any other.

- **The cells' "…" are gone.** Nothing of their menu is lost: each item in the menu of what it acts on.
- **The column's grip**: small (as the divider's grip turned on its side: about 28 × 4 px, 40 px pointed at),
  centred on the column's top edge, half above it. The line above a grid is kept free (the page's cursor never in the
  grid, a press beside it nothing), so nothing of the text is under it. Shown as the pointer is over the column (as a
  divider's grip is over the grid), lit as it is pointed at; a press on it is the grid's (no cell edited, nothing of the
  editor's under it), its click opens the menu under it.
- **A phone** (no pointer over anything): the grips of a grid shown while the grid has the focus (a tap in it gives
  it the focus already: a cell edited), gone as the focus goes elsewhere; on a touch screen the grips larger (a finger's
  target, 56 × 16 px, half in the gap above its cell). A narrow pane stacks the columns: each one's grip on its top edge as well; no dividers there (as
  now). **No handle shows beside a widget as wide as the screen** (a narrow pane), so there each column's menu has the
  grid's sections after its own (`Grids.handleHidden`, the pane marked narrow).
- **After the review (2026-11-15)**: the box SilverBullet draws a grid in scrolled what lay outside it away, the grips'
  upper halves cut off: let out (`overflow: visible` on the grid's parent, named by `:has(> .swl-grid)`); the cell
  edited keeps its grip (`celleditor.ts` `keptWhileEdited`: on a phone the column tapped into had none), its press
  its own, the field still edited; the grid's items in the handle's menu settle the handle after them, as Align's.
- **After the second review (2026-11-15)**: a grip pressed in the cell edited leaves the cell as any press does (its
  text written in turn), and what its menu does waits for the cells' writes and acts on the grid drawn anew by them
  (`cellAction`); the grid cuts off itself what lies outside it but above (`clip-path: inset(-48px 0 0 0)`: its
  cells' lines the pixel after it, as the host's box did before it was let out); a provider's item may return a
  promise, the handle placed again once it is done.
- A grip hidden takes no press (`pointer-events: none`): a press there is the cell's, as before it was there (on a
  phone a tap in a short cell hit the grip, unseen, and opened its menu).

## What changes

- **shared/layout.ts**: `LayoutProvider.menu?(element)`, optional: sections a provider adds to the handle's menu under
  Layout's own (Align, Width). The grid's provider (`src/grid/provider.ts`) gives its grid's; any other provider may,
  none does now. Not breaking (optional; Silverware Layout is the one reading it).
- **src/ui/handle.ts**: its menu takes the provider's sections after its own.
- **src/grid/ui/cellmenu.ts** → **src/grid/ui/columngrips.ts**: a grip per cell on its top edge and the column's menu;
  the grid's items moved to the provider's `menu`. `CellAction` kept (the same actions, one place to carry them out).
- **The style page**: the grips' rules (as the dividers'), the cell's "…" rules gone; shown under the pointer over the
  column, and on a touch screen while the grid has the focus (`:focus-within`).
- **Docs**: the library page's grid section (the menus by their handles), docs/silverware-layout-grid.md (its *"…"
  menu* section), silverware-layout/CLAUDE.md.
- **Tests**: the UI tests that open a cell's "…" (grid.spec.ts: a cell moved, the grid removed, borders, a column
  added; grid-touch.spec.ts) open the column's grip or the grid's handle instead; a scenario for each menu, and one
  for a phone (a tap in the grid shows its grips, a tap outside hides them). Unit tests of the menus' items.

## Not changed

- Files' "…" (Silverware Assets), cards' and links' menus by their icon.
- Dragging a column's shares by its divider, a grid's width by its handle, Alt+click for the markdown.
- What each action does and how it is written (the page writer's `grids` part).

## Columns redone (2026-11-15, the user's choice)

- The menu's columns were seven items under each other (Columns: automatic, 2, 3, 4 columns, Borders, …): now one row of choices, **Columns: Auto | 2 … 8** (`LayoutMenuChoices`, a provider's row in shared/layout.ts, drawn as the popup's segmented row). "Automatic" (no attribute: a column per cell, four at most) is gone from the menu; a grid without `columns` still has a column per cell, now eight at most (`MAX_COLUMNS`, was four: a grid of 5 or more cells without `columns` shows more to a row than before, for the release notes), and its count shows as the one set. `columns="auto"` was one column of auto width before (a track `auto`), now as many as fit.
- **Auto** (`columns="auto"`): as many equal columns in a row as fit, none narrower than `min` (`xs` 100, `s` 160, `m` 240 the default, `l` 360 px, or px 40 to 1200), CSS `repeat(auto-fit, minmax(min(<min>px, 100%), 1fr))`. No dividers (equal columns, none resized), its columns kept in a narrow pane (`data-swl-fit`). With Auto the menu has **Min width: XS S M L px…** (its own px the row's last choice, asked in SilverBullet's prompt, `GridHost.ask`, the init page's `prompt`). A count chosen takes `min` off.
- Put into grid's Gallery offers Auto first (`GridColumns`, shared/markdown/gridbuild.ts); a Split asked for Auto is cut into two.
- The default grid (`/grid`) stays two columns (two cells, no attribute).
- A divider's double click (two columns made even) left the dividers where the old widths had them until the grid was drawn anew: the dividers are placed again as the grid's template changes (a MutationObserver on its style, told by its template and fit alone).
- A grid drawn anew after one cell's write drew every cell again (its images flashed, the page under it jumped): the cells of unchanged markdown take the old drawing's rendering (`takeOverUnchanged`, exchanged, not moved: SilverBullet may draw a grid twice and show either).
- On a phone (2026-11-15, the user's report): the menu ran out of the window (placed as if 220 px wide) and the rows of choices out of the menu. The popup is measured and held in the window, a row's buttons go under its label where they do not fit beside it; the columns and their min width a section of their own (Borders, Add a column at the end one after it: they read as the min width's before); a row's label where the items' words begin in a menu with icons.
- A column's menu holds the column's actions alone, *Clear column…* (its content emptied, the column kept, asked first: the cell written empty) then *Delete column…* last (the user's choice, 2026-11-15): where no handle shows, the grid's own sections are no longer put into it but opened by its *Grid…* (the grid's menu as the handle shows it, Align aside).
