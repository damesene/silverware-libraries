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

  test("a column dragged past what its header needs cuts it, its name its title; at 80px the next column gives", async ({ page }) => {
    const before = await widths(page);
    await dragHandle(page, 1, [-2000]);
    await expect.poll(() => markdown(page)).toContain("widths.-c-quantity.size='80'");
    const after = await widths(page);
    // Quantity and then Name gave all they could, Note took it all
    near(after.columns[0]!, 80);
    near(after.columns[1]!, 80);
    near(after.columns[2]!, before.columns[2]! + (before.columns[0]! - after.columns[0]!) + (before.columns[1]! - after.columns[1]!));
    near(after.table, before.table);
    const name = header(page, 1).locator(".swt-head-name");
    expect(await name.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeGreaterThan(0);
    await expect(name).toHaveAttribute("title", "Quantity");
    // Whole again (Reset column widths): no title
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Reset column widths")).click();
    await expect.poll(() => markdown(page)).not.toContain("widths.");
    await expect(name).not.toHaveAttribute("title");
  });

  test("a header fitted in full screen shows whole back in the page, the other columns giving the room", async ({ page }) => {
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Full screen")).click();
    await expect(table(page)).toHaveClass(/swt-over-window/);
    // Quantity as wide as its header (its cells are shorter)
    await hoverCell(page, header(page, 1));
    const handle = (await header(page, 1).locator(".swt-col-resize").boundingBox())!;
    await page.mouse.dblclick(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await expect.poll(() => markdown(page)).toContain("widths.box=");
    await page.keyboard.press("Escape");
    await expect(table(page)).not.toHaveClass(/swt-over-window/);
    const name = header(page, 1).locator(".swt-head-name");
    await expect.poll(() => name.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
    await expect(name).not.toHaveAttribute("title");
    const box = await table(page).evaluate((widget) => widget.scrollWidth - widget.clientWidth);
    expect(box).toBeLessThanOrEqual(0);
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

  test("a double click fits a column to its text, the next column giving the room, the table keeping its width", async ({ page }) => {
    await rendersAnew(page, () => setPage(page, "# Test\n\n| Name | Quantity | Note |\n|---|---|---|\n| A rather long name of a pear | 3 | ripe |\n| Fig | 2 | dried |\n| <meta core.table widths.-c-name.size='80' widths.-c-quantity.size='300' widths.-c-note.size='200'> |\n"));
    const before = await widths(page);
    // How much wider the text is on one line than its box (cut or wrapped there)
    const missing = () =>
      cell(page, 1, 0)
        .locator(".swt-cell-content")
        .evaluate((e: HTMLElement) => {
          const shown = e.clientWidth;
          const { width, maxWidth } = e.style;
          Object.assign(e.style, { width: "max-content", maxWidth: "none" });
          const whole = e.getBoundingClientRect().width;
          Object.assign(e.style, { width, maxWidth });
          return whole - shown;
        });
    expect(await missing()).toBeGreaterThan(10);
    await hoverCell(page, header(page, 0));
    const handle = (await header(page, 0).locator(".swt-col-resize").boundingBox())!;
    await page.mouse.dblclick(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await expect.poll(() => markdown(page)).not.toContain("widths.-c-name.size='80'");
    await expect.poll(missing).toBeLessThanOrEqual(1);
    const after = await widths(page);
    near(after.columns[0]! - before.columns[0]!, before.columns[1]! - after.columns[1]!);
    near(after.columns[2]!, before.columns[2]!);
    near(after.table, before.table);
  });

  test("widths set in full screen: back in the page the table fits its box, its columns as shared as there", async ({ page }) => {
    const box = () => table(page).evaluate((widget) => ({ scroll: widget.scrollWidth, client: widget.clientWidth }));
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Full screen")).click();
    await expect(table(page)).toHaveClass(/swt-over-window/);
    await dragHandle(page, 0, [200]);
    await expect.poll(() => markdown(page)).toContain("widths.box=");
    const full = await widths(page);
    await page.keyboard.press("Escape");
    await expect(table(page)).not.toHaveClass(/swt-over-window/);
    const inPage = await widths(page);
    expect(inPage.table).toBeLessThan(full.table);
    // No sideways scroll: as wide as its box
    const now = await box();
    expect(now.scroll).toBeLessThanOrEqual(now.client);
    for (const column of [0, 1, 2]) expect(Math.abs(inPage.columns[column]! / inPage.table - full.columns[column]! / full.table)).toBeLessThan(0.01);
  });

  test("columns held at their headers' need in a narrower box: the pinned columns' offsets follow", async ({ page }) => {
    // Set in a box three times as wide: Name and Quantity would be under their headers' need, held there
    await rendersAnew(page, () => setPage(page, `${PAGE}| <meta core.table core.pin-left='2' widths.-c-name.size='300' widths.-c-quantity.size='300' widths.-c-note.size='2400' widths.box='3000'> |\n`));
    const name = header(page, 1).locator(".swt-head-name");
    await expect.poll(() => name.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
    // Quantity's sticky offset is Name's width as shown now
    await expect.poll(async () => Math.abs(parseFloat(await header(page, 1).evaluate((e) => (e as HTMLElement).style.left)) - (await header(page, 0).boundingBox())!.width)).toBeLessThan(1);
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
