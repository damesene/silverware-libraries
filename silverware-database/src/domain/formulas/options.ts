// A property's options given by a formula (docs/silverware-database-formulas.md, decided 7): a select's, a
// multi-select's, a person's `optionsFormula`, calculated over the database's items as its formulas are (its own items
// alone for now). Never kept: the schema as kept has the formula, a schema with its list as `options` is what shows
// the database (the calculating store's), never what a write is made from.
import { FormulaError, listResult } from "../../../../shared/formulas/index.ts";
import type { Database, Item, Params } from "../../model/database.ts";
import { databaseTable, type FormulaProblem } from "./model.ts";

/** The formula a property's params give its options by, none where they are listed */
export function optionsFormulaOf(params: Params): string | undefined {
  return typeof params.optionsFormula === "string" && params.optionsFormula.trim() !== "" ? params.optionsFormula : undefined;
}

/** The options a formula gives over the items: its list's texts, each once, empty ones left out; or why it gives none */
export function formulaOptions(database: Database, items: readonly Item[], formula: string): readonly string[] | FormulaProblem {
  const { table, cells } = databaseTable(database, items);
  const listed = listResult(table, { cells, own: { decimalComma: false, totalRows: false } }, formula);
  if (listed instanceof FormulaError) return { code: listed.code, detail: listed.detail };
  if (listed === undefined) return { code: "#REF!", detail: "it reads what is not read here" };
  return [...new Set(listed.map((one) => one.trim()).filter(Boolean))];
}

/**
 * The database as its views show it: each property whose options are a formula's with its list as its `options` (none
 * where it gives an error, said by its problem); the same database where none is
 */
export function withFormulaOptions(database: Database, items: readonly Item[]): { readonly database: Database; readonly problems: ReadonlyMap<string, FormulaProblem> } {
  const problems = new Map<string, FormulaProblem>();
  if (!database.properties.some((property) => optionsFormulaOf(property.params) !== undefined)) return { database, problems };
  const properties = database.properties.map((property) => {
    const formula = optionsFormulaOf(property.params);
    if (formula === undefined) return property;
    const given = formulaOptions(database, items, formula);
    if ("code" in given) problems.set(property.key, given);
    // (A multi-select's values are typed with commas between: an option with one would be split, so it is none)
    const options = "code" in given ? [] : property.params.multiple === true ? given.filter((one) => !one.includes(",")) : [...given];
    return { ...property, params: { ...property.params, options } };
  });
  return { database: { ...database, properties }, problems };
}
