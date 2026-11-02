// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cell, clickOn, controller, editor, flush, key, setup, text, useTablePage } from "../testing/page.ts";

const ORDERS = [
  "| Region | Revenue |",
  "|---|--:|",
  "| East | 100 |",
  "| West | 50 |",
  "| East | 20 |",
  "| <meta core.table core.name='orders'> |",
].join("\n");
const PIVOT = (body: string, headers = "") =>
  `| Region | Sum of Revenue |\n|---|--:|\n${body}\n| <meta core.table pivot.source='orders' pivot.rows='region' pivot.values='SUM([revenue])'${headers}> |`;

describe("Pivot tables", () => {
  useTablePage();
  const field = () => editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
  const type = async (value: string) => {
    field().value = value;
    field().dispatchEvent(new Event("input", { bubbles: true }));
    key(field(), "Enter");
    await flush();
    await controller.scan();
  };
  const pivotOf = (page: string) => page.slice(page.indexOf("| Region | Sum"));
  const second = (row: number, column: number) => editor.querySelectorAll("table")[1]!.rows[row]!.cells[column]!;

  it("calculates a pivot of its source anew with each edit of it, in the same edit", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.editor.enterKey": "save" });
    clickOn(cell(2, 1)); // West's revenue
    await type("80");
    expect(pivotOf(text)).toBe(`${PIVOT("| East | 120 |\n| West | 80 |\n| Total | 200 |")}\n`);
  });

  it("is written as its source makes it with Refresh, the user's name of a header kept", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 1 |\n| Total | 1 |")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    const info = controller.shownTables()[1]!;
    await controller.writeTable(info, (t) => t);
    await controller.scan();
    expect(pivotOf(text)).toBe(`${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`);
    // A header renamed: kept by what its column is
    clickOn(second(0, 1));
    await type("Revenue");
    expect(text).toContain("| Region | Revenue |");
    expect(text).toContain(`pivot.headers='{"value:SUM([revenue])":"Revenue"}'`);
    clickOn(cell(2, 1));
    await type("10");
    expect(text).toContain("| Region | Revenue |");
    expect(text).toContain("| Total | 130 |");
  });

  it("follows its source's new name", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[0]!;
    await controller.writeTable(info, (t) => controller.withTableName(t, "sales"));
    await controller.scan();
    expect(text).toContain("pivot.source='sales'");
  });
});
