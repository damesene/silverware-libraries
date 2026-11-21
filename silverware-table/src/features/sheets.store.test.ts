// The sheet module over the memory store (docs/silverware-table-store-plan.md,
// step 5): its write hooks given a page's tables as models, their result
// written by a store's transaction, no text anywhere, the proof that a module
// needs none. Its host only what the hooks ask: the sheet's own attributes and
// the names.
import { describe, expect, it } from "vitest";
import type { ModelHost, WriteEdit } from "../core/feature.ts";
import { ownMeta } from "../core/metaaccess.ts";
import { TableRegister } from "../core/tables.ts";
import { metaName } from "../meta.ts";
import type { TableModel } from "../../../shared/table/model.ts";
import { insertRow } from "../../../shared/table/ops.ts";
import { AT_KEY, SHEET_KEY } from "../sheet/page.ts";
import { table } from "../store/contract.ts";
import { MemoryStore } from "../store/memory.ts";
import { Sheets } from "./sheets.ts";

const sheet = ownMeta("sheet", () => true);
const core = ownMeta("core", () => true);
const host = { ...sheet, tableName: metaName, canName: () => true } as unknown as ModelHost;

/** A table on the sheet Plan at a cell, named */
const placed = (model: TableModel, name: string, at: string) => sheet.withAttribute(sheet.withAttribute(core.withAttribute(model, "name", name), SHEET_KEY, "Plan"), AT_KEY, at);

describe("the sheet module over the memory store", () => {
  it("moves the table under one that grows out of its room, both written in one transaction", async () => {
    const store = new MemoryStore(new TableRegister(), {
      Plan: [placed(table(["Item"], ["Pear"]), "costs", "A1"), placed(table(["City"], ["Brno"]), "cities", "A4")],
    });
    const [costs, cities] = (await store.tables("Plan"))!;
    // Three rows more: from A1 down to A5 now, over the table at A4
    const grown = [1, 2, 3].reduce((t, at) => insertRow(t, at), costs!.model);
    const tables = [costs!, cities!].map(({ key, model }) => ({ key, model }));
    const edit: WriteEdit = { tables, read: tables, key: costs!.key, formulas: [] };
    const module = new Sheets(host);
    expect(module.refusesWrite(costs!.model, grown, edit)).toBeUndefined();
    const others = module.otherTablesWritten(costs!.model, grown, edit);
    expect(others.map((one) => [one.key, sheet.attribute(one.model, AT_KEY)])).toEqual([[cities!.key, "A7"]]);
    const report = await store.apply(
      await store.plan({
        document: "Plan",
        edits: [
          { kind: "write", key: costs!.key, expects: costs!.revision, model: grown },
          ...others.map((one) => ({ kind: "write" as const, key: one.key, expects: cities!.revision, model: one.model })),
        ],
      }),
    );
    expect(report.written).toBe(true);
    const after = (await store.tables("Plan"))!;
    expect(after.map((one) => [metaName(one.model), sheet.attribute(one.model, AT_KEY), one.model.rows.length])).toEqual([
      ["costs", "A1", 4],
      ["cities", "A7", 1],
    ]);
  });
});
