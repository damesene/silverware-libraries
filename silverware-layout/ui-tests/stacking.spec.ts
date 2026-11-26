// What Silverware Layout lays over its grids (docs/silverware-core-work.md, step S, item 3): a cell's grip and its
// menu, the grid's handle and its menu, each on top whole (what the document has at its middle and corners, not visibility
// alone), Esc closing the top one alone.
import { expect, gridsDrawn, ON_TOP, onTopAt, test } from "./helpers.ts";

const GRID = "<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n";

test("a grid's cell grip and the grid's handle, each with its menu, on top whole; Esc closes a menu alone, the grid kept", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${GRID}\nAfter\n` }, "Page");
  await gridsDrawn(page);
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  await cell.hover();
  const grip = cell.locator(".swl-grid-cell-grip");
  await expect(grip).toBeVisible();
  expect(await onTopAt(grip, 1)).toEqual(ON_TOP);
  await grip.click();
  const menu = page.locator(".swl-popup");
  await expect(menu.locator(".swl-menu-item").first()).toBeVisible();
  expect(await onTopAt(menu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.locator("#sb-main .swl-grid:not(.swl-grid-shown)")).toHaveCount(1);
  // The grid's handle beside it and its menu: on top whole, Esc closing the menu alone
  await page.locator("#sb-main .swl-grid").first().hover();
  const handle = page.locator(".swl-handle-bar");
  await expect(handle).toBeVisible();
  expect(await onTopAt(handle, 1)).toEqual(ON_TOP);
  await handle.click();
  await expect(menu.locator(".swl-menu-item").first()).toBeVisible();
  expect(await onTopAt(menu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.locator("#sb-main .swl-grid:not(.swl-grid-shown)")).toHaveCount(1);
});
