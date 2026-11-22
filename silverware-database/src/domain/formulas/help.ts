// What a formula property's field offers while its formula is typed (docs/silverware-database-formulas.md, decided 2):
// the functions and the database's properties offered as a name is typed, the function the caret is in, why the
// formula cannot be; and its result for one item, calculated over the whole database as the views calculate it. Pure:
// the field (shared/formulafield.ts) is drawn by the properties' module.
import { choiceText, type FormulaChoice, formulaChoices, functionHelp, type FormulaHelp, withEquals } from "../../../../shared/formulas/index.ts";
import { type Database, type Item, NAME_KEY, type Params, type Property, type Value } from "../../model/database.ts";
import { FORMULA_TYPE } from "../types/builtin/formula.ts";
import { withFormulaValues } from "./calculate.ts";
import type { FormulaProblem } from "./model.ts";
import { validateFormula } from "./validate.ts";

/** A choice offered as a formula is typed: what the list shows, what it puts in place of from..to, what it is */
export type FormulaOffer = { readonly label: string; readonly insert: string; readonly kind: string };

const KINDS: Readonly<Record<FormulaChoice["kind"], string>> = { function: "function", column: "property", cell: "cell", row: "row", table: "table", source: "source" };

/** How a property is written in a formula of its own item: by its key, which stays as its name changes */
export const propertyReference = (property: Pick<Property, "key">): string => `[@${property.key}]`;

/** The properties a formula reads by name, as offered: the item's name first, each by its label and key */
function columns(database: Database): { readonly name: string; readonly id: string }[] {
  return [{ name: "Name", id: NAME_KEY }, ...database.properties.map((property) => ({ name: property.label || property.key, id: property.key }))];
}

/**
 * What the name typed before `caret` may be: a function, or in `[` `[@` a property (shown by its label, written by its
 * key); its place in `text` and the choices, undefined where nothing is offered. A formula written without its "="
 * read as one with it
 */
export function formulaCompletion(database: Database, text: string, caret: number): { readonly from: number; readonly to: number; readonly choices: readonly FormulaOffer[] } | undefined {
  const { formula, shift } = withEquals(text);
  const made = formulaChoices(formula, caret + shift, caret + shift, [], undefined, columns(database), true);
  if (!made) return undefined;
  return {
    from: made.from - shift,
    to: made.to - shift,
    choices: made.choices.map((choice) => ({ label: choice.kind === "column" ? choice.name : choiceText(choice).replace(/[([!]$/, ""), insert: choiceText(choice), kind: KINDS[choice.kind] })),
  };
}

/** The function the caret is in: its syntax, the argument at the caret; undefined out of any */
export function formulaFunctionHelp(text: string, caret: number): FormulaHelp | undefined {
  const { formula, shift } = withEquals(text);
  return functionHelp(formula, caret + shift);
}

/**
 * Why a formula typed cannot be a property's (it does not read, it reads outside the database), as said next to it
 * (`the formula ends too early`, not the params' `its formula: …`); undefined where it can, or nothing is typed
 */
export function formulaTypedProblem(text: string): string | undefined {
  return text.trim() ? validateFormula(text)?.replace(/^its formula: /, "") : undefined;
}

/** A formula's result for one item: its value (null: none), or the error it gives with why */
export type FormulaPreview = { readonly value: Value; readonly problem?: FormulaProblem };

/**
 * The result `params` (a formula property's, as typed) give for `item`, calculated over all `items` as the views
 * calculate it (the database's other formulas with it, a whole column read once); `key` the property's (a new one: any
 * key no other property has)
 */
export function formulaPreview(database: Database, items: readonly Item[], key: string, params: Params, item: Item): FormulaPreview {
  const at = database.properties.findIndex((one) => one.key === key);
  const property: Property = { key, label: at >= 0 ? database.properties[at]!.label : key, type: FORMULA_TYPE, params, readonly: true };
  const properties = at >= 0 ? database.properties.map((one, n) => (n === at ? property : one)) : [...database.properties, property];
  const { items: calculated, problems } = withFormulaValues(items, { ...database, properties });
  const index = items.indexOf(item);
  const value = index < 0 ? null : (calculated[index]!.values[key] ?? null);
  const problem = problems.get(item.key)?.[key];
  return { value, ...(problem ? { problem } : {}) };
}
