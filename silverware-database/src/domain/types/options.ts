// What the select types share: their options, a list of texts in a
// property's params (`{ options: ["Todo", "Doing", "Done"] }`), in their order,
// and the colors the user gave some of them (`colors: { Done: "green", Blocked:
// "#c0392b" }`: a color of the palette by its name, or one of the user's own as
// `#rrggbb`; an option without one has the color of its place among the options).
import type { Params } from "../../model/database.ts";

/** The colors an option may have, by name, in the order an option's place picks one */
export const OPTION_COLORS = ["gray", "blue", "green", "yellow", "orange", "red", "purple", "pink"] as const;
export type NamedColor = (typeof OPTION_COLORS)[number];
/** A color of an option: a palette's by name, or the user's own, `#rrggbb` */
export type OptionColor = NamedColor | `#${string}`;

const OWN_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Whether something is a color an option may have */
export function isOptionColor(color: unknown): color is OptionColor {
  return typeof color === "string" && ((OPTION_COLORS as readonly string[]).includes(color) || OWN_COLOR_RE.test(color));
}

/** The colors given to options, by option (none: an empty map; what is no color left out) */
export function colorsOf(params: Params): Readonly<Record<string, OptionColor>> {
  const colors = params.colors;
  if (typeof colors !== "object" || colors === null || Array.isArray(colors)) return {};
  return Object.fromEntries(Object.entries(colors).filter((entry): entry is [string, OptionColor] => isOptionColor(entry[1])));
}

/**
 * An option's color: a place among OPTION_COLORS (the one given it by name,
 * else its place among the options) or the user's own `#rrggbb`; none where
 * it is none of the options
 */
export function optionColor(params: Params, option: string): number | `#${string}` | undefined {
  const colors = colorsOf(params);
  // (Its own key only: an option named "constructor" has no color of Object's)
  const given = Object.hasOwn(colors, option) ? colors[option] : undefined;
  if (given) return given.startsWith("#") ? (given.toLowerCase() as `#${string}`) : OPTION_COLORS.indexOf(given as NamedColor);
  const at = optionsOf(params).indexOf(option);
  return at < 0 ? undefined : at % OPTION_COLORS.length;
}

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
  const colors = params.colors;
  if (colors !== undefined) {
    if (typeof colors !== "object" || colors === null || Array.isArray(colors)) return "its colors are no map of an option to a color";
    const wrong = Object.values(colors).find((color) => !isOptionColor(color));
    if (wrong !== undefined) return `"${String(wrong)}" is no color: ${OPTION_COLORS.join(", ")}, or #rrggbb`;
  }
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
