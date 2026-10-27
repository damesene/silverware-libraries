// The snippets module's text snippet: added in the settings, its text typed there, its icon and label in its panel; a click writes its text
import { bar, barButton, expect, popup, select, selected, test, text } from "./helpers.ts";

test.describe("The text snippet", () => {
  test("added in the settings with its icon, label and text: its character shown, a click wraps the selection, which stays selected", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="favorites"]').click();
    await dialog.locator('[data-swb-row="1"] .swb-settings-add').click();
    await dialog.locator(".swb-settings-pick-field").fill("snippet");
    await page.keyboard.press("Enter");
    // Its field to type in, focused
    const item = dialog.locator(".swb-settings-kind").last();
    await expect(item.locator('[data-swb-field="text"] textarea')).toBeFocused();
    // Without its text yet: the toolbar leaves it out, said so
    await expect(item).toHaveAttribute("title", /No text yet/);
    await page.keyboard.type("%%{s}%%");
    // Its icon and label in its panel, as an action's
    await item.locator(".swb-settings-item-name").click();
    const look = dialog.locator("[data-swb-look]");
    await look.locator('[data-swb-own="icon"]').fill("📌");
    await look.locator('[data-swb-own="icon"]').press("Enter");
    await look.locator('[data-swb-own="label"]').fill("Comment");
    await look.locator('[data-swb-own="label"]').press("Enter");
    await expect(item.locator(".swb-settings-item-icon")).toHaveText("📌");
    await expect(item.locator(".swb-settings-item-name")).toHaveText("Comment");
    await dialog.locator(".swb-settings-save").click();
    await expect(dialog).toHaveCount(0);
    await select(page, "some text");
    const snippet = bar(page).locator(".swb-snippet");
    await expect(snippet).toHaveText("📌");
    await expect(snippet).toHaveAttribute("aria-label", "Comment");
    await snippet.click();
    await expect.poll(() => text(page)).toContain("Select %%some text%% in this page");
    expect(await selected(page)).toBe("some text");
  });
});
