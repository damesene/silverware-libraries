// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// init page again, which makes a new controller in the place of the one before. After it the tags' manager opens as
// before, one window; the Tags panel, open across it, opens one window from a row and adds a tag.
import { commandDefined, expect, onSilverBullet, openManager, openPage, pageText, panelAction, panelRow, reloadSpaceLua, test } from "./helpers.ts";

test("after System: Reload the manager opens once, a tag picked in it", async ({ page }) => {
  test.skip(!onSilverBullet, "System: Reload is SilverBullet's");
  await commandDefined(page, "Silverware Tags: Manager");
  await reloadSpaceLua(page);
  const window = await openManager(page, "todo");
  await expect(page.locator(".swg-workspace")).toHaveCount(1);
  await window.locator('[data-swg-tag="milestone"] .swg-tag-row').click();
  await expect(window.locator(".swg-name-field")).toHaveValue("milestone");
});

test("the Tags panel open across System: Reload: a row's action opens one window, + adds the tag to the page", async ({ page }) => {
  test.skip(!onSilverBullet, "System: Reload and the panel are SilverBullet's");
  await openPage(page, "Recipes/Soup");
  await panelRow(page, "todo");
  // (Returned once Space Lua ran again: the panel's view defined anew by the init page; SilverBullet draws its row
  // anew or keeps it, as its load goes, so the row is not told apart, only what its action does)
  await reloadSpaceLua(page);
  await panelAction(page, await panelRow(page, "todo"), "Open in the Tags window");
  const window = page.locator(".swg-workspace");
  await expect(window.locator(".swg-name-field")).toHaveValue("todo");
  await expect(window).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(window).toHaveCount(0);
  await panelAction(page, await panelRow(page, "idea"), "Add to the page open");
  await expect.poll(() => pageText(page, "Recipes/Soup")).toBe("---\ntitle: Soup\ntags: [idea]\n---\nCarrots, onions, salt.\n");
  await expect(window).toHaveCount(0);
});
