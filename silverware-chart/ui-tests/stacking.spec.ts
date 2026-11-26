// What Silverware Chart lays over its chart (docs/silverware-core-work.md, step S, item 3): its toolbar, its menu, its
// settings dialog, each on top whole (what the document has at its middle and corners, not visibility alone), Esc
// closing the top one alone.
import { charts, expect, ON_TOP, onTopAt, test } from "./helpers.ts";

const CHART = '# Sales\n\n```mermaid\nxychart-beta\n  x-axis ["a", "b"]\n  bar "one" [1, 2]\n```\n\nAfter\n';

test("a chart's toolbar, its menu and its settings dialog each on top whole; Esc closes the menu alone, the dialog alone", async ({ page, open }) => {
  await open(CHART);
  await expect.poll(async () => (await charts(page)).length).toBe(1);
  await page.locator(".swc-chart").first().hover({ position: { x: 200, y: 100 } });
  const bar = page.locator(".swc-bar.swc-visible");
  await expect(bar).toBeVisible();
  expect(await onTopAt(bar)).toEqual(ON_TOP);
  await bar.locator(".swc-bar-more").click();
  const menu = page.locator(".swc-menu").filter({ has: page.locator(".swc-menu-item") });
  await expect(menu).toBeVisible();
  expect(await onTopAt(menu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  // (Its toolbar still over the chart: the menu's Esc its own)
  await expect(bar).toBeVisible();
  // The settings dialog from the menu: on top, Esc closing it alone
  await page.locator(".swc-chart").first().hover({ position: { x: 200, y: 100 } });
  await page.locator(".swc-bar.swc-visible .swc-bar-more").click();
  await page.locator(".swc-menu-item", { hasText: "Settings" }).click();
  const dialog = page.locator(".swc-settings");
  await expect(dialog).toBeVisible();
  expect(await onTopAt(dialog)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // (The chart drawn, its block's markdown not shown)
  await expect(page.locator(".swc-chart")).toHaveCount(1);
  expect(await charts(page)).toHaveLength(1);
});
