// A benchmark, not a test (docs/silverware-core-work.md, step S, item 6; run on request against the playground:
// SW_BENCH=1 npm run test:ui -- silverware-table/ui-tests/bench.spec.ts --workers 1): Silverware Table's cost by the
// playground's own benchmark (playground/benchmark.ts, profile.ts): a page generated with a table of N rows (8 columns,
// the panel's default types, a calculated column and a totals row), then a cell edited; each action's "shown after" (from
// the key or press to the frame painted after Silverware Table's work) and its measured work, as its log says. N by
// SW_BENCH_ROWS (several separated by commas, by default 1000,10000). One warm-up left out, then the median, least and
// most of 5. Printed as JSON lines, `BENCH {...}`. Its tables are not converted to Preact: these numbers watch steps 4,
// 5 and 9.
import { expect, type Page, test } from "@playwright/test";

const ON = process.env.SW_BENCH === "1";
const ROWS = (process.env.SW_BENCH_ROWS ?? "1000,10000").split(",").map(Number);
const RUNS = Number(process.env.SW_BENCH_RUNS ?? 5);

test.skip(!ON || process.env.SW_TARGET === "silverbullet", "a benchmark of the playground: run with SW_BENCH=1 against it");
test.use({ viewport: { width: 1600, height: 1000 } });
// (A benchmark failed is not run again: a run takes many minutes, and its numbers would be printed twice)
test.describe.configure({ retries: 0 });
test.setTimeout(1_800_000);

type Times = { readonly shown: number; readonly work: number };

/** The log's action that `what` names (the log keys each action by what started it: the playground's Generate, a key,
 * a press): Silverware Table's work in it, once it holds still a second (its entries come in as the work ends). Its
 * "shown after" is not taken: it grows with every later entry of the action, small work long after the frame */
async function work(page: Page, what: RegExp): Promise<number> {
  const action = page.locator("#bench-log .bench-action summary").filter({ has: page.locator(".bench-what", { hasText: what }) });
  await expect(action).toHaveCount(1, { timeout: 600_000 });
  const measured = async () => Number(/measured ([\d.]+) ms/.exec((await action.innerText()).replace(/,/g, ""))?.[1]);
  let value = NaN;
  await expect(async () => {
    const before = await measured();
    await page.waitForTimeout(1000);
    value = await measured();
    expect(value).toBe(before);
  }).toPass({ timeout: 600_000 });
  return value;
}

/** From the next event `type` (its time stamp) until the frame painted after `done` holds (a frame callback, then a
 * task: after the browser lays out and paints): started before the action, awaited after it */
async function shownAfter(page: Page, type: "click" | "keydown", done: string): Promise<() => Promise<number>> {
  await page.evaluate(
    ([type, done]) => {
      const holds = new Function(`return (${done})`) as () => boolean;
      (window as unknown as { __shown: Promise<number> }).__shown = new Promise((resolve) => {
        window.addEventListener(
          type,
          (e) => {
            const from = e.timeStamp;
            const check = () => {
              if (!holds()) return void setTimeout(check, 5);
              requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - from)));
            };
            check();
          },
          { capture: true, once: true },
        );
      });
    },
    [type, done] as const,
  );
  return () => page.evaluate(() => (window as unknown as { __shown: Promise<number> }).__shown.then(Math.round));
}

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], least: sorted[0], most: sorted.at(-1) };
};

for (const rows of ROWS) {
  test(`a table of ${rows} rows generated, a cell edited`, async ({ browser }) => {
    const runs: Record<string, Times>[] = [];
    for (let i = 0; i <= RUNS; i++) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await context.newPage();
      try {
        await page.goto("/");
        await page.locator("#bench-toggle").click();
        await page.locator("#bench-rows").fill(String(rows));
        // (Generated: its last row drawn)
        let shown = await shownAfter(page, "click", `document.querySelector('.swt-table tr[data-swt-row="${rows}"]') !== null`);
        await page.locator("#bench-form .bench-primary").click();
        const generated = { shown: await shown(), work: await work(page, /^Generate/) };
        // A text cell of the first row edited (its editor by a double click, Enter saving: its text shown; the editor moves
        // to the row below, as a spreadsheet's)
        const cell = page.locator(`.swt-table tr[data-swt-row="1"] > td`).nth(1);
        await cell.dblclick();
        await expect(page.locator(".swt-cell-editor")).toBeFocused();
        await page.keyboard.type("x");
        shown = await shownAfter(page, "keydown", `document.querySelectorAll('.swt-table tr[data-swt-row="1"] > td')[1]?.textContent.endsWith("x") === true`);
        await page.keyboard.press("Enter");
        const edited = { shown: await shown(), work: await work(page, /^Key Enter/) };
        if (i > 0) runs.push({ generated, edited });
      } finally {
        await context.close();
      }
    }
    const out = Object.fromEntries(["generated", "edited"].map((action) => [action, { shown: stats(runs.map((r) => r[action]!.shown)), work: stats(runs.map((r) => r[action]!.work)) }]));
    console.log(`BENCH ${JSON.stringify({ rows, ...out })}`);
  });
}
