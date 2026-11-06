// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { ModelHost } from "../core/feature.ts";
import { cell, clickOn, controller, editor, flush, key, setup, text, useTablePage } from "../testing/page.ts";
import { memorySources, type SourceProvider, type SourcesOffer } from "../sources.ts";
import { Sources, sourceTable } from "./sources.ts";

/** The module on a host that keeps what it offers and counts the tables' checks */
function started<P extends SourceProvider>(provider: P = memorySources({ tasks: { columns: ["name", "due"], rows: [["a | b", "2025-11-06"]] } }) as unknown as P) {
  let offer: SourcesOffer | undefined;
  const tablesChanged = vi.fn();
  const host = { offer: (api: SourcesOffer) => void (offer = api), tablesChanged } as unknown as ModelHost;
  const module = new Sources(host, provider);
  module.start();
  return { offer: offer!, tablesChanged, module, provider };
}

describe("sourceTable", () => {
  it("makes a source's data a table: its columns the header, each value a cell's text", () => {
    const table = sourceTable({ columns: ["name"], rows: [["a | b"], []] });
    expect(table.rows.map((r) => r.cells)).toEqual([["name"], ["a \\| b"], [""]]);
  });
});

describe("the sources module", () => {
  it("offers a source as a table, the same object while its data are the same", () => {
    const { offer } = started();
    const table = offer.table("Tasks");
    expect(table?.rows[1]?.cells).toEqual(["a \\| b", "2025-11-06"]);
    expect(offer.table("tasks")).toBe(table);
    expect(offer.names()).toEqual(["tasks"]);
  });

  it("tells no such source (null) from one not read yet (undefined)", () => {
    const provider = { names: () => ["tasks"], read: () => undefined, changed: () => () => {} };
    const { offer } = started(provider);
    expect(offer.table("tasks")).toBeUndefined();
    expect(offer.table("people")).toBeNull();
  });

  it("has the tables checked again as a source changes, and counts the changes", () => {
    const { offer, tablesChanged, provider, module } = started(memorySources({ tasks: { columns: ["name"], rows: [] } }));
    const version = offer.version();
    provider.set("people", { columns: ["value"], rows: [["anna"]] });
    expect(tablesChanged).toHaveBeenCalledTimes(1);
    expect(offer.version()).toBe(version + 1);
    module.stop();
    provider.set("people", undefined);
    expect(tablesChanged).toHaveBeenCalledTimes(1);
  });
});

describe("sources in a page's formulas", () => {
  useTablePage();

  const TASKS = { columns: ["name", "done"], rows: [["Write", "TRUE"], ["Test", "FALSE"]] };
  const recalc = () => {
    cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    return document.querySelector<HTMLElement>('.swt-bar button[aria-label="Recalculate"]')!;
  };

  it("writes a formula reading a source; a source changed highlights Recalculate, which writes it anew", async () => {
    const sources = memorySources({ tasks: TASKS });
    await setup("| Open |\n|---|\n| x |\n", { "silverware.table.metadata": true, "silverware.table.editor.enterKey": "save" }, {}, sources);
    clickOn(cell(1, 0));
    const field = editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
    field.value = '=COUNTIFS(@tasks[done], "FALSE")';
    field.dispatchEvent(new Event("input", { bubbles: true }));
    key(field, "Enter");
    await flush();
    await controller.scan();
    expect(text).toBe(`| Open |\n|---|\n| 1 <meta formulas.f='=COUNTIFS(@tasks[done], "FALSE")'> |\n`);
    expect(recalc().classList.contains("swt-attention")).toBe(false);
    sources.set("tasks", { ...TASKS, rows: [...TASKS.rows, ["Ship", "FALSE"]] });
    expect(recalc().classList.contains("swt-attention")).toBe(true);
    // Viewing writes nothing
    expect(text).toContain("| 1 <meta");
    recalc().click();
    await flush();
    expect(text).toContain("| 2 <meta");
  });

  it("keeps the results written with the module off", async () => {
    const page = "| Open |\n|---|\n| 7 <meta formulas.f='=COUNTA(@tasks[name])'> |\n";
    await setup(page, { "silverware.table.modules.sources.enabled": false }, {}, memorySources({ tasks: TASKS }));
    expect(recalc().classList.contains("swt-attention")).toBe(false);
    recalc().click();
    await flush();
    expect(text).toBe(page);
  });
});
