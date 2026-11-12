// A widget's handle on a touch screen (the "touch" project: a phone's touch, at a tablet's size, as Silverware Layout
// lays nothing out in a pane under 600 px), on the playground (layout.html, as widgets.spec.ts)
import { expect, type Page, test } from "@playwright/test";

const TEXT = 760;

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await page.goto("layout.html");
  await expect(page.locator(".pg-widget").first()).toBeVisible();
});

const widget = (page: Page, key: string) => page.locator(`.pg-widget[data-key="${key}"]`);
const kept = async (page: Page) => JSON.parse((await page.locator("#entries").textContent()) || "{}") as Record<string, Record<string, string>>;
const width = async (page: Page, key: string) => Math.round((await widget(page, key).boundingBox())!.width);

/** A finger moved from one point to another and lifted, as Chrome gets it (Playwright's touchscreen only taps) */
async function swipe(page: Page, x: number, y: number, toX: number, steps = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + ((toX - x) * i) / steps, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** The handle shown by a tap on a widget, and its bar's middle */
async function tapWidget(page: Page, key: string) {
  const b = (await widget(page, key).boundingBox())!;
  await page.touchscreen.tap(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  return { x: at.x + at.width / 2, y: at.y + at.height / 2, right: at.x + at.width };
}

test("@playground a tap on a widget shows its bar, a finger dragging it widens the widget, written once; a tap elsewhere hides it", async ({ page }) => {
  expect(await width(page, "table-1")).toBe(TEXT);
  const at = await tapWidget(page, "table-1");
  await swipe(page, at.x, at.y, at.x + 100);
  await expect.poll(() => kept(page)).toEqual({ "table-1": { width: String(TEXT + 200) } });
  await expect.poll(() => width(page, "table-1")).toBe(TEXT + 200);
  // Still shown for the widget (a finger has no hover to leave)
  await expect(page.locator(".swl-handle-bar")).toBeVisible();
  // (Beside the page, level with the widget: no widget there)
  await page.touchscreen.tap(5, at.y);
  await expect(page.locator(".swl-handle-bar")).toBeHidden();
});

test("@playground a finger takes the bar beside it, wider than the bar looks", async ({ page }) => {
  const at = await tapWidget(page, "table-1");
  // 8 px right of the bar's edge: the room around it is its own on a touch screen
  await swipe(page, at.right + 8, at.y, at.right + 108);
  await expect.poll(() => width(page, "table-1")).toBe(TEXT + 200);
});

test("@playground a double tap on the bar takes the width off: the text's again", async ({ page }) => {
  let at = await tapWidget(page, "table-1");
  await swipe(page, at.x, at.y, at.x + 100);
  await expect.poll(() => width(page, "table-1")).toBe(TEXT + 200);
  at = await tapWidget(page, "table-1");
  await page.touchscreen.tap(at.x, at.y);
  await page.touchscreen.tap(at.x, at.y);
  await expect.poll(() => kept(page)).toEqual({});
  await expect.poll(() => width(page, "table-1")).toBe(TEXT);
});
