// A link's icon tapped on a phone (the "touch" project, against SilverBullet): its menu, not the link followed, as
// SilverBullet follows a link as a touch on it ends.
import { expect, test } from "./helpers.ts";

test("a link's icon tapped opens its menu, the link not followed", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nSee [[${space.folder}/doc.pdf]] here.\n` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  const icon = page.locator("#sb-main [data-swl-asset-link='pdf'] .swl-asset-link-icon");
  await expect(icon).toBeVisible();
  const url = page.url();
  await icon.tap();
  await expect(page.locator(".swl-asset-menu-holder .swl-menu-item")).toHaveText(["Open in a new tab", "Show in a side panel", "Show enlarged", "Show as embedded"]);
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  await page.locator(".swl-asset-menu-holder .swl-menu-item", { hasText: "Show enlarged" }).tap();
  await expect(page.locator(".swl-asset-popover object")).toBeVisible();
});
