// A chart's block as it is written (docs/silverware-core-work.md, step S, item 4: recorded against today's code before
// its UI is rewritten): a change made on one of two blocks alike written into that one alone (shared/placed.ts, by the
// widget's place), the settings saved with nothing changed writing nothing (a block following a table too), two
// blocks alike following one table both written by a cell's edit.
import { charts, expect, savedText, test } from "./helpers.ts";

const BLOCK = '```mermaid\nxychart-beta\n  x-axis ["a", "b"]\n  bar "one" [1, 2]\n```\n';
const SALES = "| Month | Revenue | Cost |\n|---|--:|--:|\n| Oct | 120 | 80 |\n| Nov | 140 | 85 |\n| <meta core.table core.name='sales'> |\n";
/** A block of the table named sales, its values as written */
const FOLLOWING = (values: string) => `\`\`\`mermaid\nxychart-beta\n  x-axis ["Oct", "Nov"]\n  bar "revenue" [${values}]\n%% chart.source: sales\n%% chart.labels: month\n%% chart.series: revenue\n\`\`\`\n`;

/** A chart's menu opened from its toolbar (`index`: which chart) */
async function chartMenu(page: import("@playwright/test").Page, index: number): Promise<void> {
  await page.locator(".swc-chart").nth(index).hover({ position: { x: 200, y: 100 } });
  await page.locator(".swc-bar.swc-visible .swc-bar-more").click();
}

test("of two blocks alike, the type picked on the second is written into the second alone", async ({ page, open }) => {
  const text = `# Twins\n\n${BLOCK}\nBetween\n\n${BLOCK}\nAfter\n`;
  await open(text);
  await expect.poll(() => charts(page)).toHaveLength(2);
  await chartMenu(page, 1);
  await page.locator(".swc-menu-item", { hasText: "Type" }).click();
  await page.locator(".swc-menu-tile", { hasText: /^Line/ }).click();
  await expect.poll(() => savedText(page)).toBe(`# Twins\n\n${BLOCK}\nBetween\n\n${BLOCK.replace('  bar "one"', '  line "one"')}\nAfter\n`);
  await expect.poll(async () => (await charts(page)).map((one) => one.type)).toEqual(["bar", "line"]);
});

test("the settings saved with nothing changed write nothing, a change after them written alone", async ({ page, open }) => {
  const text = `# Sales\n\n${BLOCK}\nAfter\n`;
  await open(text);
  await expect.poll(() => charts(page)).toHaveLength(1);
  await chartMenu(page, 0);
  await page.locator(".swc-menu-item", { hasText: "Settings" }).click();
  const dialog = page.locator(".swc-settings");
  await expect(dialog).toBeVisible();
  await dialog.locator(".swc-settings-save").click();
  await expect(dialog).toHaveCount(0);
  // (Then a change that is written for sure: its page holds that change alone, so whatever the save wrote, even late,
  // would be in it too)
  await chartMenu(page, 0);
  await page.locator(".swc-menu-item", { hasText: "Type" }).click();
  await page.locator(".swc-menu-tile", { hasText: /^Line/ }).click();
  await expect.poll(() => savedText(page)).toBe(text.replace('  bar "one"', '  line "one"'));
});

test("a block following a table, its settings saved unchanged: nothing written, its data as they were", async ({ page, open }) => {
  const text = `# Sales\n\n${SALES}\n${FOLLOWING("120, 140")}\nAfter\n`;
  await open(text);
  await expect.poll(() => charts(page)).toHaveLength(1);
  await chartMenu(page, 0);
  await page.locator(".swc-menu-item", { hasText: "Settings" }).click();
  const dialog = page.locator(".swc-settings");
  await expect(dialog).toBeVisible();
  await dialog.locator(".swc-settings-save").click();
  await expect(dialog).toHaveCount(0);
  // (Then a change written for sure, alone in the page with it)
  await chartMenu(page, 0);
  await page.locator(".swc-menu-item", { hasText: "Type" }).click();
  await page.locator(".swc-menu-tile", { hasText: /^Line/ }).click();
  await expect.poll(() => savedText(page)).toBe(text.replace('  bar "revenue"', '  line "revenue"'));
});

test("two blocks alike following one table: a cell's edit writes its numbers into both", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\n${FOLLOWING("120, 140")}\nBetween\n\n${FOLLOWING("120, 140")}\nAfter\n`);
  await expect.poll(() => charts(page)).toHaveLength(2);
  // Edit mode (a click edits the cell), as the table's tests set it
  await page.evaluate(() => localStorage.setItem("silverware.table.editMode", "on"));
  await page.reload();
  await expect.poll(() => charts(page)).toHaveLength(2);
  await page.locator(".sb-table-widget td", { hasText: /^120$/ }).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("300");
  await page.keyboard.press("Enter");
  // (The table written by Silverware Table: its columns padded to the header's widths, numbers to the right)
  const edited = "| Month | Revenue | Cost |\n| ----- | ------: | ---: |\n| Oct   |     300 |   80 |\n| Nov   |     140 |   85 |\n| <meta core.table core.name='sales'> |\n";
  await expect.poll(() => savedText(page)).toBe(`# Sales\n\n${edited}\n${FOLLOWING("300, 140")}\nBetween\n\n${FOLLOWING("300, 140")}\nAfter\n`);
});
