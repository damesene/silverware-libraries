// A database as a table of the model, for formulas (docs/silverware-database-formulas.md, *How it fits*), and its
// values to the cells formulas read and back: the one place that knows both ways.
//
// A column per property, the item's name first: a column's header is its property's label and its fixed name (the
// model's `core.n`, which formulas find a column by first) the property's key, so a formula reads `[@due]` whatever
// the label is, and `[@Due date]` by the label as a table's column. A row per item, in the order given, none named. A
// formula property's cells hold its formula as the database's own attribute (`FormulaCells`, not a table's). A plain
// cell's value is given to formulas as it is (`plainValue`), never guessed from text: a text `007` stays a text, a
// checkbox a logical value; its text is only what a cell would show.
import { attributeIn, CORE, type ModelCell, type ModelColumn, NO_ATTRIBUTES, type TableModel, withAttributeIn } from "../../../../shared/table/model.ts";
import { LINE_NAME_KEY, modelCellNames, modelRowNames } from "../../../../shared/table/names.ts";
import { type FormulaCells, FormulaError, type Scalar, scalarText } from "../../../../shared/formulas/index.ts";
import { formatLuaNumber } from "../../../../shared/formulas/format.ts";
import { type Database, type Item, NAME_KEY, type Params, type Property, type Value } from "../../model/database.ts";
import { FORMULA_TYPE } from "../types/builtin/formula.ts";
import { outsideReading } from "./validate.ts";

// A formula cell's formula: the database's own attribute
const OWNER = "database";
const FORMULA_KEY = "formula";

/** How the database's table holds formulas: in its cells' own attribute; no row or cell named */
const FORMULA_CELLS: FormulaCells = {
  formulaOf: (cell) => {
    const formula = attributeIn(cell.attributes, OWNER, FORMULA_KEY);
    return formula === undefined ? undefined : { formula, value: cell.content };
  },
  formulaCell: (value, formula, from) => ({ content: value, attributes: withAttributeIn(from?.attributes ?? NO_ATTRIBUTES, OWNER, FORMULA_KEY, formula) }),
  withoutFormula: (cell) => ({ content: cell.content, attributes: withAttributeIn(cell.attributes, OWNER, FORMULA_KEY, undefined) }),
  rowNames: modelRowNames,
  cellNames: modelCellNames,
};

/** The formula a formula property's params give, none where it has none yet */
export function formulaOf(params: Params): string | undefined {
  return typeof params.formula === "string" && params.formula.trim() !== "" ? params.formula : undefined;
}

/** Whether a property's values are its formula's */
export const isFormula = (property: Property) => property.type === FORMULA_TYPE;

// A date and time as kept (`2026-11-08T14:30:05.123`): formulas read one with a space and to the second
const MOMENT_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?$/;

/** A value as formulas read it: a number, a logical value, a text as it is, a moment as formulas write one, a list its items with commas */
export function cellValue(value: Value): Scalar {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  const moment = MOMENT_RE.exec(value as string);
  return moment ? `${moment[1]} ${moment[2]}` : (value as string);
}

/** A value as a cell would show it to formulas: a number with a decimal point, a logical value as formulas write one */
export function cellText(value: Value): string {
  const read = cellValue(value);
  if (read === null) return "";
  if (typeof read === "number") return formatLuaNumber(read);
  return scalarText(read);
}

/** A database's items as a table, how formulas read its cells, and the formula properties refused their reading (by key) */
export type DatabaseTable = { readonly table: TableModel; readonly cells: FormulaCells; readonly refused: ReadonlyMap<string, FormulaError> };

/**
 * The database's items as a table of the model: a formula property's cells its formula's (none: empty); one whose
 * formula reads outside the database (written into the root page by hand, which Properties refuses) its error in
 * every cell, so formulas reading it get it too
 */
export function databaseTable(database: Database, items: readonly Item[]): DatabaseTable {
  const given = new WeakMap<ModelCell, Scalar>();
  const plain = (value: Scalar, shown: string): ModelCell => {
    const cell = { content: shown, attributes: NO_ATTRIBUTES };
    given.set(cell, value);
    return cell;
  };
  const refused = new Map<string, FormulaError>();
  const formulas = database.properties.map((property) => {
    if (!isFormula(property)) return undefined;
    const formula = formulaOf(property.params);
    const outside = formula === undefined ? undefined : outsideReading(formula);
    if (outside) refused.set(property.key, new FormulaError("#REF!", outside));
    return formula;
  });
  const column = (header: string, key: string): ModelColumn => ({ header, align: "", attributes: withAttributeIn(NO_ATTRIBUTES, CORE, LINE_NAME_KEY, key) });
  const columns = [column("Name", NAME_KEY), ...database.properties.map((property) => column(property.label, property.key))];
  const rows = items.map((item) => ({
    attributes: NO_ATTRIBUTES,
    cells: [
      plain(item.name, item.name),
      ...database.properties.map((property, at): ModelCell => {
        const error = refused.get(property.key);
        if (error) return plain(error, error.code);
        const formula = formulas[at];
        if (formula !== undefined) return FORMULA_CELLS.formulaCell("", formula);
        // (A formula property of no formula yet: empty, whatever an item keeps under its key)
        const value = isFormula(property) ? null : (item.values[property.key] ?? null);
        return plain(cellValue(value), cellText(value));
      }),
    ],
  }));
  return { table: { attributes: NO_ATTRIBUTES, columns, rows }, cells: { ...FORMULA_CELLS, plainValue: (cell) => given.get(cell) }, refused };
}

/** A formula's error as its value shows it, with why */
export type FormulaProblem = { readonly code: string; readonly detail: string };

// A moment as formulas write it (`2026-11-08 14:30:05`): kept with a `T`, as the database keeps a date and time
const WRITTEN_MOMENT_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/;

/**
 * A formula's result as a value of its property (`resultType`: as that type keeps it, else Auto: as it is), and its
 * error where it is one (the value then its code, as a table's cell shows it). A result that is not of the type is
 * kept as calculated, shown as a value that does not read as the type.
 */
export function resultValue(result: Scalar, resultType: unknown): { readonly value: Value; readonly problem?: FormulaProblem } {
  // (A database has no Show result a table's cell has: what a spill's why offers there left out)
  if (result instanceof FormulaError) return { value: result.code, problem: { code: result.code, detail: result.detail.replace(/, or see it with Show result$/, "") } };
  if (result === null) return { value: null };
  if (resultType !== "text" && (typeof result === "number" || typeof result === "boolean")) return { value: result };
  // (A time of day, a duration: as formulas write it; an empty text no value, as an empty cell is none)
  const text = typeof result === "string" ? result : scalarText(result);
  if (text === "") return { value: null };
  if (resultType === "text") return { value: text };
  return { value: text.replace(WRITTEN_MOMENT_RE, "$1T$2") };
}
