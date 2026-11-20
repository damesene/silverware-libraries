import { describe, expect, it } from "vitest";
import { parseTable } from "../markdown.ts";
import { decode } from "../store/markdown/codec.ts";
import { attributeIn, type ModelCell, type TableModel, withAttributeSet } from "./model.ts";
import { duplicateRow, insertRow, moveRow, withCellAt, withContentAt } from "./ops.ts";
import { type AttributeRules, withAttributeRules } from "./rules.ts";

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
