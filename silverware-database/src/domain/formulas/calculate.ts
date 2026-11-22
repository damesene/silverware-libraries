// A database's formula properties calculated for its items (docs/silverware-database-formulas.md, decided 5), as
// withSystemValues gives the system's: every formula property's key of every item set to its result, or taken off
// where it has none, so no value an item keeps under such a key is ever shown or written back. Pure: what else formulas
// read is given (`tables`; none yet: a database's formulas read only its own items).
import { callsPureFunctionsOnly, formulaResults, type TableSource } from "../../../../shared/formulas/index.ts";
import type { Database, Item, ItemKey, Value } from "../../model/database.ts";
import { databaseTable, type FormulaProblem, formulaOf, isFormula, resultValue } from "./model.ts";

/** Items with their formulas' values, and the errors among them by item and property key */
export type FormulaValues = {
  readonly items: readonly Item[];
  readonly problems: ReadonlyMap<ItemKey, Readonly<Record<string, FormulaProblem>>>;
};

// Each item calculated with errors, its errors by property key: what a view marks an error's value by (formulaProblemOf)
const problemsByItem = new WeakMap<Item, Readonly<Record<string, FormulaProblem>>>();

/** The error a formula property's value of an item is (its code the value), as the item was calculated; none where it is no error */
export function formulaProblemOf(item: Item, key: string): FormulaProblem | undefined {
  return problemsByItem.get(item)?.[key];
}

/**
 * How many of the items (as calculated) a formula property's value is an error of, and the error most of them give, as
 * said once a formula is saved (`2 of 40 items give an error: division by zero`); none where no item gives one
 */
export function formulaErrorsSaid(items: readonly Item[], key: string): string | undefined {
  const details = new Map<string, number>();
  let count = 0;
  for (const item of items) {
    const problem = formulaProblemOf(item, key);
    if (!problem) continue;
    count++;
    details.set(problem.detail, (details.get(problem.detail) ?? 0) + 1);
  }
  if (!count) return undefined;
  const [detail] = [...details].reduce((most, one) => (one[1] > most[1] ? one : most));
  return `${count === items.length ? (count === 1 ? "The item gives" : `All ${count} items give`) : `${count} of ${items.length} items give${count === 1 ? "s" : ""}`} an error: ${detail}`;
}

/** The items with their formula properties' values calculated over the whole database */
export function withFormulaValues(items: readonly Item[], database: Database, tables?: TableSource): FormulaValues {
  const formulas = database.properties.map((property, at) => ({ property, column: at + 1 })).filter(({ property }) => isFormula(property));
  if (!formulas.length) return { items, problems: new Map() };
  const { table, cells, refused } = databaseTable(database, items);
  // (A database's rows are no markdown table's: no row a total row; a number its formulas write as text with a point)
  const results = formulaResults(table, { cells, ...(tables ? { tables } : {}), own: { decimalComma: false, totalRows: false } });
  const problems = new Map<ItemKey, Record<string, FormulaProblem>>();
  const calculated = items.map((item, at) => {
    const values: Record<string, Value> = { ...item.values };
    for (const { property, column } of formulas) {
      const result = refused.get(property.key) ?? results.get(`${at + 1},${column}`);
      if (result === undefined) {
        delete values[property.key];
        continue;
      }
      const { value, problem } = resultValue(result, property.params.resultType);
      if (value === null) delete values[property.key];
      else values[property.key] = value;
      if (problem) {
        const of = problems.get(item.key) ?? {};
        of[property.key] = problem;
        problems.set(item.key, of);
      }
    }
    const made = { ...item, values };
    const of = problems.get(item.key);
    if (of) problemsByItem.set(made, of);
    return made;
  });
  return { items: calculated, problems };
}

/**
 * Whether a database's formulas give another result as time goes (`TODAY()`, `NOW()`) or as functions defined from
 * Space Lua change: its values are then calculated at every reading, never kept from one to the next
 */
export function changesByItself(database: Database): boolean {
  return database.properties.some((property) => {
    // (A property's own formula, or its options' (options.ts), whose list follows the time as its values would)
    const formula = isFormula(property) ? formulaOf(property.params) : typeof property.params.optionsFormula === "string" ? property.params.optionsFormula : undefined;
    return formula !== undefined && formula.trim() !== "" && !callsPureFunctionsOnly(formula);
  });
}
