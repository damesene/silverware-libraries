// A link's icon tapped on a phone (the "touch" project, against SilverBullet): its menu, not the link followed, as
// SilverBullet follows a link as a touch on it ends.
import { expect, test } from "./helpers.ts";

test("the arrow after a link tapped opens its menu, the link not followed", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\nSee [[${space.folder}/doc.pdf]] here.\n` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  const icon = page.locator("#sb-main [data-swa-link='pdf'] .swa-link-marker");
  await expect(icon).toBeVisible();
  const url = page.url();
  await icon.tap();
  await expect(page.locator(".swa-popup .swa-menu-item")).toHaveText(["Rename…", "Open in a new tab", "Open in side panel", "Open enlarged", "Copy markdown", "Download", "Delete file…"]);
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Open enlarged" }).tap();
  await expect(page.locator(".swa-popover object")).toBeVisible();
});
