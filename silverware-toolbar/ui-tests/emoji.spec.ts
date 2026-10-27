// The emoji module's picker: opened from the list of every action, its emoji loaded from the file beside the bundle
import { bar, barButton, expect, popup, select, test, text } from "./helpers.ts";

test.describe("The emoji picker", () => {
  test("opened from the list of every action: typed, found by its name; Enter writes it over the selection, the picker gone", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    // Not the emoji themselves in the list: the picker
    await popup(page).locator(".swb-search-field").fill("thumbs");
    await expect(popup(page).locator(".swb-option")).toHaveCount(0);
    await popup(page).locator(".swb-search-field").fill("emoji");
    await page.keyboard.press("Enter");
    const panel = page.locator(".swb-panel.swb-visible");
    await expect(panel.locator(".swb-emoji").first()).toBeVisible();
    await expect(panel.locator(".swb-search-field")).toBeFocused();
    // Under the toolbar, which stays
    await expect(bar(page)).toBeVisible();
    await page.keyboard.type("thumb");
    await expect(panel.locator(".swb-emoji").first()).toHaveText("👍");
    await expect(panel.locator(".swb-emoji-name")).toHaveText("thumbs up");
    await page.keyboard.press("Enter");
    await expect(panel).toHaveCount(0);
    await expect.poll(() => text(page)).toContain("Select 👍 in this page");
  });

  test("… while it is open: the popup in its place, the picker gone", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("emoji");
    await page.keyboard.press("Enter");
    const panel = page.locator(".swb-panel.swb-visible");
    await expect(panel.locator(".swb-emoji").first()).toBeVisible();
    await barButton(page, "actions.more").click();
    await expect(popup(page)).toBeVisible();
    await expect(panel).toHaveCount(0);
    await expect(popup(page).locator(".swb-search-field")).toBeFocused();
  });

  test("its groups over the search filter it: one group's emoji alone, All again every group", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("emoji");
    await page.keyboard.press("Enter");
    const panel = page.locator(".swb-panel.swb-visible");
    const tabs = panel.locator(".swb-emoji-tab");
    await expect(tabs.first()).toHaveText("All");
    await expect(tabs.first()).toHaveAttribute("aria-checked", "true");
    // Over the search
    expect((await tabs.first().boundingBox())!.y).toBeLessThan((await panel.locator(".swb-search-field").boundingBox())!.y);
    await panel.locator('.swb-emoji-tab[aria-label="Food & drink"]').click();
    await expect(panel.locator(".swb-group")).toHaveText(["Food & drink"]);
    await expect(panel.locator(".swb-search-field")).toBeFocused();
    await tabs.first().click();
    await expect(panel.locator(".swb-group")).toHaveCount(9);
  });

  test("Esc closes it, nothing written", async ({ page }) => {
    await select(page, "some text");
    const before = await text(page);
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("emoji");
    await page.keyboard.press("Enter");
    const panel = page.locator(".swb-panel.swb-visible");
    await expect(panel.locator(".swb-emoji").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(bar(page)).toBeVisible();
    expect(await text(page)).toBe(before);
  });
});
