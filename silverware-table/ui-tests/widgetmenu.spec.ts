// SilverBullet's ⋮ beside a widget: kept from a table Silverware Table enhances (its own menus
// do what it offers), shown beside a widget not ours (shared/silverbullet/widgetmenu.ts)
import { embedOf, expectWidgetMenuKept } from "../../scripts/silverbullet-widgetmenu.ts";
import { expect, setOtherPage, setPage, table, target, test } from "./helpers.ts";

test("SilverBullet's ⋮ beside a widget: kept from a table, shown beside a widget not ours", async ({ page }) => {
  test.skip(target !== "silverbullet", "the ⋮ beside a widget is SilverBullet's");
  await setOtherPage(page, "WidgetMenuOther", "# Other\n\nEmbedded.\n");
  await setPage(page, `# Test\n\n${embedOf("WidgetMenuOther")}\n\nBetween\n\n| Name | Quantity |\n|---|---|\n| Pear | 3 |\n| Fig | 2 |\n`);
  await expect(table(page)).toBeVisible();
  await expectWidgetMenuKept(page, page.locator("#sb-main [data-sb-widget-menu]").first(), "Embed", table(page));
});
