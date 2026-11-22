// The parts of a formula that read nothing of the row they are calculated in, calculated once in a calculation, not
// once a row (evaluate.ts, Sheet.rowFree): what they give is what calculating them in every row gives
import { afterEach, describe, expect, it } from "vitest";
import { attributeIn, type ModelCell, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "../table/model.ts";
import { modelCellNames, modelRowNames } from "../table/names.ts";
import { type FormulaCells, formulaResults, type Scalar } from "./index.ts";
import { clearCustomFunctions, defineCustomFunctions } from "./registry.ts";

const OWNER = "rows";
const plain = (content: string): ModelCell => ({ content, attributes: NO_ATTRIBUTES });
const formula = (text: string): ModelCell => ({ content: "", attributes: withAttributeIn(NO_ATTRIBUTES, OWNER, "formula", text) });
const table = (headers: readonly string[], rows: readonly (readonly ModelCell[])[]): TableModel => ({
  attributes: NO_ATTRIBUTES,
  columns: headers.map((header) => ({ header, align: "", attributes: NO_ATTRIBUTES })),
  rows: rows.map((cells) => ({ cells, attributes: NO_ATTRIBUTES })),
});

/** The rows' cells, every plain cell's reading counted */
function counting() {
  const reads = { count: 0 };
  const cells: FormulaCells = {
    formulaOf: (cell) => {
      const text = attributeIn(cell.attributes, OWNER, "formula");
      return text === undefined ? undefined : { formula: text, value: cell.content };
    },
    formulaCell: (value, text, from) => ({ content: value, attributes: withAttributeIn(from?.attributes ?? NO_ATTRIBUTES, OWNER, "formula", text) }),
    withoutFormula: (cell) => ({ content: cell.content, attributes: withAttributeIn(cell.attributes, OWNER, "formula", undefined) }),
    rowNames: modelRowNames,
    cellNames: modelCellNames,
    plainValue: (cell) => {
      reads.count++;
      const number = Number(cell.content);
      return cell.content === "" ? null : Number.isNaN(number) ? cell.content : number;
    },
  };
  return { cells, reads };
}

const column = (results: Map<string, Scalar>, rows: number, at: number) => Array.from({ length: rows }, (_, r) => results.get(`${r + 1},${at}`));

afterEach(() => clearCustomFunctions());

describe("a formula's parts reading nothing of its row", () => {
  it("are calculated once: a column summed for every row is read once, not once a row", () => {
    const rows = 200;
    const { cells, reads } = counting();
    const model = table(["Hours", "Share"], Array.from({ length: rows }, (_, r) => [plain(String(r + 1)), formula("=[@hours]/SUM([hours])")]));
    const results = formulaResults(model, { cells });
    const total = (rows * (rows + 1)) / 2;
    expect(column(results, rows, 1).slice(0, 2)).toEqual([1 / total, 2 / total]);
    // (Each row's own hours, and the column once)
    expect(reads.count).toBeLessThanOrEqual(rows * 2);
  });

  it("are calculated in every row where they read the cell they are in (ROW()) or the row's own values", () => {
    const { cells } = counting();
    const model = table(["X", "A", "B"], [
      [plain("1"), formula("=ROW()+SUM([x])"), formula("=[@x]+SUM([x])")],
      [plain("2"), formula("=ROW()+SUM([x])"), formula("=[@x]+SUM([x])")],
    ]);
    const results = formulaResults(model, { cells });
    expect([column(results, 2, 1), column(results, 2, 2)]).toEqual([
      [4, 5],
      [4, 5],
    ]);
  });

  it("are calculated in every row where they call a function of the user's, which may give another value at each call", () => {
    let calls = 0;
    defineCustomFunctions([{ name: "NEXT", syntax: "NEXT()", description: "The next number", minArgs: 0, maxArgs: 0, call: () => ++calls }]);
    const { cells } = counting();
    const model = table(["N"], [[formula("=NEXT()")], [formula("=NEXT()")], [formula("=NEXT()")]]);
    expect(column(formulaResults(model, { cells }), 3, 0)).toEqual([1, 2, 3]);
  });

  it("give a function of the user's its own copy of a list they read, which it may change", () => {
    defineCustomFunctions([{ name: "POPLEN", syntax: "POPLEN(list)", description: "A list's length less one", minArgs: 1, maxArgs: 1, call: ([list]) => ((list as unknown[]).pop(), (list as unknown[]).length) }]);
    const { cells } = counting();
    const model = table(["X", "N"], [
      [plain("1"), formula("=POPLEN([x])")],
      [plain("2"), formula("=POPLEN([x])")],
      [plain("3"), formula("=POPLEN([x])")],
    ]);
    expect(column(formulaResults(model, { cells }), 3, 1)).toEqual([2, 2, 2]);
  });

  it("keep no part calculated while a cycle was met: one reading the cell being calculated is calculated anew elsewhere", () => {
    const { cells } = counting();
    // (In A1 the A1 it reads is a cycle, 0 by IFERROR; in B1 it is A1's result, 1)
    const model = table(["A", "B"], [[formula("=IFERROR(A1,0)+1"), formula("=IFERROR(A1,0)+1")]]);
    const results = formulaResults(model, { cells });
    expect([results.get("1,0"), results.get("1,1")]).toEqual([1, 2]);
  });

  it("leave a total row out of the columns they read, as calculated in each row", () => {
    const { cells } = counting();
    // (A markdown table's last row reading its own column whole is a total row)
    const model = table(["Item", "Hours", "Share"], [
      [plain("a"), plain("1"), formula("=[@hours]/SUM([hours])")],
      [plain("b"), plain("3"), formula("=[@hours]/SUM([hours])")],
      [plain("Total"), formula("=SUM([hours])"), formula("=SUM([share])")],
    ]);
    const results = formulaResults(model, { cells });
    expect(column(results, 3, 2)).toEqual([0.25, 0.75, 1]);
    expect(results.get("3,1")).toBe(4);
  });

  it("keep a cycle a cycle in every row", () => {
    const { cells } = counting();
    const model = table(["X", "Y"], [
      [formula("=[@y]"), formula("=SUM([x])")],
      [formula("=[@y]"), formula("=SUM([x])")],
    ]);
    const results = formulaResults(model, { cells });
    for (const value of [...column(results, 2, 0), ...column(results, 2, 1)]) expect((value as { code?: string }).code).toBe("#CYCLE!");
  });
});
