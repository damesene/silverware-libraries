import { charts, expect, savedText, test } from "./helpers.ts";

const SALES = `| Month | Revenue | Cost |
|---|--:|--:|
| Oct | 120 | 80 |
| Nov | 140 | 85 |
| <meta core.table core.name='sales'> |
`;

test("draws Mermaid charts with Chart.js, and leaves other diagrams alone", async ({ page, open }) => {
  await open(`# Charts

\`\`\`mermaid
xychart-beta
  x-axis ["a", "b"]
  bar "one" [1, 2]
  line "two" [3, 4]
\`\`\`

\`\`\`mermaid
pie title Pets
  "Dogs" : 3
  "Cats" : 1
%% chart.type: doughnut
\`\`\`

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`);
  await expect.poll(() => charts(page)).toEqual([
    { type: "bar", labels: ["a", "b"], data: [[1, 2], [3, 4]] },
    { type: "doughnut", labels: ["Dogs", "Cats"], data: [[3, 1]] },
  ]);
  // No Mermaid library in the tests' space: the flowchart shows as code (below the charts, scrolled into the editor's view)
  await page.locator(".cm-scroller").evaluate((scroller) => scroller.scrollTo(0, scroller.scrollHeight));
  await expect(page.locator(".swc-code")).toContainText("flowchart LR");
});

test("says why it cannot draw a chart", async ({ page, open }) => {
  await open('# Chart\n\n```mermaid\npie\n  "a" : 1\n%% chart.type: sunburst\n```\n');
  await expect(page.locator(".swc-problem")).toHaveText('Silverware Chart: no chart type "sunburst"');
});

const block = (source: string, values: string) => `\`\`\`mermaid
xychart-beta
  x-axis ["Oct", "Nov"]
  bar "revenue" [${values}]
%% chart.source: ${source}
%% chart.x: month
%% chart.series: revenue
\`\`\``;

test("draws a named table and the table above, follows them and writes their numbers with a cell's edit", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\n${block("sales", "120, 140")}\n\n${block("above", "120, 140")}\n`);
  await expect.poll(() => charts(page)).toEqual([
    { type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] },
    { type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] },
  ]);
  await expect(page.locator(".swc-stale")).toHaveCount(0);
  // Edit mode (a click edits the cell), as the table's tests set it
  await page.evaluate(() => localStorage.setItem("silverware.table.editMode", "on"));
  await page.reload();
  await expect.poll(() => charts(page)).toHaveLength(2);
  // (The first row: Enter on the last one adds a row)
  await page.locator(".sb-table-widget td", { hasText: /^120$/ }).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("300");
  await page.keyboard.press("Enter");
  await expect.poll(() => charts(page)).toEqual([
    { type: "bar", labels: ["Oct", "Nov"], data: [[300, 140]] },
    { type: "bar", labels: ["Oct", "Nov"], data: [[300, 140]] },
  ]);
  // Both blocks written in the table's edit (Silverware Table's onWrite)
  await expect.poll(() => savedText(page)).toContain(`${block("sales", "300, 140")}\n\n${block("above", "300, 140")}`);
});

test("says a block's numbers are behind its table, and writes them on request", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\n${block("#Sales", "1, 2")}\n`);
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] }]);
  await page.locator(".swc-stale").click();
  await expect.poll(() => savedText(page)).toContain(block("#Sales", "120, 140"));
  await expect(page.locator(".swc-stale")).toHaveCount(0);
});

test("follows a column renamed with Silverware Table", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\n${block("sales", "120, 140")}\n`);
  await expect.poll(() => charts(page)).toHaveLength(1);
  await page.evaluate(() => localStorage.setItem("silverware.table.editMode", "on"));
  await page.reload();
  await expect.poll(() => charts(page)).toHaveLength(1);
  // The header renamed in its cell
  await page.locator(".sb-table-widget tr").first().locator("td, th").nth(1).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Income");
  await page.keyboard.press("Enter");
  await expect.poll(() => savedText(page)).toContain("%% chart.series: Income");
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] }]);
});

test("offers the table's columns where a reference finds none, one picked written into the block", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\n${block("above", "120, 140").replace("chart.series: revenue", "chart.series: income")}\n`);
  await expect(page.locator(".swc-problem")).toContainText("the table above has no column income");
  await page.locator(".swc-choice", { hasText: "Revenue" }).click();
  await expect.poll(() => savedText(page)).toContain("%% chart.series: Revenue");
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] }]);
});
