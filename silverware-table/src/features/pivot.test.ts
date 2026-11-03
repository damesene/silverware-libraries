// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { insertRowWith } from "../core/structure.ts";
import { setCell } from "../ops.ts";
import { cell, cellMenuItem, clickOn, controller, editor, flashes, flush, key, setup, tableMenuItem, text, useTablePage } from "../testing/page.ts";

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

  it("is changed by its source only: no cell of its body edited, no row added, its menus offering neither", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
    const page = text;
    // The editor does not open on a body cell, and says why
    clickOn(second(1, 1));
    expect(editor.querySelector(".swt-cell-editor")).toBeNull();
    expect(flashes.at(-1)).toContain("is a pivot of orders");
    // An edit that would change one (a paste, a key, a feature's) is not written, nor a row added
    const info = controller.shownTables()[1]!;
    expect(await controller.writeTable(info, (t) => setCell(t, 1, 1, "999"))).toBe("failed");
    expect(await insertRowWith(controller, info, 2, 0)).toBe("failed");
    expect(text).toBe(page);
    // Its cell menu: copied, not cut, pasted or cleared
    const menuOf = (label: RegExp) => cellMenuItem(second(1, 1), label);
    expect(menuOf(/^Copy$/)).toBeDefined();
    expect(menuOf(/^Cut$/)).toBeUndefined();
    expect(menuOf(/^Paste$/)).toBeUndefined();
    expect(menuOf(/^Clear/)).toBeUndefined();
    // Its source's cells as any table's
    expect(cellMenuItem(cell(1, 1), /^Cut$/)).toBeDefined();
  });

  it("on a sheet, grown by an edit of its source, moves the table under it as a table grown by hand does", async () => {
    const onSheet = PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |").replace("pivot.source=", "sheet.name='S' sheet.at='A1' pivot.source=");
    const under = "| Note |\n|---|\n| x |\n| <meta core.table sheet.name='S' sheet.at='A6'> |";
    await setup(`${ORDERS}\n\n${onSheet}\n\n${under}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    clickOn(cell(1, 0));
    await type("North");
    // A row more (North): the table under it one row lower
    expect(text).toContain("| North | 100 |");
    expect(text).toContain("sheet.at='A7'");
  });

  it("follows its source's columns renamed, its definition written with them in the same edit", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |").replace("pivot.values='SUM([revenue])'", "pivot.values='SUM([revenue])' pivot.sort='SUM([revenue]) desc'")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    clickOn(cell(0, 0));
    await type("Area");
    clickOn(cell(0, 1));
    await type("Sales");
    // (Written by the columns' keys, as formulas write them)
    expect(text).toContain("pivot.rows='area' pivot.values='SUM([sales])' pivot.sort='SUM([sales]) desc'");
    // Calculated as before, its headers named by the source's columns now
    expect(text).toContain("| Area | Sum of Sales |\n|---|--:|\n| East | 120 |\n| West | 50 |\n| Total | 170 |");
  });

  it("keeps a header the user named as its source's column is renamed", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    clickOn(second(0, 1));
    await type("Money");
    clickOn(cell(0, 1));
    await type("Sales");
    expect(text).toContain("| Region | Money |");
    expect(text).toContain(`pivot.headers='{"value:SUM([sales])":"Money"}'`);
  });

  describe("its dialog", () => {
    const dialog = () => document.querySelector<HTMLElement>(".swt-pivot-dialog")!;
    const previewCells = () => Array.from(dialog().querySelectorAll(".swt-pivot-table tr"), (tr) => Array.from(tr.children, (c) => c.textContent));
    const pick = (label: string, value: string) => {
      const s = dialog().querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
      s.value = value;
      s.dispatchEvent(new Event("change", { bubbles: true }));
    };

    it("makes a pivot of a table, its preview as the fields are picked, inserted under it", async () => {
      await setup(`${ORDERS}\n\nEnd.\n`, { "silverware.table.metadata": true });
      tableMenuItem(/^Insert pivot table…$/)!.click();
      // Its text column by its numbers' sum, to start with
      expect(previewCells()).toEqual([
        ["Region", "Sum of Revenue"],
        ["East", "120"],
        ["West", "50"],
        ["Total", "170"],
      ]);
      pick("Value 1 function", "AVERAGE");
      expect(previewCells()[1]).toEqual(["East", "60"]);
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("| Region | Average of Revenue |\n|---|---:|\n| East | 60 |\n| West | 50 |\n| Total | 56.666666666667 |\n| <meta core.table pivot.source='orders' pivot.rows='Region' pivot.values='AVERAGE([Revenue])'> |\n\nEnd.");
    });

    it("names a table without a name in the same edit, as a pivot names its source", async () => {
      await setup(`${ORDERS.replace("| <meta core.table core.name='orders'> |", "")}\nEnd.\n`, { "silverware.table.metadata": true });
      tableMenuItem(/^Insert pivot table…$/)!.click();
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("<meta core.table core.name='table1'>");
      expect(text).toContain("pivot.source='table1'");
    });

    it("shows a pivot's definition, saved into it with its values calculated anew", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      tableMenuItem(/^Pivot settings…$/, 1)!.click();
      expect((dialog().querySelector<HTMLSelectElement>('select[aria-label="Value 1 function"]')!).value).toBe("SUM");
      pick("Value 1 function", "MAX");
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.values='MAX([revenue])'");
      expect(text).toContain("| East | 100 |");
    });
  });

  it("follows its source's new name", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[0]!;
    await controller.writeTable(info, (t) => controller.withTableName(t, "sales"));
    await controller.scan();
    expect(text).toContain("pivot.source='sales'");
  });
});
