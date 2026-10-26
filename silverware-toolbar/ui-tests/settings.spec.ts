// The toolbar's settings dialog (saved in the playground's store, or in SilverBullet's CONFIG page)
import type { Locator, Page } from "@playwright/test";
import { answerConfirm, bar, barButton, caret, expect, lineBox, popup, ready, select, test, text } from "./helpers.ts";

const dialog = (page: Page): Locator => page.locator(".swb-settings");
const tab = (page: Page, id: string): Locator => dialog(page).locator(`[data-swb-tab="${id}"]`);
const item = (page: Page, row: number, index: number): Locator => dialog(page).locator(`[data-swb-item="${row}:${index}"]`);
const rowItems = (page: Page, row: number): Locator => dialog(page).locator(`[data-swb-items="${row}"] .swb-settings-item-name`);
const save = (page: Page): Locator => dialog(page).locator(".swb-settings-save");

/** The settings opened as a user would: the popup of every action, its last item */
async function openSettings(page: Page): Promise<void> {
  await select(page, "some text");
  await bar(page).locator(".swb-more").click();
  await popup(page).locator(".swb-search-field").fill("settings");
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
}

test.describe("The settings dialog", () => {
  test("opens from the popup's last item, its tabs General, Favorites, Modules; Esc closes it unchanged", async ({ page }) => {
    await select(page, "some text");
    await bar(page).locator(".swb-more").click();
    await expect(popup(page).locator(".swb-option").last()).toHaveText("Silverware Toolbar settings…");
    await popup(page).locator(".swb-option").last().click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator(".swb-settings-tab")).toHaveText(["General", "Favorites", "Modules"]);
    await expect(dialog(page).locator(".swb-settings-key")).toHaveValue("Ctrl-Shift-q");
    await tab(page, "favorites").click();
    await expect(rowItems(page, 0)).toHaveText(["Turn into"]);
    await expect(rowItems(page, 1)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight"]);
    await expect(save(page)).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("an item removed and one added from the search: saved, the toolbar shows them at once and after a reload", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await item(page, 1, 0).locator(".swb-settings-remove").click();
    await expect(rowItems(page, 1)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight"]);
    await dialog(page).locator('[data-swb-row="1"] .swb-settings-add').click();
    await page.keyboard.type("strike");
    await page.keyboard.press("Enter");
    await expect(rowItems(page, 1)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Strikethrough"]);
    await expect(save(page)).toHaveText("Save");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await select(page, "some text");
    await expect(barButton(page, "formats.strikethrough")).toBeVisible();
    await expect(barButton(page, "formats.bold")).toHaveCount(0);
    await page.reload();
    await ready(page);
    await select(page, "some text");
    await expect(barButton(page, "formats.strikethrough")).toBeVisible();
    await expect(barButton(page, "formats.bold")).toHaveCount(0);
  });

  test("items moved by dragging into another row and with Alt+arrows; an action shown with its label", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    // Bold dragged after Turn into, in the row above
    const target = (await item(page, 0, 0).boundingBox())!;
    const from = (await item(page, 1, 0).locator(".swb-settings-item-name").boundingBox())!;
    await page.mouse.move(from.x + 4, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width - 4, target.y + target.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(rowItems(page, 0)).toHaveText(["Turn into", "Bold"]);
    await expect(item(page, 0, 1)).toBeFocused();
    // Italic (now first of the lower row) up into the row above, then left of Bold
    await item(page, 1, 0).focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(rowItems(page, 0)).toHaveText(["Italic", "Turn into", "Bold"]);
    await page.keyboard.press("Alt+ArrowRight");
    await expect(rowItems(page, 0)).toHaveText(["Turn into", "Italic", "Bold"]);
    // Italic shown with its label
    await item(page, 0, 1).locator(".swb-settings-show").click();
    await expect(item(page, 0, 1).locator(".swb-settings-show")).toHaveAttribute("aria-pressed", "true");
    await save(page).click();
    await select(page, "some text");
    const first = bar(page).locator(".swb-row").first();
    await expect(first.locator("[data-swb-action]")).toHaveCount(3);
    await expect(first.locator('[data-swb-action="formats.italic"]')).toContainText("Italic");
  });

  test("shown always: on a computer by the cursor, with nothing selected, following it as you type", async ({ page }) => {
    await openSettings(page);
    await dialog(page).locator(`[data-swb-setting="silverware.toolbar.show"] select`).selectOption("always");
    await expect(save(page)).toHaveText("Save");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await caret(page, "Plain paragraph one", 3);
    await expect(bar(page)).toBeVisible();
    await expect(bar(page)).not.toHaveClass(/swb-docked/);
    await page.keyboard.type("xy");
    await expect.poll(() => text(page)).toContain("Plaxyin paragraph one");
    await expect(bar(page)).toBeVisible();
    // Above the line the cursor is in
    const toolbar = (await bar(page).boundingBox())!;
    const line = await lineBox(page, "Plaxyin paragraph one");
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(line.y + 1);
  });

  test("a module turned off: Save and reload, its actions gone; closing with changes asks first", async ({ page }) => {
    await openSettings(page);
    await tab(page, "modules").click();
    await dialog(page).locator('[data-swb-module="clear"]').uncheck({ force: true });
    await expect(save(page)).toHaveText("Save and reload");
    // Esc with a change: asked, and kept on No
    await answerConfirm(page, false, () => page.keyboard.press("Escape"));
    await expect(dialog(page)).toBeVisible();
    await save(page).click();
    await page.waitForEvent("load");
    await ready(page);
    await select(page, "some text");
    await bar(page).locator(".swb-more").click();
    await popup(page).locator(".swb-search-field").fill("clear");
    await expect(popup(page).locator(".swb-option")).toHaveCount(0);
  });
});
