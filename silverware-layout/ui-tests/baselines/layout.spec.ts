// Rendering baselines of what Silverware Layout lays over the page (docs/silverware-core-work.md, step S, item 5): its
// settings dialog (the command "Silverware Layout: Settings", src/ui/pagedialog.ts) and a widget's handle's menu
// (src/ui/handle.ts); each opened in its theme on a desktop and a phone as a user there opens it, its DOM, its look and
// its place in the window (the menu's against its handle too) (scripts/ui-test-baselines.ts `recordParts`; written anew only by
// SW_BASELINES=update). The handle's widget is a small table: on a phone a handle shows only beside a widget narrower
// than the window (a grid is as wide as it, so it has none there).
import type { Locator, Page } from "@playwright/test";
import { type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { onPhone, press } from "../../../scripts/ui-test-helpers.ts";
import { boxOf, expect, LAYOUT_SETTINGS, runCommand, type Space, test } from "../helpers.ts";

type Args = { page: Page; space: Space };

// SilverBullet's interface's font, which the dialog and the menu take
const FONT = "Inter";
// A page of a small table, text around it
const PAGE = "# Table\n\nBefore\n\n| Name | Qty |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n\nAfter\n";

/** The table's handle shown, as a user there shows it (the pointer over the table, or a tap on it); given */
async function handleShown(page: Page, space: Space): Promise<Locator> {
  await space.open({ Page: PAGE }, "Page");
  const table = page.locator(".sb-table-widget");
  await expect(table).toBeVisible();
  const b = await boxOf(table);
  const [x, y] = [b.x + 20, b.y + b.height / 2];
  if (await onPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.move(x, y);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  return bar;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  settings: {
    open: async ({ page, space }) => {
      await space.open({ Page: PAGE }, "Page");
      await runCommand(page, LAYOUT_SETTINGS);
      const dialog = page.locator(".swl-dialog");
      await expect(dialog.locator('[role="tab"][aria-selected="true"]')).toHaveText("Page");
      // (Its subtitle names the page, the test's folder in it: written one length, so a title's length moves nothing
      // under it, on a phone a line of its own)
      await dialog.locator(".swl-dialog-subtitle").evaluate((subtitle) => (subtitle.textContent = "<folder>/Page"));
      return dialog;
    },
    parts: { dialog: "", title: "h2", close: ".swl-dialog-close", tab: '[role="tab"][aria-selected="false"]', selected: '[role="tab"][aria-selected="true"]', panel: '[role="tabpanel"]:not([hidden])', row: '[role="tabpanel"]:not([hidden]) .swl-dialog-row', section: '[role="tabpanel"]:not([hidden]) .swl-dialog-section', slider: '[role="tabpanel"]:not([hidden]) .swl-dialog-slider', amount: '[role="tabpanel"]:not([hidden]) .swl-dialog-amount', segment: '[role="tabpanel"]:not([hidden]) .swl-segment[aria-checked="false"]', segmentOn: '[role="tabpanel"]:not([hidden]) .swl-segment[aria-checked="true"]', select: '[role="tabpanel"]:not([hidden]) .swl-dialog-align', notice: '[role="tabpanel"]:not([hidden]) .swl-dialog-notice', subtitle: ".swl-dialog-subtitle", save: ".swl-dialog-save", cancel: ".swl-dialog-cancel" },
    font: FONT,
    place: () => ({}),
  },
  handleMenu: {
    open: async ({ page, space }) => {
      const bar = await handleShown(page, space);
      await press(page, bar);
      const menu = page.locator(".swl-popup");
      // (A table with no width of its own: Align alone, its three choices, the default checked)
      await expect(menu.getByRole("menuitemradio")).toHaveCount(3);
      return menu;
    },
    parts: { menu: "", title: ".swl-menu-title", close: ".swl-menu-close", row: ".swl-menu-segmented", label: ".swl-menu-segmented > .swl-label", choice: '[role="menuitemradio"][aria-checked="false"]', checked: '[role="menuitemradio"][aria-checked="true"]' },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swl-handle-bar") }),
  },
};

recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS);
