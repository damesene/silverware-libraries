// Silverware Database's places laid out by Silverware Layout, in SilverBullet: the database's provider keeps the width
// as a line of its block (`layout.width: 1100`), Silverware Layout shows it.
import { expect, test } from "./helpers.ts";

const TEXT = 760;
const LOREM = "Quisque placerat sollicitudin leo, quis sollicitudin dui pretium in. Donec vulputate a turpis at convallis.";
// A database as Silverware Database keeps one (its root page found by its id), and an item of it
const root = `---\ntags: [db-root]\n_database:\n  id: uilayout\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n---\n`;
const item = `---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a\n---\n`;
const PAGE = `# Database\n\n${LOREM}\n\n\`\`\`silverware-database\nid: uilayout\n\`\`\`\n\n${LOREM}\n`;

test.use({ viewport: { width: 1600, height: 900 } });

test("a database's place widened by its handle: the width a line of its block, drawn anew at it with no frame at the text's width, a double click taking it off", async ({ page, space }) => {
  await page.addInitScript(() => {
    const widths: number[] = ((window as unknown as { swlWidths: number[] }).swlWidths = []);
    const tick = () => {
      const place = document.querySelector(".swd-place");
      if (place) widths.push(Math.round(place.getBoundingClientRect().width));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await space.open({ "db-uilayout": root, "db-uilayout/First task": item, Page: PAGE }, "Page");
  const place = page.locator(".swd-place");
  await expect(place.getByText("First task")).toBeVisible();
  expect(Math.round((await place.boundingBox())!.width)).toBe(TEXT);

  const b = (await place.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + at.height / 2, { steps: 5 });
  await page.mouse.move(at.x + 150, at.y + at.height / 2, { steps: 5 });
  await expect.poll(async () => Math.round((await place.boundingBox())!.width)).toBeGreaterThan(TEXT + 250);
  const from = await page.evaluate(() => (window as unknown as { swlWidths: number[] }).swlWidths.length);
  await page.mouse.up();

  await expect.poll(async () => (await space.saved("Page")) ?? "").toMatch(/\nlayout\.width: "?(\d+)"?\n/);
  const width = Number(/\nlayout\.width: "?(\d+)"?\n/.exec((await space.saved("Page"))!)![1]);
  expect(width).toBeGreaterThan(TEXT + 250);
  expect(await space.saved("Page")).toContain("```silverware-database\nid: uilayout\nlayout.width: ");
  await expect.poll(async () => Math.round((await page.locator(".swd-place").boundingBox())!.width)).toBe(width);
  // Not cut by the box SilverBullet shows a Lua block's output in (the text's width, scrolling): its right end seen
  const shown = await page.locator(".swd-place").evaluate((place) => {
    const r = place.querySelector(".swd-table")!.getBoundingClientRect();
    return !!document.elementFromPoint(r.right - 8, r.top + 8)?.closest(".swd-place");
  });
  expect(shown).toBe(true);
  await page.waitForTimeout(300);
  const after =await page.evaluate((i) => (window as unknown as { swlWidths: number[] }).swlWidths.slice(i), from);
  expect(after.filter((w) => w === TEXT)).toEqual([]);

  const again = (await page.locator(".swd-place").boundingBox())!;
  await page.mouse.move(again.x + 40, again.y + again.height / 2);
  await expect(bar).toBeVisible();
  const at2 = (await bar.boundingBox())!;
  await page.mouse.dblclick(at2.x + at2.width / 2, at2.y + at2.height / 2);
  await expect.poll(async () => (await space.saved("Page")) ?? "").not.toContain("layout.width");
  await expect.poll(async () => Math.round((await page.locator(".swd-place").boundingBox())!.width)).toBe(TEXT);
});

test("a database's rows lower at a smaller font (Silverware Layout's font zoom), as high as a table's, their grip keeping its size; the name and Open in the row's middle", async ({ page, space }) => {
  await space.open({ "db-uilayout": root, "db-uilayout/First task": item, Page: PAGE }, "Page");
  const row = page.locator(".swd-table tbody tr", { hasText: "First task" });
  await expect(row).toBeVisible();
  const height = async () => Math.round((await row.boundingBox())!.height);
  const theme = await height();
  // Font zoom down to half SilverBullet's 18 px, over the page's text
  const text = (await page.locator(".cm-line", { hasText: "Quisque placerat" }).first().boundingBox())!;
  await page.mouse.move(text.x + 20, text.y + text.height / 2);
  await page.keyboard.down("Control");
  for (let i = 0; i < 9; i++) await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  await expect.poll(height).toBeLessThan(theme - 6);
  await row.hover();
  const grip = (await row.locator(".swd-row-grip").boundingBox())!;
  expect(Math.round(grip.height)).toBe(22);
  // As high as a table's row of Silverware Table: the line and SilverBullet's 8 px above and below (and its line under it)
  const line = await row.locator("td[data-key=name]").evaluate((td) => parseFloat(getComputedStyle(td).lineHeight));
  expect(await height()).toBeLessThanOrEqual(Math.round(line + 16) + 2);
  const r = (await row.boundingBox())!;
  const middle = r.y + r.height / 2;
  for (const part of [".swd-open", ".swd-table-name", ".swd-row-grip"]) {
    const b = (await row.locator(part).boundingBox())!;
    expect(Math.abs(b.y + b.height / 2 - middle), part).toBeLessThanOrEqual(2);
  }
});
