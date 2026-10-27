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
  await barButton(page, "actions.more").click();
  await popup(page).locator(".swb-search-field").fill("settings");
  await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
  await expect(dialog(page)).toBeVisible();
}

test.describe("The settings dialog", () => {
  test("opens from the gear by the popup's search (not listed; typed, found), its tabs General, Favorites, Modules; Esc closes it unchanged", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await expect(popup(page).locator('.swb-option[data-swb-action="actions.settings"]')).toHaveCount(0);
    await popup(page).locator(".swb-search-field").fill("silverware toolbar settings");
    await expect(popup(page).locator('.swb-option[data-swb-action="actions.settings"]')).toHaveCount(1);
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator(".swb-settings-tab")).toHaveText(["General", "Favorites", "Modules"]);
    await expect(dialog(page).locator(".swb-settings-key")).toHaveValue("Ctrl-Shift-q");
    await tab(page, "favorites").click();
    await expect(rowItems(page, 0)).toHaveText(["Turn into"]);
    await expect(rowItems(page, 1)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await expect(save(page)).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("is of one height whatever its tab shows, 720px where the window has room", async ({ page }) => {
    await openSettings(page);
    const heights: number[] = [];
    for (const id of ["general", "favorites", "modules"]) {
      await tab(page, id).click();
      heights.push(Math.round((await dialog(page).boundingBox())!.height));
    }
    // (The test's window: 800px high, the dialog 720px)
    expect(heights).toEqual([720, 720, 720]);
  });

  test("an item removed and one added from the search: saved, the toolbar shows them at once and after a reload", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await item(page, 1, 0).locator(".swb-settings-remove").click();
    await expect(rowItems(page, 1)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await dialog(page).locator('[data-swb-row="1"] .swb-settings-add').click();
    await page.keyboard.type("strike");
    await page.keyboard.press("Enter");
    await expect(rowItems(page, 1)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action", "Strikethrough"]);
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
    // (Shown as its icon alone, as in the toolbar)
    const from = (await item(page, 1, 0).boundingBox())!;
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
    // Italic shown with its label: a click on it, its look's panel under the row
    await item(page, 0, 1).click();
    const look = dialog(page).locator("[data-swb-look]");
    await look.locator('[data-swb-show="label"]').click();
    await expect(look.locator('[data-swb-show="label"]')).toHaveAttribute("aria-checked", "true");
    await expect(item(page, 0, 1)).not.toHaveClass(/swb-settings-iconly/);
    await save(page).click();
    await select(page, "some text");
    const first = bar(page).locator(".swb-row").first();
    await expect(first.locator("[data-swb-action]")).toHaveCount(3);
    await expect(first.locator('[data-swb-action="formats.italic"]')).toContainText("Italic");
  });

  test("an item as it shows in the toolbar: its icon alone, or its label too, of a fixed width kept within 3 and 30 characters", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    // Bold: its icon alone, its name in its tooltip
    await expect(item(page, 1, 0)).toHaveClass(/swb-settings-iconly/);
    await expect(item(page, 1, 0)).toHaveAttribute("title", "Bold");
    // Turn into (with its label): a width of 1 typed is 3
    await item(page, 0, 0).click();
    const width = dialog(page).locator("[data-swb-look] .swb-settings-look-width");
    await width.fill("1");
    await width.press("Enter");
    await expect(width).toHaveValue("3");
    await width.fill("9");
    await width.press("Enter");
    await expect(item(page, 0, 0)).toHaveClass(/swb-settings-fixed/);
    // Esc closes the panel, not the dialog
    await width.press("Escape");
    await expect(dialog(page).locator("[data-swb-look]")).toHaveCount(0);
    await expect(dialog(page)).toBeVisible();
    await save(page).click();
    await select(page, "some text");
    const turnInto = barButton(page, "actions.turnInto");
    await expect(turnInto).toHaveClass(/swb-fixed/);
    // As wide whatever the selection's block (a paragraph, a list)
    const paragraph = (await turnInto.boundingBox())!.width;
    await select(page, "Second item");
    await expect(turnInto).toContainText("Bullet");
    expect(Math.abs((await turnInto.boundingBox())!.width - paragraph)).toBeLessThan(1);
  });

  test("an action's own icon and label: shown in the settings and the toolbar, its label its tooltip whatever it shows; put back by its reset", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await item(page, 1, 0).click();
    const look = dialog(page).locator("[data-swb-look]");
    await look.locator('[data-swb-own="icon"]').fill("★");
    await look.locator('[data-swb-own="icon"]').press("Enter");
    await look.locator('[data-swb-own="label"]').fill("Tučně");
    await look.locator('[data-swb-own="label"]').press("Enter");
    await expect(item(page, 1, 0).locator(".swb-settings-item-icon")).toHaveText("★");
    await expect(item(page, 1, 0)).toHaveAttribute("title", "Tučně");
    await expect(look.locator("[data-swb-reset]")).toHaveCount(2);
    await save(page).click();
    await select(page, "some text");
    // Shown as its icon: its own, its own label its tooltip
    const bold = barButton(page, "formats.bold");
    await expect(bold).toHaveText("★");
    await expect(bold).toHaveAttribute("title", "Tučně");
    // Its icon reset: the action's again, its label kept
    await openSettings(page);
    await tab(page, "favorites").click();
    await item(page, 1, 0).click();
    await dialog(page).locator('[data-swb-look] [data-swb-reset="icon"]').click();
    await expect(dialog(page).locator('[data-swb-look] [data-swb-own="icon"]')).toHaveValue("");
    await expect(dialog(page).locator('[data-swb-look] [data-swb-reset="icon"]')).toHaveCount(0);
    await save(page).click();
    await select(page, "some text");
    await expect(bold.locator("svg")).toHaveCount(1);
    await expect(bold).toHaveAttribute("title", "Tučně");
  });

  test("an item let go in the gap between two others goes there; while dragged it holds its place, a copy following the pointer", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    const link = (await item(page, 1, 4).boundingBox())!;
    const bold = (await item(page, 1, 0).boundingBox())!;
    const italic = (await item(page, 1, 1).boundingBox())!;
    await page.mouse.move(link.x + 4, link.y + link.height / 2);
    await page.mouse.down();
    // The gap between Bold and Italic: over neither
    await page.mouse.move((bold.x + bold.width + italic.x) / 2, bold.y + bold.height / 2, { steps: 8 });
    await expect(dialog(page).locator(".swb-settings-ghost")).toHaveCount(1);
    await expect(dialog(page).locator(".swb-settings-placeholder")).toHaveCount(1);
    await page.mouse.up();
    await expect(dialog(page).locator(".swb-settings-ghost")).toHaveCount(0);
    await expect(rowItems(page, 1)).toHaveText(["Bold", "Link", "Italic", "Code", "Separator", "Highlight", "Separator", "Every action"]);
  });

  test("a row dragged by its handle above another, and back with Alt+↓", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    const grip = (await dialog(page).locator('[data-swb-row="1"] .swb-settings-row-grip').boundingBox())!;
    const first = (await dialog(page).locator('[data-swb-row="0"]').boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, first.y + 4, { steps: 8 });
    await page.mouse.up();
    await expect(rowItems(page, 0)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await expect(rowItems(page, 1)).toHaveText(["Turn into"]);
    await expect(dialog(page).locator('[data-swb-row="0"] .swb-settings-row-grip')).toBeFocused();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(rowItems(page, 0)).toHaveText(["Turn into"]);
  });

  test("Touch: Click's shown dimmed while its own are off; on, its own to change; saved, a mouse still has Click's; Copy from either way", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await expect(dialog(page).locator('[data-swb-device="click"]')).toHaveAttribute("aria-checked", "true");
    await dialog(page).locator('[data-swb-device="touch"]').click();
    await expect(dialog(page).locator(".swb-settings-rows-same")).toBeVisible();
    await dialog(page).locator(".swb-settings-devices .swb-settings-switch").click();
    await expect(dialog(page).locator(".swb-settings-rows-same")).toHaveCount(0);
    // Touch's own: its rows after the boxes of its pinned items (none pinned yet)
    await expect(dialog(page).locator(".swb-settings-pin-box")).toHaveCount(2);
    await expect(rowItems(page, 3)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await item(page, 3, 0).locator(".swb-settings-remove").click();
    await expect(rowItems(page, 3)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    // Click's as they were; then Touch's copied over them, and back from Touch
    await dialog(page).locator('[data-swb-device="click"]').click();
    await expect(rowItems(page, 1)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    // A mouse: Click's
    await select(page, "some text");
    await expect(barButton(page, "formats.bold")).toBeVisible();
    await openSettings(page);
    await tab(page, "favorites").click();
    await dialog(page).locator(".swb-settings-copy-from").click();
    await expect(rowItems(page, 1)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await dialog(page).locator('[data-swb-device="touch"]').click();
    await expect(rowItems(page, 3)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
  });

  test("Touch: an item dragged into Pinned left is pinned there, saved so; dragged out, it is not", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await dialog(page).locator('[data-swb-device="touch"]').click();
    await dialog(page).locator(".swb-settings-devices .swb-settings-switch").click();
    const left = dialog(page).locator('[data-swb-items="0"]');
    const box = (await left.boundingBox())!;
    const bold = (await item(page, 3, 0).boundingBox())!;
    await page.mouse.move(bold.x + 4, bold.y + bold.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(rowItems(page, 0)).toHaveText(["Bold"]);
    await expect(rowItems(page, 3)).toHaveText(["Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    // Read back: pinned
    await openSettings(page);
    await tab(page, "favorites").click();
    await dialog(page).locator('[data-swb-device="touch"]').click();
    await expect(rowItems(page, 0)).toHaveText(["Bold"]);
    // Out again with the keyboard, into the first row (not into Pinned right): no longer pinned
    await item(page, 0, 0).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(rowItems(page, 0)).toHaveCount(0);
    await expect(rowItems(page, 1)).toHaveCount(0);
    await expect(rowItems(page, 2)).toHaveText(["Bold", "Turn into"]);
    // And back up into Pinned left
    await page.keyboard.press("Alt+ArrowUp");
    await expect(rowItems(page, 0)).toHaveText(["Bold"]);
  });

  test("Every action removed: the editor says it is required, and the toolbar has it pinned at its end", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await expect(dialog(page).locator(".swb-settings-warning")).toHaveCount(0);
    await item(page, 1, 7).locator(".swb-settings-remove").click();
    await expect(dialog(page).locator(".swb-settings-warning")).toContainText("is required");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await select(page, "some text");
    // Pinned: the last row's last
    await expect(bar(page).locator(".swb-row").last().locator(".swb-button").last()).toHaveClass(/swb-more/);
    await barButton(page, "actions.more").click();
    await expect(popup(page)).toBeVisible();
    // Not in the popup itself
    await expect(popup(page).locator('[data-swb-action="actions.more"]')).toHaveCount(0);
  });

  test("Reset to defaults asks first: no keeps them, yes puts the defaults back (saved, the toolbar shows them)", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await dialog(page).locator('[data-swb-row="0"] .swb-settings-row-remove').click();
    await expect(dialog(page).locator(".swb-settings-favrow")).toHaveCount(1);
    const reset = dialog(page).locator(".swb-settings-reset");
    await answerConfirm(page, false, () => reset.click());
    await expect(dialog(page).locator(".swb-settings-favrow")).toHaveCount(1);
    await answerConfirm(page, true, () => reset.click());
    // The toolbar's defaults (not the tests' favourites): four rows
    await expect(dialog(page).locator(".swb-settings-favrow")).toHaveCount(4);
    await expect(rowItems(page, 0)).toHaveText(["Turn into"]);
    await expect(rowItems(page, 1)).toHaveText(["Bold", "Italic", "Highlight", "Underline", "Strikethrough"]);
    await expect(save(page)).toBeEnabled();
  });

  test("a row removed by its ×, its items with it: saved, the toolbar has one row", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    await dialog(page).locator('[data-swb-row="0"] .swb-settings-row-remove').click();
    await expect(dialog(page).locator(".swb-settings-favrow")).toHaveCount(1);
    await expect(rowItems(page, 0)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await select(page, "some text");
    await expect(bar(page).locator(".swb-row")).toHaveCount(1);
    await expect(barButton(page, "actions.turnInto")).toHaveCount(0);
  });

  test("the search of what to add closes by its × or Close, the row as it was", async ({ page }) => {
    await openSettings(page);
    await tab(page, "favorites").click();
    const add = dialog(page).locator('[data-swb-row="0"] .swb-settings-add');
    await add.click();
    await expect(add).toHaveText("Close");
    await dialog(page).locator(".swb-settings-pick-close").click();
    await expect(dialog(page).locator(".swb-settings-picker")).toHaveCount(0);
    await expect(add).toHaveText("Add");
    await add.click();
    await add.click();
    await expect(dialog(page).locator(".swb-settings-picker")).toHaveCount(0);
    await expect(rowItems(page, 0)).toHaveText(["Turn into"]);
    await expect(dialog(page)).toBeVisible();
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
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("clear");
    await expect(popup(page).locator(".swb-option")).toHaveCount(0);
  });
});
