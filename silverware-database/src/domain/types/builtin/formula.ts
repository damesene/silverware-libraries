// Formula: a property whose values its formula gives (docs/silverware-database-formulas.md). Its formula and the
// result's type are its params (`formula`, `resultType`), as a select's options are; its values are calculated as
// the items are read, never kept in an item, and read only. With a result's type it is that type in all but its name
// (shown, sorted, filtered and grouped as that type does, as a select is a multi-select by its params); without one,
// Auto: each value as what it is.
import { isEmpty, type Params, type Value } from "../../../model/database.ts";
import { validateFormula } from "../../formulas/validate.ts";
import { keptText, type Parsed, type PropertyType } from "../type.ts";
import { checkbox } from "./checkbox.ts";
import { date } from "./date.ts";
import { datetime } from "./datetime.ts";
import { number } from "./number.ts";
import { text } from "./text.ts";

/** The formula type's name, as a property's `type` names it */
export const FORMULA_TYPE = "formula";

/** The types a formula's result may be given as (`resultType`) */
const RESULT_TYPES: readonly PropertyType[] = [text, number, checkbox, date, datetime];

/** The names of the types a formula's result may be given as, a property's `resultType` */
export const FORMULA_RESULT_TYPES: readonly string[] = RESULT_TYPES.map((type) => type.name);

// (Nothing is typed into a formula's value: an editor offering one would be refused here)
const calculatedOnly = (): Parsed => ({ problem: "a formula's values are calculated" });

/** Why params are no formula property's, undefined where they are (no formula yet: values none) */
function validateFormulaParams(params: Params): string | undefined {
  if (params.formula !== undefined && typeof params.formula !== "string") return "its formula is no text";
  const formulaProblem = typeof params.formula === "string" && params.formula.trim() !== "" ? validateFormula(params.formula) : undefined;
  if (formulaProblem) return formulaProblem;
  const result = params.resultType;
  if (result !== undefined && !RESULT_TYPES.some((type) => type.name === result)) {
    return `its result's type "${String(result)}" is none of ${RESULT_TYPES.map((type) => type.name).join(", ")}`;
  }
  return undefined;
}

const isScalar = (value: Value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean";

// Each result's type as the formula type, made once (the registry asks for a property's type often)
const asResult = new Map<string, PropertyType>();

function resultTyped(params: Params): PropertyType {
  const result = RESULT_TYPES.find((type) => type.name === params.resultType);
  if (!result) return formula;
  let made = asResult.get(result.name);
  if (!made) {
    // (Its settings none and its params the formula type's to check; its editor kept, what the views know its values by (a
    // date's day placed in a calendar, a checkbox grouped as one), no value typed in it: a formula is read only)
    const { forParams: _forParams, settings: _settings, validateParams: _validateParams, ...shown } = result;
    made = { ...shown, name: FORMULA_TYPE, label: formula.label, parse: calculatedOnly, validateParams: validateFormulaParams };
    asResult.set(result.name, made);
  }
  return made;
}

/** Auto, a formula of no result's type given: a value as what it is (a number, a text, a logical value) */
export const formula: PropertyType = {
  name: FORMULA_TYPE,
  label: "Formula",
  forParams: resultTyped,
  validateParams: validateFormulaParams,
  validate: (value) => (isEmpty(value) || isScalar(value) ? undefined : "no value a formula gives"),
  text: keptText,
  parse: calculatedOnly,
};
