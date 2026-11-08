// Select: one of the property's options (`params.options`). A value not among
// them is kept and shown invalid; sorted in the options' order.
import { isEmpty } from "../../../model/database.ts";
import { optionRank, optionsOf, validateOptions } from "../options.ts";
import { keptText, type PropertyType } from "../type.ts";

export const select: PropertyType = {
  name: "select",
  label: "Select",
  editor: "select",
  look: "options",
  validateParams: (params) => validateOptions(params),
  validate: (value, params) => {
    if (isEmpty(value)) return undefined;
    if (typeof value !== "string") return "no option";
    return optionsOf(params).includes(value) ? undefined : `"${value}" is none of its options`;
  },
  text: keptText,
  sortKey: (value, params) => (typeof value === "string" ? optionRank(value, optionsOf(params)) : ""),
  parse: (typed) => ({ value: typed.trim() === "" ? null : typed.trim() }),
};
