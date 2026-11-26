// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// init page again, which makes a new controller and stops the one before. After it a chart put in is drawn as before,
// once, and a chart drawn before has one toolbar (the old controller's stopped).
import { appendToPage, charts, expect, reloadSpaceLua, test } from "./helpers.ts";

const CHART = '```mermaid\nxychart-beta\n  x-axis ["a", "b"]\n  bar "one" [1, 2]\n```\n';

test("after System: Reload a chart put in is drawn once, the one before kept with one toolbar", async ({ page, open }) => {
  await open(`# Charts\n\n${CHART}`);
  await expect.poll(async () => (await charts(page)).length).toBe(1);
  await reloadSpaceLua(page);
  await appendToPage(page, `\nAgain\n\n${CHART.replace('"one"', '"two"')}`);
  await expect.poll(async () => (await charts(page)).length).toBe(2);
  const canvases = page.locator("#sb-main canvas");
  await expect(canvases).toHaveCount(2);
  await canvases.first().hover();
  await expect(page.locator(".swc-bar.swc-visible")).toHaveCount(1);
});
