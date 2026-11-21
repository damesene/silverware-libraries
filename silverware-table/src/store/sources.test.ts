import { describe, expect, it } from "vitest";
import { TableRegister } from "../core/tables.ts";
import { memorySources } from "../sources.ts";
import { storeContract } from "./contract.ts";
import { SourceStore, sourceTable } from "./sources.ts";
import type { TableModel } from "../../../shared/table/model.ts";

/** A source's data of a table of the contract: its headers the columns, its cells' contents the values */
const dataOf = (model: TableModel) => ({ columns: model.columns.map((c) => c.header), rows: model.rows.map((r) => r.cells.map((c) => c.content)) });

// Each document of the contract a source of its one table (a document of none: no source)
storeContract(
  "the space's sources",
  (documents) => {
    const sources = memorySources();
    const name = (document: string) => document.replace(/^@/, "");
    const put = (document: string, tables: readonly TableModel[]) => sources.set(name(document), tables[0] && dataOf(tables[0]));
    const store = new SourceStore(sources, new TableRegister());
    for (const [document, tables] of Object.entries(documents)) put(document, tables);
    // (The contract names its documents without the @ a source's has: read through a store that adds it)
    const named = {
      tables: (document: string) => store.tables(`@${name(document)}`),
      documentOf: (key: Parameters<SourceStore["documentOf"]>[0]) => store.documentOf(key)?.slice(1),
      plan: store.plan.bind(store),
      apply: store.apply.bind(store),
      planUndo: store.planUndo.bind(store),
      asRead: store.asRead.bind(store),
    };
    return { store: named, replace: put };
  },
  { readOnly: true, oneTable: true },
);

describe("the sources' store", () => {
  it("makes a source's data a table: its columns the header, each value a cell's text", () => {
    const table = sourceTable({ columns: ["name"], rows: [["a | b"], []] });
    expect(table.rows.map((r) => r.cells)).toEqual([["name"], ["a \\| b"], [""]]);
  });

  it("reads a source as a table of a page is: a value's hidden tag an attribute, the same model while its data are the same", async () => {
    const sources = memorySources({ tasks: { columns: ["total"], rows: [["42 <meta formulas.f='=SUM([qty])'>"]] } });
    const store = new SourceStore(sources, new TableRegister());
    const table = store.table("Tasks")!;
    expect(table.rows[0]!.cells[0]!.content).toBe("42");
    expect(store.table("tasks")).toBe(table);
    expect(store.table("people")).toBeNull();
    const [stored] = (await store.tables("@tasks"))!;
    expect(stored!.model).toBe(table);
    expect(store.documentOf(stored!.key)).toBe("@tasks");
  });
});
