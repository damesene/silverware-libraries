// A benchmark, not a test (docs/silverware-core-work.md, step S, item 6; run on request against SilverBullet:
// SW_BENCH=1 npm run test:ui:sb -- silverware-database/ui-tests/sbbench.spec.ts --workers 1): how many times each action
// draws a database's place and its view in SilverBullet, and its time (what the playground lacks: the widget drawn anew
// on a write, rendered twice, the index emptied while a page is indexed again). A database of N items (SW_BENCH_ITEMS,
// by default 1000), `silverware.database.pageSize` N and the default 50; per view (table, list, board, calendar,
// timeline):
// - the page opened (loaded anew): until the place holds still;
// - an item changed elsewhere (its page written through SilverBullet);
// - a key typed in the name's filter;
// - the block written (the filter kept by Enter).
// Each until nothing in the page's content is added or removed for 500 ms (2 s for the first two): the time, the places
// and the views' bodies added (each a widget or a view drawn whole: a view's own update in place adds neither, and the
// still copy a new widget shows until it draws counts as one; counted by the spec's MutationObserver, never by `src/`),
// the long tasks. One warm-up left out,
// then the median, least and most of 5. Printed as JSON lines, `BENCH {...}`.
import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { configFile, silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { expect, test } from "./helpers.ts";

const ON = process.env.SW_BENCH === "1";
const ITEMS = Number(process.env.SW_BENCH_ITEMS ?? 1000);
const VIEWS = (process.env.SW_BENCH_VIEWS ?? "table,list,board,calendar,timeline").split(",");
const RUNS = Number(process.env.SW_BENCH_RUNS ?? 5);

test.skip(!ON, "a benchmark: run with SW_BENCH=1");
// (A benchmark failed is not run again: a run takes many minutes, and its numbers would be printed twice)
test.describe.configure({ retries: 0 });
test.use({ viewport: { width: 1600, height: 1000 } });
test.setTimeout(3_600_000);

const ROOT = "---\ntags: [db-root]\n_database:\n  id: bench\n  name: Bench\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Doing, Done] }\n    qty: { type: number, label: Qty }\n    due: { type: date, label: Due }\n---\n";
const item = (i: number) => `---\ntags: [db]\nstatus: ${["Todo", "Doing", "Done"][i % 3]}\nqty: ${(i * 7) % 13}\ndue: 2026-11-${String((i % 30) + 1).padStart(2, "0")}\n_database:\n  rank: a${String(i).padStart(6, "0")}\n---\n`;

type Measure = { readonly ms: number; readonly places: number; readonly bodies: number; readonly long: number };

/** What the page records from its start: long tasks, each change of the content's nodes, the places and views' bodies added */
async function recording(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sw = ((window as unknown as { __sw: unknown }).__sw = { tasks: [] as [number, number][], muts: [] as number[], places: [] as number[], bodies: [] as number[] });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) sw.tasks.push([e.startTime, e.duration]);
    }).observe({ type: "longtask", buffered: true });
    // (Each element counted once, though it is found again in a node added after it in the same batch)
    const seen = new WeakSet<Element>();
    const count = (node: Node, selector: string) => {
      if (!(node instanceof Element)) return 0;
      const found = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)].filter((e) => !seen.has(e));
      for (const e of found) seen.add(e);
      return found.length;
    };
    new MutationObserver((records) => {
      const t = performance.now();
      for (const r of records) {
        if (!(r.target instanceof Element) || !r.target.closest("#sb-main")) continue;
        sw.muts.push(t);
        for (const node of r.addedNodes) {
          for (let i = count(node, ".swd-place"); i > 0; i--) sw.places.push(t);
          for (let i = count(node, ".swd-place-body"); i > 0; i--) sw.bodies.push(t);
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

/** From `from` until the content holds still `quiet` ms (or has not changed since): what it took. A page opened and an
 * item changed elsewhere wait 2 s (SilverBullet indexes the page between, drawing nothing meanwhile) */
function settled(page: Page, from: number, quiet = 500): Promise<Measure> {
  return page.evaluate(async ([from, quiet]) => {
    const sw = (window as unknown as { __sw: { tasks: [number, number][]; muts: number[]; places: number[]; bodies: number[] } }).__sw;
    const end = performance.now() + 300_000;
    while (performance.now() < end) {
      await new Promise((done) => setTimeout(done, 100));
      const last = sw.muts.filter((t) => t >= from).at(-1) ?? from;
      if (performance.now() - last > quiet) break;
    }
    const last = sw.muts.filter((t) => t >= from).at(-1) ?? from;
    return { ms: Math.round(last - from), places: sw.places.filter((t) => t >= from).length, bodies: sw.bodies.filter((t) => t >= from).length, long: Math.round(sw.tasks.filter(([t]) => t >= from).reduce((sum, [, d]) => sum + d, 0)) };
  }, [from, quiet] as const);
}

const now = (page: Page) => page.evaluate(() => performance.now());

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], least: sorted[0], most: sorted.at(-1) };
};

for (const size of [ITEMS, 50]) {
  for (const view of VIEWS) {
    test(`${view}, ${ITEMS} items, ${size} at first`, async ({ page, space }) => {
      const server = silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
      // (The setting as the settings dialog keeps it; the fixture puts the configuration back after)
      await writeFile(configFile(server.space), `\`\`\`space-lua\nconfig.set("silverware.database.pageSize", ${size})\n\`\`\`\n`);
      const pages: Record<string, string> = { Page: `# Bench\n\n\`\`\`silverware-database\nid: bench\nview: ${view}\n\`\`\`\n\nAfter\n`, "Page/db-bench": ROOT };
      for (let i = 0; i < ITEMS; i++) pages[`Page/db-bench/Item ${i}`] = item(i);
      await recording(page);
      await space.open(pages, "Page");
      // (Indexed whole, once: every item counted)
      await expect(page.locator(".swd-place .swd-place-count")).toHaveText(String(ITEMS), { timeout: 600_000 });
      const runs: Record<string, Measure>[] = [];
      for (let i = 0; i <= RUNS; i++) {
        const result: Record<string, Measure> = {};
        await page.reload();
        await expect(page.locator(".swd-place .swd-place-count")).toHaveText(String(ITEMS), { timeout: 120_000 });
        result.opened = await settled(page, 0, 2000);
        let from = await now(page);
        await page.evaluate(
          async ([name, text]) => {
            const { client } = window as unknown as { client: { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } } };
            await client.clientSystem.localSyscall("space.writePage", [name, text]);
          },
          [`${space.folder}/Page/db-bench/Item 0`, item(0).replace(/qty: \d+/, `qty: ${100 + i}`)] as const,
        );
        result.changed = await settled(page, from, 2000);
        await page.locator(".swd-filter-button").click();
        const field = page.locator('.swd-filter input[data-key="name"]');
        await field.click();
        from = await now(page);
        await page.keyboard.type("1");
        result.filterKey = await settled(page, from);
        from = await now(page);
        await page.keyboard.press("Enter");
        result.written = await settled(page, from);
        // (On disk before it is taken off: a change made before the place is drawn anew from its write compares with the
        // block as it was, so taking the filter off then writes nothing, and the write of "1" lands after)
        await expect.poll(async () => /\.filter:/.test((await space.saved("Page")) ?? ""), { timeout: 30_000 }).toBe(true);
        await settled(page, await now(page), 2000);
        // (The filter taken off again for the next run: its panel opened where the widget drawn anew left it closed;
        // saved before the reload)
        const button = page.locator(".swd-filter-button");
        if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
        await page.locator('.swd-filter input[data-key="name"]').fill("");
        await page.keyboard.press("Enter");
        await settled(page, await now(page));
        await expect.poll(async () => /\.filter:/.test((await space.saved("Page")) ?? ""), { timeout: 30_000 }).toBe(false);
        if (i > 0) runs.push(result);
      }
      const actions = Object.keys(runs[0] ?? {});
      const out = Object.fromEntries(actions.map((action) => [action, Object.fromEntries((["ms", "places", "bodies", "long"] as const).map((k) => [k, stats(runs.map((r) => r[action]![k]))]))]));
      console.log(`BENCH ${JSON.stringify({ view, items: ITEMS, size, ...out })}`);
    });
  }
}
