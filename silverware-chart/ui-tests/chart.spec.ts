import { charts, expect, test } from "./helpers.ts";

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

test("draws a named table and follows it as a cell is edited", async ({ page, open }) => {
  await open(`# Sales

${SALES}
\`\`\`mermaid
xychart-beta
  x-axis ["Oct", "Nov"]
  bar "revenue" [1, 2]
%% chart.source: sales
%% chart.x: month
%% chart.series: revenue
\`\`\`
`);
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] }]);
  // Edit mode (a click edits the cell), as the table's tests set it
  await page.evaluate(() => localStorage.setItem("silverware.table.editMode", "on"));
  await page.reload();
  await expect.poll(() => charts(page)).toHaveLength(1);
  // (The first row: Enter on the last one adds a row)
  await page.locator(".sb-table-widget td", { hasText: /^120$/ }).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("300");
  await page.keyboard.press("Enter");
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[300, 140]] }]);
});
