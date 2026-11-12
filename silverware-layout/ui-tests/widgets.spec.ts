// A widget's width, laid out and changed by its handle, on the playground (layout.html): an editor as SilverBullet's
// (text 800 px with 20 px of padding: 760 px of text), widgets of a provider of the playground's which keeps their
// entries in memory and draws a widget anew when written (as SilverBullet does). Its widths and centring are CSS's,
// as in SilverBullet (docs/silverware-layout.md, probes 1 and 3).
import { expect, type Page, test } from "@playwright/test";

const TEXT = 760;

// Wide enough for the Wide preset (1200 px) with the pane's gutter
test.use({ viewport: { width: 1600, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto("layout.html");
  await expect(page.locator(".pg-widget").first()).toBeVisible();
});

const widget = (page: Page, key: string) => page.locator(`.pg-widget[data-key="${key}"]`);
const kept = async (page: Page) => JSON.parse((await page.locator("#entries").textContent()) || "{}") as Record<string, Record<string, string>>;
/** A widget's box; one being drawn anew (its element replaced) measured once the new one is there */
async function box(page: Page, key: string) {
  for (let tries = 0; tries < 50; tries++) {
    const found = await widget(page, key)
      .boundingBox({ timeout: 1000 })
      .catch(() => null);
    if (found) return found;
    await page.waitForTimeout(20);
  }
  throw new Error(`no widget ${key}`);
}
const contentMiddle = async (page: Page) => {
  const b = (await page.locator(".cm-content").boundingBox())!;
  return b.x + b.width / 2;
};

/** The handle shown for a widget (the pointer over it), and its bar's middle */
async function barOf(page: Page, key: string) {
  const b = await box(page, key);
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  return { x: at.x + at.width / 2, y: at.y + at.height / 2 };
}

/** The bar dragged by `dx`, in steps */
async function drag(page: Page, key: string, dx: number) {
  const at = await barOf(page, key);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + dx / 2, at.y, { steps: 5 });
  await page.mouse.move(at.x + dx, at.y, { steps: 5 });
}

test("@playground a drag of the bar widens the widget on both sides, written once on release, drawn anew at its width", async ({ page }) => {
  expect((await box(page, "table-1")).width).toBe(TEXT);
  await drag(page, "table-1", 150);
  // Every frame only shown: nothing kept yet, the widget twice the distance wider, centred on the text
  expect(await kept(page)).toEqual({});
  await expect.poll(async () => Math.round((await box(page, "table-1")).width)).toBe(TEXT + 300);
  await page.mouse.up();
  await expect.poll(() => kept(page)).toEqual({ "table-1": { width: String(TEXT + 300) } });
  // Drawn anew (a new element), laid out at once at its width, centred
  await expect.poll(async () => Math.round((await box(page, "table-1")).width)).toBe(TEXT + 300);
  const b = await box(page, "table-1");
  expect(Math.round(b.x + b.width / 2)).toBe(Math.round(await contentMiddle(page)));
  expect((await box(page, "table-2")).width).toBe(TEXT);
});

test("@playground a drag snaps to a preset and to the text's width; a double click takes the width off", async ({ page }) => {
  // To about 1200 px: Wide
  await drag(page, "table-1", (1196 - TEXT) / 2);
  await page.mouse.up();
  await expect.poll(() => kept(page)).toEqual({ "table-1": { width: "1200" } });
  // Back to about the text's width: none kept
  await drag(page, "table-1", -(1200 - TEXT + 6) / 2);
  await page.mouse.up();
  await expect.poll(() => kept(page)).toEqual({});
  await expect.poll(async () => (await box(page, "table-1")).width).toBe(TEXT);
  await drag(page, "table-1", 100);
  await page.mouse.up();
  await expect.poll(() => kept(page)).toEqual({ "table-1": { width: String(TEXT + 200) } });
  const at = await barOf(page, "table-1");
  await page.mouse.dblclick(at.x, at.y);
  await expect.poll(() => kept(page)).toEqual({});
  await expect.poll(async () => (await box(page, "table-1")).width).toBe(TEXT);
});

test("@playground a drag far right snaps to Full width: the pane less 40 px, kept as full", async ({ page }) => {
  const pane = (await page.locator("#sb-editor").boundingBox())!.width;
  await drag(page, "table-1", (pane - 40 - TEXT - 6) / 2);
  await page.mouse.up();
  await expect.poll(() => kept(page)).toEqual({ "table-1": { width: "full" } });
  await expect.poll(async () => Math.round((await box(page, "table-1")).width)).toBe(Math.round(pane - 40));
  await barOf(page, "table-1");
  await expect(page.locator(".swl-handle-bar")).toHaveAttribute("title", "Width: Full width. Drag to change it, double-click for the text's width");
});

test("@playground Esc during a drag puts the width back, writing nothing", async ({ page }) => {
  await drag(page, "table-1", 120);
  await expect.poll(async () => Math.round((await box(page, "table-1")).width)).toBe(TEXT + 240);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await box(page, "table-1")).width).toBe(TEXT);
  expect(await kept(page)).toEqual({});
});

test("@playground a write refused is said, the width held for the view", async ({ page }) => {
  await page.locator("#refuse").check();
  await drag(page, "table-1", 100);
  await page.mouse.up();
  await expect(page.locator("#flash")).toContainText("the width could not be saved (the playground refuses writes)");
  expect(await kept(page)).toEqual({});
  expect(Math.round((await box(page, "table-1")).width)).toBe(TEXT + 200);
});

test("@playground a widget in a line of its own (a code widget) passes its line, which keeps the text's width", async ({ page }) => {
  await drag(page, "chart-1", 100);
  await page.mouse.up();
  await expect.poll(() => kept(page)).toEqual({ "chart-1": { width: String(TEXT + 200) } });
  await expect.poll(async () => Math.round((await box(page, "chart-1")).width)).toBe(TEXT + 200);
  const line = (await page.locator(".cm-line", { has: page.locator(".pg-widget") }).boundingBox())!;
  expect(Math.round(line.width)).toBe(TEXT);
});

test("@playground over the window or in a narrow pane a widget is left to its plugin, its width back after", async ({ page }) => {
  // To about 1200 px: Wide
  await drag(page, "table-1", (1196 - TEXT) / 2);
  await page.mouse.up();
  await expect.poll(async () => (await box(page, "table-1")).width).toBe(1200);
  // Over the window (as Silverware Table's full screen marks it): its own box, no handle
  await page.locator("#over-window").click();
  await expect.poll(async () => (await box(page, "table-1")).width).not.toBe(1200);
  const b = await box(page, "table-1");
  await page.mouse.move(b.x + 40, b.y + 40);
  await expect(page.locator(".swl-handle")).toBeHidden();
  await page.locator("#over-window").click();
  await expect.poll(async () => (await box(page, "table-1")).width).toBe(1200);
  // A pane narrower than 600 px: the text's width, no handle; wider again, its width back
  await page.setViewportSize({ width: 560, height: 800 });
  await expect.poll(async () => Math.round((await box(page, "table-1")).width)).toBeLessThan(560);
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-swl-narrow"))).toBe(true);
  await page.setViewportSize({ width: 1600, height: 800 });
  await expect.poll(async () => (await box(page, "table-1")).width).toBe(1200);
});

test("@playground the bar is 120 px at most, centred on the part of the widget in view as the page scrolls", async ({ page }) => {
  // A short window: the chart (160 px) partly scrolled out of it
  await page.setViewportSize({ width: 1600, height: 500 });
  const middleOf = (b: { y: number; height: number }) => b.y + b.height / 2;
  await barOf(page, "chart-1");
  const chart = await box(page, "chart-1");
  let bar = (await page.locator(".swl-handle-bar").boundingBox())!;
  expect(Math.round(bar.height)).toBe(120);
  expect(Math.abs(middleOf(bar) - middleOf(chart))).toBeLessThan(2);
  // Scrolled so its top half is above the window: the bar on the half in view
  await page.mouse.wheel(0, chart.y + chart.height / 2);
  await expect.poll(async () => Math.round((await box(page, "chart-1")).y)).toBeLessThan(0);
  const shown = await box(page, "chart-1");
  const inView = { y: 0, height: shown.y + shown.height };
  await expect.poll(async () => Math.abs(middleOf((await page.locator(".swl-handle-bar").boundingBox())!) - middleOf(inView))).toBeLessThan(2);
  bar = (await page.locator(".swl-handle-bar").boundingBox())!;
  expect(Math.round(bar.height)).toBe(Math.round(Math.min(120, inView.height)));
});

test("@playground while the bar is dragged, a quiet guide each side for the text's width and each guide; the one snapped to a little stronger; none after", async ({ page }) => {
  await drag(page, "table-1", 40);
  const guides = page.locator(".swl-handle-guide");
  // The text's width, the guides 900 px and 1200 px, Full width: two lines each
  await expect(guides).toHaveCount(8);
  await expect(page.locator(".swl-handle-guide-label")).toHaveText(["Text width", "900 px", "1200 px", "Full width"]);
  await expect(page.locator(".swl-handle-guide-near")).toHaveCount(0);
  // Each guide where a widget of its width has its edges, centred on the text
  const middle = await contentMiddle(page);
  const wide = (await page.locator('[data-swl-guide="1200 px"]').boundingBox())!;
  expect(Math.round(wide.x)).toBe(Math.round(middle + 600));
  // Near 1200 px: its two lines lit, the others not
  const at = (await page.locator(".swl-handle-bar").boundingBox())!;
  await page.mouse.move(at.x + at.width / 2 + (1196 - TEXT - 80) / 2, at.y + at.height / 2, { steps: 5 });
  await expect(page.locator(".swl-handle-guide-near")).toHaveCount(2);
  await expect(page.locator('[data-swl-guide="1200 px"]')).toHaveClass(/swl-handle-guide-near/);
  await page.mouse.up();
  await expect(guides).toHaveCount(0);
});

test("@playground guides near each other: their names in rows, none over another", async ({ page }) => {
  // The text's width (760 px), 780 and 800 px: three lines 10 px apart each side
  await page.goto("layout.html?guides=780,800,full");
  await drag(page, "table-1", 40);
  const labels = page.locator(".swl-handle-guide-label");
  await expect(labels).toHaveText(["Text width", "780 px", "800 px", "Full width"]);
  const boxes = await labels.evaluateAll((all) => all.map((label) => label.getBoundingClientRect()).map(({ left, right, top, bottom }) => ({ left, right, top, bottom })));
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
  }
  // Rows only where needed: Full width, far from them, at the top
  expect(boxes[3]!.top).toBe(boxes[0]!.top);
  await page.mouse.up();
});
