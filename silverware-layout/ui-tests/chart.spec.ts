// Silverware Chart's charts laid out by Silverware Layout, in SilverBullet: the chart's provider keeps the width in the
// chart's model, which the Mermaid format writes as a comment of the block (`%% layout.width: 1100`).
import { expect, test } from "./helpers.ts";

const TEXT = 760;
const LOREM = "Quisque placerat sollicitudin leo, quis sollicitudin dui pretium in. Donec vulputate a turpis at convallis.";
const CHART = "```mermaid\nxychart-beta\n  x-axis [a, b, c]\n  bar [3, 5, 2]\n```";
const PAGE = `# Chart\n\n${LOREM}\n\n${CHART}\n\n${LOREM}\n`;

test.use({ viewport: { width: 1600, height: 900 } });

test("a chart widened by its handle: the width a comment of its block, drawn anew at it with no frame at the text's width, a double click taking it off", async ({ page, space }) => {
  await page.addInitScript(() => {
    const widths: number[] = ((window as unknown as { swlWidths: number[] }).swlWidths = []);
    const tick = () => {
      const widget = document.querySelector(".swc-widget");
      if (widget) widths.push(Math.round(widget.getBoundingClientRect().width));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await space.open({ Page: PAGE }, "Page");
  const widget = page.locator(".swc-widget");
  await expect(widget.locator("canvas")).toBeVisible();
  expect(Math.round((await widget.boundingBox())!.width)).toBe(TEXT);

  const b = (await widget.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + at.height / 2, { steps: 5 });
  await page.mouse.move(at.x + 150, at.y + at.height / 2, { steps: 5 });
  await expect.poll(async () => Math.round((await widget.boundingBox())!.width)).toBeGreaterThan(TEXT + 250);
  const from = await page.evaluate(() => (window as unknown as { swlWidths: number[] }).swlWidths.length);
  await page.mouse.up();

  await expect.poll(async () => (await space.saved("Page")) ?? "").toMatch(/\n%% layout\.width: (\d+)\n```/);
  const width = Number(/\n%% layout\.width: (\d+)\n```/.exec((await space.saved("Page"))!)![1]);
  expect(width).toBeGreaterThan(TEXT + 250);
  await expect.poll(async () => Math.round((await page.locator(".swc-widget").boundingBox())!.width)).toBe(width);
  // Chart.js draws the chart as wide as its box
  await expect.poll(async () => Math.round((await page.locator(".swc-widget canvas").boundingBox())!.width)).toBeGreaterThan(TEXT + 200);
  await page.waitForTimeout(300);
  const after = await page.evaluate((i) => (window as unknown as { swlWidths: number[] }).swlWidths.slice(i), from);
  expect(after.filter((w) => w === TEXT)).toEqual([]);

  const again = (await page.locator(".swc-widget").boundingBox())!;
  await page.mouse.move(again.x + 40, again.y + again.height / 2);
  await expect(bar).toBeVisible();
  const at2 = (await bar.boundingBox())!;
  await page.mouse.dblclick(at2.x + at2.width / 2, at2.y + at2.height / 2);
  await expect.poll(async () => (await space.saved("Page")) ?? "").not.toContain("layout.width");
  // (The block as the Mermaid format writes it, as any write of the chart: its labels quoted)
  expect(await space.saved("Page")).toContain('xychart-beta\n  x-axis ["a", "b", "c"]\n  bar [3, 5, 2]\n```');
  await expect.poll(async () => Math.round((await page.locator(".swc-widget").boundingBox())!.width)).toBe(TEXT);
});
