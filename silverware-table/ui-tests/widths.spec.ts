// Column widths: the edge between two columns dragged, double-clicked
import type { Page } from "@playwright/test";
import { cell, expect, header, hoverCell, markdown, rendersAnew, setPage, setSettings, settled, table, tableIcon, test } from "./helpers.ts";

const PAGE = "# Test\n\n| Name | Quantity | Note |\n|---|---|---|\n| Pear | 3 | ripe |\n| Fig | 2 | dried |\n";

/** The header cells' widths and the table's, as shown */
const widths = async (page: Page) => ({
  columns: await Promise.all([0, 1, 2].map(async (column) => (await header(page, column).boundingBox())!.width)),
  table: (await table(page).locator("table").boundingBox())!.width,
});

/** A press on a column's handle; the pointer moved `by` from it, one step after another, each step's widths given to `during` */
async function dragHandle(page: Page, column: number, steps: readonly number[], during?: (step: number) => Promise<void>) {
  await hoverCell(page, header(page, column));
  const handle = (await header(page, column).locator(".swt-col-resize").boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const by of steps) {
    await page.mouse.move(x + by, y, { steps: 6 });
    await settled(page);
    await during?.(by);
  }
  await page.mouse.up();
}

const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2);

test.describe("Column widths", () => {
  test.beforeEach(async ({ page }) => {
    await setSettings(page, { "silverware.table.metadata": true });
    await rendersAnew(page, () => setPage(page, PAGE));
  });

  test("an edge dragged moves only itself: the neighbour gives what the column takes, back again it has its width again; the table keeps its width", async ({ page }) => {
    const before = await widths(page);
    await dragHandle(page, 0, [60, 20], async (by) => {
      const now = await widths(page);
      near(now.columns[0]!, before.columns[0]! + by);
      near(now.columns[1]!, before.columns[1]! - by);
      near(now.columns[2]!, before.columns[2]!);
      near(now.table, before.table);
    });
    // Every column's width stored, and shown so once the table is rendered anew
    await expect.poll(() => markdown(page)).toMatch(/widths\.-c-name\.size='\d+' widths\.-c-quantity\.size='\d+' widths\.-c-note\.size='\d+'/);
    await expect(table(page).locator("table > colgroup.swt-fixed-columns > col")).toHaveCount(3);
    const after = await widths(page);
    near(after.columns[0]!, before.columns[0]! + 20);
    near(after.columns[1]!, before.columns[1]! - 20);
    near(after.table, before.table);
    // While dragging the handle was lit; let go, it is not
    await expect(header(page, 0).locator(".swt-col-resize.swt-active")).toHaveCount(0);
  });

  test("a column at what its header needs stops giving: the next column gives, the header's name stays whole", async ({ page }) => {
    const before = await widths(page);
    await dragHandle(page, 1, [-2000]);
    await expect.poll(() => markdown(page)).toContain("widths.-c-quantity.size=");
    const after = await widths(page);
    // Name and Quantity gave all they could, Note took it all
    expect(after.columns[0]!).toBeLessThan(before.columns[0]!);
    expect(after.columns[1]!).toBeLessThan(before.columns[1]!);
    near(after.columns[2]!, before.columns[2]! + (before.columns[0]! - after.columns[0]!) + (before.columns[1]! - after.columns[1]!));
    near(after.table, before.table);
    const name = header(page, 1).locator(".swt-head-name");
    expect(await name.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("a column with a width in a table whose other columns are automatic shrinks as dragged", async ({ page }) => {
    await rendersAnew(page, () => setPage(page, `${PAGE}| <meta core.table widths.-c-name.size='300'> |\n`));
    const before = await widths(page);
    await dragHandle(page, 0, [-100]);
    await expect.poll(() => markdown(page)).toContain("widths.-c-quantity.size=");
    const after = await widths(page);
    near(after.columns[0]!, before.columns[0]! - 100);
    near(after.columns[1]!, before.columns[1]! + 100);
    near(after.table, before.table);
  });

  test("a double click makes a column automatic again, the others keep their widths", async ({ page }) => {
    await dragHandle(page, 0, [40]);
    await expect.poll(() => markdown(page)).toContain("widths.-c-name.size=");
    const sized = await widths(page);
    await hoverCell(page, header(page, 0));
    const handle = (await header(page, 0).locator(".swt-col-resize").boundingBox())!;
    await page.mouse.dblclick(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await expect.poll(() => markdown(page)).not.toContain("widths.-c-name.size=");
    await expect(table(page).locator("table > colgroup.swt-fixed-columns")).toHaveCount(0);
    const after = await widths(page);
    near(after.columns[1]!, sized.columns[1]!);
    near(after.columns[2]!, sized.columns[2]!);
  });

  test("the last column has no handle: its right edge is the table's", async ({ page }) => {
    await hoverCell(page, header(page, 2));
    await expect(header(page, 2).locator(".swt-col-resize")).toHaveCount(0);
    await expect(table(page).locator("thead .swt-col-resize")).toHaveCount(2);
  });

  test("the table the sheet view was opened from has its handles again once the view is closed, its header as it was", async ({ page }) => {
    const heads = () => table(page).locator("thead tr").first().evaluate((tr) => Array.from(tr.children, (c) => c.querySelectorAll(".swt-head").length));
    const before = await heads();
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Sheet view")).click();
    await expect(page.locator(".sb-table-widget.swt-drawn.swt-sheet-table:not(.swt-stand-in)")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".swt-sheet-board")).toHaveCount(0);
    await expect(header(page, 0).locator(".swt-col-resize")).toHaveCount(1);
    expect(await table(page).locator("thead .swt-col-resize").count()).toBe((await table(page).locator("thead tr").first().locator("> *").count()) - 1);
    // Shown again, not decorated twice
    expect(await heads()).toEqual(before);
  });
});
