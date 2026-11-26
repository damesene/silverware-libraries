// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// init page again, which makes a new controller in the place of the one before. After it the tags' manager opens as
// before, one window.
import { commandDefined, expect, onSilverBullet, openManager, reloadSpaceLua, test } from "./helpers.ts";

test("after System: Reload the manager opens once, a tag picked in it", async ({ page }) => {
  test.skip(!onSilverBullet, "System: Reload is SilverBullet's");
  await commandDefined(page, "Silverware Tags: Manager");
  await reloadSpaceLua(page);
  const window = await openManager(page, "todo");
  await expect(page.locator(".swg-workspace")).toHaveCount(1);
  await window.locator('[data-swg-tag="milestone"] .swg-tag-row').click();
  await expect(window.locator(".swg-name-field")).toHaveValue("milestone");
});
