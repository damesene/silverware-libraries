// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the init
// page again on the module already loaded. After it the table works as before, once (a row added is one row), and a
// table's view is as it was.
import { bodyRows, cell, expect, hoverCell, markdown, reloadSpaceLua, rendersAnew, table, tableIcon, target, test } from "./helpers.ts";

test.describe("System: Reload", () => {
  test.skip(target !== "silverbullet", "System: Reload is SilverBullet's");

  test("after it the + under the last row adds one row, not one per load", async ({ page }) => {
    await expect(table(page)).toBeVisible();
    const rows = await bodyRows(page).count();
    await reloadSpaceLua(page);
    const last = bodyRows(page).last().locator("td").first();
    await last.click();
    await hoverCell(page, last);
    const box = (await last.boundingBox())!;
    await page.mouse.move(box.x - 13, box.y + box.height + 1, { steps: 4 });
    const plus = page.locator(".swt-insert.swt-visible");
    await expect(plus).toHaveCount(1);
    await rendersAnew(page, () => plus.click());
    await expect(bodyRows(page)).toHaveCount(rows + 1);
    expect(await markdown(page)).toMatch(/\| Šípek[^\n]*\n\| +\| +\| +\| +\|\n/);
  });

  test("after it a table in the sheet view is still in it, its toolbar one", async ({ page }) => {
    await expect(table(page)).toBeVisible();
    await hoverCell(page, cell(page, 1, 1));
    await (await tableIcon(page, "Sheet view")).click();
    const sheet = page.locator(".sb-table-widget.swt-drawn.swt-sheet-table:not(.swt-stand-in)");
    await expect(sheet).toHaveCount(1);
    await reloadSpaceLua(page);
    // (The table's controller is the same after it, set on the new platform: the view kept by that; its toolbar shown
    // by a pointer is what a second controller would double)
    await expect(sheet).toHaveCount(1);
    await sheet.locator("tr[data-swt-row='1'] > td").first().hover();
    await expect(page.locator(".swt-bar.swt-visible")).toHaveCount(1);
  });
});
