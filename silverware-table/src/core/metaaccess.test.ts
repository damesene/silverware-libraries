import { describe, expect, it } from "vitest";
import { parseTable, serializeTable, writtenMeta } from "../markdown.ts";
import { setCell } from "../ops.ts";
import { decode, encode } from "../store/markdown/codec.ts";
import { withTagValue } from "../tagvalues.ts";
import { ownMeta } from "./metaaccess.ts";

describe("a module's own metadata", () => {
  const table = parseTable("| Name | Qty |\n|---|---|\n| Pear | 3 |\n| <meta core.table core.name='fruit' filters.-c-name.condition='=Pear'> |");

  it("is named by the core: the module's name, its key, and the column", () => {
    const filters = ownMeta("filters", () => true);
    expect(filters.attribute(table, "condition", { column: 0 })).toBe("=Pear");
    expect(writtenMeta(filters.withAttribute(table, "condition", ">1", { column: 1 }))).toEqual({
      "core.name": "fruit",
      "filters.-c-name.condition": "=Pear",
      "filters.-c-qty.condition": ">1",
    });
    expect(writtenMeta(ownMeta("themes", () => true).withAttribute(table, "name", "slate"))["themes.name"]).toBe("slate");
    expect(filters.getCellTag("6 <meta filters.x='1'> <meta formulas.x='2'>", "x")).toBe("1");
  });

  it("with the metadata setting off: what the table has may change or go, nothing new is added", () => {
    const filters = ownMeta("filters", () => false);
    expect(filters.withAttribute(table, "condition", "=Fig", { column: 0 }).meta?.["filters.-c-name.condition"]).toBe("=Fig");
    expect(filters.withAttribute(table, "condition", ">1", { column: 1 })).toBe(table);
    expect(writtenMeta(filters.withColumnAttributes(table, "condition", new Map([[0, "=Fig"], [1, ">1"]])))).toEqual({ "core.name": "fruit", "filters.-c-name.condition": "=Fig" });
    expect(writtenMeta(filters.withAttribute(table, "condition", undefined, { column: 0 }))).toEqual({ "core.name": "fruit" });
    expect(filters.canStore(table, "condition", { column: 0 })).toBe(true);
    expect(filters.canStore(table, "condition", { column: 1 })).toBe(false);
    expect(filters.canStoreCellTag("6 <meta filters.x='1'>", "x")).toBe(true);
    expect(filters.canStoreCellTag("6", "x")).toBe(false);
  });

  describe("on the model: the table's, a column's, a row's and a cell's, written where the markdown keeps them", () => {
    const model = decode(table);

    it("reads and writes at each place, the module's own only", () => {
      const filters = ownMeta("filters", () => true);
      expect(filters.attribute(model, "condition", { column: 0 })).toBe("=Pear");
      expect(ownMeta("core", () => true).attribute(model, "name")).toBe("fruit");
      const cell = filters.withAttribute(model, "x", "1", { row: 1, column: 1 });
      expect(filters.attribute(cell, "x", { row: 1, column: 1 })).toBe("1");
      expect(ownMeta("formulas", () => true).attribute(cell, "x", { row: 1, column: 1 })).toBeUndefined();
      // Written into the cell's tags, as withTagValue writes them
      expect(serializeTable(encode(cell, table))).toBe(serializeTable(setCell(table, 1, 1, withTagValue(table.rows[1]!.cells[1]!, "filters.x", "1"))));
      const column = filters.withAttribute(model, "condition", ">1", { column: 1 });
      expect(filters.columnAttributes(column, "condition")).toEqual(new Map([[0, "=Pear"], [1, ">1"]]));
      expect(writtenMeta(encode(column, table))["filters.-c-qty.condition"]).toBe(">1");
      const row = filters.withAttribute(model, "mark", "y", { row: 1 });
      expect(filters.attribute(row, "mark", { row: 1 })).toBe("y");
      // No such place: as it was
      expect(filters.withAttribute(model, "x", "1", { row: 9, column: 0 })).toBe(model);
    });

    it("with the metadata setting off: what it has may change or go, nothing new is added", () => {
      const filters = ownMeta("filters", () => false);
      expect(filters.canStore(model, "condition", { column: 0 })).toBe(true);
      expect(filters.canStore(model, "condition", { column: 1 })).toBe(false);
      expect(filters.withAttribute(model, "condition", ">1", { column: 1 })).toBe(model);
      expect(filters.withAttribute(model, "x", "1", { row: 1, column: 0 })).toBe(model);
      expect(filters.attribute(filters.withAttribute(model, "condition", "=Fig", { column: 0 }), "condition", { column: 0 })).toBe("=Fig");
      expect(filters.withColumnAttributes(model, "condition", new Map([[0, "=Fig"], [1, ">1"]])).columns.map((c) => c.attributes.get("filters")?.get("condition"))).toEqual(["=Fig", undefined]);
    });
  });
});
