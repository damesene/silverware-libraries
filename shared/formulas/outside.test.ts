// Formulas outside Silverware Table (docs/silverware-formulas-shared.md): rows another plugin keeps its own way (a
// database's items, each a row, its properties the columns) calculated by the formulas, which know nothing of how
// a formula is kept: the plugin says (`FormulaCells`), and what else formulas read (another plugin's table, a
// source) is given (`TableSource`).
import { describe, expect, it } from "vitest";
import { attributeIn, CORE, type ModelCell, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "../table/model.ts";
import { LINE_NAME_KEY, modelCellNames, modelRowNames } from "../table/names.ts";
import { evaluateFormula, type FormulaCells, recalculate, scalarText, type TableSource, type Value } from "./index.ts";

// The plugin's own attribute for a formula (a database's property calculated, say), not the table's `formulas.f`
const OWNER = "items";
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
const formula = (text: string): ModelCell => cells.formulaCell("", text);
const named = (name: string) => withAttributeIn(NO_ATTRIBUTES, CORE, LINE_NAME_KEY, name);
/** A formula's one value as text */
const one = (value: Value) => {
  if (Array.isArray(value)) throw new Error("a list, not one value");
  return scalarText(value as Exclude<Value, readonly unknown[]>);
};

/** Items as rows: a name, a quantity, a price, a total by formula */
const items: TableModel = {
  attributes: NO_ATTRIBUTES,
  columns: ["Item", "Qty", "Unit price", "Total"].map((header) => ({ header, align: "", attributes: NO_ATTRIBUTES })),
  rows: [
    { cells: [plain("Pear"), plain("3"), plain("2.5"), formula("=[@qty]*[@unit_price]")], attributes: named("pear") },
    { cells: [plain("Fig"), plain("4"), plain("1"), formula("=[@qty]*[@unit_price]")], attributes: NO_ATTRIBUTES },
  ],
};

describe("formulas on rows another plugin keeps", () => {
  it("calculates each row's formula as the plugin keeps it, the rest of the rows as they are", () => {
    const calculated = recalculate(items, { cells });
    expect(calculated.rows.map((row) => row.cells[3]!.content)).toEqual(["7.5", "4"]);
    // (Kept where the plugin keeps it)
    expect(cells.formulaOf(calculated.rows[0]!.cells[3]!)).toEqual({ formula: "=[@qty]*[@unit_price]", value: "7.5" });
    expect(calculated.rows[0]!.cells[0]).toBe(items.rows[0]!.cells[0]);
  });

  it("reads another table by its name and a source by @, as given; a row by its name", () => {
    const prices: TableModel = {
      attributes: NO_ATTRIBUTES,
      columns: ["Price"].map((header) => ({ header, align: "", attributes: NO_ATTRIBUTES })),
      rows: [{ cells: [plain("10")], attributes: NO_ATTRIBUTES }, { cells: [plain("5")], attributes: NO_ATTRIBUTES }],
    };
    const tables = Object.assign((name: string) => (name.toLowerCase() === "prices" ? prices : name.toLowerCase() === "items" ? items : undefined), {
      spaceSource: (name: string) => (name.toLowerCase() === "tasks" ? prices : null),
    }) satisfies TableSource;
    expect(one(evaluateFormula("=SUM(prices![price])", { cells, tables }))).toBe("15");
    expect(one(evaluateFormula("=COUNTA(@tasks[price])", { cells, tables }))).toBe("2");
    expect(one(evaluateFormula("=items!pear[qty]", { cells, tables }))).toBe("3");
    expect(one(evaluateFormula("=SUM(missing![price])", { cells, tables }))).toBe("#REF!");
  });
});
