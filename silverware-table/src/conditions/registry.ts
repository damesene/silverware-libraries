// Which conditions and formats exist: the built-in ones (builtin/, made
// through the same checks as the user's) and the custom ones, which replace a
// built-in one of their name in its place. `version` changes with every
// definition, so what was evaluated with those before is not kept.
import type { ConditionDefinition, FormatDefinition } from "./api.ts";
import { BUILT_IN_CONDITIONS, BUILT_IN_FORMATS } from "./builtin/index.ts";
import { checkedConditions, checkedFormats } from "./custom.ts";

type Known<T extends { readonly name: string }> = { readonly all: readonly T[]; readonly byName: ReadonlyMap<string, T> };

function knownOf<T extends { readonly name: string }>(builtIn: readonly T[], custom: readonly T[]): Known<T> {
  const lower = (t: T) => t.name.toLowerCase();
  const replacing = new Map(custom.map((t) => [lower(t), t]));
  const all = [...builtIn.map((t) => replacing.get(lower(t)) ?? t), ...custom.filter((t) => !builtIn.some((b) => lower(b) === lower(t)))];
  return { all, byName: new Map(all.map((t) => [lower(t), t])) };
}

// The built-in ones, made once: a built-in definition that fails its checks is a bug (a test makes them all)
const builtInConditions = checkedConditions(BUILT_IN_CONDITIONS);
const builtInFormats = checkedFormats(BUILT_IN_FORMATS);

/** What is wrong with the built-in definitions (none: a test says so) */
export const BUILT_IN_PROBLEMS: readonly string[] = [...builtInConditions.problems, ...builtInFormats.problems];

let customConditions: readonly ConditionDefinition[] = [];
let customFormats: readonly FormatDefinition[] = [];
let conditions = knownOf(builtInConditions.list, customConditions);
let formats = knownOf(builtInFormats.list, customFormats);
let anewConditions = false;
let anewFormats = false;
let changes = 0;

/** Changes with every definition made: what was evaluated before may differ */
export function definitionsVersion(): number {
  return changes;
}

export const allConditions = (): readonly ConditionDefinition[] => conditions.all;
export const allFormats = (): readonly FormatDefinition[] => formats.all;
export const conditionNamed = (name: string): ConditionDefinition | undefined => conditions.byName.get(name.toLowerCase());
export const formatNamed = (name: string): FormatDefinition | undefined => formats.byName.get(name.toLowerCase());
export const isBuiltInCondition = (d: ConditionDefinition) => builtInConditions.list.includes(d);
export const isBuiltInFormat = (d: FormatDefinition) => builtInFormats.list.includes(d);

const merged = <T extends { readonly name: string }>(before: readonly T[], anew: boolean, given: readonly T[]) =>
  Array.from(new Map([...(anew ? [] : before), ...given].map((t) => [t.name.toLowerCase(), t])).values());

/** Custom conditions, added to those defined before (one of the same name replaced), or replacing them all after `customDefinitionsAnew` */
export function defineCustomConditions(given: readonly ConditionDefinition[]): void {
  customConditions = merged(customConditions, anewConditions, given);
  anewConditions = false;
  conditions = knownOf(builtInConditions.list, customConditions);
  changes++;
}

/** Custom formats, as `defineCustomConditions` */
export function defineCustomFormats(given: readonly FormatDefinition[]): void {
  customFormats = merged(customFormats, anewFormats, given);
  anewFormats = false;
  formats = knownOf(builtInFormats.list, customFormats);
  changes++;
}

/** Space Lua is loaded again: the scripts define them anew; those of before are kept until then */
export function customDefinitionsAnew(): void {
  anewConditions = true;
  anewFormats = true;
}

/** Forgets the custom definitions (tests) */
export function clearCustomDefinitions(): void {
  customConditions = [];
  customFormats = [];
  conditions = knownOf(builtInConditions.list, customConditions);
  formats = knownOf(builtInFormats.list, customFormats);
  anewConditions = false;
  anewFormats = false;
  changes++;
}
