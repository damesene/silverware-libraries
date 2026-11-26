// What Silverware Table lays over its tables (docs/silverware-core-work.md, step S, item 3): its toolbar, its menu, the
// + inserting a row, a dialog opened from the menu, a table over the whole window, each on top whole (what the document has at its middle and
// corners, not visibility alone), Esc closing the top one alone.
import { bodyRows, boxOf, cell, expect, hoverCell, menu, ON_TOP, onTopAt, table, tableIcon, test } from "./helpers.ts";

test.describe("What a table lays over itself", () => {
  test("its toolbar and its menu on top whole; Esc closes the menu alone", async ({ page }) => {
    await expect(table(page)).toBeVisible();
    await hoverCell(page, cell(page, 1, 1));
    const bar = page.locator(".swt-bar.swt-visible");
    await expect(bar).toBeVisible();
    expect(await onTopAt(bar)).toEqual(ON_TOP);
    await bar.locator(".swt-bar-more").click();
    await expect(menu(page)).toBeVisible();
    expect(await onTopAt(menu(page))).toEqual(ON_TOP);
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await expect(table(page)).toBeVisible();
  });

  test("the + under the last row on top whole", async ({ page }) => {
    const last = bodyRows(page).last().locator("td").first();
    await last.click();
    await hoverCell(page, last);
    const box = await boxOf(last);
    await page.mouse.move(box.x - 13, box.y + box.height + 1, { steps: 4 });
    const plus = page.locator(".swt-insert.swt-visible");
    await expect(plus).toHaveCount(1);
    // (Round: its corners read past its rounding)
    expect(await onTopAt(plus)).toEqual(ON_TOP);
  });

  test("a dialog from its menu on top whole; Esc closes it alone, the table kept", async ({ page }) => {
    await hoverCell(page, cell(page, 1, 1));
    await (await tableIcon(page, "Insert pivot table…")).click();
    const dialog = page.locator(".swt-pivot-dialog");
    await expect(dialog).toBeVisible();
    expect(await onTopAt(dialog)).toEqual(ON_TOP);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(table(page)).toBeVisible();
  });

  test("over the whole window: the table on top whole, its toolbar and menu over it; Esc closes the menu alone, then the full screen", async ({ page }) => {
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Full screen")).click();
    await expect(table(page)).toHaveClass(/swt-over-window/);
    expect(await onTopAt(table(page))).toEqual(ON_TOP);
    await hoverCell(page, cell(page, 1, 1));
    const bar = page.locator(".swt-bar.swt-visible");
    await expect(bar).toBeVisible();
    expect(await onTopAt(bar)).toEqual(ON_TOP);
    await bar.locator(".swt-bar-more").click();
    await expect(menu(page)).toBeVisible();
    expect(await onTopAt(menu(page))).toEqual(ON_TOP);
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    // (Still over the window: the menu's Esc its own)
    await expect(table(page)).toHaveClass(/swt-over-window/);
    await page.keyboard.press("Escape");
    await expect(table(page)).not.toHaveClass(/swt-over-window/);
  });
});
