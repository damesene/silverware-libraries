/// <reference types="node" />
// What the chart's interaction tests share. Charts are drawn by SilverBullet's
// code widgets, which the playground has not: these tests run against a real
// SilverBullet only (npm run test:ui:sb), the committed silverware-chart.js
// deployed, and are skipped on the playground. A test's page is written into
// its worker's space (UiChart/<name>), opened, and removed after.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");
const FOLDER = "UiChart";

/**
 * Tests get `page` (nothing open yet) and `open(text)`, a page of that text
 * opened (SilverBullet puts the cursor at its start: a block there shows its
 * markdown, so a page starts with a heading); an error in the page fails the test
 */
export const test = base.extend<{ open: (text: string) => Promise<void> }>({
  page: async ({ page }, use) => {
    test.skip(!onSilverBullet, "charts are drawn by SilverBullet's code widgets: tested against SilverBullet only");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // (SilverBullet answers what it looks for and does not find with a 404, which the page logs)
      if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text());
    });
    try {
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      await page.close();
      await rm(join(server().space, FOLDER), { recursive: true, force: true });
    }
  },
  open: async ({ page }, use) => {
    await use(async (text) => {
      const name = `${FOLDER}/${test.info().title.replace(/[^\w ]/g, "").slice(0, 40).trim()}`;
      const path = join(server().space, `${name}.md`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
      await page.goto(`http://127.0.0.1:${server().port}/${name}`);
    });
  },
});

/** The page's text as saved */
export async function savedText(page: Page): Promise<string> {
  const name = await page.evaluate(() => (window as unknown as { client: { currentName(): string } }).client.currentName());
  return (await readFile(join(server().space, `${name}.md`), "utf8")).replace(/\r\n/g, "\n");
}

/** Each chart shown, by Chart.js's own registry (the module the plugin loaded): its type and its series' values */
export function charts(page: Page): Promise<{ type: string; labels: unknown[]; data: unknown[][] }[]> {
  return page.evaluate(async () => {
    const url = "/.fs/Library/damesene/silverware-chart-chartjs.js";
    const { Chart } = (await import(url)) as { Chart: { getChart(canvas: HTMLCanvasElement): { config: { type: string }; data: { labels?: unknown[]; datasets: { data: unknown[] }[] } } | undefined } };
    return [...document.querySelectorAll<HTMLCanvasElement>(".swc-chart canvas")].flatMap((canvas) => {
      const chart = Chart.getChart(canvas);
      return chart ? [{ type: chart.config.type, labels: chart.data.labels ?? [], data: chart.data.datasets.map((d) => d.data) }] : [];
    });
  });
}
