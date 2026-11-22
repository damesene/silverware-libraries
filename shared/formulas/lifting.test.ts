// A function of one value given a range (docs/silverware-formulas-lifting.md): called for each of its values, as Excel
// 365 calls it, its result a list (a cell's #SPILL!, a list where a function or a list's formula takes it)
import { afterEach, describe, expect, it } from "vitest";
import { attributeIn, type ModelCell, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "../table/model.ts";
import { modelCellNames, modelRowNames } from "../table/names.ts";
import { cellWholeResult, type FormulaCells, FormulaError, formulaResults, givesList, listResult, type Result } from "./index.ts";
import { clearCustomFunctions, defineCustomFunctions } from "./registry.ts";

const OWNER = "rows";
const cells: FormulaCells = {
  formulaOf: (cell) => {
    const formula = attributeIn(cell.attributes, OWNER, "formula");
    return formula === undefined ? undefined : { formula, value: cell.content };
  },
  formulaCell: (value, formula, from) => ({ content: value, attributes: withAttributeIn(from?.attributes ?? NO_ATTRIBUTES, OWNER, "formula", formula) }),
  withoutFormula: (cell) => ({ content: cell.content, attributes: withAttributeIn(cell.attributes, OWNER, "formula", undefined) }),
  rowNames: modelRowNames,
  cellNames: modelCellNames,
};
const plain = (content: string): ModelCell => ({ content, attributes: NO_ATTRIBUTES });

/** Fruit, prices and digits; the formula in the last column of the first row */
function table(formula: string, rows = [["pear", "2.456", "1"], ["fig", "1.5", "0"], ["kiwi", "", "2"]]): TableModel {
  return {
    attributes: NO_ATTRIBUTES,
    columns: ["Name", "Price", "Digits", "F"].map((header) => ({ header, align: "", attributes: NO_ATTRIBUTES })),
    rows: rows.map((row, r) => ({ cells: [...row.map(plain), r === 0 ? cells.formulaCell("", formula) : plain("")], attributes: NO_ATTRIBUTES })),
  };
}

/** The formula's whole result (a list as it is) */
const whole = (formula: string, rows?: string[][]): Result => cellWholeResult(table(formula, rows), 1, 3, { cells })!;
/** What its cell shows: one value, a list #SPILL! */
const shown = (formula: string, rows?: string[][]) => {
  const result = formulaResults(table(formula, rows), { cells }).get("1,3");
  return result instanceof FormulaError ? result.code : result;
};
const codes = (result: Result) => (result as readonly unknown[]).map((one) => (one instanceof FormulaError ? one.code : one));

afterEach(() => clearCustomFunctions());

describe("a function of one value given a range", () => {
  it("is called for each of its values, its result a list, a cell's #SPILL!", () => {
    expect(whole("=UPPER([name])")).toEqual(["PEAR", "FIG", "KIWI"]);
    expect(shown("=UPPER([name])")).toBe("#SPILL!");
    // (Over two ranges of one size, place by place)
    expect(whole("=ROUND([price], [digits])")).toEqual([2.5, 2, 0]);
  });

  it("is taken whole by a function reading a range: one value again", () => {
    expect(shown('=TEXTJOIN(", ", TRUE, UPPER([name]))')).toBe("PEAR, FIG, KIWI");
    expect(shown("=SUM(ROUND([price], 0))")).toBe(4);
  });

  it("refuses ranges of other sizes and a grid of several rows and columns, takes an area's cells row by row: as an operator does", () => {
    expect((whole("=ROUND([price], A1:A2)") as FormulaError).detail).toMatch(/not the same size \(3 and 2/);
    expect((whole("=UPPER([#Data])") as FormulaError).detail).toMatch(/rows and 4 columns where one value is expected: pick a column first/);
    // (The grid's error whole, not a list of it beside a list: its cell says why)
    expect(shown("=ROUND([price], [#Data])")).toBe("#VALUE!");
    // (An area of several columns read as its cells, row by row, as `A1:B2 & "x"` reads it)
    expect(whole("=UPPER(A1:B2)")).toEqual(["PEAR", "2.456", "FIG", "1.5"]);
  });

  it("keeps a reference to one cell, or a range of one, one value", () => {
    expect(whole("=UPPER(A1)")).toBe("PEAR");
    expect(whole("=UPPER(A1:A1)")).toBe("PEAR");
  });

  it("gives an error at its place alone, one given beside a list at every place", () => {
    expect(codes(whole("=1/[digits]"))).toEqual([1, "#DIV/0!", 0.5]);
    expect(codes(whole("=ROUND([price], 1/0)"))).toEqual(["#DIV/0!", "#DIV/0!", "#DIV/0!"]);
  });

  it("gives a list of none for a column of no rows", () => {
    expect(listResult(table("", []), { cells }, "=UPPER([name])")).toEqual([]);
  });

  it("chooses with IF place by place over a list deciding, its branches a list of that size or one value", () => {
    expect(whole('=IF([digits] > 0, [name], "none")')).toEqual(["pear", "none", "kiwi"]);
    // (One condition: the branch picked as now, a range in the branch not picked never read)
    expect(whole('=IF(A1 = "pear", "first", [name])')).toBe("first");
    expect(whole("=IFERROR(1/[digits], 0)")).toEqual([1, 0, 0.5]);
    // (A branch of another size: an error where it is picked)
    expect(codes(whole("=IF([digits] > 0, A1:A2, 0)"))).toEqual(["#VALUE!", 0, "#VALUE!"]);
    expect(whole('=SWITCH([digits], 0, "none", 1, "one", "more")')).toEqual(["one", "none", "more"]);
    expect(whole('=IFS([digits] = 0, "none", TRUE, "some")')).toEqual(["some", "none", "some"]);
  });

  it("looks each value up with XLOOKUP, its ranges read whole", () => {
    expect(whole('=XLOOKUP(UPPER([name]), UPPER([name]), [digits])')).toEqual([1, 0, 2]);
    // (Its if_not_found a branch, place by place; a null literal left out, as given)
    expect(whole("=XLOOKUP([name], A2:A2, C2:C2, [digits])")).toEqual([1, 0, 2]);
    expect(whole('=XLOOKUP([name], A2:A2, A1:A1, "none")')).toEqual(["none", "pear", "none"]);
    expect(whole("=XLOOKUP([name], [name], [digits], , 0)")).toEqual([1, 0, 2]);
  });

  it("takes each -IFS criterion of a range, a result for each", () => {
    expect(whole("=COUNTIFS([digits], [digits])")).toEqual([1, 1, 1]);
  });

  it("reads ISNUMBER of each value", () => {
    expect(whole("=ISNUMBER([price])")).toEqual([true, true, false]);
  });

  it("keeps TEXTJOIN's delimiter one value (a range #VALUE!, as now)", () => {
    expect(shown("=TEXTJOIN([name], TRUE, [name])")).toBe("#VALUE!");
  });

  it("calls a function of the user's for each value, unless it says it reads a range", () => {
    defineCustomFunctions([
      { name: "SHOUT", syntax: "SHOUT(text)", description: "Its text in capitals", minArgs: 1, maxArgs: 1, call: ([text]) => String(text).toUpperCase() },
      { name: "HOWMANY", syntax: "HOWMANY(list)", description: "How many values", minArgs: 1, maxArgs: 1, argument: () => "range", call: ([list]) => (list as unknown[]).length },
      { name: "TAIL", syntax: "TAIL(text, [end])", description: "Its text and an end", minArgs: 1, maxArgs: 2, call: ([text, end = "!"]) => `${String(text)}${String(end)}` },
    ]);
    expect(whole("=SHOUT([name])")).toEqual(["PEAR", "FIG", "KIWI"]);
    expect(shown("=HOWMANY([name])")).toBe(3);
    // (A reference to one cell a list of one, as a built-in function gets it: SHOUT's String() reads its value)
    expect(whole("=SHOUT([@name])")).toBe("PEAR");
    expect(whole("=SHOUT(A1)")).toBe("PEAR");
    // (Its default where an argument is left out, at each place)
    expect(whole("=TAIL([name])")).toEqual(["pear!", "fig!", "kiwi!"]);
  });

  it("is told a list by givesList", () => {
    expect(givesList("=UPPER([name])")).toBe(true);
    expect(givesList("=UPPER([@name])")).toBe(false);
    expect(givesList("=SUM([price])")).toBe(false);
    expect(givesList('=IF(A1 = "pear", [name], "x")')).toBe(false);
    expect(givesList('=IF([digits] > 0, "a", "b")')).toBe(true);
  });

  it("calculates a lifted part reading no row once, the same for every row", () => {
    const model = table("", [["pear", "1", ""], ["fig", "2", ""]]);
    const rows = model.rows.map((one) => ({ ...one, cells: [...one.cells.slice(0, 3), cells.formulaCell("", '=TEXTJOIN(",", TRUE, UPPER([name]))')] }));
    const results = formulaResults({ ...model, rows }, { cells });
    expect([results.get("1,3"), results.get("2,3")]).toEqual(["PEAR,FIG", "PEAR,FIG"]);
  });
});
