# Flaky tests and profiling, round 2

Asked by the user 2026-11-16, after round 1 (commits `eacd688` … `3d22d57` on `docs/layout-assets`: fake timers in place of
sleeps in Silverware Table's tests, the viewers' tests without the network, the editor's text parsed whole, tests split
where one did too much, Table's `moduleHost` shared). Two parts:

1. **The tests still flaky**: Silverware Database's `src/index.test.ts` (failed once in `npm run verify`: "writes a view
   picked into the block it was picked in, and nothing where a block alike is out of view"), Silverware Tags'
   `src/core/core.test.ts` (failed under two runs at once), Silverware Table's UI tests `choices.spec.ts`, `names.spec.ts`,
   `widths.spec.ts` (flaky on the playground; also `autofill.spec.ts` "Esc while dragging the fill handle").
2. **Profiling Silverware Database and Layout** as Table was: where their tests' time goes, and whether their code
   (not jsdom) has a cost worth taking away without hard-to-keep complexity.

## Rules (root CLAUDE.md: *Interaction tests run in parallel*, *Unit tests (vitest) alike*)

- A test failing under load is a race of the test or the code: fixed where it is, waiting for what really happens;
  never a pause, never a retry of its own. A time of its own (`{ timeout }`) or a lock only with the user's permission.
- A test doing too much in one (reading every file, transforming many) is split (`it.each`) rather than given time.
- A performance change must change no behaviour: compared member by member or A/B, its tests (unit and UI, against
  SilverBullet too) passing; an independent review before it is committed.
- Commits: split by fix, each `npm run build` + `npm run verify` green with its own bundles (the scratchpad's
  `commit-step.sh` did it: stage, stash the rest, build, verify, commit, pop). The user says when to commit.

## How (the commands that worked in round 1)

- **Bring a flaky unit test out**: two full runs at once, `npx vitest run > a.log & npx vitest run > b.log`, then
  `grep "^ FAIL"` and the error (`Test timed out` is cost or a wait; an `AssertionError` is a race). Alone:
  `npx vitest run <file> --reporter=verbose` (times per test).
- **Bring a flaky UI test out**: `npx playwright test <spec> --repeat-each 10` (playground), `SW_SB_FIRST_PORT=3210 node
  scripts/ui-tests.mjs silverbullet <spec>` against SilverBullet (the local Podman SilverBullet `sw-pivot-test` holds
  3010). Never two Playwright runs of one target at once.
- **Profile unit tests in their workers**: a temporary `vitest.zprofile.config.ts` in the repository's root
  (`mergeConfig(base, { test: { setupFiles: ["./zprofile.setup.ts"] } })`) and `zprofile.setup.ts` starting
  `node:inspector/promises`' profiler in `beforeAll`, writing the profile in `afterAll`; summed by self and inclusive
  time of the repository's functions (the scratchpad's `profsum.mjs`). Both temporary files deleted after.
- **jsdom's costs are not the code's**: `getComputedStyle` and `querySelectorAll` are slow in jsdom, cheap in a
  browser; only pure JavaScript work (as `moduleHost`'s) is worth changing for a user.

## Steps

1. [x] Database `index.test.ts`: reproduce, cause, fix.
2. [x] Tags `core.test.ts`: reproduce, cause, fix.
3. [x] Table UI `choices`, `names`, `widths`, `autofill` (Esc while dragging): reproduce with `--repeat-each`, cause, fix.
4. [x] Profile Database's unit tests: the top functions; what is the code's; changes worth making.
5. [x] Profile Layout's unit tests alike.
6. [ ] Review (independent agent), fixes; numbers before and after; commits (with the user's word).

## Findings

(Each step's result, written as it is done.)

- **Database `index.test.ts`**: `settle` was a real pause of 20 ms after a view picked; loaded, the write came later
  (an `AssertionError` with the page as before, or the test's time out). `settle` moves fake timers by 20 ms instead
  (the two tests using it start them), every read and write chained in it run: four runs at once, twice, all passed.
- **Tags `core.test.ts`** ("reads hundreds of pages…"): a cost, not a race: 300 pages through the page writer, 964 ms
  alone, over 5 s loaded. Sixty pages test the same (ten times `AT_ONCE`, their order, the progress), 78 ms; it also
  asserts the reads did run at once (`most > 1`), so its upper bound cannot pass without reads in flight.
- **Table UI tests** (`--repeat-each 8` of choices, names, widths, autofill: 6 flaky of 280, choices and autofill none):
  no race found. Names (`setPage` then the table's own rows counted) and widths (`rendersAnew`: the table marked
  before gone) wait for the right thing; loaded (four workers, each test eight times) the playground drew the new page
  later than the assertion's 5 s, the sample page's first table (its six rows) still the one counted. Each passed
  alone on its retry. The cost behind it: every test starts on the sample page (13 tables) and most replace it at once;
  `ready()` lets a test go once the first table shows (all but one of the 13 are enhanced within ~16 ms unloaded; one
  never is, so "all enhanced" is no signal). The user decided (2026-11-16) for a test declaring its own first page:
  `startingOn(PAGE)` (helpers.ts, an annotation the fixture reads before it opens the page), 47 tests and describes
  converted, shared pages in `ui-tests/pages.ts`; against SilverBullet the Table suite went from 9.2 to 4.1 minutes
  (199 passed), the playground's 188 passed in under a minute, none flaky.
- **Database profiled** (554 tests, 26 s of samples): its drawing (place, menus, views, the properties dialog) is jsdom's DOM
  work in the main. The code's own cost: the timeline made an `Intl.DateTimeFormat` for every day of its axis and every
  month (`fmt(…)` in the loop) and an `Intl.Segmenter` for every item's initial; a formatter costs some 40 µs to make
  (V8, Node as Chrome): an axis of five years by days, 75–86 ms of formatters a drawing, 1.6–2.2 ms with them made once.
  The timeline and the calendar take them from `shared/intl.ts` (kept across drawings), the segmenter Database's one (`graphemes`, domain/look.ts). The same
  pattern found in Silverware Assets XLSX (a formatter made for every cell of a sheet): Table's formatters kept by locale and
  options moved to `shared/intl.ts` (`numberFormat`, `dateTimeFormat`), Table and XLSX using them.
- **Layout profiled** (168 tests, 4.6 s of samples): its settings dialog and widgets' layout, jsdom's style and selector
  work in the main; `paneWidth` (host/marks.ts: a computed style and a box read) is called a few times a change of the
  dialog, cheap in a browser. Nothing of the code's own worth changing.
- **Review** (independent agent): no behaviour changed; the formatters' key told apart what the browser refuses (no
  locale from "", NaN from null), as a kept formatter answered for an input that throws; fixed, tested.
- **Still flaky under `verify`**, one or two a run, each a different test and a time out (no wrong assertion): Table's
  `export`, `sources`, Database's `calendar` ("never draws all of many items"). Heavy jsdom flows on a loaded machine:
  for the user to decide (a lower `maxWorkers`, a longer `testTimeout` for every test, or cheaper tests one by one).
