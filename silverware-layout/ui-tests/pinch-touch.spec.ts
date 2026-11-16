// The font zoom by a pinch (docs/silverware-layout-font-size.md, *Pinch*), on a phone in SilverBullet: on (the
// default), a pinch zooms the font and opens nothing, and a tap with two fingers still opens the page picker, as the
// fingers are lifted; off (the settings dialog's Font tab), two fingers are SilverBullet's (its page picker at once).
import type { CDPSession, Page } from "@playwright/test";
import { expect, LAYOUT_SETTINGS, runCommand, test } from "./helpers.ts";

const PAGE = "# Page\n\nSome text to zoom with two fingers.\n\nMore text under it.\n";

const fontSize = (page: Page) => page.evaluate(() => Math.round(parseFloat(getComputedStyle(document.querySelector("#sb-main .cm-editor")!).fontSize)));
// SilverBullet's page picker (its filter box)
const picker = (page: Page) => page.getByText("Press Shift-Enter to create a new page");

/** Two fingers as Chrome gets them (Playwright's touchscreen has one): put down, moved apart by `spread` px each, lifted */
async function twoFingers(cdp: CDPSession, x: number, y: number, spread: number, steps = 8): Promise<void> {
  const at = (d: number) => [
    { x: x - 40 - d, y, id: 1 },
    { x: x + 40 + d, y, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
  for (let i = 1; i <= steps && spread; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at((spread * i) / steps) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("a pinch with two fingers zooms the font (on by default), a tap with two fingers still opens the page picker; turned off, two fingers are SilverBullet's", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  const cdp = await page.context().newCDPSession(page);
  const text = (await page.locator(".cm-line", { hasText: "Some text to zoom" }).boundingBox())!;
  const [x, y] = [text.x + text.width / 2, text.y + text.height / 2];
  const before = await fontSize(page);
  // On (the default): a pinch makes the font larger, nothing opened
  await twoFingers(cdp, x, y, 60);
  await expect.poll(() => fontSize(page)).toBeGreaterThan(before);
  await expect(page.locator(".swl-zoom-label")).toContainText("Font size");
  await expect(picker(page)).toHaveCount(0);
  // A tap with two fingers: the page picker, as SilverBullet's own
  await twoFingers(cdp, x, y, 0);
  await expect(picker(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker(page)).toHaveCount(0);
  // Turned off in the settings dialog's Font tab: two fingers are SilverBullet's, its page picker at once, no zoom
  await runCommand(page, LAYOUT_SETTINGS);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Font" }).click();
  await dialog.getByRole("checkbox", { name: "Pinch with two fingers zooms the text" }).uncheck();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => space.config()).toContain("silverware.layout.fontZoom.pinch");
  const zoomed = await fontSize(page);
  await twoFingers(cdp, x, y, 60);
  await expect(picker(page)).toBeVisible();
  expect(await fontSize(page)).toBe(zoomed);
  await page.keyboard.press("Escape");
  await cdp.detach();
});
