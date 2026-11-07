// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { insertRowWith } from "../core/structure.ts";
import { setCell } from "../ops.ts";
import { memorySources } from "../sources.ts";
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

  describe("calculated by the formulas, in their order", () => {
    const SUMS = PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |").replace("<meta core.table", "<meta core.table core.name='sums'");
    const READER = (value: string) => `| West |\n|---|\n| ${value} <meta formulas.f='=XLOOKUP("West", sums![region], sums![sum_of_revenue])'> |`;

    it("writes a table reading a pivot, and a view of it, in the same edit as its source", async () => {
      const view = "| Region |\n|---|\n| East |\n| West |\n| Total |\n| <meta core.table view.formula='=CHOOSECOLS(sums![#Data], 1)'> |";
      await setup(`${ORDERS}\n\n${SUMS}\n\n${READER("50")}\n\n${view}\n`, { "silverware.table.editor.enterKey": "save" });
      clickOn(cell(1, 0)); // East's region
      await type("North");
      expect(text).toContain("| North | 100 |");
      expect(text).toContain(READER("50"));
      clickOn(cell(2, 1)); // West's revenue
      await type("80");
      expect(text).toContain("| West | 80 |\n| Total | 200 |");
      expect(text).toContain(READER("80"));
      expect(text).toContain("| Region |\n|---|\n| East |\n| North |\n| West |\n| Total |");
    });

    it("is calculated from a view of its source, in the same edit", async () => {
      const big = "| Region | Revenue |\n|---|--:|\n| East | 100 |\n| West | 50 |\n| <meta core.table core.name='big' view.formula='=FILTER(orders![#Data], orders![revenue] &gt; 30)'> |";
      const pivot = PIVOT("| East | 100 |\n| West | 50 |\n| Total | 150 |").replace("pivot.source='orders'", "pivot.source='big'");
      await setup(`${ORDERS}\n\n${big}\n\n${pivot}\n`, { "silverware.table.editor.enterKey": "save" });
      clickOn(cell(3, 1)); // the second East's revenue: 20, now in the view
      await type("40");
      expect(text).toContain("| East | 140 |\n| West | 50 |\n| Total | 190 |");
    });

    it("names its source anew as it is renamed, in the same edit", async () => {
      await setup(`${ORDERS}\n\n${SUMS}\n\n${READER("50")}\n`, { "silverware.table.metadata": true });
      await controller.writeTable(controller.shownTables()[0]!, (t) => controller.withTableName(t, "sales"));
      await controller.scan();
      expect(text).toContain("pivot.source='sales'");
      expect(text).toContain("| East | 120 |\n| West | 50 |\n| Total | 170 |");
      expect(text).toContain(READER("50"));
    });

    it("is #CYCLE! where it reads a view of itself: neither is written", async () => {
      const loop = "| Region |\n|---|\n| x |\n| <meta core.table core.name='loop' view.formula='=CHOOSECOLS(sums![#Data], 1)'> |";
      const pivot = SUMS.replace("pivot.source='orders'", "pivot.source='loop'");
      await setup(`${pivot}\n\n${loop}\n`, { "silverware.table.metadata": true });
      const page = text;
      await controller.writeTable(controller.shownTables()[0]!, (t) => t);
      await controller.scan();
      expect(text).toBe(page);
      const info = controller.shownTables()[0]!;
      expect(controller.tableBadges(info).map((b) => b.text)).toContain("Cannot be calculated");
    });

    it("keeps its numbers where it cannot be calculated; a table reading it gets the error", async () => {
      const gone = SUMS.replace("pivot.source='orders'", "pivot.source='gone'");
      await setup(`${gone}\n\n${READER("50")}\n`, { "silverware.table.metadata": true });
      await controller.writeTable(controller.shownTables()[1]!, (t) => t);
      await controller.scan();
      expect(text).toContain("| East | 120 |\n| West | 50 |\n| Total | 170 |");
      expect(text).toContain(`| \\#REF! <meta formulas.f='=XLOOKUP("West", sums![region], sums![sum_of_revenue])'> |`);
    });
  });

  it("writes an error with its # escaped, so it is no hashtag", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 0 |").replace("pivot.values='SUM([revenue])'", "pivot.values='SUM([revenue]) / 0'")}\n`, { "silverware.table.editor.enterKey": "save" });
    clickOn(cell(2, 1)); // West's revenue
    await type("80");
    expect(text).toMatch(/\| East +\| \\#DIV\/0! +\|/);
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
    // The editor does not open on a body cell, and says why: its settings open instead, where what it shows is changed
    clickOn(second(1, 1));
    expect(editor.querySelector(".swt-cell-editor")).toBeNull();
    expect(flashes.at(-1)).toContain("is a pivot of orders");
    const dialog = document.querySelector<HTMLElement>(".swt-pivot-dialog");
    expect(dialog?.querySelector(".swt-dialog-primary")?.textContent).toBe("Save");
    dialog!.querySelector<HTMLButtonElement>(".swt-dialog-button")!.click();
    expect(document.querySelector(".swt-pivot-dialog")).toBeNull();
    // Its header renamed as any table's: no settings
    clickOn(second(0, 1));
    expect(editor.querySelector(".swt-cell-editor")).not.toBeNull();
    expect(document.querySelector(".swt-pivot-dialog")).toBeNull();
    key(editor.querySelector(".swt-cell-editor")!, "Escape");
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

    it("moves values (and groups) up and down: the pivot's columns in that order", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |").replace("pivot.values='SUM([revenue])'", "pivot.values='SUM([revenue]), COUNTA([region])'")}\n`, { "silverware.table.metadata": true });
      pivotSettings();
      const button = (label: string) => dialog().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      // One group: nothing to order; two values: the first up and the last down dimmed
      expect(button("Row 1 move up")).toBeNull();
      expect(button("Value 1 move up")!.disabled).toBe(true);
      expect(button("Value 2 move down")!.disabled).toBe(true);
      button("Value 1 move down")!.click();
      expect(previewCells()[0]).toEqual(["Region", "Count of Region", "Sum of Revenue"]);
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.values='COUNTA([region]), SUM([revenue])'");
      expect(text).toContain("| Region | Count of Region | Sum of Revenue |");
    });

    it("keeps the rows sorted by a value as that value is changed", async () => {
      await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |").replace("pivot.values='SUM([revenue])'", "pivot.values='SUM([revenue])' pivot.sort='SUM([revenue]) desc'")}\n`, { "silverware.table.metadata": true });
      pivotSettings();
      pick("Value 1 shown", "total");
      dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.values='SHARE(SUM([revenue]))' pivot.sort='SHARE(SUM([revenue])) desc'");
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

  describe("Unpin all", () => {
    const page = `${ORDERS.replace("core.name='orders'", "core.name='orders' core.pin-bottom='1'")}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |", " core.pin-bottom='1'")}\n`;

    it("is not in a pivot's ⋯ menu: its pins are its own", async () => {
      await setup(page, { "silverware.table.metadata": true });
      expect(tableMenuItem(/^Unpin all$/, 1)).toBeUndefined();
    });

    it("is in its source's, pinned too", async () => {
      await setup(page, { "silverware.table.metadata": true });
      expect(tableMenuItem(/^Unpin all$/, 0)).toBeDefined();
    });
  });

  it("says what it is: Pivot of its source, another page's with its page, a named pivot's name apart", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |")}\n\n${PIVOT("| East | 1 |").replace("pivot.source='orders'", "pivot.source='[[Orders]]orders' core.name='byregion'")}\n`, { "silverware.table.metadata": true });
    const [source, here, other] = controller.shownTables();
    expect(controller.tableBadges(source!)).toEqual([]);
    expect(controller.tableBadges(here!)[0]!.text).toBe("Pivot of orders");
    expect(controller.tableBadges(other!)[0]!.text).toBe("Pivot of [[Orders]]orders");
  });

  it("says it is out of date, or cannot be calculated, by a badge asking for attention; up to date, only what it is", async () => {
    const current = PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |", " core.pin-bottom='1'");
    const broken = PIVOT("| East | 1 |").replace("pivot.source='orders'", "pivot.source='nowhere'");
    await setup(`${ORDERS}\n\n${current}\n\n${PIVOT("| East | 1 |")}\n\n${broken}\n`, { "silverware.table.metadata": true });
    const [, upToDate, stale, notCalculated] = controller.shownTables();
    expect(controller.tableBadges(upToDate!).map((b) => b.text)).toEqual(["Pivot of orders"]);
    expect(controller.tableBadges(stale!).map((b) => [b.text, b.attention])).toEqual([["Pivot of orders", undefined], ["Out of date", true]]);
    expect(controller.tableBadges(notCalculated!)[1]).toMatchObject({ text: "Cannot be calculated", attention: true });
  });

  it("follows its source's new name", async () => {
    await setup(`${ORDERS}\n\n${PIVOT("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[0]!;
    await controller.writeTable(info, (t) => controller.withTableName(t, "sales"));
    await controller.scan();
    expect(text).toContain("pivot.source='sales'");
  });

  describe("of another page's table", () => {
    const OTHER = (body: string) => PIVOT(body).replace("pivot.source='orders'", "pivot.source='[[Orders]]orders'");
    const refresh = () => {
      cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      return document.querySelector<HTMLElement>('.swt-bar button[aria-label="Refresh pivot"]');
    };
    const shown = async (page: string, pages: Record<string, string>, settings: Record<string, unknown> = {}) => {
      const read: string[] = [];
      await setup(page, { "silverware.table.metadata": true, ...settings }, { readPage: (name) => (read.push(name), pages[name] ?? Promise.reject(new Error(`no page ${name}`))) });
      // (The page read as the pivot shows, then checked)
      await flush();
      return read;
    };

    it("reads that page as it shows, Refresh writing it as calculated, the page read anew for it", async () => {
      const read = await shown(`${OTHER("| East | 1 |")}\n`, { Orders: ORDERS });
      expect(read).toEqual(["Orders"]);
      expect(refresh()?.classList.contains("swt-attention")).toBe(true);
      expect(refresh()?.title).toBe("Refresh pivot: it is out of date (its source on Orders was changed)");
      refresh()!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("| Region | Sum of Revenue |\n|---|--:|\n| East | 120 |\n| West | 50 |\n| Total | 170 |");
      expect(read).toEqual(["Orders", "Orders"]);
      expect(refresh()?.classList.contains("swt-attention")).toBe(false);
    });

    it("is out of date once that page is indexed with changes", async () => {
      const pages = { Orders: ORDERS };
      await shown(`${OTHER("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, pages);
      expect(refresh()?.classList.contains("swt-attention")).toBe(false);
      pages.Orders = ORDERS.replace("| West | 50 |", "| West | 60 |");
      await controller.pageIndexed("Orders");
      expect(refresh()?.classList.contains("swt-attention")).toBe(true);
    });

    it("says why it cannot be calculated: no such page", async () => {
      await shown(`${OTHER("| East | 1 |")}\n`, {});
      expect(refresh()?.title).toBe("This pivot cannot be calculated: no page Orders");
    });

    it("says why it cannot be calculated: no such table there", async () => {
      await shown(`${OTHER("| East | 1 |")}\n`, { Orders: "| A |\n|---|\n| 1 |\n" });
      expect(refresh()?.title).toBe("This pivot cannot be calculated: no table named orders on Orders");
    });

    it("says why it cannot be calculated: pageLinks off", async () => {
      const read = await shown(`${OTHER("| East | 1 |")}\n`, { Orders: ORDERS }, { "silverware.table.modules.pageLinks.enabled": false });
      expect(read).toEqual([]);
      expect(refresh()?.title).toBe("This pivot cannot be calculated: its source is on another page, which the pageLinks module reads: it is off");
    });

    it("is not written by an edit of a table of its source's name on this page", async () => {
      await shown(`${ORDERS}\n\n${OTHER("| East | 1 |")}\n`, { Orders: ORDERS.replace("| East | 100 |", "| East | 900 |") });
      await controller.writeTable(controller.shownTables()[0]!, (t) => setCell(t, 2, 1, "7"));
      await controller.scan();
      expect(text).toContain("| East | 1 |");
    });

    it("keeps its source in its settings, that page's columns to pick, its preview calculated from it", async () => {
      await shown(`${OTHER("| East | 1 |")}\n`, { Orders: ORDERS });
      cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      document.querySelector<HTMLElement>('.swt-bar button[aria-label="Pivot settings…"]')!.click();
      const dialog = document.querySelector<HTMLElement>(".swt-pivot-dialog")!;
      await flush();
      expect(dialog.querySelector<HTMLSelectElement>('select[aria-label="Source"]')!.selectedOptions[0]!.textContent).toBe("Another page…");
      expect(dialog.querySelector<HTMLInputElement>('input[aria-label="Source page"]')!.value).toBe("Orders");
      expect(dialog.querySelector<HTMLSelectElement>('select[aria-label="Source table"]')!.value).toBe("orders");
      expect(dialog.querySelector(".swt-pivot-info")?.textContent).toMatch(/^On another page: the pivot is not written anew/);
      expect(Array.from(dialog.querySelector<HTMLSelectElement>('select[aria-label="Value 1 column"]')!.options, (o) => o.value)).toEqual(["Region", "Revenue"]);
      expect(dialog.querySelectorAll(".swt-pivot-table tr")[1]?.textContent).toBe("East120");
      dialog.querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      await flush();
      await controller.scan();
      expect(text).toContain("pivot.source='[[Orders]]orders'");
      expect(text).toContain("| East | 120 |");
    });

    describe("picked in its dialog", () => {
      const dialog = () => document.querySelector<HTMLElement>(".swt-pivot-dialog")!;
      const pick = (label: string, value: string) => {
        const s = dialog().querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
        s.value = value;
        s.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const anotherPage = () => pick("Source", Array.from(dialog().querySelector<HTMLSelectElement>('select[aria-label="Source"]')!.options).find((o) => o.textContent === "Another page…")!.value);
      const typePage = async (name: string) => {
        const field = dialog().querySelector<HTMLInputElement>('input[aria-label="Source page"]')!;
        field.value = name;
        field.dispatchEvent(new Event("change", { bubbles: true }));
        await flush();
      };
      const previewCells = () => Array.from(dialog().querySelectorAll(".swt-pivot-table tr"), (tr) => Array.from(tr.children, (c) => c.textContent));
      const LOCAL = "| Item | Qty |\n|---|--:|\n| Fig | 3 |\n";

      it("is of the page typed: its first named table, the pivot shown from it, said what such a pivot does not do, inserted so", async () => {
        await shown(`${LOCAL}\nEnd.\n`, { Orders: `| Note |\n|---|\n| x |\n\n${ORDERS}` });
        tableMenuItem(/^Insert pivot table…$/)!.click();
        expect(dialog().querySelector(".swt-pivot-info")).toBeNull();
        anotherPage();
        expect(dialog().querySelector(".swt-pivot-info")).not.toBeNull();
        expect(dialog().querySelector(".swt-pivot-none")?.textContent).toBe("Pick the table summarized");
        expect(dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.disabled).toBe(true);
        await typePage("Orders");
        // The page's named table only (its other has no name)
        expect(Array.from(dialog().querySelector<HTMLSelectElement>('select[aria-label="Source table"]')!.options, (o) => o.value)).toEqual(["orders"]);
        pick("Row 1 column", "Region");
        pick("Value 1 column", "Revenue");
        expect(previewCells()[1]).toEqual(["East", "120"]);
        dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
        await flush();
        await controller.scan();
        expect(text).toContain("pivot.source='[[Orders]]orders' pivot.rows='Region' pivot.values='SUM([Revenue])'");
        expect(text).toContain("| East | 120 |");
      });

      it("says why a page gives no source: none of its tables named, no such page", async () => {
        await shown(`${LOCAL}`, { Notes: "| A |\n|---|\n| 1 |\n" });
        tableMenuItem(/^Insert pivot table…$/)!.click();
        anotherPage();
        await typePage("Notes");
        expect(dialog().querySelector(".swt-pivot-hint:not(.swt-pivot-label *)")?.textContent).toBe("No table of Notes has a name: a pivot names the table it summarizes");
        await typePage("Nowhere");
        expect(dialog().querySelector(".swt-pivot-hint:not(.swt-pivot-label *)")?.textContent).toBe("There is no page Nowhere");
      });

      it("offers the space's other pages as one is typed, and none with pageLinks off", async () => {
        await setup(`${LOCAL}`, { "silverware.table.metadata": true }, { readPage: () => ORDERS, listPages: () => ["Test", "Orders", "Notes"] });
        tableMenuItem(/^Insert pivot table…$/)!.click();
        anotherPage();
        await flush();
        expect(Array.from(dialog().querySelectorAll("#swt-pivot-pages option"), (o) => o.getAttribute("value"))).toEqual(["Orders", "Notes"]);
        dialog().querySelector<HTMLButtonElement>(".swt-dialog-button")!.click();
        await shown(`${LOCAL}`, { Orders: ORDERS }, { "silverware.table.modules.pageLinks.enabled": false });
        tableMenuItem(/^Insert pivot table…$/)!.click();
        anotherPage();
        await typePage("Orders");
        expect(dialog().querySelector(".swt-pivot-hint:not(.swt-pivot-label *)")?.textContent).toBe("Other pages are read by the pageLinks module, which is off");
      });

      it("picks a page's first table again as that page is typed again", async () => {
        await shown(`${LOCAL}`, { Orders: ORDERS, Notes: ORDERS.replace("core.name='orders'", "core.name='notes'") });
        tableMenuItem(/^Insert pivot table…$/)!.click();
        anotherPage();
        await typePage("Orders");
        await typePage("Notes");
        await typePage("Orders");
        expect(dialog().querySelector<HTMLSelectElement>('select[aria-label="Source table"]')!.value).toBe("orders");
        expect(dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.disabled).toBe(false);
      });

      it("reads the page it is moved to anew as its settings are saved", async () => {
        const pages: Record<string, string> = { Orders: ORDERS, Sales: ORDERS.replace("core.name='orders'", "core.name='sales'") };
        await shown(`${OTHER("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, pages);
        cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
        document.querySelector<HTMLElement>('.swt-bar button[aria-label="Pivot settings…"]')!.click();
        await flush();
        await typePage("Sales");
        // Changed after the dialog read it
        pages.Sales = pages.Sales!.replace("| East | 100 |", "| East | 900 |");
        dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
        await flush();
        await controller.scan();
        expect(text).toContain("pivot.source='[[Sales]]sales'");
        expect(text).toContain("| East | 920 |");
      });

      it("goes back to a table of this page", async () => {
        await shown(`${ORDERS}\n\n${OTHER("| East | 120 |\n| West | 50 |\n| Total | 170 |")}\n`, { Orders: ORDERS });
        second(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
        document.querySelector<HTMLElement>('.swt-bar button[aria-label="Pivot settings…"]')!.click();
        pick("Source", "orders");
        expect(dialog().querySelector('input[aria-label="Source page"]')).toBeNull();
        dialog().querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
        await flush();
        await controller.scan();
        expect(text).toContain("pivot.source='orders'");
      });
    });

    it("takes a source naming the page shown as of this page", async () => {
      await shown(`${ORDERS}\n\n${PIVOT("| East | 1 |").replace("pivot.source='orders'", "pivot.source='[[Test]]orders'")}\n`, {});
      await controller.writeTable(controller.shownTables()[0]!, (t) => controller.withTableName(t, "sales"));
      await controller.scan();
      expect(text).toContain("pivot.source='[[Test]]sales'");
      expect(text).toContain("| East | 120 |");
    });
  });

  describe("Insert pivot table, the command (and /pivot)", () => {
    const dialog = () => document.querySelector<HTMLElement>(".swt-pivot-dialog");
    // The cursor where the editor has it, as it is asked (moved meanwhile: cursorAt)
    let cursorAt = 0;
    const run = async (page: string, cursor: number, settings: Record<string, unknown> = {}) => {
      cursorAt = cursor;
      await setup(page, { "silverware.table.metadata": true, ...settings }, { getCursor: () => cursorAt, readPage: () => ORDERS });
      const command = (await controller.commands()).find((c) => c.name === "Silverware Table: Insert pivot table");
      await command?.run();
      return command;
    };
    const insert = async () => {
      dialog()!.querySelector<HTMLButtonElement>(".swt-dialog-primary")!.click();
      // (The cursor asked, then the table written)
      await flush();
      await flush();
    };
    const PIVOTED = "| Region | Sum of Revenue |\n|---|---:|\n| East | 120 |\n| West | 50 |\n| Total | 170 |\n| <meta core.table pivot.source='orders' pivot.rows='Region' pivot.values='SUM([Revenue])' core.pin-bottom='1'> |";

    it("is a command of the module, its slash command /pivot", async () => {
      const command = await run(`${ORDERS}\n`, 0);
      expect(command).toMatchObject({ name: "Silverware Table: Insert pivot table", slash: "pivot" });
      expect(dialog()).not.toBeNull();
    });

    it("is no command with the pivot module off", async () => {
      expect(await run(`${ORDERS}\n`, 0, { "silverware.table.modules.pivot.enabled": false })).toBeUndefined();
    });

    it("makes a pivot of the page's first named table, inserted after the cursor's line, an empty line around it", async () => {
      const page = `Intro.\n\n${ORDERS}\n\nFirst line.\nSecond line.\n`;
      await run(page, page.indexOf("First") + 2);
      await insert();
      expect(text).toBe(`Intro.\n\n${ORDERS}\n\nFirst line.\n\n${PIVOTED}\n\nSecond line.\n`);
    });

    it("goes on the cursor's empty line (what /pivot leaves), after the table the cursor is in", async () => {
      const empty = `${ORDERS}\n\nText.\n\n\nMore.\n`;
      await run(empty, empty.indexOf("Text.") + 7);
      await insert();
      expect(text).toBe(`${ORDERS}\n\nText.\n\n${PIVOTED}\n\nMore.\n`);
      const inTable = `${ORDERS}\n\nText.\n`;
      await run(inTable, 5);
      await insert();
      expect(text).toBe(`${ORDERS}\n\n${PIVOTED}\n\nText.\n`);
    });

    it("goes where the cursor is as it is inserted (the text before it edited meanwhile)", async () => {
      const page = `${ORDERS}\n\nFirst line.\nSecond line.\n`;
      await run(page, page.indexOf("First"));
      setText(`Added.\n\n${page}`);
      cursorAt = text.indexOf("First");
      await insert();
      expect(text).toBe(`Added.\n\n${ORDERS}\n\nFirst line.\n\n${PIVOTED}\n\nSecond line.\n`);
    });

    it("with the formulas module off: its dialog says so first and inserts nothing; the ⋯ menu offers it as well", async () => {
      await run(`${ORDERS}\n`, 0, { "silverware.table.modules.formulas.enabled": false });
      expect(dialog()!.querySelector(".swt-pivot-warning")?.textContent).toMatch(/^A pivot is calculated by the formulas module, which is off/);
      expect(dialog()!.querySelector<HTMLButtonElement>(".swt-dialog-primary")!.disabled).toBe(true);
      dialog()!.querySelector<HTMLButtonElement>(".swt-dialog-button")!.click();
      tableMenuItem(/^Insert pivot table…$/)!.click();
      expect(dialog()!.querySelector(".swt-pivot-warning")).not.toBeNull();
    });

    it("on a page with no named table: of another page's, picked as in the dialog", async () => {
      await run("Text.\n", 5);
      expect(dialog()!.querySelector('input[aria-label="Source page"]')).not.toBeNull();
      expect(dialog()!.querySelector<HTMLButtonElement>(".swt-dialog-primary")!.disabled).toBe(true);
    });
  });

  describe("of a source of the space", () => {
    const TASKS = { columns: ["owner", "hours"], rows: [["anna", "3"], ["petr", "1"], ["anna", "2"]] };
    const SPACE = (body: string) =>
      `| owner | Sum of hours |\n|---|--:|\n${body}\n| <meta core.table pivot.source='@tasks' pivot.rows='owner' pivot.values='SUM([hours])'> |`;
    const refresh = () => {
      cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      return document.querySelector<HTMLElement>('.swt-bar button[aria-label="Refresh pivot"]')!;
    };

    it("is calculated from it; out of date as it changes, Refresh writing it anew", async () => {
      const sources = memorySources({ tasks: TASKS });
      await setup(`${SPACE("| anna | 5 |\n| petr | 1 |\n| Total | 6 |")}\n`, {}, {}, sources);
      expect(refresh().classList.contains("swt-attention")).toBe(false);
      expect(controller.tableBadges(controller.shownTables()[0]!)[0]!.text).toBe("Pivot of @tasks");
      sources.set("tasks", { ...TASKS, rows: [...TASKS.rows, ["petr", "4"]] });
      expect(refresh().classList.contains("swt-attention")).toBe(true);
      refresh().click();
      await flush();
      expect(text).toBe(`${SPACE("| anna | 5 |\n| petr | 5 |\n| Total | 10 |")}\n`);
    });

    it("keeps its numbers while the source is not read, or its module is off", async () => {
      const page = `${SPACE("| anna | 5 |\n| Total | 5 |")}\n`;
      await setup(page, { "silverware.table.modules.sources.enabled": false }, {}, memorySources({ tasks: TASKS }));
      expect(refresh().classList.contains("swt-attention")).toBe(false);
      refresh().click();
      await flush();
      expect(text).toBe(page);
    });

    it("says there is no such source", async () => {
      await setup(`${SPACE("| anna | 5 |")}\n`, {}, {}, memorySources({}));
      expect(refresh().title).toBe("This pivot cannot be calculated: no source named tasks in the space");
    });

    it("offers the space's sources in its dialog, its columns to pick", async () => {
      await setup(`${SPACE("| anna | 5 |\n| petr | 1 |\n| Total | 6 |")}\n`, {}, {}, memorySources({ tasks: TASKS }));
      cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      document.querySelector<HTMLElement>('.swt-bar button[aria-label="Pivot settings…"]')!.click();
      const dialog = document.querySelector<HTMLElement>(".swt-pivot-dialog")!;
      const source = dialog.querySelector<HTMLSelectElement>('select[aria-label="Source"]')!;
      expect(source.value).toBe("@tasks");
      expect(source.querySelector('optgroup[label="Sources of the space"]')!.textContent).toBe("@tasks");
      expect(dialog.textContent).toContain("anna");
    });
  });
});
