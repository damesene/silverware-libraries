import { cell, expect, hoverCell, markdown, notification, rendersAnew, setPage, table, test } from "./helpers.ts";

const PAGE = `# Pivots

| Region | Revenue |
|---|--:|
| East | 100 |
| West | 50 |
| East | 20 |
| <meta core.table core.name='orders'> |

| Region | Sum of Revenue |
|---|--:|
| East | 0 |
| <meta core.table pivot.source='orders' pivot.rows='region' pivot.values='SUM([revenue])'> |
`;

test.describe("Pivot tables", () => {
  test.beforeEach(async ({ page }) => {
    await setPage(page, PAGE);
  });

  test("Refresh calculates a pivot, an edit of its source writes it anew, its cells are not edited by hand", async ({ page }) => {
    // Out of date as written: its Refresh asks to be used
    await hoverCell(page, cell(page, 1, 0, 1));
    const refresh = page.locator('.swt-bar.swt-visible button[aria-label="Refresh pivot"]');
    await expect(refresh).toHaveClass(/swt-attention/);
    await rendersAnew(page, () => refresh.click(), 1);
    expect(await markdown(page)).toContain("| East   |            120 |\n| West   |             50 |\n| Total  |            170 |");
    // An edit of the source: the pivot written anew with it
    await cell(page, 2, 1).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("80");
    await rendersAnew(page, () => page.keyboard.press("Enter"), 1);
    await expect(table(page, 1).locator("tr").nth(2)).toContainText("80");
    expect(await markdown(page)).toContain("| Total  |            200 |");
    // A cell of the pivot: no editor, said why
    await cell(page, 1, 1, 1).dblclick();
    await expect(page.locator(".swt-cell-editor")).toHaveCount(0);
    await expect(notification(page, /is a pivot of orders/)).toBeVisible();
  });
});
