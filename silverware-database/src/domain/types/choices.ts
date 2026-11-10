// Types whose values are picked from a property's options (`params.options`):
// the select and the person, made by one recipe (`choiceType`). One option,
// or some of them where the params say `multiple: true` (a list, each once;
// typed with commas between, so no option of such a property has a comma in
// it): its shape for its params is `forParams`'s, two type objects of its
// name. A value none of the options is kept and shown invalid, unless the
// type offers to take any (`anyone`: the params say `anyone: true`, the
// options then only offered); sorted in the options' order, the others after
// them by their text. How a value shows (`shown`: a person's `@ada`) is its
// text, which is what is filtered and copied; it is read back as typed
// (`read`: `@ada` is `ada`), so a value is never kept as it shows.
import { isEmpty, type Params } from "../../model/database.ts";
import { optionRank, optionsOf, validateOptions } from "./options.ts";
import { keptText, type PropertyType, type TypeSwitch } from "./type.ts";

/** Whether a property's params pick several options */
export const picksSeveral = (params: Params): boolean => params.multiple === true;

/** Whether a property's params take a value none of its options (a person's Anyone) */
export const takesAny = (params: Params): boolean => params.anyone === true;

/** What makes a type of options */
export type ChoiceSpec = {
  readonly name: string;
  readonly label: string;
  /** The icons the views draw: of one option, of several (none: the type's name's, `select-multiple`) */
  readonly icons?: { readonly one?: string; readonly several: string };
  /** How an option shows, as its text (none: as it is) */
  readonly shown?: (option: string) => string;
  /** An option as typed or shown read as kept (none: as it is, trimmed) */
  readonly read?: (typed: string) => string;
  /** Why an option cannot be one of this type's, beside what every type of options refuses */
  readonly validateOption?: (option: string) => string | undefined;
  /** True where its options are people, shown and pressed as mentions (the person's) */
  readonly mentions?: boolean;
  /** The switch taking any value, none of the options too (a person's Anyone); none: never */
  readonly anyone?: TypeSwitch;
};

const MULTIPLE: TypeSwitch = { param: "multiple", label: "Multiple", hint: "Several options picked, a list" };

const texts = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);

/** A type of options made by its spec: its two shapes, one option or several, as its params pick */
export function choiceType(spec: ChoiceSpec): PropertyType {
  const shown = spec.shown ?? ((option: string) => option);
  const read = (typed: string) => (spec.read ?? ((one: string) => one))(typed.trim()).trim();
  // (A value none of the options: refused unless the params take any)
  const strange = (values: readonly string[], params: Params) => (spec.anyone && takesAny(params) ? [] : values.filter((one) => !optionsOf(params).includes(one)));
  const validateParams = (params: Params): string | undefined => {
    for (const name of ["multiple", ...(spec.anyone ? [spec.anyone.param] : [])]) if (params[name] !== undefined && typeof params[name] !== "boolean") return `its ${name} is no logical value`;
    const problem = validateOptions(params, picksSeveral(params) ? { commas: false } : {});
    if (problem || !spec.validateOption) return problem;
    for (const option of optionsOf(params)) {
      const wrong = spec.validateOption(option);
      if (wrong) return `"${option}": ${wrong}`;
    }
    return undefined;
  };
  const single: PropertyType = {
    name: spec.name,
    label: spec.label,
    editor: "select",
    look: "options",
    ...(spec.icons?.one ? { icon: spec.icons.one } : {}),
    settings: [MULTIPLE, ...(spec.anyone ? [spec.anyone] : [])],
    validateParams,
    validate: (value, params) => {
      if (isEmpty(value)) return undefined;
      if (typeof value !== "string") return "no option";
      return strange([value], params).length ? `"${value}" is none of its options` : undefined;
    },
    text: (value) => (typeof value === "string" ? shown(value) : keptText(value)),
    sortKey: (value, params) => (typeof value === "string" ? optionRank(value, optionsOf(params)) : ""),
    parse: (typed) => {
      const value = read(typed);
      return { value: value === "" ? null : value };
    },
    optionShown: shown,
    ...(spec.mentions ? { mentions: true } : {}),
    // (Where the params take any value: its editors a field to type in too, offering the options)
    takesTyped: (params) => !!spec.anyone && takesAny(params),
  };
  const several: PropertyType = {
    ...single,
    editor: "multi-select",
    lists: true,
    icon: spec.icons?.several ?? `${spec.name}-multiple`,
    validate: (value, params) => {
      if (isEmpty(value)) return undefined;
      if (!Array.isArray(value) || !value.every((one) => typeof one === "string")) return "no list of options";
      if (new Set(value).size !== value.length) return "an option twice";
      const wrong = strange(texts(value), params);
      return wrong.length ? `${wrong.map((one) => `"${one}"`).join(", ")} ${wrong.length === 1 ? "is" : "are"} none of its options` : undefined;
    },
    text: (value) => (Array.isArray(value) && value.every((one) => typeof one === "string") ? value.map(shown).join(", ") : keptText(value)),
    sortKey: (value, params) => texts(value).map((one) => optionRank(one, optionsOf(params))).join(","),
    parse: (typed) => {
      const parts = [...new Set(typed.split(",").map(read).filter((one) => one !== ""))];
      return { value: parts.length ? parts : null };
    },
  };
  return { ...single, forParams: (params) => (picksSeveral(params) ? several : single) };
}
