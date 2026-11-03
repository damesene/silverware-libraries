import type { Page } from "@playwright/test";
import { expect, setPage, table, target, test } from "./helpers.ts";

const TEXT = "Before.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\nAfter.\n";
// The empty line right after the table
const AFTER_TABLE = TEXT.indexOf("\n\nAfter.") + 1;

const cursor = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { client: { editorView: { state: { selection: { main: { head: number } } } } } }).client.editorView.state.selection.main.head);

test.describe("Presses beside a table", () => {
  // The playground draws a table in a line of its own: SilverBullet's editor keeps the table's first line under it
  test.skip(target !== "silverbullet", "SilverBullet's editor only");

  test.beforeEach(async ({ page }) => {
    await setPage(page, TEXT);
    await expect(table(page)).toBeVisible();
  });

  test("no empty line of the table's own shows under it: the line after it starts at its bottom", async ({ page }) => {
    const box = (await table(page).boundingBox())!;
    const line = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".cm-line")?.getBoundingClientRect().top, { x: box.x + 20, y: box.y + box.height + 2 });
    expect(Math.abs(line! - (box.y + box.height))).toBeLessThan(1);
  });

  const points: [string, (box: { x: number; y: number; width: number; height: number }) => { x: number; y: number }][] = [
    ["right of the table", (box) => ({ x: box.x + box.width + 30, y: box.y + box.height / 2 })],
    ["right under it", (box) => ({ x: box.x + 20, y: box.y + box.height + 1 })],
    ["on the empty line after it", (box) => ({ x: box.x + 20, y: box.y + box.height + 10 })],
  ];
  for (const [name, at] of points) {
    test(`a press ${name} puts the cursor after the table, which stays shown`, async ({ page }) => {
      const point = at((await table(page).boundingBox())!);
      await page.mouse.click(point.x, point.y);
      await expect.poll(() => cursor(page)).toBe(AFTER_TABLE);
      await expect(table(page)).toBeVisible();
    });
  }
});
