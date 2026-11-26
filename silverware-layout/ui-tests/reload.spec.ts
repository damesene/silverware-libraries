// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the init
// page again on the module already loaded. After it a grid's cell is edited as before, by one editor, a key typed written once.
import { cellField, expect, fieldState, gridsDrawn, onSilverBullet, reloadSpaceLua, test } from "./helpers.ts";

const GRID = "# Grid\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n";

test("after System: Reload a cell is edited by one editor, a key typed written once", async ({ page, space }) => {
  test.skip(!onSilverBullet, "System: Reload is SilverBullet's");
  await space.open({ Page: GRID }, "Page");
  await gridsDrawn(page);
  await reloadSpaceLua(page);
  await page.locator("#sb-main .swl-grid-cell").first().click();
  await expect(cellField(page)).toHaveCount(1);
  await expect.poll(async () => (await fieldState(page)).focused).toBe(true);
  await page.keyboard.press("Control+End");
  await page.keyboard.type("X");
  await expect.poll(async () => (await fieldState(page)).text).toBe("Left textX");
});
