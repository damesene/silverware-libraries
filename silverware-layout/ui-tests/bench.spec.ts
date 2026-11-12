// A benchmark, not a test (run on request: SW_BENCH=1 npm run test:ui:sb -- silverware-layout/ui-tests/bench.spec.ts):
// a large page in SilverBullet (text, a markdown table of Silverware Table, a database of Silverware Database with
// many items, a chart of Silverware Chart with many points), timed with Silverware Layout installed and without it
// (SW_BENCH_LAYOUT=0: its library pages removed from the worker's space before the page is opened):
// - typing in a paragraph above the widgets: each key's time to the frame after it;
// - a widget drawn anew after an edit of its markdown (a table's cell, the database's block): the time until its new
//   element stops changing; the chart's data edited: the time until Chart.js shows it (on a larger page it was not
//   seen in 10 s, 2026-11-12, cause not found: said so in the result, `what`);
// - dragging a widget's width handle (with Silverware Layout): the frames' times while it is dragged, and the write.
// Each with the main thread's long tasks (over 50 ms) summed. Results printed as JSON lines, `BENCH {...}`.
// Sizes by SW_BENCH_SIZES (rows,items,points; several separated by ;), by default "200,100,50;1000,400,300".
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Page } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { expect, test } from "./helpers.ts";

const ON = process.env.SW_BENCH === "1";
const WITH_LAYOUT = process.env.SW_BENCH_LAYOUT !== "0";
const SIZES = (process.env.SW_BENCH_SIZES ?? "200,100,50;1000,400,300").split(";").map((size) => size.split(",").map(Number) as [number, number, number]);
const LOREM = "Quisque placerat sollicitudin leo, quis sollicitudin dui pretium in. Donec vulputate a turpis at convallis.";

test.skip(!ON, "a benchmark: run with SW_BENCH=1");
test.use({ viewport: { width: 1600, height: 1000 } });
test.setTimeout(600_000);

const tableOf = (rows: number) =>
  `| Name | Amount | Status | Note | Date |\n| --- | --- | --- | --- | --- |\n${Array.from({ length: rows }, (_, i) => `| Item ${i} | ${i * 3} | ${i % 2 ? "Done" : "Todo"} | ${LOREM.slice(0, 30 + (i % 40))} | 2026-01-${String((i % 28) + 1).padStart(2, "0")} |`).join("\n")}`;
const root = (id: string) =>
  `---\ntags: [db-root]\n_database:\n  id: ${id}\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    amount: { type: number, label: Amount }\n---\n`;
const item = (i: number) => `---\ntags: [db]\nstatus: ${i % 2 ? "Done" : "Todo"}\namount: ${i}\n_database:\n  rank: a${String(i).padStart(5, "0")}\n---\n`;
const chartOf = (points: number) => {
  const labels = Array.from({ length: points }, (_, i) => `p${i}`).join(", ");
  const values = Array.from({ length: points }, (_, i) => (i * 7) % 50).join(", ");
  return `\`\`\`mermaid\nxychart-beta\n  x-axis [${labels}]\n  bar [${values}]\n\`\`\``;
};

/** The page scrolled until an element is in it (CodeMirror keeps blocks far from the view out of the document), then to it */
async function reveal(page: Page, selector: string): Promise<void> {
  // (From the page's top down: what is above the view is out of the document too)
  if (!(await page.locator(selector).count())) {
    await page.evaluate(() => (document.querySelector(".cm-scroller")!.scrollTop = 0));
    await page.waitForTimeout(100);
  }
  for (let i = 0; i < 400 && !(await page.locator(selector).count()); i++) {
    await page.evaluate(() => (document.querySelector(".cm-scroller")!.scrollTop += 600));
    await page.waitForTimeout(50);
  }
  // (Not Playwright's scrolling, which waits for the element to be still and seen)
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), selector);
  await page.waitForTimeout(300);
}

/** Frames and long tasks recorded in the page from now on */
async function record(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { bench: { frames: number[]; long: number[]; mutations: number } };
    w.bench = { frames: [], long: [], mutations: 0 };
    const tick = (t: number) => {
      w.bench.frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.bench.long.push(entry.duration);
    }).observe({ type: "longtask" });
  });
}

/** The long tasks' time since `from` items of them were taken (ms), and their count */
const longSince = (page: Page, from: number) =>
  page.evaluate((i) => {
    const long = (window as unknown as { bench: { long: number[] } }).bench.long.slice(i);
    return { longTasks: long.length, longMs: Math.round(long.reduce((a, b) => a + b, 0)) };
  }, from);
const longCount = (page: Page) => page.evaluate(() => (window as unknown as { bench: { long: number[] } }).bench.long.length);

/** Each typed key's time to the frame after it (ms): median, 95th percentile, most */
async function typing(page: Page, keys: number) {
  const line = page.locator(".cm-line", { hasText: "Type here." });
  await line.click();
  await page.keyboard.press("End");
  const from = await longCount(page);
  const times: number[] = [];
  for (let i = 0; i < keys; i++) {
    const start = await page.evaluate(() => performance.now());
    await page.keyboard.type("x");
    times.push(await page.evaluate((t) => new Promise<number>((resolve) => requestAnimationFrame(() => requestAnimationFrame((now) => resolve(now - t)))), start));
  }
  times.sort((a, b) => a - b);
  return { medianMs: Math.round(times[Math.floor(times.length / 2)]!), p95Ms: Math.round(times[Math.floor(times.length * 0.95)]!), maxMs: Math.round(times.at(-1)!), ...(await longSince(page, from)) };
}

/**
 * An edit of the page's text (`find` replaced by `put`, through CodeMirror, as a keystroke would): the time until the
 * element `selector` (a widget) and what is in it stop changing for 300 ms
 */
async function redraw(page: Page, selector: string, find: string, put: string) {
  const from = await longCount(page);
  const answer = page.evaluate(
    ({ selector, find, put }) =>
      new Promise<{ ms: number; what: string }>((resolve) => {
        const content = document.querySelector(".cm-content")!;
        // (Drawn anew: a new element in the old one's place; the old one, until then)
        const old = document.querySelector(selector);
        let fresh = false;
        let last = performance.now();
        let what = "";
        const observer = new MutationObserver((records) => {
          for (const r of records) {
            const target = r.target instanceof Element ? r.target : r.target.parentElement;
            if (target?.closest(selector) || [...r.addedNodes, ...r.removedNodes].some((n) => n instanceof Element && (n.matches(selector) || !!n.querySelector(selector)))) {
              last = performance.now();
              const now = document.querySelector(selector);
              if (now && now !== old) fresh = true;
              what = `${r.type} ${r.attributeName ?? ""} ${target?.tagName}.${target?.className}`.slice(0, 120);
            }
          }
        });
        observer.observe(content, { childList: true, subtree: true, attributes: true });
        const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
        const at = view.state.doc.toString().indexOf(find);
        if (at < 0) {
          observer.disconnect();
          return resolve({ ms: -1, what: `not found: ${find}` });
        }
        let start = performance.now();
        // (In a task of its own, as a keystroke's: not inside this evaluation)
        setTimeout(() => {
          start = performance.now();
          last = start;
          view.dispatch({ changes: { from: at, to: at + find.length, insert: put } });
        }, 0);
        // (At most 10 s: something changing in it all the time is said, not waited for)
        const check = () => {
          const capped = performance.now() - start > 10_000;
          if ((fresh && performance.now() - last > 300) || capped) {
            observer.disconnect();
            resolve({ ms: last - start, what: capped ? (fresh ? `still changing: ${what}` : "not drawn anew in 10 s") : "" });
          } else setTimeout(check, 50);
        };
        setTimeout(check, 50);
      }),
    { selector, find, put },
  );
  // (The page not answering in 20 s: said, not waited for)
  const { ms, what } = await Promise.race([answer, new Promise<{ ms: number; what: string }>((resolve) => setTimeout(() => resolve({ ms: -1, what: "the page did not answer in 20 s" }), 20_000))]);
  return { settledMs: Math.round(Math.max(0, ms)), ...(what ? { what } : {}), ...(await longSince(page, from)) };
}

/**
 * The chart's data edited (its first value, 0, made 9): the time until Chart.js shows it (its registry's chart's first
 * value). A chart follows its block in place, not always as a new element, so it is told by its data
 */
async function chartRedraw(page: Page) {
  const from = await longCount(page);
  const answer = page.evaluate(async () => {
    const url = "/.fs/Library/damesene/silverware-chart-chartjs.js";
    const { Chart } = (await import(url)) as { Chart: { getChart(canvas: HTMLCanvasElement): { data: { datasets: { data: unknown[] }[] } } | undefined } };
    const shown = () => {
      const canvas = document.querySelector<HTMLCanvasElement>(".swc-widget canvas");
      return canvas ? Chart.getChart(canvas)?.data.datasets[0]?.data[0] : undefined;
    };
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const at = view.state.doc.toString().indexOf("  bar [");
    if (at < 0) return -1;
    return new Promise<number>((resolve) => {
      setTimeout(() => {
        const start = performance.now();
        view.dispatch({ changes: { from: at + "  bar [".length, to: at + "  bar [".length + 1, insert: "9" } });
        const check = () => {
          if (shown() === 9) resolve(performance.now() - start);
          else if (performance.now() - start > 10_000) resolve(-1);
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }, 0);
    });
  });
  const ms = await Promise.race([answer, new Promise<number>((resolve) => setTimeout(() => resolve(-1), 20_000))]);
  return { settledMs: Math.round(ms), ...(ms < 0 ? { what: "the new data not shown in 10 s" } : {}), ...(await longSince(page, from)) };
}

/** A widget's width handle dragged by 300 px in 30 steps: the frames' times while it moved, then the write's redraw */
async function drag(page: Page, selector: string) {
  await reveal(page, selector);
  const widget = page.locator(selector).first();
  const b = (await widget.boundingBox())!;
  // (On the part of it in view: a tall table's top is above the window)
  const view = page.viewportSize()!;
  await page.mouse.move(b.x + 40, Math.min(Math.max(b.y, 0) + 120, b.y + b.height - 10, view.height - 20));
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  const frames = await page.evaluate(() => (window as unknown as { bench: { frames: number[] } }).bench.frames.length);
  const from = await longCount(page);
  for (let i = 1; i <= 30; i++) await page.mouse.move(at.x + at.width / 2 + i * 10, at.y + at.height / 2);
  const during = await page.evaluate((i) => {
    const f = (window as unknown as { bench: { frames: number[] } }).bench.frames.slice(i);
    const gaps = f.slice(1).map((t, j) => t - f[j]!).sort((a, b) => a - b);
    return { frameMedianMs: Math.round(gaps[Math.floor(gaps.length / 2)] ?? 0), frameMaxMs: Math.round(gaps.at(-1) ?? 0), framesOver33: gaps.filter((g) => g > 33).length };
  }, frames);
  const long = await longSince(page, from);
  const writeFrom = await longCount(page);
  const start = Date.now();
  await page.mouse.up();
  // (The write and the widget drawn anew at its width)
  await page.waitForTimeout(1500);
  return { ...during, ...long, afterRelease: { ...(await longSince(page, writeFrom)), waitedMs: Date.now() - start } };
}

// Silverware Layout's files in a space, as deploy.mjs copies them
const LAYOUT_FILES = ["silverware-layout.md", "silverware-layout-init.md", "silverware-layout-api.md", "silverware-layout-style.md", "silverware-layout.js"];
// What puts the worker's space back after a run without Silverware Layout
let restore: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  await restore?.();
  restore = undefined;
});

for (const [rows, items, points] of SIZES) {
  test(`bench: ${rows} rows, ${items} items, ${points} points, ${WITH_LAYOUT ? "with" : "without"} Silverware Layout`, async ({ page, space }) => {
    const server = silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
    if (!WITH_LAYOUT) {
      // (Put back after it, from the repository, as they were deployed: the worker's space serves other tests too)
      const library = join(server.space, "Library", "damesene");
      for (const file of LAYOUT_FILES) await rm(join(library, file), { force: true });
      test.info().attach("layout removed", { body: library });
      restore = () => Promise.all(LAYOUT_FILES.map((file) => copyFile(join(import.meta.dirname, "..", file), join(library, file)))).then(() => undefined);
    }
    const id = `bench${rows}x${items}`;
    const pages: Record<string, string> = { [`db-${id}`]: root(id) };
    for (let i = 0; i < items; i++) pages[`db-${id}/Item ${i}`] = item(i);
    const text = Array.from({ length: 6 }, () => LOREM).join("\n\n");
    pages.Page = `# Bench\n\nType here.\n\n${text}\n\n${tableOf(rows)}\n\n${text}\n\n\`\`\`silverware-database\nid: ${id}\n\`\`\`\n\n${text}\n\n${chartOf(points)}\n\n${text}\n`;
    // (Written and opened here: the fixture's open waits for Silverware Layout's command, which may not be there)
    for (const [name, text] of Object.entries(pages)) {
      const path = join(server.space, space.folder, `${name}.md`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    }
    await page.goto(`http://127.0.0.1:${server.port}/${space.folder}/Page`);
    await page.waitForFunction(() => !!(window as unknown as { client?: { editorView?: unknown } }).client?.editorView);
    await expect(page.locator(".sb-table-widget.swt-table")).toBeVisible({ timeout: 60_000 });
    await reveal(page, ".swd-place");
    await expect(page.locator(".swd-place .swd-place-count")).toHaveText(String(items), { timeout: 300_000 });
    await reveal(page, ".swc-widget");
    await expect(page.locator(".swc-widget canvas")).toBeAttached({ timeout: 60_000 });
    console.log("bench: page ready");
    await page.evaluate(() => (document.querySelector(".cm-scroller")!.scrollTop = 0));
    await page.waitForTimeout(2000);
    // (Silverware Layout there or not, as asked)
    expect(await page.evaluate(() => !!document.documentElement.style.getPropertyValue("--swl-pane-width"))).toBe(WITH_LAYOUT);
    await record(page);
    const result: Record<string, unknown> = { rows, items, points, layout: WITH_LAYOUT };
    result.typing = await typing(page, 30);
    await reveal(page, ".sb-table-widget");
    result.tableRedraw = await redraw(page, ".sb-table-widget", "| Item 5 |", "| Item 5b |");
    await reveal(page, ".swd-place");
    result.databaseRedraw = await redraw(page, ".swd-place", `id: ${id}\n`, `id: ${id}\nlayout.width: 1100\n`);
    await reveal(page, ".swc-widget");
    result.chartRedraw = await chartRedraw(page);
    if (WITH_LAYOUT) {
      result.tableDrag = await drag(page, ".sb-table-widget");
      result.databaseDrag = await drag(page, ".swd-place");
      result.chartDrag = await drag(page, ".swc-widget");
    }
    console.log(`BENCH ${JSON.stringify(result)}`);
  });
}
