// What the select types share: their options, a list of texts in a
// property's params (`{ options: ["Todo", "Doing", "Done"] }`), in their order.
import type { Params } from "../../model/database.ts";

/** A property's options as its params have them (none where they are not a list of texts) */
export function optionsOf(params: Params): readonly string[] {
  const options = params.options;
  return Array.isArray(options) && options.every((option) => typeof option === "string") ? options : [];
}

/**
 * Why params are no options of a select, undefined where they are (none
 * given: a select of no options yet); `commas: false` where options are typed
 * with commas between (a multi-select's)
 */
export function validateOptions(params: Params, rules: { readonly commas?: boolean } = {}): string | undefined {
  const options = params.options;
  if (options === undefined) return undefined;
  if (!Array.isArray(options) || !options.every((option) => typeof option === "string")) return "its options are no list of texts";
  if (new Set(options).size !== options.length) return "its options repeat one";
  if (rules.commas === false && options.some((option) => option.includes(","))) return "an option has a comma, which typing it would split";
  return undefined;
}

/**
 * An option's place as sorting compares it: in the options' order, one not
 * among them after them, by its text (letters lead, as a locale's collation
 * may pass over punctuation: `a` before `b` in any)
 */
export function optionRank(option: string, options: readonly string[]): string {
  const at = options.indexOf(option);
  return at < 0 ? `b${option}` : `a${String(at).padStart(6, "0")}`;
}
