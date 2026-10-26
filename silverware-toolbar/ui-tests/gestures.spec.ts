// The gestures module's button with a mouse: a click runs its first action, dragged up its second
import type { Page } from "@playwright/test";
import { addGesture, expect, gestureButton, selected, test, text } from "./helpers.ts";

/** The gesture button dragged from its middle up by `dy` px (negative: down), in steps, then let go where `back` says */
async function dragUp(page: Page, dy: number, back = 0): Promise<void> {
  const box = (await gestureButton(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - dy, { steps: 8 });
  if (back) await page.mouse.move(x, y - dy + back, { steps: 8 });
  await page.mouse.up();
}

test.describe("The gesture button", () => {
  test("added in the settings: two actions in one, the second's icon small above the first's; a click runs the first", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    // The second's icon small, centred above the first's
    const hint = (await gestureButton(page).locator(".swb-gesture-hint svg").boundingBox())!;
    const icon = (await gestureButton(page).locator(".swb-gesture-tap svg").boundingBox())!;
    expect(Math.abs(hint.x + hint.width / 2 - (icon.x + icon.width / 2))).toBeLessThan(1);
    expect(hint.y + hint.height).toBeLessThanOrEqual(icon.y + 1);
    expect(hint.width).toBeLessThan(icon.width / 2);
    await expect(gestureButton(page)).toHaveAttribute("aria-label", "Bold (swipe up: Italic)");
    await gestureButton(page).click();
    await expect.poll(() => text(page)).toContain("Select **some text** in this page");
    expect(await selected(page)).toBe("some text");
    // Its state is the first's
    await expect(gestureButton(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("dragged up past half its height: its second face rolls in, lit, and let go runs the second action", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    const box = (await gestureButton(page).boundingBox())!;
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
    expect(Math.round((await gestureButton(page).boundingBox())!.width)).toBe(Math.round(box.width));
  });

  test("dragged up and back down, or not far enough, runs nothing and rolls back", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    const before = await text(page);
    const height = (await gestureButton(page).boundingBox())!.height;
    await dragUp(page, height * 0.8, height * 0.7);
    await dragUp(page, height * 0.3);
    await page.waitForTimeout(300);
    expect(await text(page)).toBe(before);
    await expect(gestureButton(page)).not.toHaveClass(/swb-armed/);
    await expect.poll(() => gestureButton(page).evaluate((b) => (b as HTMLElement).style.getPropertyValue("--swb-roll"))).toBe("0");
  });
});
