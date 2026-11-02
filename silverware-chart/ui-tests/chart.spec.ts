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

/** The chart's ⋯ menu opened (the toolbar shown by hovering the chart) */
async function chartMenu(page: import("@playwright/test").Page, index = 0): Promise<void> {
  const chart = page.locator(".swc-chart").nth(index);
  await chart.hover({ position: { x: 200, y: 100 } });
  await page.locator(".swc-bar.swc-visible .swc-bar-more").click();
}

test("the menu's Type gallery writes the type picked", async ({ page, open }) => {
  await open(`# Sales\n\n${block("above", "120, 140")}\n`.replace("%% chart.source: above\n%% chart.x: month\n%% chart.series: revenue\n", ""));
  await expect.poll(() => charts(page)).toHaveLength(1);
  await chartMenu(page);
  await page.locator(".swc-menu-item", { hasText: "Type" }).click();
  await page.locator(".swc-menu-tile", { hasText: "Stacked bar" }).click();
  await expect.poll(() => savedText(page)).toContain("%% chart.stacked: true");
  await chartMenu(page);
  await page.locator(".swc-menu-item", { hasText: "Type" }).click();
  await expect(page.locator(".swc-menu-tile[aria-checked=true]")).toHaveText("Stacked bar");
  await page.locator(".swc-menu-tile", { hasText: "Doughnut" }).click();
  await expect.poll(() => savedText(page)).toContain("%% chart.type: doughnut");
  await expect.poll(async () => (await charts(page))[0]?.type).toBe("doughnut");
});

test("the menu's Data draws a table of the page, its columns picked", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\n\`\`\`mermaid\nxychart-beta\n  x-axis ["a"]\n  bar [1]\n\`\`\`\n`);
  await expect.poll(() => charts(page)).toHaveLength(1);
  await chartMenu(page);
  await page.locator(".swc-menu-item", { hasText: "Data" }).click();
  await page.locator(".swc-menu-item", { hasText: "Table above" }).click();
  await page.locator(".swc-menu-check", { hasText: "Cost" }).locator("input").check();
  await page.locator(".swc-menu-apply").click();
  await expect.poll(() => savedText(page)).toContain("%% chart.source: above\n%% chart.x: Month\n%% chart.series: Revenue, Cost");
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[120, 140], [80, 85]] }]);
});

test("the menu's Edit source shows the block's markdown", async ({ page, open }) => {
  await open(`# Sales\n\n${block("above", "120, 140")}\n`.replace("%% chart.source: above\n%% chart.x: month\n%% chart.series: revenue\n", ""));
  await expect.poll(() => charts(page)).toHaveLength(1);
  await chartMenu(page);
  await page.locator(".swc-menu-item", { hasText: "Edit source" }).click();
  await expect(page.locator(".swc-chart")).toHaveCount(0);
  await expect(page.locator(".cm-content")).toContainText("xychart-beta");
});

test("Insert chart of the table puts a chart of it under the table", async ({ page, open }) => {
  await open(`# Sales\n\n${SALES}\nAfter.\n`);
  await expect(page.locator(".sb-table-widget")).toBeVisible();
  // The cursor on the line after the table, the command run as SilverBullet's palette runs it (once its Space Lua has defined it)
  const name = "Silverware Chart: Insert chart of the table";
  await page.waitForFunction(
    (name) => {
      const c = (window as unknown as { client?: { ui?: { viewState?: { commands?: Map<string, unknown> } }; clientSystem?: { commandHook?: { buildAllCommands?(): Map<string, unknown> } } } }).client;
      return !!(c?.ui?.viewState?.commands?.has(name) || c?.clientSystem?.commandHook?.buildAllCommands?.().has(name));
    },
    name,
    { timeout: 30_000 },
  );
  await page.evaluate((name) => {
    const client = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(t: unknown): void }; runCommandByName(name: string): Promise<void> } }).client;
    const text = client.editorView.state.doc.toString();
    client.editorView.dispatch({ selection: { anchor: text.indexOf("After.") } });
    void client.runCommandByName(name);
  }, name);
  await expect
    .poll(() => savedText(page))
    .toContain('```mermaid\nxychart-beta\n  x-axis ["Oct", "Nov"]\n  bar "Revenue" [120, 140]\n  bar "Cost" [80, 85]\n%% chart.source: above\n%% chart.x: Month\n%% chart.series: Revenue, Cost\n```');
});

test("SilverBullet's own controls of a chart's block are left out; Reload draws the chart anew", async ({ page, open }) => {
  await open(`# Sales\n\n${block("above", "120, 140")}\n`.replace("%% chart.source: above\n%% chart.x: month\n%% chart.series: revenue\n", ""));
  await expect.poll(() => charts(page)).toHaveLength(1);
  const chart = page.locator(".swc-chart").first();
  await chart.hover({ position: { x: 200, y: 100 } });
  // (SilverBullet's widget menu and the block's Copy button are there, not shown)
  await expect(page.locator(".swc-widget .sb-widget-menu-bar")).toBeHidden();
  await expect(page.locator(".cm-line:has(.swc-widget) .sb-code-copy-button")).toBeHidden();
  await chartMenu(page);
  await page.locator(".swc-menu-item", { hasText: "Reload" }).click();
  await expect.poll(() => charts(page)).toEqual([{ type: "bar", labels: ["Oct", "Nov"], data: [[120, 140]] }]);
});
