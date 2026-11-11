// The toolbar's settings dialog (saved in the playground's store, or in SilverBullet's CONFIG page)
import type { Locator, Page } from "@playwright/test";
import { answerConfirm, bar, barButton, caret, expect, lineBox, popup, ready, select, test, text } from "./helpers.ts";

const dialog = (page: Page): Locator => page.locator(".swb-settings");
const tab = (page: Page, id: string): Locator => dialog(page).locator(`[data-swb-tab="${id}"]`);
const item = (page: Page, row: number, index: number): Locator => dialog(page).locator(`[data-swb-item="${row}:${index}"]`);
const rowItems = (page: Page, row: number): Locator => dialog(page).locator(`[data-swb-items="${row}"] .swb-settings-item-name`);
// Touch's own: a zone of a row (pinned left, the others: middle, pinned right)
const zoneItems = (page: Page, row: number, zone: string): Locator => dialog(page).locator(`[data-swb-items="${row}"][data-swb-zone="${zone}"] .swb-settings-item-name`);
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
  test("opens from the gear by the popup's search (not listed; typed, found), its tabs General, Toolbars, Modules; Esc closes it unchanged", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await expect(popup(page).locator('.swb-option[data-swb-action="actions.settings"]')).toHaveCount(0);
    await popup(page).locator(".swb-search-field").fill("silverware toolbar settings");
    await expect(popup(page).locator('.swb-option[data-swb-action="actions.settings"]')).toHaveCount(1);
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator(".swb-settings-tab")).toHaveText(["General", "Toolbars", "Modules"]);
    await expect(dialog(page).locator(".swb-settings-key")).toHaveValue("Ctrl-Shift-q");
    await tab(page, "toolbars").click();
    await expect(rowItems(page, 0)).toHaveText(["Turn into"]);
    await expect(rowItems(page, 1)).toHaveText(["Bold", "Italic", "Code", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    await expect(save(page)).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("is of one height whatever its tab shows, 720px where the window has room", async ({ page }) => {
    await openSettings(page);
    const heights: number[] = [];
    for (const id of ["general", "toolbars", "modules"]) {
      await tab(page, id).click();
      heights.push(Math.round((await dialog(page).boundingBox())!.height));
    }
    // (The test's window: 800px high, the dialog 720px)
    expect(heights).toEqual([720, 720, 720]);
  });

  test("an item removed and one added from the search: saved, the toolbar shows them at once and after a reload", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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

  test("toolbars: a new one, named, used for Click in place of the one before; saved, a mouse shows it; deleted, the first again", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
    const lists = dialog(page).locator(".swb-settings-toolbar-tab-name");
    await expect(lists).toHaveText(["Test", "Test touch"]);
    // By the selection: no boxes of pinned items; docked, each row its own
    await expect(dialog(page).locator(".swb-settings-zones")).toHaveCount(0);
    await dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="1"]').click();
    await expect(dialog(page).locator(".swb-settings-zones")).toHaveCount(2);
    await expect(dialog(page).locator('[data-swb-zone="left"]')).toHaveCount(2);
    await dialog(page).locator(".swb-settings-toolbar-new").click();
    await expect(lists).toHaveText(["Test", "Test touch", "Toolbar"]);
    await expect(dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="2"] .swb-settings-toolbar-tab-for')).toHaveCount(0);
    const name = dialog(page).locator(".swb-settings-toolbar-name");
    await expect(name).toBeFocused();
    await name.fill("test");
    await name.press("Enter");
    await expect(dialog(page).locator(".swb-settings-toolbar-problem")).toHaveText("Another toolbar is named test");
    await name.fill("Mouse");
    await name.press("Enter");
    await expect(lists).toHaveText(["Test", "Test touch", "Mouse"]);
    // Bold alone, used for Click: Test keeps Touch
    await dialog(page).locator('[data-swb-row="0"] .swb-settings-add').click();
    await dialog(page).locator(".swb-settings-pick-field").fill("bold");
    await page.keyboard.press("Enter");
    await dialog(page).locator('.swb-settings-toolbar-use[data-swb-use="click"]').click();
    await expect(dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="2"] .swb-settings-toolbar-tab-for')).toHaveText("Click");
    await expect(dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="0"] .swb-settings-toolbar-tab-for')).toHaveCount(0);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await select(page, "some text");
    await expect(barButton(page, "formats.bold")).toBeVisible();
    await expect(barButton(page, "formats.italic")).toHaveCount(0);
    // Deleted (asked: Click then shows Test)
    await openSettings(page);
    await tab(page, "toolbars").click();
    await dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="2"]').click();
    await answerConfirm(page, true, () => dialog(page).locator(".swb-settings-toolbar-delete").click());
    await expect(lists).toHaveText(["Test", "Test touch"]);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await select(page, "some text");
    await expect(barButton(page, "formats.italic")).toBeVisible();
  });

  test("a docked toolbar: an item dragged into its row's Pinned left is pinned there, saved so; unpinned in its panel; Alt+arrows keep it in its zone", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
    await dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="1"]').click();
    // (Its second row in view: the toolbar's card above it)
    await dialog(page).locator('[data-swb-row="1"]').scrollIntoViewIfNeeded();
    const left = dialog(page).locator('[data-swb-items="1"][data-swb-zone="left"]');
    const box = (await left.boundingBox())!;
    const code = (await item(page, 1, 2).boundingBox())!;
    await page.mouse.move(code.x + 4, code.y + code.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(zoneItems(page, 1, "left")).toHaveText(["Code"]);
    await expect(zoneItems(page, 1, "middle")).toHaveText(["Bold", "Italic", "Separator", "Link", "Highlight", "Separator", "Every action"]);
    // The first row's own zones untouched
    await expect(zoneItems(page, 0, "left")).toHaveCount(0);
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    // Read back: pinned in its row
    await openSettings(page);
    await tab(page, "toolbars").click();
    await dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="1"]').click();
    await expect(zoneItems(page, 1, "left")).toHaveText(["Code"]);
    // Alt+↑ into the row above, its own Pinned left
    await item(page, 1, 0).focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(zoneItems(page, 0, "left")).toHaveText(["Code"]);
    await expect(zoneItems(page, 1, "left")).toHaveCount(0);
    // Unpinned in its panel: Pin, None
    await item(page, 0, 0).click();
    await dialog(page).locator('[data-swb-look] [data-swb-pin="none"]').click();
    await expect(zoneItems(page, 0, "left")).toHaveCount(0);
    await expect(rowItems(page, 0)).toHaveText(["Code", "Turn into"]);
  });

  test("with a mouse: an action for a touch screen only (Hide the keyboard) not in the popup nor a Click list's search, but in one a finger may show", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("hide the keyboard");
    await expect(popup(page).locator('[data-swb-action="actions.hideKeyboard"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await openSettings(page);
    await tab(page, "toolbars").click();
    // A list for Click alone: not offered
    await dialog(page).locator(".swb-settings-toolbar-new").click();
    await dialog(page).locator('.swb-settings-toolbar-use[data-swb-use="click"]').click();
    await dialog(page).locator('[data-swb-row="0"] .swb-settings-add').click();
    await dialog(page).locator(".swb-settings-pick-field").fill("hide the keyboard");
    await expect(dialog(page).locator(".swb-settings-pick")).toHaveCount(0);
    // The one for Touch: offered
    await dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="0"]').click();
    await dialog(page).locator('[data-swb-row="1"] .swb-settings-add').click();
    await dialog(page).locator(".swb-settings-pick-field").fill("hide the keyboard");
    await page.keyboard.press("Enter");
    await expect(rowItems(page, 1).last()).toHaveText("Hide the keyboard");
    // Known: not dimmed as an action no module gives
    await expect(item(page, 1, 8)).not.toHaveClass(/swb-settings-unknown/);
  });

  test("Every action removed: the editor says it is required, and the toolbar has it pinned at its end", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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
    await tab(page, "toolbars").click();
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

  test("shown while writing: on a computer by the cursor, with nothing selected, following it as you type; the text left, it goes", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
    await dialog(page).locator(".swb-settings-toolbar-show").selectOption("writing");
    await expect(save(page)).toHaveText("Save");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await caret(page, "Plain paragraph one", 3);
    await expect(bar(page)).toBeVisible();
    await expect(bar(page)).not.toHaveClass(/swb-docked/);
    await page.keyboard.type("xy");
    await expect.poll(() => text(page)).toContain("Plaxyin paragraph one");
    await expect(bar(page)).toBeVisible();
    // Esc is the editor's: it stays
    await page.keyboard.press("Escape");
    await expect(bar(page)).toBeVisible();
    // Above the line the cursor is in
    const toolbar = (await bar(page).boundingBox())!;
    const line = await lineBox(page, "Plaxyin paragraph one");
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(line.y + 1);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(bar(page)).toBeHidden();
  });

  test("shown always, docked: at once, the text left too; room kept for it at the editor's edge", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
    await dialog(page).locator(".swb-settings-toolbar-show").selectOption("always");
    await dialog(page).locator(".swb-settings-toolbar-placement").selectOption("bottom");
    await save(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(bar(page)).toBeVisible();
    await expect(bar(page)).toHaveClass(/swb-docked/);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.waitForTimeout(100);
    await expect(bar(page)).toBeVisible();
    // Its height, by which SilverBullet's editor is padded (the style page's CSS)
    const height = (await bar(page).boundingBox())!.height;
    const room = await page.evaluate(() => document.documentElement.style.getPropertyValue("--swb-docked-bottom"));
    expect(Math.abs(parseFloat(room) - height)).toBeLessThan(1);
  });

  test("shown always, docked: none while another plugin shows something over the whole window (its room given back, a selection and the key show nothing); back once it ends", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
    await dialog(page).locator(".swb-settings-toolbar-show").selectOption("always");
    await dialog(page).locator(".swb-settings-toolbar-placement").selectOption("bottom");
    await save(page).click();
    await expect(bar(page)).toBeVisible();
    // A full screen of another plugin, as any of them marks it (shared/overwindow.ts)
    await page.evaluate(() => {
      const view = document.createElement("div");
      view.id = "test-over-window";
      view.setAttribute("data-silverware-over-window", "");
      document.body.append(view);
    });
    await expect(bar(page)).toBeHidden();
    const room = await page.evaluate(() => document.documentElement.style.getPropertyValue("--swb-docked-bottom"));
    expect(parseFloat(room || "0")).toBe(0);
    await select(page, "some text");
    await page.keyboard.press("Control+Shift+Q");
    await page.waitForTimeout(200);
    await expect(bar(page)).toBeHidden();
    await expect(popup(page)).toHaveCount(0);
    // Ended (its mark taken off): the toolbar as set, at once
    await page.evaluate(() => document.getElementById("test-over-window")!.removeAttribute("data-silverware-over-window"));
    await expect(bar(page)).toBeVisible();
  });

  test("a module turned off: Save and reload, its actions gone; closing with changes asks first", async ({ page }) => {
    // (On, its action found by the word)
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("clear");
    await expect(popup(page).locator('.swb-option[data-swb-action="actions.clear"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
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
    // The module's action gone (a command of SilverBullet's may still be found by the word: Credentials: Clear)
    await expect(popup(page).locator('.swb-option[data-swb-action="actions.clear"]')).toHaveCount(0);
  });

  test("Every action removed: Add it at the end puts it back in the last row (a docked toolbar: pinned right)", async ({ page }) => {
    await openSettings(page);
    await tab(page, "toolbars").click();
    await item(page, 1, 7).locator(".swb-settings-remove").click();
    await dialog(page).locator(".swb-settings-warning-add").click();
    await expect(dialog(page).locator(".swb-settings-warning")).toHaveCount(0);
    await expect(rowItems(page, 1).last()).toHaveText("Every action");
    // Docked: pinned right
    await dialog(page).locator('.swb-settings-toolbar-tab[data-swb-toolbar="1"]').click();
    await item(page, 1, 7).locator(".swb-settings-remove").click();
    await dialog(page).locator(".swb-settings-warning-add").click();
    await expect(zoneItems(page, 1, "right")).toHaveText(["Every action"]);
  });
});
