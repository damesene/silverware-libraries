// A grid's cell edited on a phone (the "touch" project: Pixel 7), against SilverBullet: a tap in a cell, a tap back in
// the page's text, the page's editor taking the typing again.
import { boxOf, cellField, expect, gridsDrawn, runCommand, test } from "./helpers.ts";

test("a tap in a cell edits it, a tap back in the page's text leaves it and writes it, the page's editor taking the typing where tapped", async ({ page, space }) => {
  const text = "# Page\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n\nAfter\n";
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().tap();
  await expect(cellField(page)).toBeVisible();
  // Something written in the cell: the grid drawn anew as it is left (SilverBullet set its editor's selection again
  // then, the one before the tap where the page's editor had not read the tap's yet: the cursor went back)
  await page.keyboard.press("Control+End");
  await page.keyboard.type("X");
  await page.locator("#sb-main .cm-line", { hasText: "After" }).tap();
  await expect(cellField(page)).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toContain("<cell>\n\nLeft textX\n\n</cell>");
  // (Taken where the tap put the cursor: at the line's end, the line tapped past its text)
  await page.keyboard.press("End");
  await page.keyboard.type("typed");
  await expect.poll(() => space.saved("Page")).toContain("\nAftertyped\n");
});

test("a grid's cell grips shown on a phone while the grid has the focus (a tap in it), gone as a tap in the page's text takes it; a grip's tap its cell's menu, the grid's own by its Grid… (no handle beside a grid as wide as the screen)", async ({ page, space }) => {
  const text = "# Page\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n\nAfter\n";
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  // (The cell tapped into, edited: its own grip, kept while its field is open)
  const grip = page.locator("#sb-main .swl-grid-cell").first().locator(".swl-grid-cell-grip");
  await expect(grip).toHaveCSS("opacity", "0");
  await page.locator("#sb-main .swl-grid-cell").first().tap();
  await expect(cellField(page)).toBeVisible();
  await expect(grip).toHaveCSS("opacity", "1");
  await grip.tap();
  const items = page.locator(".swl-popup .swl-menu-item");
  await expect(items.first()).toHaveText("Edit markdown (Alt+click)");
  await expect(items.last()).toHaveText("Delete cell…");
  await expect(items.filter({ hasText: "Grid…" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.locator("#sb-main .cm-line", { hasText: "After" }).tap();
  await expect(cellField(page)).toHaveCount(0);
  await expect(grip).toHaveCSS("opacity", "0");
});

test("a grid's menu on a phone (by a cell's Grid…) whole in the window, its rows of choices within it (eight columns' buttons on lines of their own); a tap on a column's count sets it", async ({ page, space }) => {
  const text = "# Page\n\n<grid columns=\"auto\">\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n\nAfter\n";
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await page.locator("#sb-main .swl-grid-cell").first().tap();
  await expect(cellField(page)).toBeVisible();
  await page.locator("#sb-main .swl-grid-cell").first().locator(".swl-grid-cell-grip").tap();
  await page.locator(".swl-popup .swl-menu-item", { hasText: "Grid…" }).tap();
  const menu = page.locator(".swl-popup");
  await expect(menu.locator(".swl-menu-segmented", { hasText: "Min width" })).toBeVisible();
  const outside = await menu.evaluate((popup) => {
    const box = popup.getBoundingClientRect();
    const out: string[] = [];
    if (box.left < 0 || box.right > window.innerWidth) out.push(`the menu ${box.left}..${box.right} of ${window.innerWidth}`);
    for (const button of popup.querySelectorAll(".swl-segment")) {
      const one = button.getBoundingClientRect();
      if (one.left < box.left || one.right > box.right) out.push(`${button.textContent} ${one.left}..${one.right}`);
    }
    return out;
  });
  expect(outside).toEqual([]);
  await menu.locator(".swl-menu-segmented", { hasText: "Columns" }).locator(".swl-segment", { hasText: /^3$/ }).tap();
  await expect.poll(() => space.saved("Page")).toContain('<grid columns="3">');
});

test("Move to grid on a phone: a tap shows where (cells one under another: a line across), a second tap on it moves the text there", async ({ page, space }) => {
  const text = "# Page\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n\nAfter\n";
  await space.open({ Page: text }, "Page");
  await gridsDrawn(page);
  await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const at = view.state.doc.toString().indexOf("After");
    view.dispatch({ selection: { anchor: at, head: at + 5 } });
  });
  void runCommand(page, "Silverware Layout: Move to grid");
  await expect(page.locator(".swl-pick-bar")).toContainText("Tap again to confirm");
  const second = await boxOf(page.locator("#sb-main .swl-grid-cell").nth(1));
  await page.touchscreen.tap(second.x + second.width / 2, second.y + 4);
  await expect(page.locator(".swl-pick-mark")).toHaveAttribute("data-swl-pick", "between-rows");
  await expect(page.locator(".swl-pick-label")).toHaveText("New cell");
  expect(await space.saved("Page")).toBe(text);
  await page.touchscreen.tap(second.x + second.width / 2, second.y + 4);
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nAfter\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n");
  await expect(cellField(page)).toHaveCount(0);
});
