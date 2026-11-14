// A grid's cell edited on a phone (the "touch" project: Pixel 7), against SilverBullet: a tap in a cell, a tap back in
// the page's text, the page's editor taking the typing again.
import { cellField, expect, gridsDrawn, test } from "./helpers.ts";

test("a tap in a cell edits it, a tap back in the page's text leaves it and writes it, the page's editor taking the typing where tapped", async ({ page, space }) => {
  const text = "# Page\n\n<grid>\n<column>\n\nLeft text\n\n</column>\n<column>\n\nRight text\n\n</column>\n</grid>\n\nAfter\n";
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
  await expect.poll(() => space.saved("Page")).toContain("<column>\n\nLeft textX\n\n</column>");
  // (Taken where the tap put the cursor: at the line's end, the line tapped past its text)
  await page.keyboard.press("End");
  await page.keyboard.type("typed");
  await expect.poll(() => space.saved("Page")).toContain("\nAftertyped\n");
});
