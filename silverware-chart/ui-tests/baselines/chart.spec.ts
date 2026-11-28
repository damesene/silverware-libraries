// Rendering baselines of what Silverware Chart lays over its chart (docs/silverware-core-work.md, step S, item 5): its
// toolbar's menu (⋯) and its settings dialog; each opened in its theme on a desktop and a phone as a user there opens
// it (the chart hovered, or tapped: Chrome sends a tap's mousemove, which shows the toolbar), its DOM, its look and its
// place in the window (the menu's against its ⋯ too) (scripts/ui-test-baselines.ts `recordParts`; written anew only by
// SW_BASELINES=update). Against SilverBullet alone, as every chart test.
import type { Locator, Page } from "@playwright/test";
import { keptThrough, type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { boxOf, expectNoPageErrorsYet, onPhone, press } from "../../../scripts/ui-test-helpers.ts";
import { charts, expect, test } from "../helpers.ts";

type Args = { page: Page; open: (text: string) => Promise<void> };

// SilverBullet's interface's font, which the menu and the dialog take (`--ui-font`)
const FONT = "Inter";
// A chart of two series and two labels, text after it
const CHART = '# Sales\n\n```mermaid\nxychart-beta\n  x-axis ["a", "b"]\n  bar "one" [1, 2]\n  line "two" [3, 4]\n```\n\nAfter\n';

/** The chart's ⋯ menu opened, as a user there opens it: the chart hovered or tapped, then ⋯ pressed; given */
async function menuOpen({ page, open }: Args): Promise<Locator> {
  await open(CHART);
  await expect.poll(async () => (await charts(page)).length).toBe(1);
  const chart = page.locator(".swc-chart").first();
  const box = await boxOf(chart);
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (await onPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.move(x, y);
  const more = page.locator(".swc-bar.swc-visible .swc-bar-more");
  await press(page, more);
  const menu = page.locator(".swc-menu.swc-visible");
  await expect(menu.locator(".swc-menu-item")).not.toHaveCount(0);
  return menu;
}

/** The chart's settings dialog opened from its menu, at its first tab (General); given */
async function settingsOpen(args: Args): Promise<Locator> {
  const menu = await menuOpen(args);
  await press(args.page, menu.locator(".swc-menu-item", { hasText: "Settings" }));
  const dialog = args.page.locator(".swc-settings");
  await expect(dialog.locator('.swc-settings-tab[aria-selected="true"]')).toHaveText("General");
  return dialog;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  menu: {
    open: (args) => menuOpen(args),
    parts: { menu: "", title: ".swc-menu-title", close: ".swc-menu-close", item: ".swc-menu-item", label: ".swc-menu-item .swc-label" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator(".swc-bar.swc-visible .swc-bar-more") }),
  },
  settings: {
    open: (args) => settingsOpen(args),
    // (Its first panel's, General: the others hidden. The knob is the switch's track; its dot, a ::after, is not read)
    parts: { dialog: "", title: ".swc-settings-title", close: ".swc-settings-close", tab: '.swc-settings-tab[aria-selected="false"]', selected: '.swc-settings-tab[aria-selected="true"]', card: ".swc-settings-panel:not([hidden]) .swc-settings-card", row: ".swc-settings-panel:not([hidden]) .swc-settings-row", name: ".swc-settings-panel:not([hidden]) .swc-settings-name", hint: ".swc-settings-panel:not([hidden]) .swc-settings-hint", field: '.swc-settings-panel:not([hidden]) input[type="text"]', select: ".swc-settings-panel:not([hidden]) select", switch: ".swc-settings-panel:not([hidden]) .swc-settings-switch", knob: ".swc-settings-panel:not([hidden]) .swc-settings-knob", note: ".swc-settings-note", save: ".swc-settings-save", cancel: ".swc-settings-cancel" },
    font: FONT,
    place: () => ({}),
  },
};

recordParts(test, (title, body) => test(title, ({ page, open }) => body({ page, open })), PARTS);

test("a switch in the chart's settings turned on: its rows the same nodes, nothing put back", async ({ page, open }) => {
  const dialog = await settingsOpen({ page, open });
  const stacked = dialog.locator(".swc-settings-row", { hasText: "Stacked" }).locator('input[role="switch"]');
  const kept = await keptThrough(dialog, ".swc-settings-panel:not([hidden]) .swc-settings-row", ".swc-settings-name", () => press(page, stacked), async () => {
    await expect(stacked).toBeChecked();
  });
  test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
  expect(kept).toEqual({ root: "kept", kept: ["Height", "Horizontal", "Legend", "Smooth lines", "Stacked", "Title"], anew: [], blinked: 0 });
});

test("the chart's menu one menu to assistive technology: no menu inside a menu", async ({ page, open }) => {
  const menu = await menuOpen({ page, open });
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-28): the chart's floating box has role=menu (src/core/toolbar.ts) and the shared menu inside it has its own (shared/menu.ts), a menu in a menu; expected one, as Silverware Layout's popup, once the core's menus place it (step 6)");
  expect(await menu.evaluate((box) => (box.getAttribute("role") === "menu" ? 1 : 0) + box.querySelectorAll('[role="menu"]').length)).toBe(1);
});
