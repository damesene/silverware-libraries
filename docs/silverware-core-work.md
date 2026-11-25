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
3. Read *Notes for the next session*: what the last session left open.
4. Work on branch `silverware-core` only. Never on `main`, never push
   without being asked.

## Rules of this work

- **One step at a time, in order.** A step needs only the ones before it; do
  not start the next one with the current one unfinished.
- **Every commit**: `npm run build`, then `npm run verify` passes (run from
  `D:\`, read its "Tests N passed"); a change to how something is used gets
  its UI scenario and `npm run test:ui` passes. Commit messages as the root
  CLAUDE.md says: one line, Conventional Commits, scope the plugin or `core`,
  `!` for a breaking change, no body, no co-author trailer.
- **The branch stays green** after each step: it could be merged at any
  checkpoint.
- **Plans follow the code.** A decision made while working goes into the
  plan's *Decided* with its date, in the same commit; a step's scope that
  turned out different is corrected in its section here. Nothing is kept only
  in a conversation.
- **Stop and ask the user** (do not decide alone):
  - at a checkpoint (A, B, C): measure, write the result here, wait;
  - a change of anything a space has: settings, the Space Lua API, a class,
    `data-*` or structure a theme may select (a DOM snapshot that changed),
    stored markdown;
  - keeping a test from the parallel run (a lock), a test given a time of its
    own;
  - a deviation from the plans beyond the step's scope;
  - a version, a changelog entry, a release, a push, a merge.
- **At the end of a session**: *Progress* and *Notes for the next session*
  updated and committed (a `docs:` commit where the step is not done).

## Progress

| Step | What | State |
| --- | --- | --- |
| 0 | The plans | done (2026-11-25) |
| 1 | The core's skeleton, the gate, `requires:`, build and tests | not started |
| 2 | Preact in the core, `.tsx` everywhere | not started |
| A | Checkpoint A | |
| 3 | The formulas' registries (G), P1 | not started |
| 4 | SilverBullet bridge and events (B) | not started |
| 5 | Geometry and editing surfaces (D, E) | not started |
| 6 | Overlays in the core (C) | not started |
| 7 | The plugins onto the overlays | not started |
| B | Checkpoint B | |
| 8 | The registry of the plugins' APIs (F), P3 | not started |
| 9 | The settled index and the page's look (H, I) | not started |
| 10 | Preact conversions | not started |
| C | Checkpoint C (inside step 10, after the board) | |
| 11 | Cleanup and release | not started |

Letters in parentheses name sections of docs/silverware-core.md, *Services*;
P1 to P3 and I1 to I6 its *API changes*.

## Notes for the next session

- (none yet)

## Steps

Estimates are rough; checkpoints correct them. About 5 to 6 months in all.

### 1. The core's skeleton (1 week)

- **Scope**: `silverware-core/` as a plugin (library page, API page at
  priority 60, style page, `src/api.ts`, `VERSION`, `CLAUDE.md`, changelog
  1.0.0 unreleased); the gate's Lua block written into each plugin's API page
  by a script with the plugin's need, checked by check-build; the stubs of a
  refused plugin's API, the init pages doing nothing for it; `requires:` in
  every library page; the build's external and aliases; vitest, tsconfig
  `paths` and scripts/playground.mjs resolving the core to its source, a
  memory bridge for tests and the playground; scripts/deploy.mjs, the UI test
  servers, REPO.md, versions.mjs, the isolation tests (plugins import the core's
  `api.ts` only); the root CLAUDE.md's rules ("a plugin needs no other
  installed", "nothing is shared at run time"), its table, the prefix `swk-`,
  the scope `core`.
- **Not in it**: any service. The core only loads and says its version.
- **Done when**: every plugin starts through the gate on the UI test servers;
  UI tests: no core, an older core (each: the notification, no plugin start,
  the API stubs' message); unit tests of the gate's script; verify green.
  Checked by hand once (written here): Library: Install of a plugin from the
  pushed branch's GitHub URI installs the core by its `../` requirement.

### 2. Preact in the core (a few days)

- **Scope**: `preact`, `preact/hooks`, `preact/jsx-runtime`,
  `@preact/signals` pinned and re-exported by the core; `.tsx` in tsconfig,
  vitest's include, every scanner of src/ (the isolation tests,
  shared/imports.test.ts, scripts/ui-test-locks.test.ts, playwright.config.ts,
  scripts/playground.mjs); the rule that only drawing layers import Preact.
  A component of the core's own, with its test (`act`), proving the chain.
- **Done when**: bundles measured before and after (written here); verify and
  UI tests green.
- **Checkpoint A**: every plugin runs on the core, nothing changed for a user.
  Stop for the user.

### 3. The formulas' registries (1 week)

- **Scope**: shared/formulas into the core's file beside it
  (`silverware-core-formulas.js`, loaded on first use); Silverware Table and
  Database take the formulas from the core only (isolation rule); the registries
  reset once per load by the core's API page, the plugins' resets of them gone;
  `silverware.formulas.defineFunctions` / `defineSource`, the table's names as
  aliases (P1); the library pages say so.
- **Done when**: a function defined once is calculated in a table and in a
  database (unit and UI test); the instanceof classes come from one copy (a
  test of a value made by one plugin read by the other); a user with only
  Silverware Toolbar loads no formulas' file (UI test of requests).

### 4. SilverBullet bridge and events (1 to 2 weeks)

- **Scope**: the core's API page hands SilverBullet's API once (`Platform` and
  the functions beyond it); the core's Lua listens to the shared events; each
  plugin's Lua and `host/silverbullet/` slimmed to what is its own (I1);
  SilverBullet's widget menu taken off by one watcher.
- **Done when**: no plugin's Lua hands a function the core hands; every
  plugin's UI tests green, on `test:ui:sb` and `test:ui:sb:edge` too.

### 5. Geometry and editing surfaces (1 week)

- **Scope**: D and E of the core's services; the plugins read them; the
  per-plugin watchers of SilverBullet's panels gone.
- **Done when**: one watcher of the navigator; the toolbar finds surfaces
  through the core (its UI tests over a grid's cell and the peek).

### 6. Overlays in the core (2 to 3 weeks)

- **Scope**: first, DOM snapshot tests of every dialog, menu and side panel as
  they are (docs/silverware-preact.md, *Steps* 1). Then, in Preact in the
  core: the stack and its layers, dialogs, menus (from shared/popupmenu.ts),
  side panels (a second on top of the first), `useFloating`, `useKeptFocus`;
  the marks written by the host, their watchers as signals.
- **Not in it**: moving the plugins onto them (step 7).
- **Done when**: the core's own tests: two plugins' overlays one over
  another (keys, focus back, press beside), a holder leaving the page,
  CodeMirror taking a block out and back.

### 7. The plugins onto the overlays (3 to 4 weeks)

- **Scope**: every dialog (17 files), menu (Silverware Table, Database, Chart
  through shared/menu.ts; Assets and Layout through popupmenu.ts; the toolbar's
  popup) and side panel (Assets' file panel, the peek's frame) through the
  core, their content as it is (DOM nodes); shared/dialog.ts, popupmenu.ts,
  watchmark.ts go; `NOT_BESIDE` keeps SilverBullet's elements only; the two
  side panels' frames made one (a look change: their snapshots, the user's
  decision).
- **Done when**: the snapshots unchanged (or changed by decision); every
  plugin's UI tests green in parallel.
- **Checkpoint B**: one stack across plugins. Stop for the user.

### 8. The registry of the plugins' APIs (1 week)

- **Scope**: F; Silverware Icons, Editor, Assets, Layout, Table's `tables` and
  `onWrite` offered and taken through it; the Lua handovers `*.api` removed
  (P3: breaking, the user decides the release).
- **Done when**: no plugin reads another's API from Lua; a plugin offered late
  (its page loading after) is taken as it comes (unit test).

### 9. The settled index and the page's look (1 week)

- **Scope**: H and I; Silverware Tags and Table read the settled index.
- **Done when**: one sample of the look per load (test); the database's index
  tests green from the core.

### 10. Preact conversions (8 to 12 weeks)

- **Scope**: docs/silverware-preact.md, *Steps* 2 to 7, in order: the
  database's state layers (still `el()`), the table's conditions dialog, the
  board; **checkpoint C** (stop for the user: the drag tests `--repeat-each 10`,
  hand-kept state gone, `update(snapshot)` decided); then the database's other
  views, place, peek, Properties, editors and helpers (P2); then the toolbar's
  settings, the tags workspace, the table's other dialogs, the formula field.
  Each part its own commits, its snapshot first.
- **Done when**: each part: its snapshot unchanged, its hand-kept state gone,
  its tests green in parallel.

### 11. Cleanup and release

- **Scope**: CLAUDE.md files say what the code now is (the plans' content that
  became code moves there, as each CLAUDE.md says what is, not what is to be
  built); shared/ modules left unused removed; docs/ui-without-framework.md
  marked replaced; the releases drafted (docs/silverware-core.md, *Releases*)
  and proposed to the user.

## Apart from this branch

- The library pages say that offline needs `config.set("sync.documents", true)`
  (docs/silverware-core.md, probe 5): true today, on `main`, released with the
  plugins' next releases.
