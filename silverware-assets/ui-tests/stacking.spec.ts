// What Silverware Assets lays over a page's files (docs/silverware-core-work.md, step S, item 3): a file's menu, the
// side panel and a file enlarged opened from it, each on top whole (what the document has at its middle and corners,
// not visibility alone), Esc closing the top one alone.
import { expect, ON_TOP, onTopAt, test } from "./helpers.ts";

// A pixel of PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("a file's menu, the side panel and the file enlarged from it, each on top whole; Esc closes each alone", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/a.png|A||{ view: preview }]]\n\nAfter\n` }, "Page", { "a.png": PNG });
  const preview = page.locator("#sb-main [data-swa-type='image'][data-swa-view='preview']");
  const menu = page.locator(".swa-popup");
  const open = async (label: string) => {
    await preview.hover();
    await preview.locator(".swa-more").click();
    await expect(menu).toBeVisible();
    if (label) await menu.locator(".swa-menu-item", { hasText: label }).click();
  };
  await open("");
  expect(await onTopAt(menu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await open("Open in side panel");
  const panel = page.locator(".swa-side-panel");
  // (Its title the file's alt text)
  await expect(panel.locator(".swa-panel-title")).toHaveText("A");
  expect(await onTopAt(panel)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await open("Open enlarged");
  const enlarged = page.locator(".swa-enlarged");
  await expect(enlarged).toBeVisible();
  // (The file's box: `.swa-enlarged` is the backdrop over the whole window)
  expect(await onTopAt(enlarged.locator(".swa-enlarged-box"))).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(enlarged).toHaveCount(0);
  await expect(preview).toBeVisible();
});
