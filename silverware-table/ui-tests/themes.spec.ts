// A table's theme as it is drawn: its colors where SilverBullet paints a table's cells otherwise
import type { Locator, Page } from "@playwright/test";
import { expect, setSettings, stableBox, startingOn, table, test } from "./helpers.ts";

// Six rows, the striped ones among them
const SIX_ROWS = `# Test\n\n| Name | Qty |\n|---|---|\n${Array.from({ length: 6 }, (_, i) => `| Row ${i + 1} | ${i * 3} |`).join("\n")}\n\nAfter\n`;

/**
 * The color the screen shows in a cell, its fill as drawn: at its middle's height (away from a theme's lines between
 * rows), within its left padding (away from its text and from a line between columns); read where the cell rests (the
 * page may still move it just after it is drawn)
 */
async function fillOf(page: Page, cell: Locator): Promise<string> {
  const box = await stableBox(cell);
  const shot = await page.screenshot({ clip: { x: box.x + 4, y: box.y + box.height / 2, width: 2, height: 2 } });
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [image.width, image.height];
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3)).join(",");
  }, shot.toString("base64"));
}

// (On a page of its own: one set after another's table showed, the test waited on that table, slate too, and hovered
// where its row was before the page's own was drawn)
test("the row under the pointer in a theme's tint, apart from the striped rows and the plain ones alike", startingOn(SIX_ROWS), async ({ page }) => {
  await setSettings(page, { "silverware.table.modules.themes.theme": "slate" });
  await expect(table(page)).toHaveAttribute("data-swt-theme", "slate");
  const cellOf = (row: number) => table(page).locator(`tr[data-swt-row="${row}"] > td`).nth(1);
  // (The pointer away: no row under it)
  await page.mouse.move(1, 1);
  await expect(table(page).locator("tr:hover")).toHaveCount(0);
  const [plain, striped] = [await fillOf(page, cellOf(1)), await fillOf(page, cellOf(2))];
  expect(plain).not.toBe(striped);
  for (const row of [1, 2]) {
    // (The pointer onto the cell where it rests: moved by the page as the pointer goes, it hovered another row)
    const box = await stableBox(cellOf(row));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(table(page).locator(`tr[data-swt-row="${row}"]:hover`)).toHaveCount(1);
    const hovered = await fillOf(page, cellOf(row));
    expect(hovered, `row ${row} under the pointer`).not.toBe(plain);
    expect(hovered, `row ${row} under the pointer`).not.toBe(striped);
  }
});
