// The editor's font size (docs/silverware-layout-font-size.md), in SilverBullet: the setting from the Page layout
// dialog, Font zoom by Ctrl + scroll and Ctrl+0, its label, this device's zoom kept across a reload and Reset.
import type { Page } from "@playwright/test";
import { expect, PAGE_LAYOUT, runCommand, test } from "./helpers.ts";

const PAGE = "# Page\n\nSome text to zoom.\n";
// SilverBullet's theme's font size
const THEME = 18;

const fontSize = (page: Page) => page.evaluate(() => Math.round(parseFloat(getComputedStyle(document.querySelector("#sb-main .cm-editor")!).fontSize)));
const label = (page: Page) => page.locator(".swl-zoom-label");

/** Ctrl + a wheel's notches over the page's text (up: away, larger) */
async function zoom(page: Page, notches: number): Promise<void> {
  const text = (await page.locator(".cm-line", { hasText: "Some text to zoom." }).boundingBox())!;
  await page.mouse.move(text.x + 20, text.y + text.height / 2);
  await page.keyboard.down("Control");
  for (let i = 0; i < Math.abs(notches); i++) await page.mouse.wheel(0, notches > 0 ? -100 : 100);
  await page.keyboard.up("Control");
}

test("Ctrl + scroll over the page: a pixel a step, its label naming the size and the default; Ctrl+0 the default again", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  await page.keyboard.press("Escape");
  expect(await fontSize(page)).toBe(THEME);
  await zoom(page, 2);
  await expect.poll(() => fontSize(page)).toBe(THEME + 2);
  await expect(label(page)).toHaveText(`Font size ${THEME + 2} px`);
  await zoom(page, -2);
  await expect.poll(() => fontSize(page)).toBe(THEME);
  await expect(label(page)).toHaveText(`Font size ${THEME} px · default`);
  // Gone a moment after the last step
  await expect(label(page)).toBeHidden({ timeout: 3000 });
  await zoom(page, 3);
  await expect.poll(() => fontSize(page)).toBe(THEME + 3);
  await page.locator(".cm-line", { hasText: "Some text to zoom." }).click();
  await page.keyboard.press("Control+0");
  await expect.poll(() => fontSize(page)).toBe(THEME);
  await expect(label(page)).toHaveText(`Font size ${THEME} px · default`);
  // The text as it was: Ctrl+0 typed nothing
  await expect(page.locator(".cm-line", { hasText: "Some text to zoom." })).toHaveText("Some text to zoom.");
});

test("this device's zoom kept across a reload, shown in the dialog, taken off by Reset", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  await page.keyboard.press("Escape");
  await zoom(page, 2);
  await expect.poll(() => fontSize(page)).toBe(THEME + 2);
  await page.reload();
  await runCommand(page, PAGE_LAYOUT);
  await expect.poll(() => fontSize(page)).toBe(THEME + 2);
  const dialog = page.locator(".swl-dialog");
  await expect(dialog.locator(".swl-dialog-device")).toContainText(`This device: ${THEME + 2} px`);
  await dialog.getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => fontSize(page)).toBe(THEME);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  expect(await fontSize(page)).toBe(THEME);
  expect(await page.evaluate(() => localStorage.getItem("silverware.layout.fontZoom"))).toBeNull();
});

test("the font size for every page set in the dialog, shown at once, saved into CONFIG; the zoom's default then", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  const row = dialog.locator(".swl-dialog-font-row");
  await expect(row.getByRole("radio", { name: "Your theme's font size" })).toHaveAttribute("aria-checked", "true");
  await row.locator(".swl-dialog-amount").fill("22");
  await expect(row.getByRole("radio", { name: "A font size of its own" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => fontSize(page)).toBe(22);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await space.config()) ?? "").toContain('config.set("silverware.layout.fontSize", "22px")');
  expect(await fontSize(page)).toBe(22);
  // A step up and back: 22 the default
  await zoom(page, 1);
  await expect.poll(() => fontSize(page)).toBe(23);
  await zoom(page, -1);
  await expect(label(page)).toHaveText("Font size 22 px · default");
});

test("Font zoom off: Ctrl + scroll leaves the font, and the browser's zoom, alone", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("checkbox", { name: /Font zoom/ }).uncheck();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await space.config()) ?? "").toContain('config.set("silverware.layout.fontZoom.enabled", false)');
  await page.evaluate(() => {
    (window as unknown as { held: boolean[] }).held = [];
    document.addEventListener("wheel", (e) => (window as unknown as { held: boolean[] }).held.push(e.defaultPrevented), { passive: true });
  });
  await zoom(page, 2);
  await page.waitForTimeout(200);
  expect(await fontSize(page)).toBe(THEME);
  await expect(label(page)).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { held: boolean[] }).held)).toEqual([false, false]);
});

test("a task's box grows with the font, as SilverBullet draws it at its own size", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n- [ ] Some text to zoom.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  await page.keyboard.press("Escape");
  const box = async () => (await page.locator("#sb-main .cm-editor input[type=checkbox]").boundingBox())!.width;
  const theme = await box();
  // A step up: the box in proportion to the font (as SilverBullet draws it at 18 px, a step larger)
  await zoom(page, 1);
  await expect.poll(() => fontSize(page)).toBe(THEME + 1);
  await expect.poll(async () => Math.round(await box())).toBe(Math.round((theme * (THEME + 1)) / THEME));
  await zoom(page, 17);
  await expect.poll(() => fontSize(page)).toBe(THEME * 2);
  await expect.poll(async () => Math.round(await box())).toBe(Math.round(theme * 2));
});
