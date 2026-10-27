// The toolbar on a phone (the "touch" project: a Pixel 7): text selected by touch docks it at the bottom, over the keyboard
import type { Page } from "@playwright/test";
import { addGesture, bar, barButton, caret, expect, gestureButton, lineBox, popup, ready, select, selected, test, text } from "./helpers.ts";

/** A finger moved from one point to another and lifted, as Chrome gets it (Playwright's touchscreen only taps) */
async function swipe(page: Page, x: number, y: number, toX: number, toY: number, steps = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + ((toX - x) * i) / steps, y: y + ((toY - y) * i) / steps }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Text selected after a touch in the page, as a phone selects it (a long press, then its handles) */
async function selectByTouch(page: Page, needle: string): Promise<void> {
  const line = await lineBox(page, "in this page");
  await page.touchscreen.tap(line.x + 4, line.y + line.height / 2);
  await select(page, needle);
}

test.describe("The toolbar's defaults on a phone", () => {
  test.use({ favorites: null });

  test("Touch's own: gesture buttons, the kin of each action on its swipes", async ({ page }) => {
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    const gestures = bar(page).locator(".swb-gesture");
    const of = (i: number) => gestures.nth(i).evaluate((b) => [(b as HTMLElement).dataset.swbGesture, (b as HTMLElement).dataset.swbUp ?? "", (b as HTMLElement).dataset.swbDown ?? ""]);
    await expect(gestures).toHaveCount(5);
    expect(await of(0)).toEqual(["formats.bold", "formats.italic", "formats.highlight"]);
    expect(await of(1)).toEqual(["formats.strikethrough", "", "formats.underline"]);
    expect(await of(2)).toEqual(["formats.link", "formats.wikiLink", ""]);
    expect(await of(3)).toEqual(["formats.code", "formats.codeBlock", ""]);
    // …, a swipe down hiding the keyboard
    expect(await of(4)).toEqual(["actions.more", "", "actions.hideKeyboard"]);
    await expect(bar(page).locator('[data-swb-action^="formats.heading"], [data-swb-gesture^="formats.heading"]')).toHaveCount(0);
    await expect(barButton(page, "actions.turnInto")).toBeVisible();
    await expect(barButton(page, "actions.emoji")).toHaveCount(1);
  });

  test("Turn into pinned at the left end, … (a gesture button: swiped down, the keyboard hidden) at the right, out of what scrolls; Turn into as wide whatever it says, so nothing after it moves", async ({ page }) => {
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    const left = bar(page).locator(".swb-dock-pinned-left");
    const right = bar(page).locator(".swb-dock-pinned-right");
    await expect(left.locator("[data-swb-action]")).toHaveCount(1);
    await expect(left.locator('[data-swb-action="actions.turnInto"]')).toHaveClass(/swb-fixed/);
    await expect(right.locator('[data-swb-gesture="actions.more"][data-swb-down="actions.hideKeyboard"]')).toHaveCount(1);
    await expect(bar(page).locator(".swb-dock-items [data-swb-action='actions.turnInto'], .swb-dock-items [data-swb-gesture='actions.more']")).toHaveCount(0);
    // Scrolled to its end: the pinned ones where they were
    const items = bar(page).locator(".swb-dock-items");
    const before = (await left.boundingBox())!;
    const first = (await bar(page).locator(".swb-gesture").first().boundingBox())!;
    await items.evaluate((e) => (e.scrollLeft = e.scrollWidth));
    expect((await left.boundingBox())!.x).toBe(before.x);
    // Another block's lines: Turn into says another, nothing after it moves
    await select(page, "Plain", 0);
    await selectByTouch(page, "Second item");
    await expect(barButton(page, "actions.turnInto")).toContainText("Bullet");
    expect((await bar(page).locator(".swb-gesture").first().boundingBox())!.x).toBe(first.x);
  });
});

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
    await expect(barButton(page, "actions.more")).toBeVisible();
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
    await barButton(page, "actions.more").tap();
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
    await barButton(page, "actions.more").tap();
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

  test("a gesture button docked: a tap runs its first action, a swipe up its second; a swipe sideways runs nothing", async ({ page }) => {
    await addGesture(page, "bold", "italic");
    // (Selected again by touch: the same selection made anew)
    await select(page, "Plain", 0);
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    await gestureButton(page).scrollIntoViewIfNeeded();
    const box = (await gestureButton(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await swipe(page, x, y, x, y - box.height);
    await expect.poll(() => text(page)).toContain("Select _some text_ in this page");
    await selectByTouch(page, "some text");
    await gestureButton(page).tap();
    await expect.poll(() => text(page)).toContain("Select _**some text**_ in this page");
    const before = await text(page);
    await selectByTouch(page, "some text");
    const at = (await gestureButton(page).boundingBox())!;
    await swipe(page, at.x + at.width / 2, at.y + at.height / 2, at.x + at.width / 2 + 120, at.y + at.height / 2 - 4);
    await page.waitForTimeout(300);
    expect(await text(page)).toBe(before);
  });

  test("the settings' search of actions stays in view with its list as the keyboard takes the window's bottom", async ({ page }) => {
    await selectByTouch(page, "some text");
    await barButton(page, "actions.more").tap();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').tap();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="favorites"]').tap();
    await dialog.locator('[data-swb-device="click"]').tap();
    await dialog.locator('[data-swb-row="1"] .swb-settings-add').tap();
    await expect(dialog.locator(".swb-settings-pick-field")).toBeFocused();
    // The keyboard: the view half as tall (the emulation shows none)
    const view = page.viewportSize()!;
    await page.setViewportSize({ width: view.width, height: Math.round(view.height / 2) });
    const list = dialog.locator(".swb-settings-pick-list");
    await expect.poll(async () => {
      const box = (await list.boundingBox())!;
      return box.y >= 0 && box.y + Math.min(box.height, 120) <= view.height / 2;
    }).toBe(true);
    await expect.poll(async () => (await dialog.boundingBox())!.height).toBeLessThanOrEqual(view.height / 2 + 1);
  });

  test("Touch's own favourites show by finger; turned off, Click's, its own kept", async ({ page }) => {
    await selectByTouch(page, "some text");
    await barButton(page, "actions.more").tap();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').tap();
    const dialog = page.locator(".swb-settings");
    await dialog.locator('[data-swb-tab="favorites"]').tap();
    // Click's first while Touch has none of its own on
    await expect(dialog.locator('[data-swb-device="click"]')).toHaveAttribute("aria-checked", "true");
    await dialog.locator('[data-swb-device="touch"]').tap();
    const own = dialog.locator(".swb-settings-devices .swb-settings-switch");
    await own.tap();
    // (Its rows after the boxes of its pinned items)
    await dialog.locator('[data-swb-item="3:0"] .swb-settings-remove').tap();
    await dialog.locator(".swb-settings-save").tap();
    await expect(dialog).toHaveCount(0);
    await select(page, "Plain", 0);
    await selectByTouch(page, "some text");
    await expect(barButton(page, "formats.italic")).toBeVisible();
    await expect(barButton(page, "formats.bold")).toHaveCount(0);
    // Off: Click's, the own kept
    await barButton(page, "actions.more").tap();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').tap();
    await dialog.locator('[data-swb-tab="favorites"]').tap();
    // On: Touch's first
    await expect(dialog.locator('[data-swb-device="touch"]')).toHaveAttribute("aria-checked", "true");
    await own.tap();
    await dialog.locator(".swb-settings-save").tap();
    await select(page, "Plain", 0);
    await selectByTouch(page, "some text");
    await expect(barButton(page, "formats.bold")).toBeVisible();
    await barButton(page, "actions.more").tap();
    await popup(page).locator(".swb-search-field").fill("settings");
    await popup(page).locator('.swb-popup-tool[data-swb-action="actions.settings"]').tap();
    await dialog.locator('[data-swb-tab="favorites"]').tap();
    // Off: Click's first
    await expect(dialog.locator('[data-swb-device="click"]')).toHaveAttribute("aria-checked", "true");
    await dialog.locator('[data-swb-device="touch"]').tap();
    await own.tap();
    await expect(dialog.locator('[data-swb-items="3"] .swb-settings-item-name').first()).toHaveText("Italic");
  });

  test("a shade at each end it scrolls further to, gone at its ends", async ({ page }) => {
    // Enough to scroll: another row of the favourites
    await page.setViewportSize({ width: 300, height: page.viewportSize()!.height });
    await selectByTouch(page, "some text");
    const scroll = bar(page).locator(".swb-dock-scroll");
    await expect(scroll).toHaveClass(/swb-more-right/);
    await expect(scroll).not.toHaveClass(/swb-more-left/);
    await bar(page).locator(".swb-dock-items").evaluate((items) => (items.scrollLeft = 30));
    await expect(scroll).toHaveClass(/swb-more-left/);
    await expect(scroll).toHaveClass(/swb-more-right/);
    await bar(page).locator(".swb-dock-items").evaluate((items) => (items.scrollLeft = items.scrollWidth));
    await expect(scroll).not.toHaveClass(/swb-more-right/);
  });

  test("over the on-screen keyboard where it overlays the page (SilverBullet's keyboard bar off), else over that bar, both as they come and go", async ({ page }) => {
    // The VirtualKeyboard API as SilverBullet sets it on a phone (overlaysContent: the window keeps its size);
    // the emulation shows no keyboard, so its rectangle is given
    // (Before the toolbar starts: it listens to it then)
    await page.addInitScript(() => {
      // Its rectangle as the window is laid out (none yet as this runs)
      const keyboard = Object.assign(new EventTarget(), { overlaysContent: true, shown: true });
      Object.defineProperty(keyboard, "boundingRect", { get: () => (keyboard.shown ? new DOMRect(0, innerHeight - 300, innerWidth, 300) : new DOMRect(0, innerHeight, innerWidth, 0)) });
      Object.defineProperty(navigator, "virtualKeyboard", { value: keyboard, configurable: true });
    });
    await page.reload();
    await ready(page);
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    // Its line: the keyboard's top, or SilverBullet's keyboard bar's where it shows (SilverBullet lays it over the
    // keyboard by the same API)
    const line = (keyboardTop: string) =>
      page.evaluate((top) => {
        const own = document.querySelector(".sb-keyboard-bar")?.getBoundingClientRect();
        return Math.round(own && own.height > 0 ? own.top : top === "shown" ? innerHeight - 300 : innerHeight);
      }, keyboardTop);
    const bottomOf = async () => {
      const box = (await bar(page).boundingBox())!;
      return Math.round(box.y + box.height);
    };
    await expect.poll(async () => (await bottomOf()) - (await line("shown"))).toBe(0);
    expect(await bottomOf()).toBeLessThan(page.viewportSize()!.height - 250);
    // The keyboard going: told by geometrychange, the toolbar at the window's bottom
    await page.evaluate(() => {
      const keyboard = (navigator as unknown as { virtualKeyboard: EventTarget & { shown: boolean } }).virtualKeyboard;
      keyboard.shown = false;
      keyboard.dispatchEvent(new Event("geometrychange"));
    });
    await expect.poll(async () => (await bottomOf()) - (await line("gone"))).toBe(0);
  });

  test("SilverBullet's keyboard bar put in while it is docked, and taken out: over it, and back, no event telling it", async ({ page }) => {
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    const bottomOf = async () => {
      const box = (await bar(page).boundingBox())!;
      return Math.round(box.y + box.height);
    };
    const bottom = page.viewportSize()!.height;
    await expect.poll(bottomOf).toBe(bottom);
    await page.evaluate(() => {
      const keyboardBar = document.createElement("div");
      keyboardBar.className = "sb-keyboard-bar";
      keyboardBar.style.cssText = "position: fixed; left: 0; right: 0; bottom: 0; height: 44px";
      document.body.append(keyboardBar);
    });
    // Its top as laid out (SilverBullet's CSS styles the class too)
    const top = await page.evaluate(() => Math.round(document.querySelector(".sb-keyboard-bar")!.getBoundingClientRect().top));
    expect(top).toBeLessThan(bottom);
    await expect.poll(bottomOf).toBe(top);
    await page.evaluate(() => document.querySelector(".sb-keyboard-bar")?.remove());
    await expect.poll(bottomOf).toBe(bottom);
  });

  test("on the bottom of SilverBullet's view where it pins it above the keyboard (its bar off), as it measures it anew @playground", async ({ page }) => {
    // SilverBullet's root pinned above the keyboard (client/lib/keyboard_viewport.ts), as on a phone with it up
    await page.evaluate(() => {
      document.documentElement.classList.add("sb-viewport-tracked");
      document.documentElement.style.setProperty("--sb-viewport-height", "500px");
      const root = document.createElement("div");
      root.id = "sb-root";
      root.style.cssText = "position: fixed; left: 0; right: 0; top: 0; height: var(--sb-viewport-height); pointer-events: none";
      document.body.append(root);
    });
    await selectByTouch(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    const bottomOf = async () => {
      const box = (await bar(page).boundingBox())!;
      return Math.round(box.y + box.height);
    };
    await expect.poll(bottomOf).toBe(500);
    // The keyboard gone: measured anew, no other event
    await page.evaluate(() => document.documentElement.style.setProperty("--sb-viewport-height", `${innerHeight}px`));
    await expect.poll(bottomOf).toBe(page.viewportSize()!.height);
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
