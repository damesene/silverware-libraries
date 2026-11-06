import { describe, expect, it } from "vitest";
import { parseTable, type Table } from "../markdown.ts";
import type { Pins } from "../view.ts";
import { type Calculated, calculatedTable, movedRenames, readRenames, renamedIn, sameCells, storedRenames } from "./table.ts";

const RESULT: Calculated = {
  columns: [
    { id: "row:region", header: "Region", numeric: false },
    { id: "value:SUM([revenue])", header: "Sum of Revenue", numeric: true },
  ],
  body: [
    ["East", "120"],
    ["West", "#DIV/0!"],
    ["Total", "170"],
  ],
  totalRow: true,
  totalColumns: 0,
};

const EMPTY: Table = { indent: "", align: [], rows: [{ cells: [""] }], padded: false };

// The pins kept with the table, as a host keeps them in its metadata row (a copy of the table keeps them: a symbol is spread)
const PINNED = Symbol("pins");
const PINS = {
  pinsOf: (table: Table): Pins => (table as Table & { [PINNED]?: Pins })[PINNED] ?? { top: 0, bottom: 0, left: 0, right: 0 },
  withPins: (table: Table, pins: Pins): Table => ({ ...table, [PINNED]: pins }) as Table,
};

describe("calculated tables", () => {
  it("writes the result over the table: headers, cells (errors escaped), numbers right-aligned, totals pinned", () => {
    const made = calculatedTable(EMPTY, RESULT, {}, PINS);
    expect(made.rows.map((r) => r.cells)).toEqual([["Region", "Sum of Revenue"], ["East", "120"], ["West", "\\#DIV/0!"], ["Total", "170"]]);
    expect(made.align).toEqual(["", "right"]);
    expect(PINS.pinsOf(made)).toMatchObject({ bottom: 1, right: 0 });
  });

  it("keeps the headers the user renamed, by what each column stands for", () => {
    const made = calculatedTable(EMPTY, RESULT, { "value:SUM([revenue])": "Revenue" }, PINS);
    expect(made.rows[0]!.cells).toEqual(["Region", "Revenue"]);
  });

  it("keeps a table's other pins and its delimiter row where its columns are aligned as before", () => {
    const table = parseTable("| A | B |\n|:--|--:|\n| x | 1 |");
    const before = PINS.withPins(table, { top: 1, bottom: 0, left: 1, right: 0 });
    const made = calculatedTable(before, RESULT, {}, PINS);
    expect(PINS.pinsOf(made)).toEqual({ top: 1, bottom: 1, left: 1, right: 0 });
    const same = calculatedTable({ ...table, align: ["", "right"] }, RESULT, {}, PINS);
    expect(same.delimiterSource).toBe(table.delimiterSource);
  });

  it("reads and stores the renamed headers, those of the result's columns only", () => {
    expect(readRenames('{"row:region":"Area","x":1}')).toEqual({ "row:region": "Area" });
    expect(readRenames("not json")).toEqual({});
    expect(readRenames(undefined)).toEqual({});
    expect(storedRenames({ "row:region": "Area", "value:gone": "Old" }, RESULT)).toBe('{"row:region":"Area"}');
    expect(storedRenames({ "value:gone": "Old" }, RESULT)).toBeUndefined();
  });

  it("takes a header renamed in an edit for its column, its made name back as no rename", () => {
    const before = calculatedTable(EMPTY, RESULT, { "row:region": "Area" }, PINS);
    const renamed = { ...before, rows: [{ cells: ["Region", "Revenue"] }, ...before.rows.slice(1)] };
    expect(renamedIn(before, renamed, RESULT, { "row:region": "Area" })).toEqual({ "value:SUM([revenue])": "Revenue" });
    // A header of a table no longer of the result's shape: the renames as they were
    expect(renamedIn(before, { ...before, rows: [{ cells: ["Only"] }] }, RESULT, { a: "b" })).toEqual({ a: "b" });
  });

  it("moves the renames to their columns' ids as they are now", () => {
    expect(movedRenames({ "value:SUM([qty])": "Pieces" }, (id) => id.replace("qty", "count"))).toEqual({ "value:SUM([count])": "Pieces" });
  });

  it("compares two tables' cells", () => {
    const a = calculatedTable(EMPTY, RESULT, {}, PINS);
    expect(sameCells(a, calculatedTable(EMPTY, RESULT, {}, PINS))).toBe(true);
    expect(sameCells(a, calculatedTable(EMPTY, { ...RESULT, body: RESULT.body.slice(0, 2) }, {}, PINS))).toBe(false);
    expect(sameCells(a, calculatedTable(EMPTY, RESULT, { "row:region": "Area" }, PINS))).toBe(false);
  });
});
