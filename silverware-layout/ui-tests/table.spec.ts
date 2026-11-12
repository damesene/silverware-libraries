// Silverware Table's tables laid out by Silverware Layout, in SilverBullet: the table's provider (Silverware Table's
// core/layoutprovider.ts) keeps the width in the table's metadata (`layout.width`), Silverware Layout shows it.
import { expect, test } from "./helpers.ts";

// SilverBullet's default theme: 800 px of text less 20 px of padding each side
const TEXT = 760;
const LOREM = "Quisque placerat sollicitudin leo, quis sollicitudin dui pretium in. Donec vulputate a turpis at convallis.";
const PAGE = `# Table\n\n${LOREM}\n\n| Name | Amount |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n\n${LOREM}\n`;

test.use({ viewport: { width: 1600, height: 900 } });

test("a table widened by its handle: its width kept in its metadata, drawn anew at it with no frame at the text's width, a double click taking it off", async ({ page, space }) => {
  // Every frame after a write: the table's width
  await page.addInitScript(() => {
    const widths: number[] = ((window as unknown as { swlWidths: number[] }).swlWidths = []);
    const tick = () => {
      const table = document.querySelector(".sb-table-widget");
      if (table) widths.push(Math.round(table.getBoundingClientRect().width));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await space.open({ Page: PAGE }, "Page");
  const table = page.locator(".sb-table-widget.swt-table");
  await expect(table).toBeVisible();
  expect(Math.round((await table.boundingBox())!.width)).toBe(TEXT);

  const b = (await table.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + at.height / 2, { steps: 5 });
  await page.mouse.move(at.x + 150, at.y + at.height / 2, { steps: 5 });
  await expect.poll(async () => Math.round((await table.boundingBox())!.width)).toBeGreaterThan(TEXT + 250);
  const from = await page.evaluate(() => (window as unknown as { swlWidths: number[] }).swlWidths.length);
  await page.mouse.up();

  await expect.poll(async () => (await space.saved("Page")) ?? "").toMatch(/layout\.width='(\d+)'/);
  const width = Number(/layout\.width='(\d+)'/.exec((await space.saved("Page"))!)![1]);
  expect(width).toBeGreaterThan(TEXT + 250);
  // Drawn anew from its markdown: at its width, never a frame at the text's
  await expect.poll(async () => Math.round((await page.locator(".sb-table-widget").boundingBox())!.width)).toBe(width);
  await page.waitForTimeout(300);
  const after = await page.evaluate((i) => (window as unknown as { swlWidths: number[] }).swlWidths.slice(i), from);
  expect(after.filter((w) => w === TEXT)).toEqual([]);

  // A double click on the bar: the text's width again, the attribute gone
  const again = (await page.locator(".sb-table-widget").boundingBox())!;
  await page.mouse.move(again.x + 40, again.y + again.height / 2);
  await expect(bar).toBeVisible();
  const at2 = (await bar.boundingBox())!;
  await page.mouse.dblclick(at2.x + at2.width / 2, at2.y + at2.height / 2);
  await expect.poll(async () => (await space.saved("Page")) ?? "").not.toContain("layout.width");
  await expect.poll(async () => Math.round((await page.locator(".sb-table-widget").boundingBox())!.width)).toBe(TEXT);
});

test("a tall table scrolled nearly out at the top: the bar beside its held header and what is under it, not over the rows hidden above", async ({ page, space }) => {
  const rows = Array.from({ length: 14 }, (_, i) => `| r${i} | ${i} |`).join("\n");
  await space.open({ Page: `# Table\n\n${LOREM}\n\n${LOREM}\n\n| Name | Amount |\n| --- | --- |\n${rows}\n\n${`${LOREM}\n\n`.repeat(30)}` }, "Page");
  const table = page.locator(".sb-table-widget.swt-table");
  await expect(table).toBeVisible();
  // Scrolled so 120 px of the table are left below the view's top: its header held there, the rows above it hidden
  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller")!;
    const box = document.querySelector(".sb-table-widget")!.getBoundingClientRect();
    scroller.scrollTop += box.bottom - scroller.getBoundingClientRect().top - 120;
  });
  await expect.poll(async () => (await table.boundingBox())!.y).toBeLessThan(0);
  const b = (await table.boundingBox())!;
  await page.mouse.move(b.x + 60, b.y + b.height - 8);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const head = (await table.locator("thead").boundingBox())!;
  await expect.poll(async () => Math.round((await bar.boundingBox())!.y)).toBe(Math.round(head.y));
  const at = (await bar.boundingBox())!;
  expect(Math.round(at.y + at.height)).toBe(Math.round(b.y + b.height));
});
