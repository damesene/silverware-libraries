// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { cell, controller, editor, flush, setup, tableMenuItem, text, useTablePage } from "../testing/page.ts";
import { movedEdge, wholePixels } from "./widths.ts";

describe("wholePixels", () => {
  it("rounds each edge down, so the sum never passes the widths' own", () => {
    expect(wholePixels([100.6, 100.6, 100.6])).toEqual([100, 101, 100]);
    expect(wholePixels([0.4, 0.4, 0.4])).toEqual([0, 0, 1]);
    expect(wholePixels([120, 80])).toEqual([120, 80]);
  });
});

describe("movedEdge", () => {
  const columns = (...widths: number[]) => widths.map((width) => ({ width, min: 40 }));

  it("moves only the edge: the column on one side takes what the nearest on the other gives, the table's width kept", () => {
    expect(movedEdge(columns(100, 100, 100), 0, 30)).toEqual([130, 70, 100]);
    expect(movedEdge(columns(100, 100, 100), 1, -30)).toEqual([100, 70, 130]);
  });

  it("goes on to the next column once the nearest is at its minimum, and stops when none can give", () => {
    expect(movedEdge(columns(100, 100, 100), 0, 100)).toEqual([200, 40, 60]);
    expect(movedEdge(columns(100, 100, 100), 1, -100)).toEqual([60, 40, 200]);
    expect(movedEdge(columns(100, 100, 100), 0, 500)).toEqual([220, 40, 40]);
  });

  it("leaves a column narrower than its minimum as it is", () => {
    expect(movedEdge([{ width: 100, min: 40 }, { width: 30, min: 40 }, { width: 100, min: 40 }], 0, 50)).toEqual([150, 30, 50]);
  });

  it("changes nothing for the last column's edge (the table's)", () => {
    expect(movedEdge(columns(100, 100), 1, 30)).toEqual([100, 100]);
  });
});

describe("Column widths", () => {
  useTablePage();

  const PAGE = "| Name | Qty | Note |\n|---|---|---|\n| Pear | 3 | x |\n| Fig | 2 | y |\n";
  const handle = (column: number) => cell(0, column).querySelector<HTMLElement>(".swt-col-resize");
  // jsdom has no layout: the header cells are `widths` wide when the drag starts
  const measured = (widths: readonly number[]) =>
    widths.forEach((width, column) => Object.defineProperty(cell(0, column), "getBoundingClientRect", { configurable: true, value: () => new DOMRect(0, 0, width, 30) }));
  const drag = (column: number, widths: readonly number[], moves: readonly number[]) => {
    measured(widths);
    handle(column)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 100, detail: 1 }));
    for (const dx of moves) window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 1, clientX: 100 + dx }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 100 + (moves.at(-1) ?? 0), detail: 1 }));
  };
  const cols = () => Array.from(editor.querySelectorAll<HTMLElement>("table > colgroup.swt-fixed-columns > col"), (col) => col.style.width);
  const stored = (name: number, qty: number, note: number) => `<meta core.table widths.-c-name.size='${name}' widths.-c-qty.size='${qty}' widths.-c-note.size='${note}'>`;

  it("lights the handle pressed while it is dragged, the same element as the one pressed, one per column but the last", async () => {
    await setup(PAGE);
    const pressed = handle(0)!;
    measured([120, 100, 100]);
    pressed.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 100, detail: 1 }));
    expect(pressed.isConnected).toBe(true);
    expect(pressed.classList.contains("swt-active")).toBe(true);
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 100, detail: 1 }));
    expect(pressed.isConnected).toBe(true);
    expect(pressed.classList.contains("swt-active")).toBe(false);
    expect(cell(0, 0).querySelectorAll(".swt-col-resize")).toHaveLength(1);
    // The last column's right edge is the table's, which keeps its width
    expect(handle(1)).not.toBeNull();
    expect(handle(2)).toBeNull();
  });

  it("moves the edge between two columns from the widths at the press, the next column giving once one is at its minimum, every width stored", async () => {
    await setup(PAGE, { "silverware.table.metadata": true });
    // Out of the header's line (marked so, the core knows no module's element): in the cell, at its edge
    expect(handle(1)!.parentElement).toBe(cell(0, 1));
    expect(cell(0, 1).querySelector(".swt-head .swt-col-resize")).toBeNull();
    // Left past Qty's minimum (Name gives too), then back: Name has its width again
    drag(1, [100, 100, 100], [-80, 10]);
    await flush();
    expect(text).toBe(`${PAGE}| ${stored(100, 110, 90)} |\n`);
    await controller.scan();
    // Laid out by its columns, each its share of their sum; no cell styled
    expect(cols()).toEqual([`${(100 / 300) * 100}%`, `${(110 / 300) * 100}%`, `${(90 / 300) * 100}%`]);
    expect(editor.querySelector("table")!.style.minWidth).toBe("300px");
    expect(cell(1, 0).style.width).toBe("");
    expect(cell(1, 0).classList.contains("swt-sized")).toBe(false);
  });

  it("shows the widths while dragging, and a press without a move as before", async () => {
    await setup(PAGE);
    measured([100, 100, 100]);
    handle(0)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 100, detail: 1 }));
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 1, clientX: 200 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(cols()).toEqual([`${(200 / 300) * 100}%`, `${(40 / 300) * 100}%`, `${(60 / 300) * 100}%`]);
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 1, clientX: 100 }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 100, detail: 1 }));
    await flush();
    expect(text).toBe(PAGE);
    expect(cols()).toEqual([]);
    expect(editor.querySelector("table")!.style.minWidth).toBe("");
  });

  it("goes back to the automatic width on a double-click, the stored width removed", async () => {
    await setup(`${PAGE}| <meta core.table widths.-c-qty.size='90'> |\n`, { "silverware.table.metadata": true });
    expect(cell(0, 1).style.width).toBe("90px");
    // The second press of a double-click, released where it was pressed
    measured([100, 90, 100]);
    handle(1)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, detail: 2 }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, detail: 2 }));
    await flush();
    expect(text).toBe(PAGE);
    await controller.scan();
    expect(cell(0, 1).style.width).toBe("");
    expect(cell(1, 1).classList.contains("swt-sized")).toBe(false);
  });

  it("reads a sized header's need with its line let go of its width, held again after", async () => {
    await setup(`${PAGE}| <meta core.table widths.-c-qty.size='90'> |\n`, { "silverware.table.metadata": true });
    const head = cell(0, 1).querySelector<HTMLElement>(".swt-head")!;
    const held = head.style.width;
    expect(held).not.toBe("");
    let read: string | undefined;
    Object.defineProperty(head, "offsetWidth", { configurable: true, get: () => ((read = head.style.width), 0) });
    measured([100, 90, 100]);
    handle(1)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 100, detail: 1 }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 100, detail: 1 }));
    expect(read).toBe("");
    expect(head.style.width).toBe(held);
  });

  it("lays a table out by its cells again once a column of it is automatic", async () => {
    await setup(`${PAGE}| ${stored(100, 110, 90)} |\n`, { "silverware.table.metadata": true });
    expect(cols()).toHaveLength(3);
    measured([100, 110, 90]);
    handle(1)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, detail: 2 }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, detail: 2 }));
    await flush();
    expect(text).toBe(`${PAGE}| <meta core.table widths.-c-name.size='100' widths.-c-note.size='90'> |\n`);
    await controller.scan();
    expect(cols()).toEqual([]);
    expect(editor.querySelector("table")!.classList.contains("swt-fixed-columns")).toBe(false);
    expect(cell(1, 0).style.width).toBe("100px");
    expect(cell(1, 1).style.width).toBe("");
  });

  it("drags on a quick second press too (a double-click that moves), and ends a drag released outside the window", async () => {
    await setup(PAGE, { "silverware.table.metadata": true });
    measured([100, 100, 100]);
    handle(0)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 100, detail: 2 }));
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 1, clientX: 150 }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 150, detail: 2 }));
    await flush();
    expect(text).toBe(`${PAGE}| ${stored(150, 50, 100)} |\n`);
    await controller.scan();
    // Released outside the window (no mouseup): the next move, without the button, ends it there
    measured([150, 50, 100]);
    handle(0)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 100, detail: 1 }));
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 1, clientX: 80 }));
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 0, clientX: 300 }));
    await flush();
    expect(text).toBe(`${PAGE}| ${stored(130, 70, 100)} |\n`);
    expect(document.body.classList.contains("swt-resizing")).toBe(false);
  });

  it("saves a cell being edited before a drag", async () => {
    await setup(PAGE, { "silverware.table.metadata": true, "silverware.table.editor.enterKey": "save" });
    localStorage.setItem("silverware.table.editMode", "on");
    cell(1, 0).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    cell(1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    const field = editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
    field.focus();
    field.value = "Plum";
    drag(1, [100, 80, 100], [20]);
    for (let i = 0; i < 5; i++) {
      await flush();
      await controller.scan();
    }
    expect(text).toContain("| Plum | 3 | x |");
    expect(text).toContain(stored(100, 100, 80));
  });

  it("keeps the handle in a header cell being edited (it shows there, quiet, as on hover)", async () => {
    await setup(PAGE);
    localStorage.setItem("silverware.table.editMode", "on");
    cell(0, 0).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    cell(0, 0).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(cell(0, 0).querySelector(".swt-cell-editor")).not.toBeNull();
    expect(handle(0)!.parentElement).toBe(cell(0, 0));
    expect(cell(0, 0).querySelector(".swt-head")).toBeNull();
  });

  it("resets every column's width from the table's menu, right before Remove metadata, the rest of the metadata kept", async () => {
    await setup(`${PAGE}| <meta core.table widths.-c-name.size='180' widths.-c-qty.size='90' core.-c-qty.sort='desc'> |
`, { "silverware.table.metadata": true });
    tableMenuItem(/^Edit markdown$/);
    const labels = Array.from(document.querySelectorAll(".swt-menu .swt-menu-item")).map((e) => e.textContent);
    expect(labels.slice(-3)).toEqual(["Reset column widths", "Remove metadata", "Delete table"]);
    tableMenuItem(/^Reset column widths$/)!.click();
    await flush();
    expect(text).toBe(`${PAGE}| <meta core.table core.-c-qty.sort='desc'> |
`);
    await controller.scan();
    expect(cell(0, 0).style.width).toBe("");
    expect(cell(0, 1).style.width).toBe("");
    // None set: not offered
    expect(tableMenuItem(/^Reset column widths$/)).toBeUndefined();
  });

  it("resets widths held for the view only", async () => {
    await setup(PAGE);
    expect(tableMenuItem(/^Reset column widths$/)).toBeUndefined();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    drag(1, [100, 80, 100], [40]);
    await flush();
    tableMenuItem(/^Reset column widths$/)!.click();
    await flush();
    expect(text).toBe(PAGE);
    expect(cols()).toEqual([]);
    await controller.scan();
    expect(cols()).toEqual([]);
  });

  it("reads no style of columns without a width (between the writes of a view, every read makes the browser compute the table again)", async () => {
    const read = vi.spyOn(window, "getComputedStyle");
    await setup(`${PAGE}| <meta core.table widths.-c-qty.size='90'> |\n`, { "silverware.table.metadata": true });
    const header = editor.querySelector("table")!.rows[0]!;
    const of = (column: number) => read.mock.calls.filter(([element]) => element === header.cells[column]).length;
    expect(of(0)).toBe(0);
    expect(of(1)).toBeGreaterThan(0);
    expect(cell(1, 1).style.width).toBe("90px");
    read.mockRestore();
  });

  it("holds the widths for the view only without the metadata setting", async () => {
    await setup(PAGE);
    drag(1, [100, 80, 100], [40]);
    await flush();
    expect(text).toBe(PAGE);
    expect(cols()).toEqual([`${(100 / 280) * 100}%`, `${(120 / 280) * 100}%`, `${(60 / 280) * 100}%`]);
    // Rendered anew (an edit elsewhere): still so
    await controller.scan();
    expect(cols()).toEqual([`${(100 / 280) * 100}%`, `${(120 / 280) * 100}%`, `${(60 / 280) * 100}%`]);
  });

  it("keeps a press on the edge from selecting or editing the header, and a stored width with its column when it moves", async () => {
    await setup(`| Name | Qty |\n|---|---|\n| Pear | 3 |\n| <meta core.table widths.-c-name.size='90'> |\n`, { "silverware.table.metadata": true });
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, detail: 1 });
    measured([90, 100]);
    handle(0)!.dispatchEvent(down);
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(down.defaultPrevented).toBe(true);
    expect(editor.querySelector(".swt-cell-editor")).toBeNull();
    // The column renamed and moved in one edit (as the column menu would): the width goes with it (metadataAfterEdit)
    const widget = editor.querySelector<HTMLElement>(".sb-table-widget")!;
    await controller.write(widget, (t) => ({ ...t, rows: t.rows.map((r) => ({ ...r, cells: [r.cells[1]!, r.cells[0]!] })) }), {
      columnMap: (c) => (c === 0 ? 1 : 0),
    });
    await controller.scan();
    expect(text).toContain(`<meta core.table widths.-c-name.size='90'>`);
    expect(cell(0, 1).style.width).toBe("90px");
  });
});
