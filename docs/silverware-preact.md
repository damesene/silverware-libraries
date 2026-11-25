# Preact for the plugins' own UI (plan, 2026-11-25)

Status: planned, nothing built. On branch `silverware-core`, after Silverware
Core's first steps: Preact comes from Silverware Core (docs/silverware-core.md,
*Services* A). The work's order and progress: docs/silverware-core-work.md.
Below, "core/" is Silverware Database's src/core/; Silverware Core is named
in full.
Revisits docs/ui-without-framework.md (2026-11-02), whose condition for looking
again ("a plugin's own UI has a large part that changes often with its state,
and redrawing it loses focus, a field's text or a scroll") Silverware Database
now meets.

## Why

The plugins' own islands are drawn by `el()` and redrawn whole
(`replaceChildren`): a database's views, its peek, the Properties dialog, the
table's conditions and pivot dialogs, the toolbar's settings, the tags
workspace. What a whole redraw drops is put back by hand, case by case:

- a view's redraw held while a card is dragged (`Drag.pending`,
  views/builtin/board.ts, calendar.ts: `update()` deferred to the drag's end),
- the focus and scroll put back (23 uses of `activeElement` in the database's
  code alone: core/place.ts, core/groups.ts, modules/peek/panel.ts),
- what a place had open handed to the place drawn after its write
  (`handovers`, `PlaceKept`, `keptTools`, `stillCopy` in index.ts and core/place.ts),
- which parts of a dialog to redraw after a change (each dialog's `render()`,
  its preview drawn apart: conditionsdialog.ts, pivotdialog.ts), the toolbar's
  item panel lost from its item through an edit (fixed twice).

Of the 319 fixes from 2026-10-01 to 2026-11-25, about 79 are by their subjects
about state lost or kept through a redraw; roughly 15 to 25 of those were in
the plugins' own islands. The rest came from SilverBullet drawing its DOM anew,
which no framework of ours changes.

Goal: stability and less code keeping state by hand. Not speed, not fewer
lines for their own sake.

## What it does not cover

- SilverBullet's DOM, decorated: tables, CodeMirror (Silverware Layout's
  grids, the toolbar at the caret), embeds (Silverware Assets). `el()` stays
  for it.
- Pure code: shared/pages, markdown, yaml, table, formulas; the stores.

## Choice

Preact with `@preact/signals` (13.5 kB / 5.7 kB gzip with hooks, 21 kB /
8.3 kB with signals, measured 2026-11-02 for Preact 11.1.1), one copy per
window in Silverware Core, pinned.

- esbuild compiles `.tsx` itself, tsc 7 checks it; the JSX options in
  tsconfig, read by every esbuild context (build and playground).
- Listeners on the elements themselves, not delegated: `stopPropagation` in
  `onKeyDown` keeps a key from SilverBullet's document listener as today.
- No Shadow DOM; classes, `data-*` and structure stay as they are.
- An update is rendered in a batch, after the code that set the state:
  measuring and focusing after a change in `useLayoutEffect` or a ref
  callback; unit tests act through `act()` (preact/test-utils) or wait for
  what is drawn (`vi.waitFor`).

Weighed: Solid (Babel for its JSX; reactivity lost silently on a destructured
prop or an early return), Lit and lit-html (templates not checked by tsc),
Svelte 5 (piloted 2026-11-02, rejected: unchecked props, +60 kB), Vue (size,
vue-tsc).

## The model: state apart from components

### Identity: the element, as today

A place's live state belongs to its element (`app.shown: Map<HTMLElement,
Shown>`, silverware-database/src/index.ts), and so does its UI state: kept on
the `Shown` record, never keyed by the block's text. Text is no identity: two
blocks written alike would share a typed filter and the focus, and an Undo of
a hand edit would bring an old state back.

It moves only where it moves today:

- **a write**: the handover (page and text written, `HANDOVER_MS` 10 s, one
  shot) hands the UI state itself to the element drawn for the new text,
  instead of a `PlaceKept` read out of the DOM;
- **the widget cache** giving back an element that wrote and went out
  (`backAfterWriting`): the state is reset with the place, as now;
- **a place out of the page** is kept `KEPT_OUT_MS` (60 s) by `tidy`, its
  state with it.

### Three layers of state (the database)

1. **Data, one per database** (`databaseData(id)`): the schema, the items with
   their formulas' values, a problem. Fed by the calculating store's
   `onChanged` (not the index: the store already drops early changes), its
   reads serialized per database with a generation number so a late read
   never overwrites a newer one, and a timer where a formula reads the time
   (calculating.ts's moment changes values with no store event). Replaces each
   place's own reading of data and `stillCopy`. `redrawAll` stays for what it
   is for (views, types or modules defined again, settings saved, a conflict
   written), as a signal of definitions every place reads.
2. **A place's UI**: what is never written or not yet (the filter being
   typed, the filter field open, a menu open, over the window, the opener, the
   focus as an element's key and caret). Written state stays in the block's
   text (`<view>.<key>` lines, core/statekeys.ts), parsed into a signal of the
   block. **Scroll stays keyed by database and view**, as today: two blocks of
   one database share it.
3. **The peek, one per window**: the item open, the draft typed and not
   written; its item and `stale` computed from layer 1. The side panel's
   frame and width are Silverware Core's (docs/silverware-core.md, C). The peek
   module is made anew on a reload of Space Lua (`modules.stop()`): its state
   lives in the module's kept part, and the new module shows what was open.

How views and modules reach the signals: they import core types only (the
database's layers, src/isolation.test.ts), so signals reach them through
`ViewHost` / `ModuleHost`, whose contracts keep plain getters and `update()`;
a built-in view in Preact reads them through an adapter.

### Not data, not in signals

- **A drag going on.** HTML5 drag and drop ends when its source element
  leaves; a re-render moving a card into another column's parent remounts it.
  A dragging component renders from **a snapshot of the data frozen until
  `dragend`** (what `pending` does today), and `update()` stays the only way
  data reaches a built-in view, so the snapshot holds.
- Write queues (`writing`, `queue`, `moves` of the peek): services.
- A `TextEditor` (shared/editor.ts): held by a ref in a container Preact
  gives no children.

### Lifecycle of a root

A root is unmounted by its owner's end, **never by its element leaving the
page**: places are kept 60 s out of view (a scroll would drop a drag's refs),
and SilverBullet renders a block twice, one element never put in the page. So
`render(null, element)` in `DatabasePlace.destroy()` (called by `tidy`, a
reload of Space Lua in `init`, `backAfterWriting`), in a view's `destroy()`,
and by Silverware Core's overlays as one closes.

## Rules for code in a Preact tree

- **No imperative changes inside a tree Preact renders.** 48 `classList`
  changes in the database's code; in a converted part each becomes state.
  Another plugin changing our element (Silverware Layout on `.swd-place`)
  only on the root element, which our `render()` makes.
- **What lies over the page** goes through Silverware Core (dialogs, menus,
  side panels, `useFloating`), never moved into the body by hand.
- **Grouped views**: `drawGrouped` renders a view once per group, each in a
  section with a derived host (core/groups.ts); the adapter makes one root per
  section, each unmounted with it.
- Imports: `preact` (through Silverware Core) only in the layers that draw;
  the isolation tests get the rule.

## Custom views and their helpers

A database's views of the user's (`silverware.database.defineViews`,
`render(host, element)`) stay framework-free: only DOM elements and callbacks
cross the contract, never a component or a vnode (a user's own Preact or React
could not render ours). The built-in views go through the same public contract
(`preactView(Component)` gives `render`, `update`, `destroy`), so what a user's
view can do, ours do with it.

- `HELPERS.editValue(host, cell, item, key, show)`: written once as a
  component; the helper renders it into `cell` and unmounts it before `show()`.
  The cell is the helper's while it edits (documented: a view's framework
  leaves it alone meanwhile).
- `valueNodes` / `fieldNodes`: rendered once (no state, no effects) into a
  container whose children are then given as today's list: the DOM a view
  gets does not change. Safe because nothing renders that tree again.
- The roots helpers make in a view are known to the host and unmounted with
  the view, and as their cell leaves the page (CodeMirror's taking the block
  out aside), so a view redrawing its cells leaves nothing behind.
- `host.kept` (docs/silverware-core.md, *API changes* P2): a view's own state
  kept through a write and a redraw by SilverBullet.

## Steps

The conversions, in their order; each is a step of docs/silverware-core-work.md
(after Silverware Core, its bridge, overlays and registry).

1. **DOM snapshot tests** of each part before it is converted: a normalized
   `outerHTML` (classes, `data-*`, structure) in its main states. The
   conversion keeps it unchanged; a difference is a decision (a theme's
   selectors: a major), never an update of the snapshot in passing. The
   overlays' snapshots are made before Silverware Core takes them over.
2. **The database's data layer** (layer 1) and its definitions signal, under
   today's `el()` views. Worth it alone.
3. **The database's place UI** (layer 2) on `Shown`, the handover's payload,
   `keptTools` and `PlaceKept` replaced; still `el()`.
4. **The table's conditions dialog** (features/conditionsdialog.ts, 630 lines):
   its own dialog, state (rules, the one open, saved, previewed), a list that
   changes, a preview; inside Silverware Core's dialog. Shows the patterns (state,
   `act` in tests, an `el()` edge: shared/formulafield.ts) without the
   database's hard parts.
5. **The board** through `preactView`, with the drag snapshot.
   *Checkpoint C*: the board's and calendar's drag tests `--repeat-each 10`,
   the whole database suite in parallel, the snapshots; hand-kept state of the
   converted parts gone, not moved. Decided there: `update(snapshot)` (P2),
   and the rest of this list adjusted.
6. **The database**: list, table, calendar, timeline (grouped: several roots),
   the place's chrome (core/place.ts: switcher, filter, toolbar), the peek's
   content, the Properties dialog, the editors (views/editors.ts) through
   Silverware Core's floating, the helpers.
7. **The others**: the toolbar's settings dialog, the tags workspace, the
   table's pivot, choices, view and function dialogs, shared/formulafield.ts.
   The chart's settings and plain confirmations where touched anyway.

## Risks

- **DOM as public surface**: kept by the snapshots, not by the look tests
  (ui-tests/look compares the page, a grid's cell and the peek, not the
  views' markup).
- **Unit tests written for synchronous drawing** (about 1300 `querySelector`
  in the tests of database, table, toolbar, tags): a part's tests change with
  it.
- **Two ways to build UI** for good (`el()` for SilverBullet's DOM and the
  plugins' decorations of it); which where goes into CLAUDE.md as Preact
  comes (docs/silverware-core-work.md).
- **Effort.** The database's UI code is about 7,000 lines (place.ts 1265,
  peek 1019, Properties 1230), its tests about 10,000; steps 1 to 7 about 8 to
  12 weeks.
- **Releases.** Converted parts change no settings, API or stored markdown:
  a minor where a snapshot did not change.
