// The gestures module's button with a mouse: a click runs its first action, dragged up its second
import type { Page } from "@playwright/test";
import { addGesture, barButton, boxOf, expect, gestureButton, popup, select, selected, test, text } from "./helpers.ts";

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
    await dialog.locator('[data-swb-tab="favorites"]').click();
    await dialog.locator('[data-swb-device="click"]').click();
    const gesture = dialog.locator(".swb-settings-kind").last();
    // Its Click: its panel, its action, its own icon and label
    await gesture.locator('[data-swb-slot="tap"]').click();
    const look = dialog.locator("[data-swb-look]");
    await expect(look.locator(".swb-settings-look-action")).toHaveText("Bold");
    await look.locator('[data-swb-own="icon"]').fill("★");
    await look.locator('[data-swb-own="icon"]').press("Enter");
    await look.locator('[data-swb-own="label"]').fill("Tučně");
    await look.locator('[data-swb-own="label"]').press("Enter");
    await expect(gesture.locator('[data-swb-slot="tap"]')).toContainText("★");
    await expect(gesture.locator('[data-swb-slot="tap"]')).toContainText("Tučně");
    // Its Swipe up: a label of its own
    await gesture.locator('[data-swb-slot="up"]').click();
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
    await dialog.locator('[data-swb-tab="favorites"]').click();
    await dialog.locator('[data-swb-device="click"]').click();
    await gesture.locator('[data-swb-slot="tap"]').click();
    await look.locator(".swb-settings-look-change").click();
    await dialog.locator(".swb-settings-pick-field").fill("code");
    await page.keyboard.press("Enter");
    await expect(gesture.locator('[data-swb-slot="tap"]')).toContainText("Code");
    await expect(gesture.locator('[data-swb-slot="tap"]')).not.toContainText("★");
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
    await dialog.locator('[data-swb-tab="favorites"]').click();
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
