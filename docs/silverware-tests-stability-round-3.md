# Unit tests cheaper under load, round 3

Asked by the user 2026-11-16, after round 2 (docs/silverware-tests-stability-round-2.md). `npm run verify` still failed
now and then: one or two unit tests a run timed out, a different one each time (seen: Silverware Table's `export`, a
`sources` test, an `index` test; Silverware Database's `calendar`). The user chose to make the tests that time out under
load cheaper, one by one: no lower `maxWorkers`, no longer timeout for every test or for one.

## Rules

- A test is made cheaper, never given more time: no `{ timeout }` on a test, no `testTimeout`, no `maxWorkers` change, no
  retry, no pause. A test that truly cannot be made cheaper is the user's to decide (a time of its own only with their
  word and a comment saying why).
- An `AssertionError` under load is a race: fixed by waiting for what really happens (`vi.waitFor`, `{ timeout: 5_000 }`
  as its option), never a pause.
- Cheaper means less work for the same assertion: smaller fixtures, fake timers in place of real waits, a heavy fixture
  built once where no test changes it, a test checking many things split (`it.each`). Every test proves what it proved
  before; names and comments updated where they no longer fit.
- Fake timers restored after each test. `src/` changes only for a cost a user pays too (pure JavaScript), behaviour
  kept exactly; jsdom's costs are fixed in the test.
- Commits split by fix, each `npm run build` + `npm run verify` green with its own bundles; the user says when.

## How

- **Alone**: `npx vitest run --reporter=verbose` (each test's time), from `D:\` (a lowercase drive finds no tests).
- **Under load**: two full runs at once (the scratchpad's `pair.sh`), and three or four at once (`multi.sh`, the first
  run writing a JSON report: `--reporter=json --outputFile.json=…`, each test's time read by `slow.mjs`). `grep "^ FAIL"`
  and the error: `Test timed out` is cost or a missing wait, an `AssertionError` a race.
- **Profile** as in round 2 (a temporary `vitest.zprofile.config.ts` and `zprofile.setup.ts`, deleted after).

## Steps

1. [x] Measure before: alone, two at once (4 pairs), three and four at once.
2. [x] Silverware Table `conditions/conditions.test.ts`: the built-in definitions "as a user's file".
3. [x] Measure again under four at once; the next: `shared/overwindow.test.ts` (a race), then the tests waiting
   real time (Database's timeline and peek, Silverware Editor's companion, Tags' index caught up).
4. [x] Measure after: alone, two at once (4 pairs), four at once (3 times), six at once.
5. [x] Review (independent agent), its findings fixed.
6. [x] Commits (with the user's word): one a fix, each built and verified with its own changes.

## Findings

- **Before** (2026-11-16, 16 logical cores, vitest's default workers, nothing else heavy running): alone 268 files,
  2755 tests, 24.1 s by vitest (32.4 s wall, the first run after a while). Slowest tests alone: Database's timeline
  "takes a bar under a finger…" 1.39 s, Database's `index.test.ts` "writes a view picked…" 1.09 s, all others under
  0.7 s.
- **Two at once, 4 pairs**: 23, 23, 23, 24 s wall; **0 failures** in all eight runs. The failures the user saw in
  `verify` do not come out at this load on an otherwise idle machine; they did with more running beside (a Playwright
  run, SilverBullet in Docker). So the load was raised to find what fails first.
- **Three at once**: 35 s, 1 failure (of 3 runs). **Four at once, twice**: 46 s each, 1 + 4 failures (of 8 runs). Every
  failure a time out of one test: Silverware Table's `conditions/conditions.test.ts` "Built-in definitions work as a
  user's file: their types stripped…" (one `it.each` case a definition file, a different file each time). Its cases
  took 1 to 300 ms, with spikes of 3.5, 4.7, 6.4 and 19.8 s at random places in the list: each case strips the file's
  types by esbuild's `transformSync`, a round trip to esbuild's own process through a worker thread, which a loaded
  machine stalls (the first call also starts the service). No other test came near its time: at four at once the next
  slowest were 1.4 to 1.8 s (Table's `largetables`, Database's timeline and `index.test.ts`, Table's `sources`, `excel`,
  `export`), against 5 s.
- **Table `conditions.test.ts`**: a user's file is a module (`js.importFromSpace`) whose default export is the definition,
  so each built-in file is now imported as one (`await import(...)`), its types stripped as every test file's are; the
  test above it still holds that a file imports nothing but the API's types, so nothing else is needed to run it. The
  same assertions (a function, its name, a format through `checkedFormats`). 36 cases of 1 to 300 ms alone (seconds
  loaded) became 0 ms each; esbuild is used by no test any more.
- **`shared/overwindow.test.ts`** ("is watched…", an `AssertionError` at four at once, the last end not told): real
  timers, a wait of 150 ms for the watcher's end of 100 ms. Fake timers now (the watcher's `ENDED_MS` exported, moved by
  it exactly; the observer's records come in a microtask, which `advanceTimersByTimeAsync(0)` runs). 466 ms to 3 ms;
  checked to fail with the end told at once.
- **Database's timeline** ("takes a bar under a finger only once held still…"): three real waits of 450 ms for the hold
  (`HOLD_MS`, 400, exported). Fake timers from after the drawing, each wait `HOLD_MS + 50`. 1393 ms to 7 ms; checked to
  fail with a hold longer than the test waits.
- **Database's peek**: three tests waiting real time (a press beside it and the wait for its click, `CLICK_WAIT_MS`
  exported; two slow writes stubbed with a delay of 20 or 50 ms, waited 60 and 150 ms): fake timers after the panel is
  open, the same waits moved by them, the stubs' delays kept as timers. 482, 326, 260 ms to about 17 ms each.
- **Silverware Editor** ("is told so once the companion … is taken away"): a real wait of 600 ms for the look every
  `COMPANION_LOOK_MS` (500, exported from shared/editor.ts): fake timers, moved by it. 657 ms to 34 ms.
- **Tags `core.test.ts`** ("waits until the index has the pages as written"): two real polls of `INDEX_POLL_MS` (300,
  exported): fake timers (its deadline is `performance.now()`, faked too), moved by two polls. 603 ms to 1 ms.
- The constants exported change no bundle (`npm run build` leaves every `silverware-*.js` as it was).
- **Left as they are**: Database's `index.test.ts` "writes a view picked…" (1.1 s alone, 2.9 s at six at once): its time is
  the module's first load (`import("./index.ts")` after `vi.resetModules()` in `beforeEach`), counted in the file's
  first test; the next test alone takes 7 ms, and run alone 180 ms. Table's `export`, `sources`, `index.test.ts` and
  Database's calendar, the tests seen failing before: their slowest tests are their files' first (0.17 to 0.27 s alone,
  1.4 s at four at once), the same first-load cost, far from 5 s. Short real pauses (10 to 80 ms) in Database's place,
  properties, builtin and docs tests, Layout's grids, Table's controller and lazy tests: each waits for promises or
  leaves a moment between two steps, none came near failing at six at once; left for a later round.
- **After** (same machine, idle): alone 11.46 s by vitest (the state before, measured again warm: 11.55 and 11.47 s; the
  first measurement's 24.1 s was a cold start). Two at once, 4 pairs: 23 s each, 0 failures. Four at once, 3 times
  (12 runs): 45 to 46 s, 0 failures (before: 5 failures in 8 runs). Six at once: 68 s, 0 failures, the slowest test
  2.9 s (Database's `index.test.ts`, the first load above).
- **Review** (independent agent): one gap. Esbuild's CommonJS run had refused a file reaching another module by a line
  the import check did not read (`export … from`, an indented import: `require` undefined), which a module imported
  resolves. The check now reads every line reaching another module (an import, indented or not; a line ending in
  `from "…"`; an import or require called): checked to fail on each of the four kinds added to a built-in file. Found
  already true before this round, left as it was: Silverware Editor's "is told so once the companion … is taken away"
  passes without the look every `COMPANION_LOOK_MS` too (jsdom fires `focusout` as the focused field is taken out, so the
  other path tells it; its name's "no focus event tells it" is not so in jsdom). Tags' `indexCaughtUp` test would time
  out, not fail on its count, were more polls needed (as before).
