// The toolbar on a phone (the "touch" project: a Pixel 7): text selected by touch docks it at the bottom, over the keyboard
import type { Page } from "@playwright/test";
import { bar, barButton, caret, expect, lineBox, popup, select, selected, test, text } from "./helpers.ts";

/** Text selected after a touch in the page, as a phone selects it (a long press, then its handles) */
async function selectByTouch(page: Page, needle: string): Promise<void> {
  const line = await lineBox(page, "Select some text");
  await page.touchscreen.tap(line.x + 4, line.y + line.height / 2);
  await select(page, needle);
}

test.describe("The toolbar on a phone", () => {
  test("docked at the bottom as one row across the window, the rows one after another, … at its end", async ({ page }) => {
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    const box = (await bar(page).boundingBox())!;
    const view = page.viewportSize()!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(view.width);
    // Right on the window's bottom edge: no line of the page showing under it
    expect(Math.abs(box.y + box.height - view.height)).toBeLessThan(0.5);
    await expect(bar(page).locator(".swb-row")).toHaveCount(1);
    await expect(bar(page).locator(".swb-row [data-swb-action]").first()).toHaveAttribute("data-swb-action", "actions.turnInto");
    await expect(bar(page).locator(".swb-more")).toBeVisible();
    // A tap applies to the selection
    await barButton(page, "formats.bold").tap();
    await expect.poll(() => text(page)).toContain("Select **some text** in this page");
  });

  test("shown as soon as you write, nothing selected: its buttons the formats around the cursor; it stays as you type, goes as the text is left", async ({ page }) => {
    const line = await lineBox(page, "Select some text");
    await page.touchscreen.tap(line.x + 4, line.y + line.height / 2);
    await caret(page, "bold**", 2);
    await expect(bar(page)).toHaveClass(/swb-docked/);
    await expect(barButton(page, "formats.bold")).toHaveAttribute("aria-pressed", "true");
    await caret(page, "Plain paragraph one", 3);
    await expect(barButton(page, "formats.bold")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.type("x");
    await expect.poll(() => text(page)).toContain("Plaxin paragraph one");
    await expect(bar(page)).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(bar(page)).toBeHidden();
  });

  test("Turn into opens its choices in the popup over it, its search focused (the keyboard stays, the system's menu goes); a choice turns the lines", async ({ page }) => {
    await selectByTouch(page, "First item\n- Second item");
    await barButton(page, "actions.turnInto").tap();
    await expect(popup(page)).toBeVisible();
    await expect(page.locator(".swb-menu.swb-visible")).toHaveCount(0);
    await expect(popup(page).locator(".swb-back")).toHaveText("Turn into");
    await expect(popup(page).locator(".swb-search-field")).toBeFocused();
    expect((await popup(page).boundingBox())!.y + (await popup(page).boundingBox())!.height).toBeLessThanOrEqual((await bar(page).boundingBox())!.y);
    await popup(page).locator('[data-swb-action="formats.numbered"]').tap();
    await expect.poll(() => text(page)).toContain("1. First item\n2. Second item");
  });

  test("Turn into again closes its choices, the editor its selection back", async ({ page }) => {
    await selectByTouch(page, "some text");
    await barButton(page, "actions.turnInto").tap();
    await expect(popup(page)).toBeVisible();
    await barButton(page, "actions.turnInto").tap();
    await expect(popup(page)).toBeHidden();
    await expect(page.locator(".cm-content")).toBeFocused();
    expect(await selected(page)).toBe("some text");
    await expect(bar(page)).toBeVisible();
  });

  test("Hide the keyboard: the keyboard hidden, the selection kept as it is, the toolbar staying; a tap in the text brings it back", async ({ page }) => {
    await selectByTouch(page, "some text");
    await bar(page).locator(".swb-more").tap();
    await popup(page).locator(".swb-search-field").fill("keyboard");
    await popup(page).locator('[data-swb-action="actions.hideKeyboard"]').tap();
    const policy = () => page.evaluate(() => (document.querySelector(".cm-content") as HTMLElement & { virtualKeyboardPolicy?: string }).virtualKeyboardPolicy);
    await expect.poll(policy).toBe("manual");
    await expect(page.locator(".cm-content")).toBeFocused();
    expect(await selected(page)).toBe("some text");
    // Shown selected too: the page's selection, not only the editor's own
    await expect.poll(() => page.evaluate(() => document.getSelection()?.toString())).toBe("some text");
    await expect(bar(page)).toBeVisible();
    const line = await lineBox(page, "Plain paragraph one");
    await page.touchscreen.tap(line.x + 20, line.y + line.height / 2);
    await expect.poll(policy).toBe("auto");
  });

  test("the list of every action opens over it", async ({ page }) => {
    await selectByTouch(page, "some text");
    await bar(page).locator(".swb-more").tap();
    await expect(popup(page)).toBeVisible();
    const toolbar = (await bar(page).boundingBox())!;
    const list = (await popup(page).boundingBox())!;
    expect(list.y + list.height).toBeLessThanOrEqual(toolbar.y);
    expect(list.y).toBeGreaterThanOrEqual(0);
    // What is typed finds fewer: shorter from the top, its bottom staying by the toolbar
    await page.keyboard.type("bold");
    await expect.poll(async () => (await popup(page).boundingBox())!.height).toBeLessThan(list.height);
    const found = (await popup(page).boundingBox())!;
    expect(found.height).toBeLessThan(list.height);
    expect(Math.abs(found.y + found.height - (list.y + list.height))).toBeLessThan(1);
  });

  test("over SilverBullet's keyboard bar where it shows", async ({ page }) => {
    // SilverBullet's bar over the keyboard (its main; client/components/keyboard_bar.tsx), as it is laid out at the window's bottom
    await page.evaluate(() => {
      const keyboardBar = document.createElement("div");
      keyboardBar.className = "sb-keyboard-bar";
      keyboardBar.style.cssText = "position: fixed; left: 0; right: 0; bottom: 0; height: 44px";
      document.body.append(keyboardBar);
    });
    await selectByTouch(page, "some text");
    const toolbar = (await bar(page).boundingBox())!;
    const keyboardBar = (await page.locator(".sb-keyboard-bar").boundingBox())!;
    expect(Math.abs(toolbar.y + toolbar.height - keyboardBar.y)).toBeLessThanOrEqual(1);
  });
});
