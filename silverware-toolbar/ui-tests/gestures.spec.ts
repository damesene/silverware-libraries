// The gestures module's button with a mouse: a click runs its first action, dragged up its second
import type { Page } from "@playwright/test";
import { addGesture, bar, barButton, boxOf, expect, gestureButton, popup, select, selected, test, text } from "./helpers.ts";

/** The gesture button dragged from its middle up by `dy` px (negative: down), in steps, then let go where `back` says */
async function dragUp(page: Page, dy: number, back = 0): Promise<void> {
  const box = (await boxOf(gestureButton(page)));
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - dy, { steps: 8 });
  if (back) await page.mouse.move(x, y - dy + back, { steps: 8 });
  await page.mouse.up();
}

test.describe("The gesture button", () => {
  test("added in the settings: two actions in one, the second's icon small in its top right corner; a click runs the first", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    // The second's icon small, in the top right corner
    const box = (await boxOf(gestureButton(page)));
    const hint = (await gestureButton(page).locator(".swb-gesture-hint svg").boundingBox())!;
    const icon = (await gestureButton(page).locator(".swb-gesture-tap svg").boundingBox())!;
    expect(box.x + box.width - (hint.x + hint.width)).toBeLessThan(4);
    expect(hint.y - box.y).toBeLessThan(4);
    expect(hint.width).toBeLessThan(icon.width / 2);
    await expect(gestureButton(page)).toHaveAttribute("aria-label", "Bold (swipe up: Italic)");
    await gestureButton(page).click();
    await expect.poll(() => text(page)).toContain("Select **some text** in this page");
    expect(await selected(page)).toBe("some text");
    // Its state is the first's
    await expect(gestureButton(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("each of its actions with an icon and label of its own: set in its slot's panel, shown on its faces and in its name; another action picked drops them", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="toolbars"]').click();
    // Shown as the toolbar shows it: its Click's icon, its swipe's small in a corner; its slots in its panel
    const gesture = dialog.locator(".swb-settings-kind").last();
    await expect(gesture.locator(".swb-settings-item-hint-1 svg")).toHaveCount(1);
    await expect(gesture).toHaveAttribute("title", "Gesture button (Click: Bold, Swipe up: Italic)");
    const look = dialog.locator("[data-swb-look]");
    const slot = (key: string) => look.locator(`[data-swb-slot="${key}"]`);
    await gesture.click();
    // Its Click: its panel, its action, its own icon and label
    await slot("tap").click();
    await expect(look.locator(".swb-settings-look-action")).toHaveText("Bold");
    await look.locator('[data-swb-own="icon"]').fill("★");
    await look.locator('[data-swb-own="icon"]').press("Enter");
    await look.locator('[data-swb-own="label"]').fill("Tučně");
    await look.locator('[data-swb-own="label"]').press("Enter");
    // Closed: back to the item's panel, its slot showing them
    await look.locator(".swb-settings-look-close").click();
    await expect(slot("tap")).toContainText("★");
    await expect(slot("tap")).toContainText("Tučně");
    await expect(gesture.locator(".swb-settings-item-icon")).toHaveText("★");
    // Its Swipe up: a label of its own
    await slot("up").click();
    await look.locator('[data-swb-own="label"]').fill("Kurzíva");
    await look.locator('[data-swb-own="label"]').press("Enter");
    await dialog.locator(".swb-settings-save").click();
    await select(page, "some text");
    await expect(gestureButton(page).locator(".swb-gesture-tap")).toContainText("★");
    await expect(gestureButton(page)).toHaveAttribute("aria-label", "Tučně (swipe up: Kurzíva)");
    // Another action for Click, through Change…: its own icon and label gone
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    await dialog.locator('[data-swb-tab="toolbars"]').click();
    await gesture.click();
    await slot("tap").click();
    await look.locator(".swb-settings-look-change").click();
    await dialog.locator(".swb-settings-pick-field").fill("code");
    await page.keyboard.press("Enter");
    await expect(look.locator(".swb-settings-look-action")).toHaveText("Code");
    await expect(look.locator('[data-swb-own="icon"]')).toHaveValue("");
  });

  test("a text snippet on a swipe: picked for the slot in the settings, its text and icon typed in its panel; the swipe writes it", async ({ page }) => {
    await addGesture(page, "bold", undefined);
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="toolbars"]').click();
    const gesture = dialog.locator(".swb-settings-kind").last();
    const look = dialog.locator("[data-swb-look]");
    const slot = (key: string) => look.locator(`[data-swb-slot="${key}"]`);
    await gesture.click();
    await slot("up").click();
    await look.locator(".swb-settings-look-change").click();
    // Offered beside the actions
    await dialog.locator(".swb-settings-pick-field").fill("snippet");
    await page.keyboard.press("Enter");
    // Its panel: its text to type in, focused
    await expect(look.locator(".swb-settings-look-action")).toHaveText("Text snippet");
    await expect(look.locator('[data-swb-field="text"] textarea')).toBeFocused();
    await page.keyboard.type("%%{s}%%");
    // Picked again: kept, its text too
    await look.locator(".swb-settings-look-change").click();
    await dialog.locator(".swb-settings-pick-field").fill("snippet");
    await page.keyboard.press("Enter");
    await expect(look.locator('[data-swb-field="text"] textarea')).toHaveValue("%%{s}%%");
    await look.locator('[data-swb-own="icon"]').fill("💬");
    await look.locator('[data-swb-own="icon"]').press("Enter");
    await look.locator('[data-swb-own="label"]').fill("Comment");
    await look.locator('[data-swb-own="label"]').press("Enter");
    // Back in the item's panel: the slot shows it, nothing wrong with it; the item its 💬 in a corner
    await look.locator(".swb-settings-look-close").click();
    await expect(slot("up")).toContainText("💬");
    await expect(slot("up")).toContainText("Comment");
    await expect(slot("up")).not.toHaveClass(/swb-settings-unknown/);
    await expect(gesture.locator(".swb-settings-item-hint-1")).toHaveText("💬");
    await dialog.locator(".swb-settings-save").click();
    await expect(dialog).toHaveCount(0);
    await select(page, "some text");
    await expect(gestureButton(page)).toHaveAttribute("aria-label", "Bold (swipe up: Comment)");
    await expect(gestureButton(page).locator(".swb-hint-up")).toContainText("💬");
    await dragUp(page, (await boxOf(gestureButton(page))).height);
    await expect.poll(() => text(page)).toContain("Select %%some text%% in this page");
    expect(await selected(page)).toBe("some text");
  });

  test("Toolbar on a swipe: picked for the slot, its slot's panel open at its parameter; the swipe switches to that toolbar at once", async ({ page }) => {
    await addGesture(page, "bold", undefined);
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="toolbars"]').click();
    const gesture = dialog.locator(".swb-settings-kind").last();
    const look = dialog.locator("[data-swb-look]");
    const slot = look.locator('[data-swb-slot="up"]');
    await gesture.click();
    await slot.click();
    await look.locator(".swb-settings-look-change").click();
    // Toolbar alone, its toolbars not offered apart
    await dialog.locator(".swb-settings-pick-field").fill("test touch");
    await expect(dialog.locator(".swb-settings-pick", { hasText: "Test touch" })).toHaveCount(0);
    await dialog.locator(".swb-settings-pick-field").fill("toolbar");
    await dialog.locator(".swb-settings-pick").filter({ has: page.locator(".swb-settings-pick-label", { hasText: /^Toolbar$/ }) }).click();
    // The slot's panel, at the switch's parameter, focused: none given yet
    await expect(look.locator(".swb-settings-look-action")).toHaveText("Toolbar");
    const param = look.locator('[data-swb-param="toolbar"] select');
    await expect(param).toBeFocused();
    await expect(param).toHaveValue("");
    await param.selectOption("Test touch");
    // Back in the item's panel: the slot named by its toolbar
    await look.locator(".swb-settings-look-close").click();
    await expect(slot).toContainText("Test touch");
    await dialog.locator(".swb-settings-save").click();
    await expect(dialog).toHaveCount(0);
    await select(page, "some text");
    await expect(gestureButton(page)).toHaveAttribute("aria-label", "Bold (swipe up: Test touch)");
    await expect(bar(page)).not.toHaveClass(/swb-docked/);
    await dragUp(page, (await boxOf(gestureButton(page))).height);
    // No list: Test touch's, docked at the bottom, at once
    await expect(page.locator(".swb-menu.swb-visible")).toHaveCount(0);
    await expect(bar(page)).toHaveClass(/swb-docked/);
  });

  test("dragged up past half its height: its second face rolls in, lit, and let go runs the second action", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    const box = (await boxOf(gestureButton(page)));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - box.height * 0.3, { steps: 4 });
    await expect(gestureButton(page)).not.toHaveClass(/swb-armed/);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - box.height * 0.8, { steps: 4 });
    await expect(gestureButton(page)).toHaveClass(/swb-armed/);
    // The second face in the button's place, the first gone up
    const face = (await gestureButton(page).locator(".swb-gesture-up").boundingBox())!;
    expect(Math.abs(face.y - box.y - box.height * 0.2)).toBeLessThan(3);
    await page.mouse.up();
    await expect.poll(() => text(page)).toContain("Select _some text_ in this page");
    expect(await selected(page)).toBe("some text");
    // Width kept as it rolls
    expect(Math.round((await boxOf(gestureButton(page))).width)).toBe(Math.round(box.width));
  });

  test("its swipe's icon on where the second action is on: on italic text a swipe takes italic off", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    const hint = gestureButton(page).locator(".swb-gesture-hint");
    await expect(hint).not.toHaveClass(/swb-on/);
    await select(page, "italic");
    await expect(hint).toHaveClass(/swb-on/);
    await expect(gestureButton(page)).toHaveAttribute("aria-pressed", "false");
    await dragUp(page, (await boxOf(gestureButton(page))).height);
    await expect.poll(() => text(page)).toContain("**bold**, italic, ~~struck~~");
  });

  test("a swipe down too: its icon in the bottom right corner, dragged down past half runs it; a swipe left out in the settings is None", async ({ page }) => {
    await addGesture(page, "bold", undefined, "italic");
    await expect(gestureButton(page).locator(".swb-hint-up")).toHaveCount(0);
    const box = (await boxOf(gestureButton(page)));
    const hint = (await gestureButton(page).locator(".swb-hint-down svg").boundingBox())!;
    expect(box.x + box.width - (hint.x + hint.width)).toBeLessThan(4);
    expect(box.y + box.height - (hint.y + hint.height)).toBeLessThan(4);
    await expect(page.locator('.swb-settings')).toHaveCount(0);
    await dragUp(page, -(await boxOf(gestureButton(page))).height);
    await expect.poll(() => text(page)).toContain("Select _some text_ in this page");
    // Up does nothing here
    const before = await text(page);
    await select(page, "some text");
    await dragUp(page, (await boxOf(gestureButton(page))).height);
    await page.waitForTimeout(300);
    expect(await text(page)).toBe(before);
  });

  test("Every action on a swipe counts as the toolbar's: none pinned, the swipe opens the popup", async ({ page }) => {
    await addGesture(page, "bold", "every action");
    // The default's … taken off: the swipe is the only one
    await barButton(page, "actions.more").click();
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').click();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="toolbars"]').click();
    await dialog.locator('[data-swb-item="1:7"] .swb-settings-remove').click();
    await expect(dialog.locator(".swb-settings-warning")).toHaveCount(0);
    await dialog.locator(".swb-settings-save").click();
    await select(page, "some text");
    await expect(barButton(page, "actions.more")).toHaveCount(0);
    await dragUp(page, (await boxOf(gestureButton(page))).height);
    await expect(popup(page)).toBeVisible();
  });

  test("dragged up and back down, or not far enough, runs nothing and rolls back", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    const before = await text(page);
    const height = (await boxOf(gestureButton(page))).height;
    await dragUp(page, height * 0.8, height * 0.7);
    await dragUp(page, height * 0.3);
    await page.waitForTimeout(300);
    expect(await text(page)).toBe(before);
    await expect(gestureButton(page)).not.toHaveClass(/swb-armed/);
    await expect.poll(() => gestureButton(page).evaluate((b) => (b as HTMLElement).style.getPropertyValue("--swb-roll"))).toBe("0");
  });
});
