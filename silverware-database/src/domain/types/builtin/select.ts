// Select: one of the property's options (`params.options`), or some of them
// where it says `multiple: true` (a list, each once; typed with commas between,
// so no option of such a select has a comma in it; shown joined by ", "). One
// type with a setting, as Notion's Select and Multi-select differ in that
// alone (decided with the user 2026-11-09): its shape for its params is
// `forParams`'s. A value not among the options is kept and shown invalid;
// sorted in the options' order.
import { isEmpty, type Params } from "../../../model/database.ts";
import { optionRank, optionsOf, validateOptions } from "../options.ts";
import { keptText, type PropertyType } from "../type.ts";

/** Whether a select's params pick several options */
export const picksSeveral = (params: Params): boolean => params.multiple === true;

const texts = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);

const validateParams = (params: Params): string | undefined => {
  if (params.multiple !== undefined && typeof params.multiple !== "boolean") return "its multiple is no logical value";
  return validateOptions(params, picksSeveral(params) ? { commas: false } : {});
};

const SETTINGS = [{ param: "multiple", label: "Multiple", hint: "Several options picked, a list" }] as const;

// One option picked
const single: PropertyType = {
  name: "select",
  label: "Select",
  editor: "select",
  look: "options",
  settings: SETTINGS,
  validateParams,
  validate: (value, params) => {
    if (isEmpty(value)) return undefined;
    if (typeof value !== "string") return "no option";
    return optionsOf(params).includes(value) ? undefined : `"${value}" is none of its options`;
  },
  text: keptText,
  sortKey: (value, params) => (typeof value === "string" ? optionRank(value, optionsOf(params)) : ""),
  parse: (typed) => ({ value: typed.trim() === "" ? null : typed.trim() }),
};

// Some options picked (`multiple: true`): a list, each once
const several: PropertyType = {
  ...single,
  editor: "multi-select",
  lists: true,
  icon: "select-multiple",
  validate: (value, params) => {
    if (isEmpty(value)) return undefined;
    if (!Array.isArray(value) || !value.every((one) => typeof one === "string")) return "no list of options";
    if (new Set(value).size !== value.length) return "an option twice";
    const options = optionsOf(params);
    const strange = texts(value).filter((one) => !options.includes(one));
    return strange.length ? `${strange.map((one) => `"${one}"`).join(", ")} ${strange.length === 1 ? "is" : "are"} none of its options` : undefined;
  },
  sortKey: (value, params) => texts(value).map((one) => optionRank(one, optionsOf(params))).join(","),
  parse: (typed) => {
    const parts = [...new Set(typed.split(",").map((one) => one.trim()).filter((one) => one !== ""))];
    return { value: parts.length ? parts : null };
  },
};

export const select: PropertyType = { ...single, forParams: (params) => (picksSeveral(params) ? several : single) };
