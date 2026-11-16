// A file aligned on a phone (the "touch" project, against SilverBullet): the pane too narrow for Silverware Layout to
// lay widths out, the bar beside a file is for its menu alone.
import { expect, PIXEL_PNG, test } from "./helpers.ts";

test("on a phone a tap on a file shows its bar for its menu alone: aligned right from it, no width to drag or take off", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nText above.\n\n![[${space.folder}/a.png|Photo|120]]\n\nText under.\n` }, "Page", { "a.png": PIXEL_PNG });
  const image = page.locator("#sb-main [data-swa-type='image']");
  await expect(image).toBeVisible();
  // A finger put on it (SilverBullet 2.12.1 opens the file as a tap on an image ends, its main does not: the touch
  // alone, which is what shows the bar)
  await image.dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true, bubbles: true });
  const bar = page.locator(".swl-handle.swl-handle-menu-only .swl-handle-bar");
  await expect(bar).toBeVisible();
  await bar.tap();
  await expect(page.locator(".swl-popup")).toBeVisible();
  await expect(page.locator(".swl-popup .swl-menu-item", { hasText: "Width" })).toHaveCount(0);
  await page.locator(".swl-popup .swl-segment[title='Right']").tap();
  await expect.poll(() => space.saved("Page")).toContain(`![[${space.folder}/a.png|Photo|120|{ align: right }]]`);
  // At the text's right edge
  const content = page.locator("#sb-main .cm-content");
  const textRight = await content.evaluate((one) => one.getBoundingClientRect().right - parseFloat(getComputedStyle(one).paddingRight));
  await expect.poll(async () => {
    const now = (await image.boundingBox())!;
    return Math.round(now.x + now.width);
  }).toBe(Math.round(textRight));
});
