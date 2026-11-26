// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// init page again on the module already loaded (and Silverware Assets' defines its toolbar actions anew). After it
// the toolbar works as before, once: one bar, an action done once, another plugin's action there with no notice of it
// defined again, the settings as they were.
import { bar, barButton, expect, onSilverBullet, popup, reloadSpaceLua, select, test, text } from "./helpers.ts";

test("after System: Reload one toolbar shows, its action done once, another plugin's action offered once, its favourites kept", async ({ page }) => {
  test.skip(!onSilverBullet, "System: Reload is SilverBullet's");
  await select(page, "some text");
  await expect(bar(page)).toBeVisible();
  const actions = () => bar(page).locator("[data-swb-action]").evaluateAll((all) => all.map((one) => (one as HTMLElement).dataset.swbAction));
  const before = await actions();
  await reloadSpaceLua(page);
  // Silverware Assets' actions defined anew, not again: kept by name, a second definition would show only as the
  // toolbar's notice (its definitions not reset before a load)
  await expect(page.locator(".sb-notifications")).not.toContainText("defined again");
  await select(page, "some text");
  await expect(bar(page)).toHaveCount(1);
  await expect.poll(actions).toEqual(before);
  // Bold once: a listener twice would make it bold and take it off again
  await barButton(page, "formats.bold").click();
  await expect.poll(() => text(page)).toContain("Select **some text** in this page");
  // The popup of every action: one; Silverware Assets' Upload file in it, once
  await barButton(page, "actions.more").click();
  await expect(popup(page)).toHaveCount(1);
  await popup(page).locator(".swb-search-field").fill("upload file");
  await expect(popup(page).locator('[data-swb-action="actions.assetsUploadFile"]')).toHaveCount(1);
});
