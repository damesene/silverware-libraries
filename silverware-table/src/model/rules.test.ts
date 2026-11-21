import { describe, expect, it } from "vitest";
import { parseTable } from "../markdown.ts";
import { decode } from "../store/markdown/codec.ts";
import { attributeIn, type ModelCell, type TableModel, withAttributeSet } from "./model.ts";
import { duplicateRow, insertRow, moveRow, withCellAt, withContentAt } from "./ops.ts";
import { type AttributeRules, withAttributeRules, withoutNewAttributes } from "./rules.ts";

const RULES: AttributeRules = {
  boundToContent: [{ owner: "formulas", key: "f" }],
  unique: [
    { owner: "core", key: "n" },
    { owner: "core", key: "cn" },
  ],
};

// A formula cell (B1) with a cell's name, a named row, a plain cell
const TABLE = decode(parseTable("| A | B |\n|---|---|\n| Pear <meta core.n='pear'> | 3 <meta formulas.f='=1+2' core.cn='sum'> |\n| Fig | 2 |"));

const cell = (model: TableModel, row: number, column: number) => model.rows[row - 1]!.cells[column]!;
const formula = (c: ModelCell) => attributeIn(c.attributes, "formulas", "f");
const ruled = (after: TableModel, rowMap?: (r: number) => number | undefined) => withAttributeRules(TABLE, after, RULES, rowMap);

describe("what an edit does with attributes with a rule", () => {
  it("a value typed, pasted or cleared over a formula ends it; the cell's other attributes stay", () => {
    for (const content of ["7", ""]) {
      const after = ruled(withContentAt(TABLE, 1, 1, content));
      expect(formula(cell(after, 1, 1))).toBeUndefined();
      expect(attributeIn(cell(after, 1, 1).attributes, "core", "cn")).toBe("sum");
    }
  });

  it("a formula typed keeps it, the same one again too (set explicitly)", () => {
    const typed = { content: "", attributes: withAttributeSet(cell(TABLE, 1, 1).attributes, "formulas", "f", "=1+2") };
    expect(formula(cell(ruled(withCellAt(TABLE, 1, 1, typed)), 1, 1))).toBe("=1+2");
  });

  it("a result written with its formula unchanged in content, and a cell moved with its formula, keep it", () => {
    expect(ruled(TABLE)).toBe(TABLE);
    // Rows swapped: each cell is where its row went, its formula with it
    const moved = moveRow(TABLE, 1, 2);
    const after = ruled(moved, (r) => (r === 1 ? 2 : r === 2 ? 1 : r));
    expect(formula(cell(after, 2, 1))).toBe("=1+2");
    expect(after).toBe(moved);
  });

  it("a cell moved over another brings its own attributes: the formula goes with it", () => {
    const over = withCellAt(TABLE, 2, 1, cell(TABLE, 1, 1));
    expect(formula(cell(ruled(over), 2, 1))).toBe("=1+2");
  });

  it("a row duplicated or inserted with cells takes no name another row or cell has; a new name stays", () => {
    const duplicated = ruled(duplicateRow(TABLE, 1), (r) => (r >= 2 ? r + 1 : r));
    expect(attributeIn(duplicated.rows[1]!.attributes, "core", "n")).toBeUndefined();
    expect(attributeIn(cell(duplicated, 2, 1).attributes, "core", "cn")).toBeUndefined();
    // Its formula is copied: no rule makes a formula unique
    expect(formula(cell(duplicated, 2, 1))).toBe("=1+2");
    // The rows it came from keep theirs
    expect(attributeIn(duplicated.rows[0]!.attributes, "core", "n")).toBe("pear");
    const named = { content: "x", attributes: withAttributeSet(cell(TABLE, 2, 0).attributes, "core", "cn", "fresh") };
    const inserted = ruled(insertRow(TABLE, 3, [named]));
    expect(attributeIn(cell(inserted, 3, 0).attributes, "core", "cn")).toBe("fresh");
  });
});

describe("attributes new to a table (the metadata setting off)", () => {
  const before = decode(parseTable(["| Item | Qty | Total |", "|---|---|---|", "| Pear | 3 | 6 <meta formulas.f='=[@qty]*2'> |", "| Fig | 2 | 4 <meta formulas.f='=[@qty]*2'> |", ""].join("\n")));
  const withFormula = (model: TableModel, row: number, column: number, formula: string) => withCellAt(model, row, column, { ...cell(model, row, column), attributes: withAttributeSet(cell(model, row, column).attributes, "formulas", "f", formula) });

  it("are taken off, the cell's content kept, and counted", () => {
    const { table, taken } = withoutNewAttributes(before, withFormula(before, 1, 1, "=1+2"));
    expect(formula(cell(table, 1, 1))).toBeUndefined();
    expect(cell(table, 1, 1).content).toBe("3");
    expect(taken).toBe(1);
  });

  it("stay where the cell had the attribute (edited), or the table had it with that value (a calculated column's new row, a cell moved)", () => {
    expect(withoutNewAttributes(before, withFormula(before, 1, 2, "=[@qty]*3")).taken).toBe(0);
    expect(withoutNewAttributes(before, withFormula(before, 2, 1, "=[@qty]*2")).taken).toBe(0);
  });

  it("follow the rows and columns the edit moved: a row's name too", () => {
    const named = { ...before, rows: before.rows.map((row, i) => (i === 0 ? { ...row, attributes: withAttributeSet(row.attributes, "core", "n", "pear") } : row)) };
    // Pear's row moved down and renamed: it had a name, so the new one stays
    const moved = moveRow(named, 1, 2);
    const renamed = { ...moved, rows: moved.rows.map((row, i) => (i === 1 ? { ...row, attributes: withAttributeSet(row.attributes, "core", "n", "pearl") } : row)) };
    expect(withoutNewAttributes(named, renamed, (r) => (r === 1 ? 2 : r === 2 ? 1 : r)).taken).toBe(0);
    // Read as if nothing moved, it is Fig's row, which had none
    expect(withoutNewAttributes(named, renamed).taken).toBe(1);
  });

  it("of a column, only those the store reads off its text (a tag typed into its header): those the edit set a module set through canStore", () => {
    const typed = parseTable(["| Item | Qty <meta x.unit='kg'> | Total |", "|---|---|---|", "| Pear | 3 | 6 |", ""].join("\n"));
    const read = decode(typed);
    const sorted = { ...read, columns: read.columns.map((column, c) => (c === 0 ? { ...column, attributes: withAttributeSet(column.attributes, "core", "sort", "asc") } : column)) };
    const plain = decode(parseTable(["| Item | Qty | Total |", "|---|---|---|", "| Pear | 3 | 6 |", ""].join("\n")));
    // As the edit made it: the tag in the header's text, the sorting set on the first column
    const asked = { ...plain, columns: plain.columns.map((column, c) => (c === 0 ? { ...column, attributes: withAttributeSet(column.attributes, "core", "sort", "asc") } : c === 1 ? { ...column, header: "Qty <meta x.unit='kg'>" } : column)) };
    const { table, taken } = withoutNewAttributes(plain, sorted, undefined, undefined, asked);
    expect(taken).toBe(1);
    expect(attributeIn(table.columns[1]!.attributes, "x", "unit")).toBeUndefined();
    expect(attributeIn(table.columns[0]!.attributes, "core", "sort")).toBe("asc");
  });
});
