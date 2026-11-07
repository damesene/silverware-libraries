// Multi-select: some of the property's options (`params.options`), a list,
// each once. Typed with commas between, so no option has a comma in it;
// shown joined by ", ".
import { isEmpty } from "../../../model/database.ts";
import { optionRank, optionsOf, validateOptions } from "../options.ts";
import { keptText, type PropertyType } from "../type.ts";

const texts = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);

export const multiSelect: PropertyType = {
  name: "multi-select",
  label: "Multi-select",
  validateParams: (params) => validateOptions(params, { commas: false }),
  validate: (value, params) => {
    if (isEmpty(value)) return undefined;
    if (!Array.isArray(value) || !value.every((one) => typeof one === "string")) return "no list of options";
    if (new Set(value).size !== value.length) return "an option twice";
    const options = optionsOf(params);
    const strange = texts(value).filter((one) => !options.includes(one));
    return strange.length ? `${strange.map((one) => `"${one}"`).join(", ")} ${strange.length === 1 ? "is" : "are"} none of its options` : undefined;
  },
  text: keptText,
  sortKey: (value, params) => texts(value).map((one) => optionRank(one, optionsOf(params))).join(","),
  parse: (typed) => {
    const parts = [...new Set(typed.split(",").map((one) => one.trim()).filter((one) => one !== ""))];
    return { value: parts.length ? parts : null };
  },
};
