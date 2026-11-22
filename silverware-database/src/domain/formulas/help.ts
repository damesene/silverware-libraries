// What a formula property's field offers while its formula is typed (docs/silverware-database-formulas.md, decided 2):
// the functions and the database's properties offered as a name is typed, the function the caret is in, why the
// formula cannot be; and its result for one item, calculated over the whole database as the views calculate it. Pure:
// the field (shared/formulafield.ts) is drawn by the properties' module.
import { choiceText, type FormulaChoice, formulaChoices, functionHelp, type FormulaHelp, nameTyped, tokenize, withEquals } from "../../../../shared/formulas/index.ts";
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

/** How a property is written for every item's values (a whole column, for SUM, COUNT…) */
export const columnReference = (property: Pick<Property, "key">): string => `[${property.key}]`;

/** Whether a property's label or key starts with what is typed (ignoring case) */
export const propertyStarts = (property: { readonly label: string; readonly key: string }, typed: string): boolean =>
  property.label.toLowerCase().startsWith(typed.toLowerCase()) || property.key.toLowerCase().startsWith(typed.toLowerCase());

/** The properties a formula of `own` reads by name, as offered: the item's name first, each by its label and key; not `own` itself (it would read itself) */
function columns(database: Database, own?: string): { readonly name: string; readonly id: string }[] {
  return [{ name: "Name", id: NAME_KEY }, ...database.properties.filter((property) => property.key !== own).map((property) => ({ name: property.label || property.key, id: property.key }))];
}

// A name typed as a label may be written: its words (letters of any script, digits, _) and the spaces between them
const LABEL_TYPED_RE = /^[\p{L}_][\p{L}\p{N}_ ]*$/u;
const WORD_RE = /[\p{L}\p{N}_]/u;

/** What is typed of a property or a function before the caret, where it is (`to` the caret) */
export type NameTyped = { readonly from: number; readonly to: number; readonly typed: string; readonly bracket: boolean };

/**
 * The name being typed before `caret`: a reference opened and not closed (`[es`, `[@es`: from its "[", `bracket`), a
 * property's label as typed, spaces in it too (`Due d` of "Due date": the longest that starts a label of
 * `database`'s, `own` left out), else a function's name (`SU`); none where nothing is (in a text in quotes, after an
 * operand)
 */
export function formulaNameTyped(text: string, caret: number, database?: Database, own?: string): NameTyped | undefined {
  const { formula, shift } = withEquals(text);
  const at = caret + shift;
  const before = formula.slice(0, at);
  const quoted = (upTo: number) => !!tokenize(formula.slice(0, upTo)).error;
  const result = (from: number, bracket: boolean): NameTyped => ({ from: from - shift, to: at - shift, typed: before.slice(from).replace(/^\[@?/, ""), bracket });
  const open = /\[@?[^[\]"]*$/.exec(before);
  // (Not a source's column, @tasks[du: that is no property of the item)
  if (open && !quoted(open.index) && !/@[A-Za-z0-9_]*$/.test(before.slice(0, open.index))) return result(open.index, true);
  if (open) return undefined;
  // (A name only where an operand may start: after "=", "(", ",", ";" or an operator; and not in the middle of a word)
  const operandStarts = (from: number) => /(^|[=(,;+\-*/^&<>])$/.test(before.slice(0, from).trimEnd());
  if (database && !WORD_RE.test(formula[at] ?? "")) {
    const labels = columns(database, own);
    // (The longest: from the first word start within reach whose text from there starts a label or a key)
    for (let from = Math.max(0, at - 80); from < at; from++) {
      if (from > 0 && WORD_RE.test(before[from - 1]!)) continue;
      const typed = before.slice(from);
      if (!LABEL_TYPED_RE.test(typed) || !operandStarts(from) || quoted(from)) continue;
      if (labels.some((one) => propertyStarts({ label: one.name, key: one.id }, typed))) return result(from, false);
    }
  }
  const name = nameTyped(formula, at, at);
  return name && formula[name.from] !== "@" && operandStarts(name.from) ? result(name.from, false) : undefined;
}

/**
 * What the name typed before `caret` may be (in a formula of `own`, which is never offered): a property (by its label or
 * key, spaces in a label too, written for this item, `[@key]`) and a function, a function of that whole name first;
 * in `[` `[@` a property (shown by its label, written by its key); its place in `text` and the choices, undefined
 * where nothing is offered. A formula written without its "=" read as one with it
 */
export function formulaCompletion(database: Database, text: string, caret: number, own?: string): { readonly from: number; readonly to: number; readonly choices: readonly FormulaOffer[] } | undefined {
  const { formula, shift } = withEquals(text);
  const made = formulaChoices(formula, caret + shift, caret + shift, [], undefined, columns(database, own), true);
  const offers = made?.choices.map((choice): FormulaOffer => ({ label: choice.kind === "column" ? choice.name : choiceText(choice).replace(/[([!]$/, ""), insert: choiceText(choice), kind: KINDS[choice.kind] })) ?? [];
  const typed = formulaNameTyped(text, caret, database, own);
  if (!typed || typed.bracket) return made ? { from: made.from - shift, to: made.to - shift, choices: offers } : undefined;
  // (A bare name typed: the properties it starts, a property needing no [@ to be found; a function of the whole name
  // typed first, its name's Enter giving it)
  const properties = columns(database, own)
    .filter((one) => propertyStarts({ label: one.name, key: one.id }, typed.typed))
    .map((one): FormulaOffer => ({ label: one.name, insert: propertyReference({ key: one.id }), kind: "property" }));
  const functions = made && made.from - shift === typed.from ? offers : [];
  const whole = functions.filter((one) => one.label.toLowerCase() === typed.typed.toLowerCase());
  const choices = [...whole, ...properties, ...functions.filter((one) => !whole.includes(one))];
  return choices.length ? { from: typed.from, to: typed.to, choices } : undefined;
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
