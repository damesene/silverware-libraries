# Silverware Core and Preact: the work (runbook)

The entry point for anyone (a person or an agent with no earlier context)
working on Silverware Core and the move of the plugins' UI to Preact. It says
where the work is, what to do next and what done means. **What** is built and
**why** is in the plans; this file is **how and in what order**.

- docs/silverware-core.md: the core, its services, loading and the version
  gate, the probes, API changes, releases, decisions.
- docs/silverware-preact.md: the UI on Preact, the state model, rules, custom
  views, the conversions.

## Before you start

1. Read the root CLAUDE.md (working rules, commits, versions, shared/), then
   both plans whole, then the CLAUDE.md of each plugin your step touches.
2. Find the first step in *Progress* that is not done. Read its section in
   *Steps*: scope, what is not in it, the files, what done means.
3. Read *Notes for the next session*, first its *Where the work stands and
   what is next*: what the last session left open and what to do next.
4. Work on branch `silverware-core` only. Never on `main`, never push
   without being asked (for step S the user asked for a push of
   `silverware-core` after each unit of work: *Notes for the next session*).

## Rules of this work

- **One step at a time, in order.** A step needs only the ones before it; do
  not start the next one with the current one unfinished.
- **Every commit**: `npm run build`, then `npm run verify` passes (read its
  "Tests N passed"; on Windows run it from `D:\`); a change to how something is used gets
  its UI scenario and `npm run test:ui` passes. Commit messages as the root
  CLAUDE.md says: one line, Conventional Commits, scope the plugin or `core`,
  `!` for a breaking change, no body, no co-author trailer.
- **The branch stays green** after each step: it could be merged at any
  checkpoint.
- **The UI tests are the oracle.** A commit that converts or moves code adds
  UI tests but changes none: a test that must change for it shows a change of
  behaviour, which is the user's decision. A part's unit tests written for
  synchronous drawing are rewritten only after a UI scenario covers what they
  checked.
- **Rendering baselines first** (step S): before a part is converted or moved
  onto the core, its DOM, look, geometry and rendering stability are recorded
  against today's code; after, they hold.
- **Plans follow the code.** A decision made while working goes into the
  plan's *Decided* with its date, in the same commit; a step's scope that
  turned out different is corrected in its section here. Nothing is kept only
  in a conversation.
- **CLAUDE.md follows the code, in the same commit.** A step that moves,
  adds or removes what a CLAUDE.md describes (the root's shared/ section names
  its modules one by one: formulas, navpanels, widgetmenu, editorsample, room,
  contentscale, watchmark, dialog, popupmenu…) updates that text with it, so
  no CLAUDE.md describes code that is gone. Step 11 only checks.
- **A bug a test finds in today's code is recorded, not fixed in passing**, in
  every step (agreed with the user, 2026-11-26): the test asserts the behaviour
  wanted and is marked `test.fail(true, "Known (YYYY-MM-DD): …")` just before
  that assertion, after what sets it up, `expectNoPageErrorsYet(page)` on the
  line above it (an error of the page before the mark a failure, not taken for
  the known bug); the bug is listed in step S's *Known*
  with the file and the step expected to fix it. A step whose work fixes one
  sees it "unexpectedly passed" and takes the mark and the entry off in the
  same commit. What is left is step K's. **The behaviour such a test asserts
  is a claim, not the oracle**: what was taken for right when the bug was
  found, never checked by a passing run. Before a fix makes it pass, it is
  checked again (step K, *Before each fix*). `scripts/ui-test-locks.test.ts` (in
  `verify`) fails on a mark without a dated reason, without that check above
  it, or whose file is named nowhere in this runbook (it does not read the
  *Known* list itself: keep each marked file's entry there).
- **`main` is merged into this branch at a checkpoint only** (decided with
  the user, 2026-11-27): SilverBullet's image and `main`'s fixes can move the
  rendering baselines; they are run before and after the merge and written
  anew only in the merge's own commit, their diff shown to the user.
- **What step S left for a later step is recorded before that step starts**
  (decided with the user, 2026-11-27): each such case is the first task of the
  step that changes it (steps 6 and 8 name theirs).
- **A test's list of exceptions only shrinks.** The checks of this work
  (module state, SilverBullet's markers, page writes, UI islands) start with
  today's exceptions listed, each with the step that removes it; an entry is
  added only by the user's decision, with why.
- **Stop and ask the user** (do not decide alone):
  - at a checkpoint (A, B, C): measure, write the result here, wait;
  - a change of anything a space has: settings, the Space Lua API, a class,
    `data-*` or structure a theme may select (a rendering baseline that
    changed),
    stored markdown;
  - keeping a test from the parallel run (a lock), a test given a time of its
    own;
  - a deviation from the plans beyond the step's scope;
  - a version, a changelog entry, a release, a merge, a push (but step S's
    pushes of `silverware-core`, asked for by the user).
- **Step S's rest and step 1 run on without stopping** (the user, 2026-11-28: "unless something truly needs deciding,
  do the whole of step 1 autonomously"): step S's stop (*Next* 5) becomes a report of the *Known* list, not a wait;
  step 1's commits are pushed to `silverware-core` as step S's are. What still waits for the user (the core's version
  and its changelog's first entry confirmed, 2026-11-28: 1.0.0 and the entry drafted, its date that of the release): a baseline changed (shown by groups, above), a lock, a change
  of what a space has, a deviation from the plans; and Library: Install checked by hand, which only the user can do.
- **A baseline that changed is shown to the user by groups** (decided with the
  user, 2026-11-27, for step 1 on): for each commit that changes baselines, a
  short summary of each group of parts changed alike (which parts, what changed:
  the DOM, a colour, a box by how many px; and why: the change meant, its cause
  in the commit); the user approves a group, not each file. A change the agent
  cannot explain is a regression: fixed first, never written anew.
- **A commit of docs alone needs no `npm run verify`** (the user, 2026-11-27): it checks code, bundles and
  changelogs, none of which such a commit touches; a commit with any code or test runs it, as the root CLAUDE.md says.
- **At the end of a session**: *Progress* and *Notes for the next session*
  updated and committed (a `docs:` commit where the step is not done).

## Progress

| Step | What | State |
| --- | --- | --- |
| 0 | The plans | done (2026-11-25) |
| S | The safety net: tests against today's code | done (2026-11-28; the lists left of items 2 to 4: *Next* 3; item 6's numbers in item 6) |
| 1 | The core's skeleton, the gate, `requires:`, build and tests | in progress (2026-11-28): the core 1.0.0 confirmed by the user, its changelog's first entry with it |
| 2 | Preact in the core, `.tsx` everywhere | not started |
| A | Checkpoint A | |
| 3 | The formulas' registries (G), P1 | not started |
| 4 | SilverBullet bridge and events (B), every plugin's binding, settings and page writes | not started |
| 5 | Geometry and editing surfaces (D, E) | not started |
| 6 | Overlays in the core (C) | not started |
| 7 | The plugins onto the overlays | not started |
| B | Checkpoint B | |
| 8 | The registry of the plugins' APIs (F), P3 | not started |
| 9 | The settled index and the page's look (H, I) | not started |
| 10 | Preact conversions | not started |
| C | Checkpoint C (inside step 10, after the board) | |
| K | The known bugs fixed: no `test.fail` mark left | not started |
| 11 | Cleanup and release | not started |

Letters in parentheses name sections of docs/silverware-core.md, *Services*;
P1 to P3 and I1 to I6 its *API changes*.

## Notes for the next session

### Where the work stands and what is next (2026-11-28)

Read this first; the dated entries below are the record of what each item did and found.

- **Done and pushed** (branch `silverware-core`, each a commit of its own): step S items 1 to 4, and item 5 for
  Silverware Database (`silverware-database/ui-tests/baselines/views.spec.ts`, `overlays.spec.ts`, `dialogs.spec.ts`,
  `menus.spec.ts`, `properties.spec.ts`, `editors.spec.ts`: done, *Next* 2) and for Silverware Table's dialogs and
  menus (`silverware-table/ui-tests/baselines/`, *Next* 2), and for Chart, Layout, Assets, Tags and Toolbar (each
  `<plugin>/ui-tests/baselines/<plugin>.spec.ts`, *Next* 2): item 5 done; and the shared baseline code with a part's
  place (*Next* 1). Fifteen known bugs are marked, in sixteen tests (step S, *Known*;
  `grep -rn "test.fail(" */ui-tests`).
- **Decided with the user (2026-11-27)**, after a review of the first answers against the plans and the code:
  - **Item 5 records every dialog, menu and floating list a later step changes, now**, before step 1: steps 1 to 5
    already reach them (step 3 the function dialog's list and help; step 4 every settings dialog, through
    `Platform.settings`, and a chart's block written by the `codeBlocks` part; step 5 where Silverware Table's
    toolbar, menus and controls are placed, `viewBounds`, and the side panels, by the core's watcher of the editor's
    area), steps 6 and 7 move them all. The parts, by plugin (each plugin's `baselines/` folder a CI group):
    Silverware Table's eight dialogs (settings, conditions, pivot, view, function, choices, result view, Excel
    export), its toolbar and menus, its floating lists (the choices list, the formula hint, the cell popup);
    Silverware Database's settings, conflict and delete dialogs, its Visible properties and Group submenus, the
    peek's icon and colour popover (its place menu, Properties and peek are recorded); Silverware Chart's settings and
    menu; Silverware Layout's page dialog and its handle's menu; Silverware Assets' settings dialog and file menu;
    Silverware Tags' settings and manager; Silverware Toolbar's settings and popup (narrowed with the user,
    2026-11-27: *Next* 2). Five small units beyond the database's.
  - **Placement is recorded too**: `lookOf` measures boxes against the part itself only, so a menu moved off its
    button, a dialog no longer centred or a panel shifted would pass. Before the parts above, `lookOf` and
    `settledLook` take an optional anchor: the part's box against it (the button, the widget) and against the window;
    the baselines recorded without it stay as they are. A menu opened near the window's right or bottom edge (its
    flipped place) and the phone's sheet are recorded among the parts.
  - **Form fields' state is part of a DOM baseline** (decided with the user, 2026-11-27): `domOf` records an `input`'s,
    a `textarea`'s and a `select`'s value, a box's `checked` and the option chosen (properties, which attributes do
    not show), what differs between runs replaced as the folder is: a conversion that loses a dialog's values while
    drawing the same boxes fails. The baselines recorded before it are written anew once, in a commit of their own,
    its diff (values added, nothing else) shown to the user.
  - **`main` is merged into this branch at a checkpoint only**: SilverBullet's image (Dependabot) and `main`'s fixes
    can move baselines, and each baseline written anew is the user's. The baselines are run before and after the
    merge, and written anew only in the merge's own commit, their diff shown to the user.
  - **The lists left of items 2 to 4** are each recorded **before the earliest step that changes it starts**. Those
    steps 3 to 5 change are part of step S's *Done when*: Silverware Table's functions and sources reset by a reload,
    Silverware Icons' `defineSets` after a reload, Silverware Database's press beside its block, the Tags panel
    across a reload, Silverware Layout's font zoom, Silverware Assets' File: Upload, a chart's exact block after a
    settings change and settings saved on the second of two blocks alike, Silverware Tags' operations with their
    Undo, Silverware Editor's keys in each host (Ctrl+Z, Ctrl+Y, leaving by a press beside, Ctrl+Enter, the notice of
    a key SilverBullet keeps). The rest are the first task of the step that changes them, written into its section:
    item 3's stackings left (step 6), the picker's states (step 6), `onWrite` reset and Layout's providers registered
    again (step 8).
  - **Item 6 measures in both places**, each for what it shows (the conversions change the views' code; SilverBullet
    draws the block's widget anew on a write, renders a code widget twice, empties the index while a page is indexed
    again: what the playground has none of):
    - **The playground**: one drawing's cost, steady. `database.html?big=N` (a database of N items over the memory
      store) and `__bench.store().changeOutside(…)` (an item changed elsewhere), as measured on 2026-11-22
      (docs/silverware-database-formulas.md); N 1,000 and 10,000, `silverware.database.pageSize` N (the drawing the
      conversions change) and the default 50 (what users get: Load more). Silverware Table by its playground's
      benchmark (`playground/benchmark.ts`, `profile.ts`), 1,000 and 10,000 rows: its tables are not converted to
      Preact, so its numbers watch steps 4, 5 and 9.
    - **SilverBullet**: **how many times** each action draws the place and the view (counted by a MutationObserver
      the spec sets on the page, the `.swd-place` and view roots added: never a counter in `src/`; the number steady
      where the time is not), and its time: the page opened, the block written (a filter by Enter), an item changed
      elsewhere, a filter typed. A database of 1,000 items (5,000 if its indexing, once per size, stays within a few
      minutes), seeded as `silverware-layout/ui-tests/bench.spec.ts` seeds its space, `silverware.database.pageSize`
      set to its size and to the default 50, as in the playground.
    - Per view (table, list, board, calendar, timeline): the first draw until the place holds still, the redraw
      after an item changed elsewhere, each filter key to the frame after it, Load more, a board's drag's frames;
      each with the long tasks (over 50 ms) and the nodes added and removed. One warm-up left out, then the median,
      least and most of 5; `--workers 1`, nothing else running.
    - Benchmark specs run on request (`SW_BENCH=1`, skipped otherwise), as `bench.spec.ts`. The numbers in a table
      in item 6's entry: what, items, time, draws, the commit, the date, the machine, SilverBullet's version. After
      each conversion (step 10) both are run on the commit before it and the one after, in the same session: numbers
      months apart (another machine, SilverBullet, Chromium) are not compared.
- **Next, in order**:
  1. **Done (2026-11-27)**: `scripts/ui-test-baselines.ts` has `PHONE`, `Part`, `recordParts` (a test per device,
     part and theme; the spec gives a `declare` that destructures its fixtures, as Playwright reads a test's fixtures
     from its parameters and keeps its file, and so its baselines' folder, where `test()` is called) and `lookOf`'s
     and `settledLook`'s optional `place` (`@place`: the part's box against the window and its `anchor`; probed on the
     database's menu: under its ⋯, right edges aligned). `overlays.spec.ts` uses it, its baselines unchanged;
     `views.spec.ts` takes `PHONE`. No part records its place yet: the parts below use it (a part laid over the
     page alone, its anchor one visible element).
  2. **Item 5's parts** (the decision above), a unit per plugin folder (Silverware Table perhaps two: its dialogs, then
     its menus and floating lists), each the database's way: a part per thing drawn, opened in its theme, its DOM from
     the light run, its look per theme and device with its placement, a `keptThrough` check of one action it redraws on.
     Silverware Tags and Toolbar have no `space` fixture (Tags: `openManager`, `pageName`; Toolbar: its favourites
     fixture): adapt to their helpers; moving them onto `withSpace` is not this item's. How to open some: Assets' side
     panel and a file enlarged, `silverware-assets/ui-tests/stacking.spec.ts`; the toolbar's settings, `openSettings` in
     `silverware-toolbar/ui-tests/settings.spec.ts` (moved into its `helpers.ts` to share it); the tags' manager,
     `openManager` (its views By tag, By page and Cleanup, and a review). Their stability actions: Assets, another file
     opened in the panel open; the toolbar's settings, an item's icon or label typed, the dialog's other rows kept; the
     tags' manager, the search typed, the tree's rows kept. **Baselines run against SilverBullet's release alone**: a
     baselines spec skips the playground (`test.skip(!onSilverBullet, …)`, as the database's helpers do), as
     `expectBaseline` keeps one file per name and the playground draws otherwise; a baseline differing on SilverBullet's
     edge is told to the user, never recorded for edge. Edge is not run per unit: CI's `edge-tests.yml` runs it as
     `main` or edge changes, and a difference found there is reported, not fixed in the spec. The `baselines/` area
     folders were agreed with the user (item 5's layout, below). Then mark item 5 done in *Progress* and here. **Done so
     far**: Silverware Table's eight dialogs (`silverware-table/ui-tests/baselines/dialogs.spec.ts`, each with its place
     in the window, each on a start page of its own, a `Part`'s `details`: `startingOn`), opened as a user on each
     device does (a desktop: a hover, a right click, clicks, a result's ⤢; a phone, `pointer: coarse` under the Pixel
     7's emulation, probed: a tap shows the toolbar, a long press a menu, taps choose, a result from its cell's menu,
     Show result). Silverware Table's toolbar, a cell's, a column's and the ⋯ menus, a choice column's choices, a
     formula's help, a filter's bubble and a cell's popup over a long text, each with its place against what it opened
     from, and a choices list near the window's bottom, laid above its cell (`menus.spec.ts`; the presses as a user's on
     each device, `press`, `barOn`, `barAction`, `menuOf` at a fixed point, `editCell`: Enter, a second tap on a phone,
     in its `helpers.ts`). A formula's help wider than a phone's window found (*Known*); a phone's filter row drawn
     twice and a table scrolling to and fro, first marked, were the emulation's (*Known*'s rule); the bubble's and the
     popup's baselines on a desktop alone (`Part.devices`), the formula's help recorded on a phone as it is (its fix
     shows as a change of that baseline). A fill's tip (a drag) is item 3's, left for step 6. Silverware Database's
     settings, a Properties save's conflict and Delete database dialogs, the ⋯ menu's Visible properties, Group and
     Group by submenus, the view picker's and the sort's menus, the peek's icon and colour popovers
     (`silverware-database/ui-tests/baselines/dialogs.spec.ts`; opened by clicks and taps: the database has no long
     press; `onPhone` and `press` moved to `scripts/ui-test-helpers.ts`, the table's helpers taking them there; the icon
     picker narrowed by a search, its thousands of icons Silverware Icons'), the settings on its General and Views tabs,
     and a `keptThrough` of Visible properties' eye; a draft of Properties not told of a change made elsewhere and that
     menu drawn anew whole found (*Known*). The database's last unit, in two commits (agreed with the user, 2026-11-27:
     smaller to review, the editors' data no hold on the rest). **First, done**: the ⋯ menu's Color by submenu and its
     title turned into the name's field, a calendar's Start and a timeline's End submenus (`views/spans.ts` `spanMenu`),
     the ⋯ menu of a place at the bottom of SilverBullet's scroller, laid above its button (`menus.spec.ts`; the page
     scrolled to its end, the button by `scrollIntoView` end: a phone's bar lies under the scroller, so the scroller's
     bottom, not the window's), Properties' option palette and icon picker and a formula's names offered
     (`properties.spec.ts`, the list on a desktop alone: in the emulation it closes as typed); what the specs share in
     `baselines/parts.ts` (not a spec); for Silverware Table a `keptThrough` each: the toolbar's Filter pressed
     (`menus.spec.ts`) and a height typed in the settings (`dialogs.spec.ts`, kept). The table's toolbar drawing its
     buttons anew found (*Known*); a phone's formula names closed as it is typed, first marked, was the emulation's
     (*Known*'s rule). A menu held in the window at its right edge (`placemenu.ts`' clamp to `innerWidth`) is not
     recorded yet: the ⋯ menus are laid leftwards from their button and the view picker's is laid rightwards from its
     button near the place's left (x 93 on a phone, the menu ending at 303 of 412), so none reaches it (the peek's
     colour popover at the right margin is `views/popover.ts`'); recorded first in step 6 (the overlays), a tool menu in
     a window narrower than its left edge plus its width. `keptThrough` now throws where two items share a name or one
     has none (a module's settings row has no `data-swt-setting`: rows are named by their text). **Second, done**: a
     cell's editors laid over the page (`editors.spec.ts`, on `parts.ts`, its font the place's, iA-Mono): a person's
     names offered (Anyone: a field taking any name), a multiple select's boxes, a reference's search (the space's
     pages: no database of its own; narrowed to the test's two pages and a new one), a value's files and a file's menu
     (an image under `<root page>/files`, Silverware Assets installed in the test space), a link's fields; the link the
     table's last column, so on a phone its panel, the reference's and the boxes' are held at the window's right edge
     (`views/float.ts`' clamp, every panel's, the typed select's suggestions too); a `keptThrough` of the reference's
     search typed on (known: its list drawn anew, *Known*). A select's and a date's pickers are the browser's (none to
     record), and so is an item's removal (`editor.confirm`). **After it, the rest of item 5 narrowed** (decided with the user,
     2026-11-27, weighing what the units found against their cost: the first ones found most, the submenus and popovers
     on the shared menu code little): one small unit a plugin, its main settings dialog and its main menu alone, what a
     step of the rewrite changes: Silverware Chart's settings and menu, Silverware Layout's page dialog and its handle's
     menu, Silverware Assets' settings dialog and file menu, Silverware Tags' settings and manager, Silverware Toolbar's
     settings and popup. Left out, on purpose: Layout's column grips' menu, Assets' insert and rename dialogs, side
     panel and file enlarged, Toolbar's action panel and Turn into list (the shared menu and dialog code they stand on
     is recorded; each part a later step changes on its own gets its baseline in that step, before it). **Chart,
     Layout and Assets, done** (2026-11-28, each `<plugin>/ui-tests/baselines/<plugin>.spec.ts`): Silverware Chart's
     ⋯ menu (the chart hovered, on a phone tapped: Chrome sends a tap's mousemove, which shows its toolbar) and its
     settings dialog (General's rows, a switch's track; a `keptThrough` of a switch turned on: its rows kept), and a
     known bug (a menu inside a menu, *Known*); Silverware Layout's settings dialog (its Page tab's slider, amount,
     px/% segments, alignment; its subtitle, the page's name, written one length before it is read) and a small
     table's handle's menu (Align alone; on a phone a handle shows only beside a widget narrower than the window);
     Silverware Assets' settings window (its first tab) and an image preview's "…" menu. **Tags and Toolbar, done**
     (2026-11-28): Silverware Tags' settings dialog and its manager (By tag on the sample's pages, its first tag
     chosen), and a known bug (the manager not over a phone's whole screen); Silverware Toolbar's popup of every action
     (from the bar's "…": on a phone the bar docked at the bottom, its fixture keeping an emulated phone's touch,
     `hasTouch`) and its settings dialog from it, and a known bug (the popup's actions wider than its list). Item 5 is
     done. The toolbar's bar of a chart
     is left out (the narrowing: its menu's place follows it). A fixture that gathers the page's errors itself hands
     them to `expectNoPageErrorsYet` by `gatherPageErrors` (Silverware Chart's, as the table's). **Two runs of one
     target never at once** (the root CLAUDE.md): a re-record started beside a `--repeat-each` run failed both.
  3. **The lists left of items 2 to 4 that steps 3 to 5 change** (the decision above), each in the plugin's own
     `ui-tests/` beside the item's other tests (`reload.spec.ts`, `writes.spec.ts`, `undo.spec.ts`, `hosts.spec.ts`).
     What the tests had of each (read 2026-11-28; the new test goes where it says):
     - Silverware Table's functions and sources across System: Reload: no UI test (unit tests alone:
       `features/formulas.test.ts`, `host/silverbullet/sources.test.ts`). In `silverware-table/ui-tests/reload.spec.ts`,
       with `sources.spec.ts`' `defineSources`, `SAMPLE_SOURCES` and its `=COUNTIFS(@tasks[done], "FALSE")`; functions
       by a `Library/` page calling `silverware.table.defineFunctions` (no helper yet).
     - Silverware Icons' `defineSets` after a reload: none. In `silverware-icons/ui-tests/reload.spec.ts`; its `open`
       writes under `UiIcons/` alone, so a `Library/` page needs a writer and its cleanup in its helpers.
     - Silverware Database's press beside its block: `database.spec.ts` (five points, without a reload) asserts the
       place shown and no fence alone. Missing: the caret and focus after it, the page unchanged, and after a reload.
       In `silverware-database/ui-tests/reload.spec.ts`.
     - Silverware Tags' panel across a reload: none (the manager alone). In `silverware-tags/ui-tests/reload.spec.ts`
       (`panelRow`, `panelAction`, `openManager`): a row opened gives one manager.
     - Silverware Layout's font zoom: `fontsize.spec.ts` exact (a pixel a step, the label, Ctrl+0), a browser reload
       alone. Missing: a step after System: Reload (a listener twice: two px a notch). In `fontsize.spec.ts`.
     - Silverware Assets' File: Upload: `insert.spec.ts` exact. Missing: one dialog after System: Reload, none told;
       the setting off. In `silverware-assets/ui-tests/reload.spec.ts` (`uploadReplaced`, `dialog`, `rows` moved from
       `insert.spec.ts` to helpers).
     - Silverware Chart: `writes.spec.ts` has the Type menu on the second of two blocks alike and Save with nothing
       changed, exact; a settings Save that changes something only by fragments (`chart.spec.ts`). Missing: the whole
       page after such a Save, on the first and on the second of two blocks alike. In `writes.spec.ts`.
     - Silverware Tags' operations with Undo: `undo.spec.ts` exact for Remove, merge, Cleanup's merge, by page.
       Missing (item 4's own list): Rename exact, Remove of several, the subtags' options, Page tags, the panel's + and
       −, the Undo command, a custom operation's, Undo of a page changed since, Add to and Remove from pages. In
       `undo.spec.ts` (`writtenThenUndone`).
     - Silverware Editor's keys: hosts are a grid's cell and the peek (Silverware Table's cell is not the editor).
       Ctrl+Z and Ctrl+Y in the grid (the editor not ensured), Ctrl+Z alone in the peek; a press beside, by
       fragments; Ctrl+Enter in neither (the grid binds `Mod-Enter` to leave; the peek passes keys: today's to record);
       the notice of a kept key in the grid, in the peek only in its name's plain input. In
       `silverware-editor/ui-tests/hosts.spec.ts`, the editor ensured (its "opened again until it is the editor").
     **Done** (2026-11-28), each where it says above: Table's VAT and sources read after System: Reload (a formula of
     each written again; `setOtherFile` writes a script's JS module); Icons' set of one's own still answering, defined
     once (whether its script ran again cannot be told: the registry keeps the sets of before until a new one, and
     SilverBullet was seen running a deleted page's block again after a load of the page: for step 3, which moves the
     registries); Database's press beside after a reload (the caret left at the page's end, the editor not focused,
     nothing written); Tags' panel across a reload (its row drawn anew pressed); Layout's notch a pixel after a reload;
     Assets' File: Upload after a reload (the command defined anew waited for); Chart's settings changed, the page whole,
     on the second of two blocks alike too; Tags' rename exact and undone, the Undo command, Undo of a page changed
     since; Editor's Ctrl+Z, Ctrl+Y, Ctrl+K said in the grid and the peek, Ctrl+Enter (the grid leaves, written; the
     peek binds none: the editor's own, a line more indented as the last). Left of item 4's Tags list, for step K or
     the step that changes them: Remove of several, the subtags' options, Page tags and the panel's + and − with Undo,
     a custom operation's Undo, Add to and Remove from pages.
  4. **Item 6** (the decision above): the playground's benchmark and SilverBullet's, their first numbers written.
     **Done** (2026-11-28): numbers in step S, item 6; a race of a database's filter found by it written there.
  5. Step S done: *Progress* updated, the *Known* list reported to the user (not a wait, *Rules*: step S's rest and
     step 1 run on). **Done** (2026-11-28). Then **step 1** (its section below), its commits pushed to
     `silverware-core`.
- **How each unit of work is done** (the user's way, agreed 2026-11-26), one unit (a test file, a part of an item) at
  a time:
  1. Write it; run it once (`npm run test:ui:sb -- <file>`: it starts SilverBullet's test servers in Docker itself,
     from port 3010; and `npm run test:ui -- <file>` where the plugin has a playground and the test is no baseline).
     A **new baseline** is written by `SW_BASELINES=update npm run test:ui:sb -- <folder>`, its JSON read (does it hold
     what the part shows: the dark theme's colours, the phone's size, no "none" where a part should be), then checked
     by a run without the variable. Writing new baselines is the agent's work; **an existing baseline that changes is
     the user's decision** (*Stop and ask*): never written anew to make a run pass.
  2. Run the new files 10 times in parallel (`--repeat-each 10`): every run green, none flaky. A flaky one is a race
     or a value that differs between runs: find which and fix it, never a pause or a retry. A value of a baseline
     that differs between runs is made stable (`opaque`, `replace`, `omit`, `settledLook`'s waits, opening the part
     in its final state) or its part left out of `parts` with a comment saying why; `TOLERANCE` (1 px) is raised
     only by the user.
  3. A review by a fresh agent (a general-purpose subagent, read-only, no Playwright: a run may be using the
     servers) given the files and the task, not your conclusions: the new specs and their baseline JSON, the helpers
     they use, the root CLAUDE.md's interaction-test rules, step S's item and *Rules of this work*; asked for races,
     values that differ between runs, assertions weaker than a test's title, parts or states left out, rule
     breaches, each finding with file:line and a fix. Fix what it finds; send the fixes to the same agent
     (SendMessage) for a second look; repeat until it finds nothing that matters.
  4. `npm run build`, then `npm run verify` (read its "Tests N passed"); one commit: Conventional Commits, one line,
     imperative, no body, no co-author trailer (root CLAUDE.md), scoped by the plugin where it is one plugin's
     (`test(assets): …`), no scope where it spans several; **push to `silverware-core`** (the user asked for that
     after each unit of step S; never to `main`).
  5. This section and the item's entry updated in the same commit, so nothing is kept only in a conversation.
- **Runs longer than a few minutes go detached**: the Claude session runs in code-server's extension host, which
  code-server stops 3 hours after its last browser tab closed (and a session controlled from a phone by Remote Control
  keeps no tab open), killing the session's background commands with it. Write the runs into a script in the
  session's scratchpad that appends a line per step to a results file there (each step's exit code and its
  "N passed / failed / flaky" line, a last line `done`), start it with
  `setsid nohup <script> > /dev/null 2>&1 < /dev/null &`, then wait for `done` in a background command (a loop
  reading the file every 30 s). A restarted session reads the file to know where the run got to. A run stopped half way leaves SilverBullet's test containers:
  `docker ps --format '{{.Names}}' | grep silverware-ui-tests | xargs -r docker rm -f`. Never two runs of one target at
  once (their ports collide). `pkill -f` with a pattern from the command line kills the shell running it: list the
  pids (`ps aux | grep …`) into a file and `kill` them.
- **What was found the hard way** (each also in the entry it belongs to):
  - Dark theme: SilverBullet 3.0 follows `prefers-color-scheme` (`page.emulateMedia`, then wait for
    `data-sb-scheme`); a `data-theme` set by hand changes no colour. A part that copies colours as it opens (the peek)
    is opened in its theme, the switch while open a test of its own.
  - A fixed day: `page.clock.setSystemTime` before the page loads (the time runs on); `setFixedTime` stops it and
    SilverBullet never finishes indexing.
  - Values given in the order things were read (a database item's `data-item`, `page-1`, `page-2`) differ under load:
    `domOf(…, { opaque: ["data-item"] })` numbers them by where they are drawn. A test folder's name (in an `href`,
    URL-encoded) is replaced. The focus ring (`outline`) is not part of a look.
  - CodeMirror draws the lines in view only: a widget under a long text is drawn once scrolled to.
  - Silverware Editor's editor loads when the browser is idle: a cell or peek opened before keeps a plain field;
    tests open it again until its `.cm-content` is there (`toPass`, a few seconds a try).
  - A database's module start (the peek, Properties) follows its init page: after System: Reload, wait for what it
    draws (the place menu's Properties) before using one.
  - `test.fail` with no reason, or before the setup, takes any failure for the known one: the rule in *Rules of this
    work*; `expectNoPageErrorsYet(page)` on the line above it; `scripts/ui-test-locks.test.ts` checks both.
  - CI runs the UI tests against SilverBullet alone: a playground's failure shows only in a local `npm run test:ui`.
    Silverware Table's touch tests of a tall dialog started on the sample page and set their own with `setPage`, so
    `cell(page, 1, 0, 1)` was the sample's table till the new page was drawn: the pivot's failed on every run from the
    commit that added it. They now start on their pages (`startingOn`), as the table's CLAUDE.md says.
  - A part whose place differs run to run may move by itself: watch it from before the action that opens it (its
    scroll events, or `requestAnimationFrame` in one `evaluate`) before taking it for a race of the test (a phone's
    table scrolling to and fro, found the emulation's, *Emulation's, not bugs*: read twice a second apart it seemed
    to land at random; read every frame it went to and fro for about 20 frames and then stayed).
  - Probing SilverBullet: a temporary spec under `cross-plugin/ui-tests/probe/` printing what it reads
    (`console.log`, read with `grep`), deleted after; what it found written here or in the plan.

- **Step S, how it is laid out** (agreed with the user, 2026-11-26): the plugins together are `cross-plugin/ui-tests/`
  (SilverBullet only; an area folder each, a CI group each: `stacking/` now). System: Reload goes in **each plugin's**
  `ui-tests/`, every one of the 12 (the viewers and Icons too: their init or API page runs again), a
  shared helper for the reload in `scripts/ui-test-helpers.ts`; "no listener twice" is checked by behaviour (an action
  done once: one write, one menu, one notification), never by hooks in `src/`. Item 3 covers every stacking, a
  plugin's own too (its menus over its dialogs, its controls over its widgets), those in its plugin's folder.
- **Shared helpers**: `scripts/ui-test-helpers.ts` has the space fixture (`withSpace`) and the page's errors
  (`pageErrors`); `cross-plugin/` uses them. The plugins' own helpers still have their copies: moved onto these when
  touched, not all at once.
- **Item 1 done** (`cross-plugin/ui-tests/stacking/stacking.spec.ts`, 12 scenarios, each green 10 times in
  parallel): Assets' dialog and side panel over the peek, Icons' picker over Properties (Esc, Tab and Shift+Tab at
  the dialog's edges, on top) and in the toolbar's settings, the toolbar and its popup over the peek and over a grid's
  cell, one menu open across plugins (by a command and as a user goes), a database over the window with its own menu
  on top and the toolbar standing back. **One menu open holds today by the focus leaving a menu or a press beside
  it**, no rule the plugins share (a database's menu closes as the focus leaves it or by a press beside it, the
  toolbar's popup by a press outside): the core's one stack of overlays (step 6) makes it a rule.
- **Item 2 done** (`<plugin>/ui-tests/reload.spec.ts` in each of the 12; `reloadSpaceLua` in
  scripts/ui-test-helpers.ts runs System: Reload and returns once Space Lua has run again, probed; what a plugin
  starts after its init page, a database's modules, is waited for by what it shows): after it each plugin works once
  (one bar, one menu, one editor, one chart toolbar, a row or an action done once, Silverware Assets' Upload file
  there with no notice of its actions defined again, Ctrl+Z undoing one edit, a preview or chart drawn once for an embed put in after), Undo kept, a
  table's sheet view kept, the toolbar's favourites kept, a peek's typed text written once. Not yet exercised by
  it (each re-run by a load, the cheapest check named; when each is recorded: the decision of 2026-11-27 above): Silverware Table's definitions and `onWrite` listeners
  reset (a unit test: one listener after a reset), Silverware Icons' `defineSets` (a `Library/` set, reloaded, its
  icon drawn, no notification), Layout's handle with each provider registered again (one handle on a table hovered),
  Silverware Database's press beside its block, the Tags panel (a row opened: one manager; a manager open across the
  reload), Layout's font zoom (one step per Ctrl+scroll), Assets' File: Upload (one dialog).
- **Item 3 done** (`onTopAt` and `ON_TOP` in scripts/ui-test-helpers.ts, each corner read past its own rounding;
  `<plugin>/ui-tests/stacking.spec.ts` in Chart, Layout, Table, Database, Assets, Toolbar and Tags): each plugin's own
  layers on top whole, and where one has an Esc, it closes that layer alone, what is under it kept in its own state (a
  selection, a chart's toolbar, a table over the window): a chart's toolbar, menu and settings; a grid's cell grip
  and handle with their menus; a table's toolbar, menu, round + and a dialog, and the table over the window with its
  toolbar and menu; a database's place menu, Properties, a value's files' popup with a file's menu over it, the peek
  and its color picker; Assets' file menu, side panel and a file enlarged (its box, not the backdrop); the toolbar's
  bar, popup, an action's panel and Turn into list; the tags' manager. Across plugins: item 1. Icons, Editor and the
  three viewers lay no layer of their own. **Not covered yet** (by worth): Properties' own menus over its dialog, a
  filter or sort tool's menu, Table's choices list, cell popup, formula hint and fill tip, Layout's Move to grid
  picker, Assets' Rename and insert dialogs and upload progress, the plugins' settings windows.
- **Item 4 done** (what the existing scenarios left out, recorded as it is today, each test's writes whole):
  Silverware Tags' manager: Remove, a merge, Cleanup's merge and a change by page, each with every page it wrote
  exactly, then undone, every page back (`silverware-tags/ui-tests/undo.spec.ts`; only Rename's Undo was tested). A
  chart's block: written into the one of two alike it was changed on; the settings saved unchanged writing nothing,
  a block following a table too; two blocks alike following one table both written by a cell's edit, the table as
  Silverware Table writes it (`silverware-chart/ui-tests/writes.spec.ts`). Silverware Icons' picker keys: at its
  edges, with the search empty, given back to the search as a key is typed (`silverware-icons/ui-tests/keys.spec.ts`).
  Silverware Editor's field in its two hosts (a grid's cell, a database's peek: the only `editors.create`) writing
  what SilverBullet's page editor writes for the same keys (`silverware-editor/ui-tests/hosts.spec.ts`, the page the
  reference: a list ended by Enter on its empty item puts the next text on the line after it, which Markdown reads
  as the item's; the page does the same). **Not recorded yet**: Tags' Remove of several tags, Remove taking the text
  too or from page tags only, the subtags options, Page tags on the open page, the panel's + and − and their Undo,
  the Undo command, a custom operation's Undo, Undo of a page changed after it, Add to pages and Remove from pages
  from a tag; a chart's exact block after a settings change, settings saved on the second of two alike; the picker's
  Nothing found, a group with a search, a tab switched; the editor's Ctrl+Z and Ctrl+Y per host, leaving by a press
  beside, Ctrl+Enter in a cell, the notice of a key SilverBullet keeps.
- **Item 5, how it is laid out** (agreed with the user, 2026-11-26): each plugin's baselines in an area of its own,
  `<plugin>/ui-tests/baselines/` (a CI group each), on `scripts/ui-test-baselines.ts`: `domOf` (normalized DOM),
  `lookOf` (computed styles and boxes of named parts against the part's own box, a part holding text without its
  width), `expectBaseline` (a file each, `<spec>.baselines/<name>.json`, boxes within 1 px; `SW_BASELINES=update`
  writes them, never a checking run), `setTheme` (light or dark as the system asks: SilverBullet 3.0 follows
  `prefers-color-scheme`; a `data-theme` set by hand changes no colour), `keptThrough` (which items' nodes an action
  keeps, and how many nodes it took out and put back), `settledLook` (read once SilverBullet's font is loaded and two
  readings a frame apart agree). The DOM keeps what shows (`hidden`, `title`, `disabled`…, an icon's hash), not other
  plugins' marks. **Item 5 so far**: Silverware Database's place and its table, list and board views (DOM and look,
  light and dark, on a desktop and a phone: Chrome's Pixel 7, its touch and pixel ratio), and a filter typed and an item changed
  elsewhere (`silverware-database/ui-tests/baselines/views.spec.ts`; the field keeps its focus and caret, every row is
  drawn anew: known, what was kept in the report's annotations); its menu, peek and Properties, and the calendar and
  timeline at a fixed day (`page.clock.setSystemTime`: the time runs, `setFixedTime` stopped SilverBullet's indexing),
  each opened in its theme, and a filter written into the block by Enter and by the field left, SilverBullet drawing
  the block's widget anew, the focus, caret and the page's scroll kept (`overlays.spec.ts`). What is left: *Where
  the work stands and what is next*, above.

## Steps

Estimates are rough; checkpoints correct them. About 6 to 8 months in all.

### S. The safety net (2 to 3 weeks)

Tests written against today's code, so they record today's behaviour and the
rewrite is checked against it. The UI tests (about 660 scenarios, run against
SilverBullet's release and edge) check behaviour as a user acts; what they
miss is where this work reaches most (counted 2026-11-25): the plugins
together (Silverware Table 0 of 22 spec files touch another plugin, Database
2 of 5, Toolbar 2 of 8, Assets 3 of 7, Layout 5 of 15), Space Lua loaded
again (no scenario), what lies on top, the rendering itself, and the parts
with few scenarios that are rewritten (Silverware Tags 21, Chart 20, Icons 5,
Editor 3). The rest of the plan leans on this step.

- **Scope**:
  1. **The plugins together**, a suite of its own (a folder of ui-tests, its
     CI group): a dialog over another plugin's dialog (Esc, Tab, the focus
     back), Silverware Assets' upload dialog over a database's peek, Silverware
     Icons' picker in a settings dialog, the toolbar over a grid's cell and
     over the peek, one menu open at a time across plugins, a side panel over
     another, a widget over the window under its own controls.
  2. **System: Reload** in each plugin: after it the plugin works, no
     listener twice (an action done once), the database's Undo and an open
     peek kept, a table's view kept, the toolbar's settings kept.
  3. **What lies on top**: `elementFromPoint` at an overlay's middle and
     corners and at the controls over a widget, in each stacking the plugins
     make, not visibility alone.
  4. **Characterization of the parts rewritten with few scenarios**: the tags
     workspace (each action, its writes), a chart's block written (from its
     settings, a table followed, two blocks alike), the icons' picker, the
     editor's field in each host.
  5. **Rendering baselines** of each part the work converts or moves (views,
     the place's chrome, the peek, dialogs, menus, side panels, the toolbar's
     settings, the tags workspace), in its main states:
     - **DOM**: a normalized `outerHTML` (classes, `data-*`, structure);
     - **look and geometry**, kept as text, not pictures (and, decided
       2026-11-27, a part's place against its anchor and the window): the computed styles
       of its key elements (font, colours, spacing, borders, sizes) and their
       boxes against the anchor and each other, light and dark theme, desktop
       and phone, compared with a tolerance, text widths left out (they follow
       the machine's fonts). Catches what the DOM misses (a wrapper more that
       breaks a flex, a padding moved, a panel shifted) and reads as a diff;
     - **rendering stability** per action: the element kept (the same node
       after an action that rebuilds nothing: typing in a filter, one item
       changed), nothing blinking (a MutationObserver over the action: no node
       of an unchanged item removed and put back), the focus, the caret and the
       scroll kept through a data change, a write of the block and a redraw by
       SilverBullet. Where today's code blinks or loses the focus, the test
       records it as it is (marked, with the fix expected): the conversion
       turns it green, checkpoint C's measure.
  6. **Rendering cost**: a database's views and a table drawn with 1,000 and
     10,000 items, timed in the playground (one drawing's cost, steady), and in
     SilverBullet each action's draws counted and timed (what the playground
     lacks: the widget drawn anew on a write, rendered twice, the index emptied
     while a page is indexed again); decided 2026-11-27, its method in *Notes
     for the next session*' decision of that day; written here; compared after
     each conversion, the commit before and after run in one session.

     **Measured (2026-11-28)**, on commit b2606910 with the bench specs (nothing of `src/` changed), an Intel i3-9100
     (3 cores), Linux, Playwright 1.65.1's Chromium headless, SilverBullet 3.0.0 (Docker, `3.0.0-slim`); `--workers 1`,
     nothing else running; each cell the median (least-most) of 5 after a warm-up, in ms.

     *The playground's database* (`silverware-database/ui-tests/bench.spec.ts`): per action its time until the page
     holds still 500 ms, the long tasks' sum, the nodes added and removed (the mutation records' own nodes: a view's
     root redrawn counts as one). A calendar shows no Load more button (it lies in a day's cell, hidden where the day
     shows none: "-"). `?big=N` has a date property `due` since (the calendar and the timeline place items by it): its
     numbers are not like-for-like with those of 2026-11-22 (docs/silverware-database-formulas.md). `?pageSize=P` sets
     `silverware.database.pageSize` (playground/database.ts).

     | View | Items | At first | First draw: ms, long, nodes | Changed elsewhere | Filter key | Load more |
     | --- | --- | --- | --- | --- | --- | --- |
     | table | 1000 | 1000 | 447 (435-474), 389, 86 | 213 (210-214), 120, 10 | 192 (175-209), 92, 11 | - |
     | list | 1000 | 1000 | 418 (396-810), 162, 86 | 143 (142-277), 82, 10 | 88 (85-89), 0, 11 | - |
     | board | 1000 | 1000 | 375 (361-382), 101, 85 | 80 (78-86), 0, 8 | 52 (51-53), 0, 9 | - |
     | calendar | 1000 | 1000 | 352 (348-359), 75, 85 | 60 (44-64), 0, 8 | 14 (13-34), 0, 9 | - |
     | timeline | 1000 | 1000 | 429 (412-448), 202, 85 | 118 (114-122), 87, 8 | 54 (53-55), 0, 9 | - |
     | table | 1000 | 50 | 354 (341-362), 78, 86 | 42 (35-50), 0, 10 | 20 (19-25), 0, 11 | 81 (63-105), 0, 12 |
     | list | 1000 | 50 | 340 (339-358), 60, 87 | 46 (28-59), 0, 12 | 16 (16-19), 0, 13 | 63 (52-111), 0, 14 |
     | board | 1000 | 50 | 353 (342-357), 64, 85 | 56 (41-64), 0, 8 | 18 (18-19), 0, 9 | 66 (52-92), 0, 10 |
     | calendar | 1000 | 50 | 358 (340-370), 75, 85 | 54 (33-64), 0, 8 | 18 (14-21), 0, 9 | - |
     | timeline | 1000 | 50 | 347 (343-365), 66, 85 | 55 (47-63), 0, 8 | 15 (14-15), 0, 9 | 39 (33-49), 0, 10 |
     | table | 10000 | 10000 | 1501 (1488-1533), 3588, 86 | 2040 (2029-2050), 1158, 10 | 1480 (1477-1509), 1183, 11 | - |
     | list | 10000 | 10000 | 1105 (1098-1115), 1276, 86 | 1320 (1313-1337), 744, 10 | 847 (843-857), 567, 11 | - |
     | board | 10000 | 10000 | 739 (729-764), 618, 85 | 706 (697-729), 419, 8 | 570 (534-593), 406, 9 | - |
     | calendar | 10000 | 10000 | 570 (568-636), 297, 85 | 255 (254-265), 234, 8 | 57 (57-62), 53, 9 | - |
     | timeline | 10000 | 10000 | 1315 (1299-1360), 3336, 85 | 1082 (1067-1095), 1273, 8 | 526 (493-634), 441, 9 | - |
     | table | 10000 | 50 | 502 (486-512), 226, 86 | 177 (151-183), 153, 10 | 33 (33-36), 0, 11 | 99 (82-112), 59, 12 |
     | list | 10000 | 50 | 492 (483-553), 210, 87 | 184 (156-187), 160, 12 | 33 (29-37), 0, 13 | 96 (70-105), 0, 14 |
     | board | 10000 | 50 | 503 (491-518), 223, 85 | 188 (169-199), 160, 8 | 35 (35-38), 0, 9 | 87 (69-99), 0, 10 |
     | calendar | 10000 | 50 | 588 (570-613), 294, 85 | 260 (236-307), 238, 8 | 58 (56-61), 56, 9 | - |
     | timeline | 10000 | 50 | 521 (495-530), 223, 85 | 191 (186-197), 171, 8 | 34 (33-36), 0, 9 | 74 (52-100), 0, 10 |

     *The playground's table* (`silverware-table/ui-tests/bench.spec.ts`, its benchmark panel: 8 columns, a calculated
     column, a totals row): "shown", from the press or key to the frame painted after the table shows it (the last row
     drawn; the cell's text saved), measured in the page; "work", Silverware Table's own as the panel's log sums it
     (its "shown after" is not taken: it grows with every later entry of the action). The cell edited by a double
     click, a key, Enter.

     | Rows | Generated: shown | Generated: work | Cell edited: shown | Cell edited: work |
     | --- | --- | --- | --- | --- |
     | 1000 | 1236 (1224-1259) | 284 (281-315) | 1410 (1401-1432) | 376 (365-379) |
     | 10000 | 15875 (15727-16030) | 2786 (2776-2873) | 14670 (14058-15031) | 3840 (3367-3938) |

     *SilverBullet's database* (`silverware-database/ui-tests/sbbench.spec.ts`, 1000 items): per action its time until
     the page's content holds still (2 s for the page opened, loaded anew, and an item changed elsewhere, its page written
     through SilverBullet; 500 ms for a key typed in the name's filter and the filter kept by Enter, "Written"), the long
     tasks' sum, and the places and the views' bodies added (each a widget or a view drawn whole; a view's own update in
     place adds neither). Between runs the filter is taken off again once its write is on disk. Read: a change elsewhere
     draws nothing anew (0/0: the view updates in place; the list's least 0, one run where nothing changed in 2 s); a
     write draws one place and two bodies (the still copy, then the view); opened includes SilverBullet's own load.

     | View | Items | At first | Opened | Changed elsewhere | Filter key | Written |
     | --- | --- | --- | --- | --- | --- | --- |
     | table | 1000 | 1000 | 2008 (1962-2416), 1013, 1/1 | 378 (373-566), 522, 0/0 | 378 (376-468), 305, 0/0 | 187 (180-210), 278, 1/2 |
     | list | 1000 | 1000 | 1654 (1623-1741), 663, 1/1 | 752 (0-777), 567, 0/0 | 212 (209-285), 166, 0/0 | 120 (108-124), 148, 1/2 |
     | board | 1000 | 1000 | 1341 (1329-1386), 359, 1/1 | 193 (177-217), 79, 0/0 | 72 (71-78), 0, 0/0 | 50 (45-70), 58, 1/2 |
     | calendar | 1000 | 1000 | 1221 (1172-1232), 231, 1/1 | 145 (141-160), 0, 0/0 | 13 (12-14), 0, 0/0 | 37 (32-46), 0, 1/2 |
     | timeline | 1000 | 1000 | 1560 (1516-1599), 573, 1/1 | 304 (296-308), 147, 0/0 | 119 (115-121), 59, 0/0 | 108 (101-121), 110, 1/2 |
     | table | 1000 | 50 | 1230 (1213-1356), 182, 1/1 | 146 (135-156), 0, 0/0 | 16 (15-18), 0, 0/0 | 52 (49-61), 63, 1/2 |
     | list | 1000 | 50 | 1124 (1080-1228), 253, 1/1 | 145 (129-154), 0, 0/0 | 11 (11-17), 0, 0/0 | 38 (36-40), 0, 1/2 |
     | board | 1000 | 50 | 1244 (1091-1269), 236, 1/1 | 141 (136-143), 0, 0/0 | 11 (10-12), 0, 0/0 | 33 (33-38), 0, 1/2 |
     | calendar | 1000 | 50 | 1244 (1131-1356), 247, 1/1 | 144 (140-159), 0, 0/0 | 13 (12-16), 0, 0/0 | 39 (34-42), 0, 1/2 |
     | timeline | 1000 | 50 | 1111 (1072-1234), 182, 1/1 | 153 (137-179), 0, 0/0 | 18 (17-31), 0, 0/0 | 43 (40-43), 0, 1/2 |

     Found while measuring (not a bug of the benchmark): a filter changed again before the place is drawn anew from its
     last write compares with the block as it was, so taking off a filter just kept writes nothing and the earlier
     write lands after (timeline, 1000 items, every time: the field shows no filter, the page keeps `{"name":"1"}`;
     core/place.ts `setFilter` against `keptFilter()`). Not in *Known* yet: its test needs the write held back until the
     second change (seen only where drawing anew is slow); reported to the user, for step K.

     Left out: a board's drag's frames (a drag in Playwright moves by steps of its own, not a hand's: its frames would
     measure the steps). Before and after each conversion (step 10) these are run again on the commits before and
     after, in one session, and compared with each other, never with these.
  Stored screenshots (docs/silverware-look-compare.md, its second kind: a few
  scenes, Linux in Docker, refreshed only on purpose) only if the look and
  geometry baselines let something through.
- **Not in it**: changes of the plugins' code, but test hooks a test needs
  (none in what SilverBullet runs: the root CLAUDE.md's rule).
- **Done when**: every item above has its tests, green in parallel and
  `--repeat-each 10` for the new files; the lists left of items 2 to 4 that
  steps 3 to 5 change recorded, the rest written into the step that changes
  them (decided 2026-11-27, *Rules of this work*); the known blinks and lost focus listed here with
  their tests; the rendering costs written here.
- **On a phone, a known bug is what a person sees** (decided with the user, 2026-11-27, after three bugs marked in
  Chrome's phone emulation were not on the user's phone): the phone tests run in Chrome's emulation of a Pixel 7, the
  user's kind of phone (Android; an iPhone is not tested); there sizes and layout are trusted, timing and scrolling not.
  A phone's test acts as a person does (a tap once what it taps is drawn and still, not in the frame it shows) and
  asserts what the person sees (the focus where tapped, a list open); what a phone's emulation does beyond a desktop
  meanwhile (a part drawn again, a scroll to and fro) is not marked: it may be recorded as a measure (an annotation,
  step 10's). A desktop's redrawings stay marked as they are (the views', the menus', the toolbar's). One that rests on
  the keyboard or on the page's scrolling is asked of the user on a real phone before it is marked.
- **Emulation's, not bugs** (2026-11-27; the filter's test made a measure with a tap once the row is still, the two
  others taken out, the cell popup's and the formula list's phone
  baselines left out): Silverware Table's filter row drawn twice as it opens, its
  second 150 to 300 ms after (a field tapped at once lost its focus; the user's tap came later; `menus.spec.ts`, "a
  filter opened, its field tapped once its row is drawn", its drawings counted); a table scrolling to and fro some 20
  frames as a long cell is edited (the user's phone grew the row once); Silverware Database's Properties closing a
  formula's names as it is typed (its body's scroll anchored in the emulation, the list closed by any scroll,
  `shared/formulafield.ts` `closeOnScroll`; the user's phone kept it). The cell popup's and the formula list's baselines
  are a desktop's alone; the filter bubble's is a phone's too, its field tapped once the row is still
  (`filterRowStill`).
- **Known, recorded by tests** (agreed with the user, 2026-11-26): the test asserts the behaviour wanted and is marked
  `test.fail(true, "Known (YYYY-MM-DD): …")` just before that assertion, after what sets it up (a setup that breaks
  is an ordinary failure). The report shows it expected to fail with its reason; the fix shows as "unexpectedly
  passed", which says to take the mark and its entry here off (*Rules of this work*; what is left is step K's).
  Every mark is found by `test.fail(`, and
  `scripts/ui-test-locks.test.ts` (in `verify`) fails on one without a dated reason or whose file is not named here:
  - Silverware Icons' picker in a database's Properties dialog lies in the dialog's scroller, its bottom under the
    footer (2026-11-26; cross-plugin/ui-tests/stacking/stacking.spec.ts, "on top whole (known: …)"). Expected fixed
    by step 6.
  - In a database's peek, the Esc that hides Silverware Toolbar (shown by a selection) closes the peek too: the
    toolbar's key listener does not take it (2026-11-26; cross-plugin/ui-tests/stacking/stacking.spec.ts, "Esc hides
    the toolbar alone (known: …)"). Expected fixed by steps 4 and 6.
  - In a grid's cell edited, the Esc that hides Silverware Toolbar leaves the cell too, for the same reason
    (2026-11-26; cross-plugin/ui-tests/stacking/stacking.spec.ts, "then leaves the cell (known: …)"). Expected fixed
    by steps 4 and 6.
  - Esc in Silverware Toolbar's Turn into list hides the bar too, where the popup's and a panel's Esc close them
    alone: the list has no key handler and takes no focus, so the controller's key listener hides the bar and the
    Esc goes on to the editor, whose Escape collapses the selection; both halves to fix (2026-11-26;
    silverware-toolbar/ui-tests/stacking.spec.ts, "Turn into's list on top whole (known: …)"). Expected fixed by steps
    4 and 6.
  - A database's view is drawn anew whole as its filter is typed in, and as an item changes elsewhere: every row put
    anew, none kept (2026-11-26; silverware-database/ui-tests/baselines/views.spec.ts, "(known: every row drawn
    anew)", two tests). Expected kept by the Preact conversion of the views (step 10, checkpoint C's measure).
  - Silverware Table's formula help is wider than a phone's window (478 px in Pixel 7's 412), its right part out of it
    (2026-11-27; silverware-table/ui-tests/baselines/menus.spec.ts, "a formula's help whole in the window (known:
    wider than a phone's)"). Expected placed within the window by the core's floating (step 6).
  - Silverware Database's Properties dialog follows a change made elsewhere only as a place is drawn anew
    (`modules/properties/index.ts` `placeDrawn`; the peek has `host.onChanged` too), and a place shows a schema
    changed elsewhere without that: an open draft is not marked stale, its note says "Not saved yet" till Save, which
    then refuses and offers the conflict, nothing lost (2026-11-27;
    silverware-database/ui-tests/baselines/dialogs.spec.ts, "a draft of Properties made of properties changed
    elsewhere: told under its list before Save (known: …)"). The cause: a change made elsewhere reaches a place by
    `refresh()` and `instance.update()` (core/place.ts), which does not draw, so `placeDrawn` and the dialog's
    `follow()` never run. Being told before Save is the code's intent (modules/properties/index.ts, the comment over
    `placeDrawn`: "a change made elsewhere … its open dialog follows"), not a decision with the user
    (docs/silverware-database.md guarantees the conflict on Save alone); and `follow()`'s note then says "Save writes
    nothing", where Save offers the conflict: that text to fix with it. Should it ever pass unexpectedly: an index
    that briefly gives nothing makes `refresh()` draw. Expected told as the change comes (steps 4 and 6).
  - Silverware Database's ⋯ › Visible properties menu is drawn anew whole as an eye in it is pressed, none of its
    rows kept (2026-11-27; silverware-database/ui-tests/baselines/dialogs.spec.ts, "an eye in Visible properties
    pressed: … (known: the menu drawn anew)"). Expected kept by the Preact conversion of the menus (step 10,
    checkpoint C's measure).
  - Silverware Database's reference search draws its list anew whole on each letter typed: none of the pages found
    kept, nothing blinks (`views/editors.ts`, `list.replaceChildren`) (2026-11-28;
    silverware-database/ui-tests/baselines/editors.spec.ts, "a reference's search typed on: … (known: its list drawn
    anew)"). Expected kept by the Preact conversion of the editors (step 10, checkpoint C's measure).
  - Silverware Chart's ⋯ menu is a menu inside a menu to assistive technology: its floating box has `role="menu"`
    (`src/core/toolbar.ts`) and the shared menu inside it its own (`shared/menu.ts`); Silverware Layout's popup has
    one (2026-11-28; silverware-chart/ui-tests/baselines/chart.spec.ts, "the chart's menu one menu to assistive
    technology: …"). Expected one once the core's menus place it (step 6); the menu's DOM baseline changes with it.
  - Silverware Tags' manager is not over the whole screen on a phone, as its settings and every plugin's dialog are:
    the style page's phone rule (`max-width: 640px`) takes `.swg-dialog` alone, and `.swg-dialog.swg-workspace` keeps
    its height of at most 760 px over it, the manager centred with the page above and below (a rule of the window's
    width, so a real phone too) (2026-11-28; silverware-tags/ui-tests/baselines/tags.spec.ts, "the manager over the
    whole screen, … (known: 760 px tall)"). Expected fixed in step K; the manager's phone baseline changes with it.
  - Silverware Toolbar's popup of every action: each action is 100% of its list wide and padded besides
    (`.swb-option`, its box `content-box`), so 16 px wider than the list, which scrolls sideways
    (2026-11-28; silverware-toolbar/ui-tests/baselines/toolbar.spec.ts, "the popup's actions within its list: …
    (known: 16 px wider)"). Expected fixed in step K (`box-sizing: border-box`); the popup's baselines change with it.
  - Silverware Table's toolbar draws its buttons anew whole as the table's view changes (Filter pressed): the bar
    kept, none of its buttons (`core/toolbar.ts` `show`: `replaceChildren`, each button made again) (2026-11-27;
    silverware-table/ui-tests/baselines/menus.spec.ts, "the toolbar's Filter pressed: … (known: its buttons drawn
    anew)"). Expected kept by the Preact conversion (step 10, checkpoint C's measure).
  - A database's peek keeps the text colour of the theme it was opened in when the theme is switched while it is
    open: it copies the editor's colour into its inline style once (host/silverbullet/platform.ts `editorLook`), dark
    text on the dark theme (2026-11-26; silverware-database/ui-tests/baselines/overlays.spec.ts, "(known: kept
    light)"). Expected to follow the theme once the peek's look is read where it is drawn (steps 6 and 10).
  - System: Reload closes a database's peek open: the modules are made anew by a load of Space Lua, the peek among
    them; what was typed in it is written once as it closes (2026-11-26;
    silverware-database/ui-tests/reload.spec.ts, "the peek kept open (known: closed)"). Expected kept once the peek's
    state is the core's (steps 6 and 10).

### 1. The core's skeleton (1 week)

- **Scope**: `silverware-core/` as a plugin (library page, API page at
  priority 60, style page, `src/api.ts`, `VERSION`, `CLAUDE.md`; its version
  and the changelog's first entry, which check-build needs, drafted and
  confirmed by the user as the root CLAUDE.md's *Versions* says); the gate's Lua block written into each plugin's API page
  by a script with the plugin's need, checked by check-build; the stubs of a
  refused plugin's API, the init pages doing nothing for it; `requires:` in
  every library page; the build's external and aliases; vitest, tsconfig
  `paths` and scripts/playground.mjs resolving the core to its source, a
  memory bridge for tests and the playground; scripts/deploy.mjs, the UI test
  servers, REPO.md, versions.mjs, the isolation tests (plugins import the core's
  `api.ts` only); the root CLAUDE.md's rules ("a plugin needs no other
  installed", "nothing is shared at run time", and the rule of where code
  goes: docs/silverware-core.md, *Where code goes*), its table, the prefix
  `swk-`, the scope `core`; shared/modulestate.test.ts with today's state
  listed (what moves to the core listed as "until step N", each entry leaving
  the list as its step moves it), the constants typed readonly; the core's own
  layers (host-free `src/`, `src/host/silverbullet/`) and its isolation test;
  scripts/hostisolation.test.ts (docs/silverware-core.md, *SilverBullet kept
  apart*) with today's leaks listed, each with the step that moves it
  (step 4 for the plugins' entries and shared/configpage.ts);
  scripts/pagewrites.test.ts (docs/silverware-core.md, *Storage*: SilverBullet's
  write functions named outside a binding, the writer and the editing tools)
  with today's places listed (Chart's, Layout's and the settings'
  `CONFIG_PAGE`: step 4); scripts/uiislands.test.ts (docs/silverware-preact.md,
  *Two ways, one rule*) with today's `el()` islands listed (steps 7 and 10);
  the `@since` test of the core's exports against each plugin's need.
- **Not in it**: any service. The core only loads and says its version.
- **Done when**: the module-state test fails on a new `let` at a shared/
  file's top level and the host test on a new `.sb-` selector outside a
  binding (their own unit tests), both passing on today's listed state;
  every plugin starts through the gate on the UI test servers;
  UI tests: no core, an older core (each: the notification, no plugin start,
  the API stubs' message); unit tests of the gate's script; verify green.
  Checked by hand once (written here): Library: Install of a plugin from the
  pushed branch's GitHub URI installs the core by its `../` requirement.

### 2. Preact in the core (a few days)

- **Scope**: `preact`, `preact/hooks`, `preact/jsx-runtime`,
  `@preact/signals` pinned and re-exported by the core; `.tsx` in tsconfig,
  vitest's include, every scanner of src/ (the isolation tests,
  shared/imports.test.ts, scripts/ui-test-locks.test.ts, playwright.config.ts,
  scripts/playground.mjs); the rule that only drawing layers import Preact;
  the root CLAUDE.md gets the rule of *Two ways, one rule*
  (docs/silverware-preact.md). A component of the core's own, with its test
  (`act`), proving the chain.
- **Done when**: bundles measured before and after (written here); verify and
  UI tests green.
- **Checkpoint A**: every plugin runs on the core, nothing changed for a user.
  Stop for the user.

### 3. The formulas' registries (1 week)

- **Scope**: docs/silverware-core.md, *Services* G: the definitions and their
  reset in the core's main file; shared/formulas into
  `silverware-core-formulas.js` beside it, reading them; Silverware Table and
  Database import it statically (its public module `src/formulas.ts`, the
  isolation tests allowing it beside `api.ts`, forbidding shared/formulas);
  the plugins' `resetDefinitions` reset no formulas' definitions any more;
  `silverware.formulas.defineFunctions` / `defineSource`, the table's names
  as aliases said deprecated (P1); the library pages say so.
- **Done when**: a function defined once is calculated in a table and in a
  database (unit and UI test); the instanceof classes come from one copy (a
  test of a value made by one plugin read by the other); a user with only
  Silverware Toolbar loads no formulas' file (UI test of requests); no
  plugin's API page resets the formulas' definitions (a test reading them);
  the engine is synchronous for Table and Database as before (their tests
  unchanged).

### 4. SilverBullet bridge and events, every plugin's binding (2 to 3 weeks)

- **Scope**: the core's API page hands SilverBullet's API once (`Platform` and
  the functions beyond it); the core's Lua listens to the shared events; each
  plugin's Lua and `host/silverbullet/` slimmed to what is its own (I1);
  SilverBullet's widget menu taken off by one watcher. Every plugin gets its
  `src/host/silverbullet/`: what Chart, Toolbar, Tags, Icons, Editor and the
  viewers keep of SilverBullet in their entry files (and Tags'
  `space/silverbullet.ts`) moves there, the entry only composing; the leaks
  of *SilverBullet kept apart* move into bindings; shared/configpage.ts into
  the core's binding. Storage at the same boundary (docs/silverware-core.md,
  *Storage*): every plugin's settings through `Platform.settings`, with a
  `save` of the plugin's own block for settings that are tables (the
  toolbar's favourites), no plugin touching `Library/Config`; page writes by
  type (I7: `Platform`'s `Editor` and `Space` without `replace` and `write`,
  `DocumentWriter` to the page writer and the editing tools); Silverware Chart
  writes its block by the `codeBlocks` part (its formats' codec unchanged);
  Silverware Layout's `/grid` by the `grids` part; Silverware Database's
  conversion inserts its block by the `codeBlocks` part.
- **Done when**: no plugin's Lua hands a function the core hands; the host
  test's list holds no plugin entry, leak or shared/ file any more; tsc keeps
  `replace` and `write` from every module but the page writer and the editing
  tools; the page writes test's list holds editing tools only (the toolbar,
  editors' fields) and Silverware Tags' UI (step 10); a chart's block written while the page is
  edited elsewhere, and two charts' blocks written alike, each a UI test;
  every plugin's UI tests green, on `test:ui:sb` and `test:ui:sb:edge` too.

### 5. Geometry and editing surfaces (1 week)

- **Scope**: D and E of the core's services; the plugins read them; the
  per-plugin watchers of SilverBullet's panels gone.
- **Done when**: one watcher of the navigator; the toolbar finds surfaces
  through the core (its UI tests over a grid's cell and the peek).

### 6. Overlays in the core (2 to 3 weeks)

- **Scope**: first, what step S left for this step recorded against today's
  code (decided 2026-11-27): item 3's stackings left (Properties' own menus
  over its dialog, a filter or sort tool's menu, Silverware Table's choices
  list, cell popup, formula hint and fill tip, Silverware Layout's Move to grid
  picker, Silverware Assets' Rename and insert dialogs and upload progress, the
  settings windows), the icons' picker's states (Nothing found, a group with
  a search, a tab switched), and a database's tool menu held at the window's
  right edge (`core/placemenu.ts`' clamp to `innerWidth`, in a window narrower
  than the tool's left edge plus its menu's width). Then the rendering baselines of every dialog, menu
  and side panel (step S) checked to be in place. Then, in Preact in the core: the stack and
  its layers, dialogs, menus (from shared/popupmenu.ts), side panels (a second
  on top of the first), `useFloating`, `useKeptFocus`; the marks written by
  the host, their watchers as signals; the layers' variables set by the core
  as it starts; the frames' CSS as templates (shared/dialog.css,
  shared/sidepanel.css, by scripts/sharedstyles.mjs with each page's base).
- **Not in it**: moving the plugins onto them (step 7).
- **Done when**: the core's own tests: two plugins' overlays one over
  another (keys, focus back, press beside), a holder leaving the page,
  CodeMirror taking a block out and back.

### 7. The plugins onto the overlays (3 to 4 weeks)

- **Scope**: every dialog (17 files), menu (Silverware Table, Database, Chart
  through shared/menu.ts; Assets and Layout through popupmenu.ts; the toolbar's
  popup) and side panel (Assets' file panel, the peek's frame) through the
  core, their content as it is (DOM nodes); shared/dialog.ts, popupmenu.ts,
  watchmark.ts go; `NOT_BESIDE` keeps SilverBullet's elements only;
  `applyLayers` leaves the plugins; each style page takes the frames'
  templates in place of its hand-written frame rules (selectors unchanged);
  the two side panels' frames made one (a look change: their rendering
  baselines change, the user's decision).
- **Done when**: the rendering baselines hold (or changed by decision); every
  plugin's UI tests green in parallel.
- **Checkpoint B**: one stack across plugins. Stop for the user.

### 8. The registry of the plugins' APIs (1 week)

- **Scope**: first, what step S left for this step recorded against today's
  code (decided 2026-11-27): Silverware Table's `onWrite` listeners reset by a
  reload (one listener after it), and Silverware Layout's providers registered
  again by a reload (one handle on a table, a chart, a database and a file).
  Then F; Silverware Icons, Editor, Assets, Layout, Table's `tables` and
  `onWrite` offered and taken through it; the Lua handovers `*.api` removed
  (P3: breaking, the user decides the release).
- **Done when**: no plugin reads another's API from Lua, and the Lua bridges
  that handed `*.api` are deleted, not left unused; a plugin offered late (its
  page loading after) is taken as it comes, and an offer after a Space Lua
  reload replaces the first (unit tests); the library pages and the
  changelog drafts say what breaks and what to do; the major that removes the
  handovers removes the table's formulas aliases with them (P1), the user
  deciding its release.

### 9. The settled index and the page's look (1 week)

- **Scope**: H and I; Silverware Tags and Table read the settled index.
- **Done when**: one sample of the look per load (test); the database's index
  tests green from the core.

### 10. Preact conversions (10 to 14 weeks)

- **Scope**: docs/silverware-preact.md, *Steps* 2 to 7, in order: the
  database's state layers (still `el()`), the table's conditions dialog, the
  board; **checkpoint C** (stop for the user: the drag tests `--repeat-each 10`,
  hand-kept state gone, `update(snapshot)` decided); then the database's other
  views, place, peek, Properties, editors and helpers (P2); then the toolbar's
  settings, the tags workspace (its page changes planned by Silverware Tags'
  modules alone, the UI calling them: *Storage*, the page writes test's last
  entries but the editing tools gone), every other island
  (docs/silverware-preact.md, *Steps* 7). Each part its own commits, its
  rendering baselines (step S) checked in place first.
- **Done when**: each part: its rendering baselines hold and its recorded
  blinks are gone, its hand-kept state gone, its tests green in parallel; the
  UI islands test's list holds decorations of SilverBullet's DOM only.

### K. The known bugs fixed (as long as what is left takes)

- **Scope**: every test still marked `test.fail(true, "Known …")` (found by
  `test.fail(`; listed in step S's *Known*): the behaviour fixed where it
  belongs (a module's bug in the module, the root CLAUDE.md's rule), the mark
  and its *Known* entry taken off in the same commit, one bug a commit. A fix
  that changes what a space has (settings, the Space Lua API, a theme's
  selectors, stored markdown) or the behaviour a user sees beyond the bug is
  the user's decision: stop and ask. A bug whose fix the work shows is out of
  this branch's reach is the user's to keep or drop, with why written here.
- **Before each fix**, the behaviour the test asserts is checked again, not
  taken from it: a test marked failing has never passed, so what it asserts
  was written as the right behaviour when the bug was found and nothing has
  tested that claim. Read against the plugins' user docs (library pages), the
  plans' decisions, what the same action does on the other surfaces (the page,
  a grid's cell, a peek, a dialog) and the platform's convention (an Esc closes
  the top layer alone, the focus back where it was); where the test asks for
  less or other than that, or where it is unsure, the test is corrected first
  and shown to the user, never the code bent to it. A fix that makes its test
  pass but changes another test's result is a change of behaviour: stop and
  ask.
- **A phone's bug**: marked only as *Known*'s rule says (what a person sees;
  one resting on the keyboard or the page's scrolling checked on a real phone
  first).
- **Not in it**: new features; bugs no test records (each gets its test and
  mark first, then is fixed here).
- **Done when**: no `test.fail(` in any `ui-tests/`, step S's *Known* empty;
  the tests that held them green in parallel, `--repeat-each 10`.

### 11. Cleanup and release

- **Scope**: CLAUDE.md files say what the code now is (the plans' content that
  became code moves there, as each CLAUDE.md says what is, not what is to be
  built; the root CLAUDE.md gets the rules of *Where code goes*, *SilverBullet
  kept apart* and *Storage*: the two kinds of plugins and their abstraction);
  shared/ modules left unused removed; the lists of the module-state, host
  and page writes tests hold only what is each plugin's own by design or an
  editing tool; the overlays' content takes a vnode alone (I2: the DOM node's
  path removed); docs/ui-without-framework.md marked replaced; the
  playground's pages show the overlays of two plugins together; the core's
  library page tells a user what the gate's message means; the releases
  drafted (docs/silverware-core.md, *Releases*) and proposed to the user.
- **Done when**: the four tests' lists hold only entries marked "by design"
  (each plugin's own state, decorations of SilverBullet's DOM, editing tools);
  nothing imports a removed module; no deprecated alias left without its
  removal decided; every CLAUDE.md read against the code (each section's
  files exist, nothing it names is gone); verify, the UI tests on the
  release and edge, and the safety net (step S) green, no known bug marked
  (step K).

## Apart from this branch

- Silverware Assets' settings window draws its select and its previews' folder field in the browser's own look
  (`.swa-settings-select`, `.swa-settings-folder` set only `font`: grey, an inset border, in dark too), where the other
  plugins' dialogs give theirs the dialog's colours (found by step S's baselines, 2026-11-28). Its look to match.

- The library pages say that offline needs `config.set("sync.documents", true)`
  (docs/silverware-core.md, probe 5): true today, on `main`, released with the
  plugins' next releases.
- Silverware Table's filter bubble (the conditions under a filter's field) has no ×: on a phone it is hard to close
  (the user, 2026-11-27, trying the filter on a real phone). A close button of its own, as the menus' title has; not
  in this branch's steps.
- Silverware Table's column width cannot be set on a phone (the user, 2026-11-27, on a real phone): the width handle
  is a pointer's drag at a header's edge; a touch way to set it is to be made. Not in this branch's steps.
