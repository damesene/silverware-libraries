// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { insertRowWith } from "../core/structure.ts";
import { setCell } from "../ops.ts";
import { cell, cellMenuItem, clickOn, controller, cursorMoves, editor, flashes, flush, key, renderPage, setText, setup, tableMenuItem, text, useTablePage } from "../testing/page.ts";

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
  // Pivot settings…, an icon of the pivot's toolbar
  const pivotSettings = () => {
    second(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    document.querySelector<HTMLElement>('.swt-bar button[aria-label="Pivot settings…"]')!.click();
  };

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
    // Its total row pinned to the bottom
    expect(pivotOf(text)).toBe(`${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |", " core.pin-bottom='1'")}\n`);
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

  it("on a sheet under its source, both grown by one edit: the table under them moved by both", async () => {
    const source = ORDERS.replace("core.name='orders'", "core.name='orders' sheet.name='S' sheet.at='A1'");
    const pivot = PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |").replace("pivot.source=", "sheet.name='S' sheet.at='A6' pivot.source=");
    const under = "| Note |\n|---|\n| x |\n| <meta core.table sheet.name='S' sheet.at='A11'> |";
    await setup(`${source}\n\n${pivot}\n\n${under}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[0]!;
    await controller.writeTable(info, (t) => ({ ...t, rows: [...t.rows, { cells: ["North", "5"] }] }));
    await controller.scan();
    // The source a row longer: the pivot one lower; the pivot a row longer (North): the note two lower
    expect(text).toContain("sheet.at='A7' pivot.source=");
    expect(text).toContain("| North | 5 |");
    expect(text).toContain("sheet.at='A13'");
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

  it("follows its source's column renamed in a value shown as a share", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 0.8571 |\n| West | 0.1429 |\n| Total | 1 |").replace("pivot.values='SUM([revenue])'", "pivot.values='SHARE(SUM([revenue]))'")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    clickOn(cell(0, 1));
    await type("Sales");
    expect(text).toContain("pivot.values='SHARE(SUM([sales]))'");
    expect(text).toContain("| Region | Sum of Sales (% of total) #percent-1 |");
    expect(text).toContain("| East | 0.7059 |\n| West | 0.2941 |\n| Total | 1 |");
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
      expect(text).toContain("| Region | Average of Revenue |\n|---|---:|\n| East | 60 |\n| West | 50 |\n| Total | 56.666666666667 |\n| <meta core.table pivot.source='orders' pivot.rows='Region' pivot.values='AVERAGE([Revenue])' core.pin-bottom='1'> |\n\nEnd.");
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

    it("shows a value as its share of the total, offering a row's and a column's only with columns grouped", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      pivotSettings();
      const shown = () => Array.from(dialog().querySelector<HTMLSelectElement>('select[aria-label="Value 1 shown"]')!.options, (o) => o.value);
      expect(shown()).toEqual(["", "total"]);
      pick("Value 1 shown", "total");
      expect(previewCells()).toEqual([
        ["Region", "Sum of Revenue (% of total) #percent-1"],
        ["East", "0.7059"],
        ["West", "0.2941"],
        ["Total", "1"],
      ]);
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.values='SHARE(SUM([revenue]))'");
      expect(text).toContain("| East | 0.7059 |");
    });

    it("shows a pivot's definition, saved into it with its values calculated anew", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      pivotSettings();
      expect((dialog().querySelector<HTMLSelectElement>('select[aria-label="Value 1 function"]')!).value).toBe("SUM");
      pick("Value 1 function", "MAX");
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.values='MAX([revenue])'");
      expect(text).toContain("| East | 100 |");
    });
  });

  describe("as reviewed", () => {
    const dialog = () => document.querySelector<HTMLElement>(".swt-pivot-dialog")!;
    const refresh = () => {
      second(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      return document.querySelector<HTMLElement>('.swt-bar button[aria-label="Refresh pivot"]');
    };

    it("keeps every key of a group's formula typed in its dialog", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      pivotSettings();
      dialog().querySelector<HTMLButtonElement>(".swt-pivot-formula")!.click();
      const field = dialog().querySelector<HTMLInputElement>('input[aria-label="Row 1 formula"]')!;
      for (const typed of ["L", "LO", "LOWER([@region])"]) {
        field.value = typed;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.rows='LOWER([@region])'");
      expect(text).toContain("| east | 120 |");
    });

    it("opens its settings where its definition has a problem, to fix it", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 1 |").replace("pivot.values='SUM([revenue])'", "pivot.values=''")}\n`, { "silverware.table.metadata": true });
      pivotSettings();
      expect(dialog()).not.toBeNull();
    });

    it("is out of date once its source is shown anew as edited by hand", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      expect(refresh()?.classList.contains("swt-attention")).toBe(false);
      const edited = text.replace("| West | 50 |", "| West | 51 |");
      setText(edited);
      renderPage(edited, editor, cursorMoves);
      await controller.scan();
      expect(refresh()?.classList.contains("swt-attention")).toBe(true);
    });

    it("is not calculated from a second table of its source's name", async () => {
      const copy = ORDERS.replace("| East | 100 |", "| East | 9 |");
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n\n${copy}\n`, { "silverware.table.metadata": true });
      await controller.writeTable(controller.shownTables()[2]!, (t) => setCell(t, 2, 1, "7"));
      await controller.scan();
      expect(text).toContain("| East | 120 |\n| West | 50 |\n| Total | 170 |");
    });

    it("is said to lose its source when that is deleted", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      const questions: string[] = [];
      (controller as unknown as { bridge: Record<string, unknown> }).bridge.confirm = (message: string) => {
        questions.push(message);
        return false;
      };
      tableMenuItem(/^Delete table$/)!.click();
      await flush();
      expect(questions[0]).toContain("A pivot table of it keeps its numbers, calculated no more.");
    });

    it("names the table it is inserted from only where that is its source", async () => {
      const unnamed = ORDERS.replace("| <meta core.table core.name='orders'> |", "");
      await setup(`${unnamed}\n${ORDERS.replace("orders", "prices")}\n`, { "silverware.table.metadata": true });
      tableMenuItem(/^Insert pivot table…$/)!.click();
      const source = dialog().querySelector<HTMLSelectElement>('select[aria-label="Source"]')!;
      source.value = "prices";
      source.dispatchEvent(new Event("change", { bubbles: true }));
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.source='prices'");
      expect(text).not.toContain("core.name='table1'");
    });

    it("shows no Edit mode nor Lazy saving in its toolbar, its source both", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      const icons = (target: Element) => {
        target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
        return Array.from(document.querySelectorAll(".swt-bar button"), (b) => b.getAttribute("aria-label"));
      };
      const pivotIcons = icons(second(1, 0));
      expect(pivotIcons).toContain("Refresh pivot");
      expect(pivotIcons).not.toContain("Edit mode");
      expect(pivotIcons).not.toContain("Lazy saving");
      expect(icons(cell(1, 0))).toEqual(expect.arrayContaining(["Edit mode", "Lazy saving"]));
    });

    it("offers no name for its body's cells and rows, nor pins", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
      second(1, 1).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 10, clientY: 10 }));
      expect(document.querySelector(".swt-menu .swt-menu-rename")).toBeNull();
    });
  });

  it("pins its totals: the row to the bottom, a cross table's total columns to the right", async () => {
    const cross = PIVOT("| East | 0 |").replace("pivot.values=", "pivot.columns='region' pivot.values=");
    await setup(`${ORDERS}\n\n${cross}\n`, { "silverware.table.metadata": true });
    await controller.writeTable(controller.shownTables()[1]!, (t) => t);
    await controller.scan();
    expect(text).toContain("| Region | East | West | Total |");
    expect(text).toContain("core.pin-bottom='1'");
    expect(text).toContain("core.pin-right='1'");
  });

  it("follows its source's new name", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[0]!;
    await controller.writeTable(info, (t) => controller.withTableName(t, "sales"));
    await controller.scan();
    expect(text).toContain("pivot.source='sales'");
  });
});
