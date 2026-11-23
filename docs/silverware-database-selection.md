# Silverware Database: selecting items, editing and removing them together

Status (2026-11-23): planned and agreed with the user, nothing built; built only once the user says so.

Several items of a database selected in a view, then edited or removed together: properties set, values added to a
multi-select, text replaced (by a regular expression too), several changes at once in one batch. On a computer by Ctrl and
Shift as every list does; on a phone at least partly, through ⋯.

## Decided (2026-11-23, with the user)

1. **A selection is a fixed set of items, independent of the filter.** Kept as the set of their keys (`ItemKey`), never
   recalculated: an item made later (+ New, another block, the index catching up) is never selected by itself, and an
   item removed leaves it. The filter only decides what *Select all* adds: filtered, *Select all*, the filter changed,
   *Select all* again gives the union of both filters. It is made anew only by *Select all* again (added to it) or by
   clearing it.
   - Weighed and set aside: keeping it as included or excluded keys (whichever is fewer). An excluded form ("all but
     these") takes in an item made after it, which the selection must not; to avoid that it would have to remember
     which items there were, as much as the set itself. The set is small: 20,000 keys about 0.3–0.5 MB (the strings are
     the items' own, the set holds references), filled in milliseconds (estimated, not measured).
2. **The bar says "N selected"** and nothing more (no "all but 2", no how many the filter hides). A switch **Selected
   only** shows the selection alone for a while, to look it over.
3. **The selection is the database's, in the window**, never written into the block: kept at module level, by the
   database's id (a block has no identity of its own: a filter changed writes the block, which makes a new place). Two
   blocks of one database on a page show one selection, both their bars saying it. Kept across the place's views (it is
   of items, not of a view) and across a sort, a Group by and a filter changed; **cleared once another page is opened**
   (the editor's page changed, told by the platform), so a selection forgotten never waits on another page for a
   Delete. Not by the places gone from the page: CodeMirror takes a widget far out of sight out of the page, and a
   selection would go as the page is scrolled.
4. **The peek leaves the selection alone**: opened and closed while items are selected, nothing of it changes; Esc closes
   the peek first, the selection at the next Esc. While a selection is on, the peek's head has a **Selected** box for
   its item: an item looked at and chosen without closing it.
5. **The header's box** selects the items drawn; the bar then offers **Select all N** (every item the view shows: its
   filter's, in its groups shown, a folded group's and those Load more has not drawn too; a hidden group's not). Ctrl+A
   (the focus in the view, nothing edited) selects them at once. In the calendar and the timeline, every item they
   list (in any month, the undated too), not the month or the range in sight: what the filter lets through, as
   elsewhere; they have no header's box.
6. **On a computer**: a box at a row's left (shown as the row is hovered or has the focus, always once anything is
   selected) toggles it; **Ctrl/Cmd + click** anywhere on a row or a card toggles it without editing; **Shift + click**
   selects the range from the last one clicked, in the order shown (across groups; a folded group's rows, not seen,
   skipped); the box reached by Tab is toggled by Space as any box; Delete removes the selection (asked); Esc clears it
   (in a place over the window, first the selection, the next Esc the full screen). No Space on a row nor Shift+↑ ↓:
   a row's focus is on a cell or a button (a card's name), whose Space is its own. A plain click still edits a cell and
   opens a card, a selection or not: selecting never changes what a plain click does. A group's head has a box
   selecting the group (its items not drawn too).
   - **On a Mac, Cmd** (Ctrl + click is the right click there).
   - **A link or a button in a row keeps its own** Ctrl/Cmd + click (a link opened in a tab, as the browser does);
     the row's other parts and its box select.
   - Shift + click selects no text (its press's default prevented).
   - **The keys are the view's only where it has the focus and no field does**: a cell's editor, the filter's field
     keep Ctrl+A and Delete. Taken, they are stopped at the place's element, so SilverBullet (which takes its
     shortcuts at the document) and the browser (Ctrl+A the whole page) do nothing with them.
7. **On a phone, selecting always starts from ⋯ → Select** (no long press: a card held starts a drag): the boxes shown,
   a tap on a row or a card toggles it instead of editing or opening it, the item's Open icon still opens the peek,
   **Done** in the bar ends it (the selection cleared).
8. **The selection's bar** is a row of its own **under** the place's bar while anything is selected (or the phone's
   mode is on): ✕ (clear), "N selected", Select all N (where not all the view shows are), Selected only, **Edit…**,
   Copy as… (the selection, by each converter the place's ⋯ copies by), Remove. The place's bar stays above it, its
   views, filter, sort and Undo at hand: a filter changed and Select all again (1.) and Undo after Edit… (the selection
   stays) need them. Replacing it, as Notion does, would hide both.
9. **Edit… is a batch**: a panel of changes, each a row (property, operation, value), + Add a change, a preview of every
   item's result, applied at once by its button **Apply 3 changes to 37 items**: one transaction, one Undo. The button
   saying the counts is the confirmation (the panel opens only for a selection); no second dialog.
10. **Remove asks**, by a count alone: "Remove 37 items? Undo brings them back." (`core.remove` as it is, its files'
    question after it). Any change of more than one item says how many, nothing more particular.

## Edit…: the changes

| Property | Operations |
| --- | --- |
| any writable (not a formula, not Locked in views, not a system property) | **Set**, **Clear** (not a required one) |
| multi-select, person with Multiple, files | **Add**, **Remove**, Set (exactly these) |
| text, URL, the name | **Find and replace**, **Add at the start**, **Add at the end**, **Wrap** (a prefix and a suffix) |

- **Set**'s value is typed in the editor a cell has (`editValue`'s editors), started from the items' common value where
  they all have one, else empty ("various").
- **Find and replace**: Find, Replace (empty deletes what was found), switches *Regular expression* and *Match case*.
  JavaScript's replacement: `$1` `$2` groups, `$<name>` a named one, `$&` the whole match; all matches replaced. An
  invalid expression is said under its field and nothing is applied.
- **The changes go in order**, top to bottom: two changes of one property build on each other (replaced, then prefixed).
- **The preview** is calculated as it is typed: each item changed with its values before and after, the change marked;
  counts "37 change · 2 cannot". What cannot be written is marked and skipped, said why: a name taken (or two items
  given one name, two names swapped: each taken as the batch starts; a name the store cannot keep, `Space.validateName`),
  a required property left empty, a value its type does not read (a number's text not a number). Items the batch
  leaves as they are are counted, not listed. Calculated again as the items change while the panel is open (another
  block's write, the index). The counts
  are of every item; the list shows the first 100 changed (20,000 rows would take seconds to draw, as a table's did).
- **A regular expression** runs on every selected item's value as it is typed: one that backtracks badly on 20,000
  values would hold the window. Accepted (the user's own expression, as in any editor's find); the preview calculated
  once typing rests a moment (as the filter applies as it is typed), never on each key.
- **The name**: a rename per item, which SilverBullet's rename follows with each page's links (slow for many): the
  preview says so where the name changes.
- **On a phone** the panel takes the whole screen, its changes one under another.

## How it fits

- **The state** (core/place.ts, at module level as Load more's and `scrolled`: a block written makes a new place): by
  database, the set of keys, the last item clicked (Shift's anchor), whether the phone's mode is on, *Selected only*.
  Items gone from the store leave it as the place is drawn.
- **Selected only** narrows the listing in the core, not in the block (never written: the filter's state is, this is
  not); part of the listing's signature, so Load more's state of the listing without it is kept apart.
- **The core selects, not the views** (decided with the user, 2026-11-23): every view hands each item's element to the
  core already (`host.look.item(item, element)`, which draws Color by), so the core does the selection there, in every
  view at once (the table, the list, the board, the calendar, the timeline, views of the user's):
  - **The item's box** is the core's, drawn as the element's first child, or where the view says
    (`look.item(item, element, { box })`: the table its name's cell, by the grip; a row of a table takes no child but
    its cells). Shown as the element is hovered or has the focus, always once anything is selected.
  - **The element marked** (`swd-selected`) as the selection changes, without the view drawn anew; for assistive
    technology the box says it (`aria-checked` of a checkbox, its label the item's name): `aria-selected` belongs to
    a grid's or a listbox's rows, which a table's `<tr>` and a card are not.
  - **Presses** taken at the element in the capture phase, before the view's: Ctrl/Cmd + click, Shift + click, a tap
    in the phone's mode toggle or extend and stop there (the view edits no cell, opens no card); a link's or a
    button's Ctrl/Cmd + click kept. **The press's start too** (`pointerdown`, `dragstart` with a modifier, and every
    one in the phone's mode): a card's, a timeline's bar's or a calendar's item's drag never starts from a selection's
    press.
  - **One item, several elements** (a timeline's name and its bar; an item over days of a calendar): each marked, the
    box in the first alone.
  - **Shift's range** by the elements' order in the page (every element `look.item` was given, in the place:
    `compareDocumentPosition`), so a view tells nothing: a table's rows across groups, a calendar's days one after
    another, a timeline's rows down; an element not shown (a folded group's row: `checkVisibility()`) skipped, an
    item of several elements by its first.
  - **A group's box**: in the heads the core draws (core/groups.ts) and in `groupHead` (views/groups.ts, the table's
    heads): the group's items, those not drawn too.
  - **The header's box** (the items drawn): the core's element, `host.selection.headBox()`, put by the view where it has
    a header (the table's `<thead>`); a view with none has Select all in the bar and Ctrl+A.
  - **`ViewDefinition.selects: false`**: a view of the user's taking no part (its elements given to `look.item` for
    their look alone).
- **`ViewHost.selection`** (a public type, small): `has(item)`, `size`, `headBox()`, for a view drawing something of
  its own by it; the rest is the core's.
- **The selection's bar** is the place's (core/place.ts): a row under its bar while `size > 0` or the phone's mode is
  on; Select all of the items the view shows (the listing's, a hidden group's left out: the grouping's shown groups,
  not `host.items`, which holds them).
- **Items the filter hides** are in the selection by their keys alone: Edit…, Remove and Copy read them from the
  store's items (the calculating store's, as the places do) as they start, never from the listing.
- **The batch's writes** (core/core.ts): `edit(database, items, changes)`, one transaction through `onItems`, its part
  every key the changes write (and the name where one renames: a rename and values of one item go in one transaction
  already, store/pages/pages.test.ts), so an item changed meanwhile in that part is left and offered as a conflict, as
  a removal's; the plan made of `domain/` (pure: a change's operation on a value, the
  preview's results and why one cannot be written), so the preview and the write are one calculation. Its progress
  (`WriteProgress`) said in the bar: SilverBullet writes pages one at a time.
- **The peek's box**: the selection reaches the peek through the module host (`ModuleHost.selection(database)`, the
  place's state by database), the peek drawing its box where one is on.
- Copy as CSV of the selection: `copyAs` with the selected items, those listed in the listing's order, then those the
  filter hides in the order by hand.
- **The phone's mode** is ⋯ → Select on every screen (a computer with a touch screen too); the boxes alone shown, a
  press toggling. Whether a screen is a phone is not guessed.

## Review (2026-11-23)

The plan read against the code; what it lacked, put in above:

- **A selection by block** had no key: a block has no identity (a filter changed writes it, a new place; two blocks of
  one database are told apart by nothing, *Left open after the UI work* in docs/silverware-database.md). By database
  now, cleared as its page is left.
- **Select all** said "every item listed", but a hidden group's items are listed and not shown: they are left out.
- **Keys**: Ctrl+A is the browser's select all of the page and Space scrolls it; SilverBullet takes keys at the
  document. Stopped at the place, and never taken from a field. Cmd on a Mac; a link's own Ctrl/Cmd + click kept.
- **Names swapped** in a batch (A → B, B → A) would each find its name taken: said and skipped, not reordered.
- **The preview of 20,000 items** drew every row: the first 100 listed, the counts of all.
- **Selected only** would have changed Load more's state of the filtered listing: a part of its signature.
- **Copy as CSV** had no order for items the filter hides.
- Checked and holding: a rename with values in one transaction (the pages store's tests), `WriteProgress` for the bar,
  Esc's order (the peek stops the keys it takes and closes on Esc first; the place's own Esc leaves the window's view).

## Review 2 (2026-11-23, the plan read whole)

Put in above, each confirmed by the user the same day (the selection cleared as another page opens, a hidden group's
items not in Select all, the selection's bar a row under the place's, Select all in the calendar and the timeline of
every item they list, no Space nor Shift+↑ ↓ on a row):

- **The selection's bar replaced the place's**: its filter and Undo gone while a selection is on, so neither the
  union of two filters' Select all (decided 1.) nor Undo after Edit… (the selection kept) could be done. A row under
  it now.
- **"Cleared once no place is on the page"** would clear it as the page is scrolled (CodeMirror takes a widget far
  out of sight out of the page): by the editor's page changing now.
- **Select all through `host.items`** contradicted decided 5. (a hidden group's items are in it): by the shown groups.
  In the calendar and the timeline it is every item they list, not the month in sight: said.
- **Space and Shift+↑ ↓ on a row**: a row's focus is a cell or a button (a card's name), whose Space is its own; the
  box toggles by Space, as a box does. Shift+↑ ↓ dropped (no row has the focus to extend from).
- **Esc in a place over the window**: the selection first, the full screen at the next.
- **Shift's range over a folded group** took its rows unseen: skipped.
- **Items the filter hides** are keys alone: read from the store's items as an action starts.
- **`aria-selected`** on a table's row or a card is not valid ARIA: the box's `aria-checked` says it.
- **Copy as CSV** alone: the place's ⋯ copies by every converter; the selection's bar alike.
- **The preview** calculated again as items change while the panel is open; once typing rests, not on each key (a
  regular expression over 20,000 values); a name the store cannot keep is one that cannot be written.

## Steps

Each a commit with its tests, UI tests where a user sees it.

1. **The state**: the set, the anchor, Select all adding the items shown, items gone dropped, cleared as the page is
   left. Unit tests: toggle, the union of two filters' Select all, an item made later not selected, a filter changed
   keeping it, a hidden group's items left out.
2. **The core's selection on the items and the table on a computer**: `look.item`'s box and marks, the presses (their
   start too), Shift's range by the page's order, the group's and the header's boxes, the keys, the selection's bar
   under the place's (count, Select all N, Selected only, Copy as…, Remove, ✕), `ViewHost.selection`, `selects: false`.
   UI tests: Shift + click a range across groups, the header and Select all N past Load more, Ctrl+A, Delete asked,
   Esc, a plain click still editing, the peek opened and closed keeping it, a filter changed and Select all again
   (the union), the selection kept as the page is scrolled far and cleared as another page opens.
3. **Edit…**: the domain's changes and preview (unit tests: every operation, the order, a regular expression's groups,
   what cannot be written), `core.edit` as one transaction and one Undo, the panel. UI tests: two changes applied to a
   selection with items not drawn, Undo, a name taken skipped.
4. **The peek's Selected box.**
5. **The phone**: ⋯ → Select, the taps, Done; the panel over the whole screen. UI tests at a phone's size with touch.
6. **The other views**: the list, the board, the calendar and the timeline take it from the core; what each needs of its
   own looked at (where its box sits, a card's or a bar's drag not started by a selection's press, an item's several
   elements). A UI test each: Ctrl + click and Shift + click, a drag not started.
7. **Docs**: the library page (how to select, Edit…, `ViewHost.selection` and `selects` for views of one's own); this
   plan's status.

## Not done (2026-11-23, decided with the user)

- **Properties only**: Edit… changes values (and the name), never an item's content.
- **No dragging of a selection**: a drag moves its own row or card, as today; a selection's place is changed by its
  values (Edit…), not by hand. Weighed again the same day: a board's selected cards dropped in a column (their value
  set, as Edit…'s Set) would be the cheapest and most useful part, rows reordered the dearest; not now.
- ~~No selection in the calendar and the timeline~~: they have it, the core selecting in every view (decided the
  same day).
