// A benchmark, not a test (docs/silverware-core-work.md, step S, item 6; run on request against the playground:
// SW_BENCH=1 npm run test:ui -- silverware-database/ui-tests/bench.spec.ts --workers 1): one drawing's cost of a
// database's views, steady, in the playground's `database.html?big=N&pageSize=P` (a database of N items over the memory
// store, P the items a view shows at first). Per view (table, list, board, calendar, timeline), N and P:
// - the first draw: from the page's start until the place holds still (no node added or removed for 500 ms);
// - an item changed elsewhere (`__bench.store().changeOutside`): until the place holds still again;
// - a key typed in the name's filter: until it holds still;
// - Load more, where the view shows fewer than all.
// Each with the main thread's long tasks (over 50 ms) summed and the nodes added and removed. One warm-up left out,
// then the median, least and most of 5. Printed as JSON lines, `BENCH {...}`. N by SW_BENCH_ITEMS (several separated by
// commas, by default 1000,10000); the views by SW_BENCH_VIEWS.
import { expect, type Page, test } from "@playwright/test";

const ON = process.env.SW_BENCH === "1";
const ITEMS = (process.env.SW_BENCH_ITEMS ?? "1000,10000").split(",").map(Number);
const VIEWS = (process.env.SW_BENCH_VIEWS ?? "table,list,board,calendar,timeline").split(",");
const RUNS = Number(process.env.SW_BENCH_RUNS ?? 5);

test.skip(!ON || process.env.SW_TARGET === "silverbullet", "a benchmark of the playground: run with SW_BENCH=1 against it");
test.use({ viewport: { width: 1600, height: 1000 } });
// (A benchmark failed is not run again: a run takes many minutes, and its numbers would be printed twice)
test.describe.configure({ retries: 0 });
test.setTimeout(1_800_000);

type Measure = { readonly ms: number; readonly nodes: number; readonly long: number };

/** What the page records from its start: the long tasks and each mutation's time and nodes */
async function recording(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sw = ((window as unknown as { __sw: unknown }).__sw = { tasks: [] as [number, number][], muts: [] as [number, number][] });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) sw.tasks.push([e.startTime, e.duration]);
    }).observe({ type: "longtask", buffered: true });
    new MutationObserver((records) => {
      let n = 0;
      for (const r of records) n += r.addedNodes.length + r.removedNodes.length;
      sw.muts.push([performance.now(), n]);
    }).observe(document, { childList: true, subtree: true });
  });
}

/** From `from` (the page's clock) until nothing is added or removed for 500 ms: the time to the last change, its nodes, its long tasks */
function settled(page: Page, from: number): Promise<Measure> {
  return page.evaluate(async (from) => {
    const sw = (window as unknown as { __sw: { tasks: [number, number][]; muts: [number, number][] } }).__sw;
    const after = () => sw.muts.filter(([t]) => t >= from);
    const end = performance.now() + 120_000;
    while (performance.now() < end) {
      await new Promise((done) => setTimeout(done, 100));
      // (Nothing changed at all: still since the action)
      const last = after().at(-1)?.[0] ?? from;
      if (performance.now() - last > 500) break;
    }
    const muts = after();
    return { ms: Math.round((muts.at(-1)?.[0] ?? from) - from), nodes: muts.reduce((sum, [, n]) => sum + n, 0), long: Math.round(sw.tasks.filter(([t]) => t >= from).reduce((sum, [, d]) => sum + d, 0)) };
  }, from);
}

const now = (page: Page) => page.evaluate(() => performance.now());

/** One run of a view: its first draw, an item changed elsewhere, a key in a filter, Load more */
async function run(page: Page, view: string, items: number, size: number): Promise<Record<string, Measure>> {
  await recording(page);
  await page.addInitScript((view) => localStorage.setItem("silverware-playground.database.state.big", JSON.stringify({ view })), view);
  await page.goto(`database.html?big=${items}&pageSize=${size}`);
  const result: Record<string, Measure> = {};
  // (Its bar drawn: the place started; then held still)
  await expect(page.locator(".swd-place .swd-filter-button")).toBeAttached({ timeout: 120_000 });
  if (process.env.SW_BENCH_TRACE) console.log("step first");
  result.first = await settled(page, 0);
  // An item changed elsewhere, as by hand
  let from = await now(page);
  await page.evaluate(async () => {
    const store = (window as unknown as { __bench: { store(): { items(id: string): Promise<{ value: { key: string }[] }>; changeOutside(db: string, item: string, change: unknown): void } } }).__bench.store();
    const first = (await store.items("big")).value[0]!;
    store.changeOutside("big", first.key, { values: { qty: 99 } });
  });
  if (process.env.SW_BENCH_TRACE) console.log("step changed");
  result.changed = await settled(page, from);
  // A key typed in the name's filter
  await page.locator(".swd-filter-button").click();
  const field = page.locator('.swd-filter input[data-key="name"]');
  await field.click();
  from = await now(page);
  await page.keyboard.type("1");
  if (process.env.SW_BENCH_TRACE) console.log("step filterKey");
  result.filterKey = await settled(page, from);
  await page.keyboard.press("Escape");
  await settled(page, await now(page));
  // Load more, where the view shows fewer than all and its button is shown (the calendar's lies in a day's cell, hidden
  // where the day shows none; the filter taken off first)
  await field.fill("");
  await page.keyboard.press("Enter");
  await settled(page, await now(page));
  const more = page.locator(".swd-load-more-button").first();
  if (size < items && (await more.isVisible())) {
    from = await now(page);
    await more.click();
    if (process.env.SW_BENCH_TRACE) console.log("step loadMore");
    result.loadMore = await settled(page, from);
  }
  return result;
}

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], least: sorted[0], most: sorted.at(-1) };
};

for (const items of ITEMS) {
  for (const size of [items, 50]) {
    for (const view of VIEWS) {
      test(`${view}, ${items} items, ${size} at first`, async ({ browser }) => {
        const runs: Record<string, Measure>[] = [];
        for (let i = 0; i <= RUNS; i++) {
          const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
          const page = await context.newPage();
          try {
            const one = await run(page, view, items, size);
            if (i > 0) runs.push(one);
          } finally {
            await context.close();
          }
        }
        const actions = Object.keys(runs[0] ?? {});
        const out = Object.fromEntries(actions.map((action) => [action, { ms: stats(runs.map((r) => r[action]!.ms)), nodes: stats(runs.map((r) => r[action]!.nodes)), long: stats(runs.map((r) => r[action]!.long)) }]));
        console.log(`BENCH ${JSON.stringify({ view, items, size, ...out })}`);
      });
    }
  }
}
