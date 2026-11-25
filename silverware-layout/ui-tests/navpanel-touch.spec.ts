// SilverBullet's space tree lying over the page on a narrow touch screen (from 3.0; the "touch" project), against
// SilverBullet: a widget's handle is placed beside the widget in the body, over SilverBullet's own layers, and must not
// stay over the tree once it opens.
import { expect, runSilverBulletCommand, test } from "./helpers.ts";

// (Wide enough for Silverware Layout to lay widgets out, 600 px; narrow enough for SilverBullet to lay its tree over the page)
test.use({ viewport: { width: 600, height: 800 } });

test("a widget's handle shown by a tap: the space tree opened over the page, it is not left over the tree", async ({ page, space }) => {
  // (A table narrower than the text, centred: its handle beside it, where the tree then lies)
  await space.open({ Page: "# Page\n\n| Name | Qty |\n|---|---|\n| Pear | 3 |\n| <meta core.table layout.width='300'> |\n\nAfter\n" }, "Page");
  const table = page.locator("#sb-main .sb-table-widget table");
  await expect(table).toBeVisible();
  await table.locator("td", { hasText: "Pear" }).tap();
  const handle = page.locator(".swl-handle:not([hidden])");
  await expect(handle).toBeVisible();
  const shownAt = (await handle.boundingBox())!.x;
  expect(await runSilverBulletCommand(page, "Navigate: Tree")).toBe(true);
  const tree = page.locator(".sb-nav-root");
  await expect(tree).toBeVisible();
  // Over the page (the narrow screen's), not beside it, and where the handle was: else this test tests nothing
  expect((await tree.boundingBox())!.width).toBeGreaterThan(shownAt + 20);
  // (Read in the page: a locator's box waits for an element the handle hidden no longer is)
  const overTree = () =>
    page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".swl-handle");
      const panel = document.querySelector(".sb-nav-root")!.getBoundingClientRect();
      if (!box || box.hidden) return false;
      const bar = box.getBoundingClientRect();
      return bar.left < panel.right && bar.right > panel.left;
    });
  await expect.poll(overTree).toBe(false);
});
