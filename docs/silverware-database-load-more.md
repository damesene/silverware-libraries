# Silverware Database: Load more

Status (2026-11-22): built, steps 1 to 6, on branch `feat/database-formulas`, not released; no UI tests yet (step 3's
scenarios left for a run with the user).

A database of thousands of items draws every one of them today: a table view of 20,000 items took 3.9 s to show and
1.0 s to show a change (measured 2026-11-22, docs/silverware-database-formulas.md, step 3c). The calculation is not the
cost (all of 50,000 items' formulas in 0.7 s); the drawing is (26 elements a row). A view draws its first items and a
*Load more* under them; what it does not draw is still filtered, sorted, grouped and counted.

## Decided (2026-11-22, with the user)

1. **Load more, not virtualization nor pages.** A place is a widget in the page's editor (CodeMirror measures its
   height): rows drawn as they scroll into sight would change its height under the editor, and the browser's Find,
   selecting and copying the table, dragging a row and a group split by what is drawn would all break. Pages (1, 2, 3)
   break dragging between them and the whole list's overview. Virtualization may come later for a place over the
   window alone (its own scroller, a fixed height).
2. **Per group.** Where the view is grouped (Group by), each group has its own first items and its own *Load more*:
   a table's group, a list's, a board's column, a timeline's group. A group of fewer items shows them all.
3. **The limit is a setting, 50 by default**: `silverware.database.pageSize`, in Silverware Database's settings
   (the configuration page, and the settings dialog: a *General* tab beside *Views* and *Modules*), one for every
   database (no limit of a block's own). **10 to 10,000**: the dialog refuses another number and says the range; one
   written into the configuration by hand outside it (or no whole number) is taken as 50.
4. **No *Show all***: *Load more* alone, the next `pageSize` each press (drawing 20,000 rows at once takes seconds).

## How it is used

- Under a group's (or the view's) last item drawn: `Load 50 more` and how many of the group are shown (`50 of
  1,240`); it draws the next `pageSize` (the last press those left), the focus on the first row it drew. Said there
  alone: the place's bar keeps its count (`1,240 of 20,000`: the items its filter lists of all), the table's foot its
  `N of M shown` of the filter.
- What is loaded more stays for the window (by database, view, listing and group: a block written makes a new place,
  which takes it back; two blocks of one database and view listing alike share it, each drawing it as it is drawn next),
  never written into the block; kept as presses, so a larger `pageSize` set meanwhile shows more. A filter, a sort or a
  Group by changed starts each group at its first items again; back to one before, what was loaded under it is there
  again (two blocks filtered otherwise each keep their own: one state of a view, reset by the other's drawing, collapsed
  both at every write, found by the review of 2026-11-22). The last 50 listings are kept.
- **An item added, changed or moved past what is drawn is shown after the group's drawn items** (+ New in an unsorted
  table, a list or a board's column puts it at the end; a value changed moves it where a sort or a group puts it; a
  card dropped in a sorted column lands where its value sorts it): its
  key kept as shown (not the group's count raised: + New at the end of 20,000 would draw them all), drawn in its place
  in the order after the cut, once the store lists it (the index catching up). It stays shown with its listing's
  state, for the window (the last 50 listings), a press then drawing the next items not shown yet (a page of those
  shown already skipped).
- Dragging by hand moves among the items drawn; a group's end drawn so far is its end for a drag (Alt+↓ on the last
  drawn does nothing).
- A calendar's month shows every item of its days; its list of items without a date (100 at a time today, `Show N
  more (M left)`) takes the same row and `pageSize`. A timeline: per group as the table, its range still of every
  item.

## How it fits

- **The state** (core/place.ts, at module level as `scrolled` is: a block written makes a new place): by database,
  view and group key (none: the view's one list), the presses of *Load more* and the keys shown past the cut, with the
  listing they belong to (its filter, sort and grouping as a signature). A listing of another signature starts anew:
  compared as a view is drawn, since a filter typed updates the listing without drawing the place anew.
- **`ViewHost.limit`**: `limit.shown(items, group?)` the items to draw of a group's (its first `pageSize` × presses,
  then those kept shown past them, in their order), and `limit.more(items, group?)` the row's parts or none where all
  are drawn: a button (*Load 50 more*) and the count, for
  the view to put in its own row (a table's `<tr><td colspan>`, a timeline's grid row, a board column's child). A
  host's member rather than an import of views/ (as `groupHead` is) because views of the user's need it too; the
  parts drawn by `views/more.ts`, styled once.
- **Who cuts**: the place cuts only the groups it draws for a view (`groupHost`, core/groups.ts): such a view's
  `host.items` are its group's drawn items and `host.total` the group's count, as the library page says today, and the
  place draws the row after the group (`drawGrouped`'s `update` keeping it as the counts change). Every view drawing
  itself (the table, the list ungrouped, the board, the timeline, the calendar's undated list, a view of the user's)
  reads `host.limit`; one that does not draws everything, as today. `host.items` stays every item listed for such a
  view: the board's column counts and the timeline's range read it whole; the timeline's rows (its `drawn` list today,
  both its range and its rows) split from its range.
- Sorting, filtering, grouping and the counts stay over every item (core/listing); only drawing is cut. The calculating
  store, the formulas, Copy as CSV (every item listed: its hint "the items shown" said "the items listed") and *Apply
  to all* read every item.
- **The setting**: a general setting, not a view's or a module's (the dialog's rows assume an `enabled` switch, a
  *General* tab is new structure there); a number field with a range: `ViewSetting` and the dialog's number control
  get `min`, `max` and whole numbers (a public type: views of the user's may use them). `config.define` declares
  `type = "number"` alone (whether SilverBullet refuses a value outside a schema's range is not known: the range is
  checked in JS, taken as 50 outside it). Read as a view is drawn: the dialog's save draws every place anew; a hand
  edit of the configuration shows at the next drawing, as views' settings do.

## Steps

Ordered by the code; each a commit with its tests, UI tests where a user sees it.

1. **The setting**: `ViewSetting`'s `min`, `max`, whole numbers and the dialog's number field checking them; the
   *General* tab; `pageSize` in `config.define` (a number), read with the range checked (50 outside it). Unit tests:
   the default, a value set, one out of the range refused in the dialog and taken as 50 from the configuration.
2. **The limit**: the state at module level (presses, keys shown past the cut, the listing's signature),
   `ViewHost.limit`, `views/more.ts`; the place cutting the groups it draws and drawing their row; the library page's
   `ViewHost.limit` and the group's `items`/`total` documented in the same commit (`docs.test.ts` runs its examples).
   The list (grouped by the place, and ungrouped through `limit`). Unit tests: the cut, a press, the reset by a
   listing changed, an item added past the cut shown after it, a larger `pageSize` taking the presses.
3. **The table**: each group (or the table) its drawn items and its row; + New and a row's Insert past the cut;
   dragging within what is drawn. UI tests: a table of 120 items, Load more twice (the focus on the first new row),
   grouped (each group its own), a filter resetting it, + New at the end shown.
4. **The board, the timeline and the calendar's undated list**: each column, each group (the timeline's range split
   from its rows), the calendar's own *Show more* replaced by the row and `pageSize`.
5. **Measured again**: the table of 20,000 items shown and a change shown (a playground seed of N items, as 3c's
   temporary one, committed this time under a query parameter of the playground's), written into
   docs/silverware-database-formulas.md's 3c. Done 2026-11-22 (`database.html?big=N`): 20,000 items shown in 0.23 s
   (3.9 s before) and a change in 0.12 s (1.0 s before); 50,000 in 0.41 s and 0.24 s.
6. **Docs**: the library page's setting; docs/silverware-database.md's *Left open* item marked done.

## Left open (2026-11-22)

- A value changed in the item's panel (the peek) that moves the item past what its view draws (another group, a sort)
  does not show it there: the panel writes through the module's host, which knows no view's limit; a change made in
  the view itself shows the item wherever it lands.
