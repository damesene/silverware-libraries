// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the init
// page again on the module already loaded. After it a file's preview is drawn as before, its menu one.
import { appendToPage, expect, reloadSpaceLua, test } from "./helpers.ts";

// A pixel of PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("after System: Reload a file put in is drawn once, its menu one", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/a.png|A||{ view: preview }]]\n` }, "Page", { "a.png": PNG });
  const frames = page.locator("#sb-main [data-swa-type='image'][data-swa-view='preview']");
  await expect(frames).toHaveCount(1);
  await reloadSpaceLua(page);
  await appendToPage(page, `\nAgain\n\n![[${space.folder}/a.png|B||{ view: preview }]]\n`);
  await expect(frames).toHaveCount(2);
  await frames.last().hover();
  await frames.last().locator(".swa-more").click();
  await expect(page.locator(".swa-popup:visible")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-popup:visible")).toHaveCount(0);
});
