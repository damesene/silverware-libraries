// Custom actions: the user's own, with code of their own (not a format),
// defined in a JS file of the space and given from Space Lua
// (silverware.toolbar.defineActions on the library page), as formats are: a
// definition, a function given HELPERS returning one or a list, or a list.
// An action's `edit` gets the selection's context and gives the text replacing a part
// of the page (`helpers.cursor()` marking the selection after it); what it
// gives or throws is checked when it runs, a mistake shown, nothing written.
// Or it does something (`perform`: a command run, a page opened) with the
// editor's API the core gives, nothing written by the core; or it offers
// choices. `listed: false`: found by the popup's search only.
import type { Action, ActionEditor, Change, Context } from "./core/action.ts";
import { HELPERS, message } from "./formats/index.ts";
import { letters } from "./icons.ts";

/** What a custom action gives: the text replacing from..to of the page */
export type Edit = { readonly from: number; readonly to: number; readonly text: string };

export type ActionDefinition = {
  readonly name: string;
  readonly label: string;
  readonly icon?: string;
  readonly group?: string;
  readonly keywords?: readonly string[];
  readonly active?: (context: Context) => boolean;
  readonly enabled?: (context: Context) => boolean;
  // What it does; or instead, a list of actions to pick from (`choices`), the one on shown in the toolbar (none: `mixed`)
  readonly edit?: (context: Context) => Edit | undefined;
  // Instead: something it does, awaited (a promise may be given)
  readonly perform?: (context: Context, editor: ActionEditor) => unknown;
  // false: not listed as the popup opens, found by its search only
  readonly listed?: boolean;
  readonly choices?: readonly ActionDefinition[];
  readonly mixed?: string;
  readonly afterWrite?: (written: { readonly text: string }, editor: { select(from: number, to: number): void }) => void;
};

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

// The custom actions by name, as last defined
let custom = new Map<string, Action>();
let anew = false;

/** The definitions given as a flat list, or what failed making them */
function definitionsOf(value: unknown, problems: string[]): unknown[] {
  if (isObject(value) && !Array.isArray(value) && "default" in value) return definitionsOf(value.default, problems);
  if (typeof value === "function") {
    try {
      return definitionsOf((value as (helpers: typeof HELPERS) => unknown)(HELPERS), problems);
    } catch (e) {
      problems.push(`the definitions failed: ${message(e)}`);
      return [];
    }
  }
  if (Array.isArray(value)) return value.flatMap((item) => definitionsOf(item, problems));
  return [value];
}

/** The actions defined, and what is wrong with the others */
export function actionsOf(definitions: unknown): { actions: Action[]; problems: string[] } {
  const problems: string[] = [];
  const actions: Action[] = [];
  definitionsOf(definitions, problems).forEach((definition, i) => {
    const action = actionOf(definition);
    if (typeof action === "string") problems.push(`action ${isObject(definition) && typeof definition.name === "string" ? definition.name : i + 1}: ${action}`);
    else actions.push(action);
  });
  return { actions, problems };
}

function actionOf(definition: unknown): Action | string {
  if (!isObject(definition)) return "not an object";
  const d = definition as Partial<ActionDefinition>;
  const { name, label, icon, group, keywords, choices, mixed, listed } = d;
  if (typeof name !== "string" || !NAME_RE.test(name)) return `its name ${JSON.stringify(name)} is not letters, digits and _ starting with a letter`;
  if (typeof label !== "string" || !label) return "it has no label";
  if (icon !== undefined && typeof icon !== "string") return "its icon is not text (an SVG)";
  if (group !== undefined && typeof group !== "string") return "its group is not text";
  if (keywords !== undefined && !(Array.isArray(keywords) && keywords.every((k) => typeof k === "string"))) return "its keywords are not a list of texts";
  for (const fn of ["active", "enabled", "edit", "perform", "afterWrite"] as const) if (d[fn] !== undefined && typeof d[fn] !== "function") return `its ${fn} is not a function`;
  const { active, enabled, edit, perform, afterWrite } = d;
  if (listed !== undefined && typeof listed !== "boolean") return "its listed is not true or false";
  const kinds = [edit, perform, choices].filter((k) => k !== undefined).length;
  if (kinds > 1) return "it has more than one of edit, perform and choices";
  if (kinds === 0) return "it has none of edit, perform and choices";
  const shown = listed === false ? { listed: false } : {};
  if (mixed !== undefined && typeof mixed !== "string") return "its mixed is not text";
  if (choices !== undefined) {
    if (!Array.isArray(choices) || !choices.length) return "its choices are not a list of actions";
    const own = choices.map(actionOf);
    const wrong = own.findIndex((c) => typeof c === "string");
    if (wrong >= 0) return `its choice ${wrong + 1}: ${own[wrong] as string}`;
    return {
      ...base(name, label, icon, group, keywords, active, enabled),
      ...shown,
      choices: own as Action[],
      ...(mixed ? { mixed } : {}),
    };
  }
  if (perform) {
    return {
      ...base(name, label, icon, group, keywords, active, enabled),
      ...shown,
      perform: async (context, editor) => {
        try {
          await perform(context, editor);
        } catch (e) {
          throw new Error(`${name}'s perform failed: ${message(e)}`);
        }
      },
    };
  }
  if (!edit) return "it has none of edit, perform and choices";
  return {
    ...base(name, label, icon, group, keywords, active, enabled),
    ...shown,
    edit: (context) => {
      const given = call(name, "edit", () => edit(context));
      if (given === undefined) return undefined;
      if (!isEdit(given, context.text.length)) throw new Error(`${name}'s edit did not give { from, to, text } within the page`);
      const change: Change = { from: given.from, to: given.to, insert: given.text };
      if (!afterWrite) return change;
      return { ...change, after: (editor, text) => call(name, "afterWrite", () => afterWrite({ text }, { select: (a, b) => editor.select(given.from + a, given.from + b) })) };
    },
  };
}

/** What every action of a definition has: its id, label, icon, group, keywords, state */
function base(
  name: string,
  label: string,
  icon: string | undefined,
  group: string | undefined,
  keywords: readonly string[] | undefined,
  active: ActionDefinition["active"],
  enabled: ActionDefinition["enabled"],
): Omit<Action, "edit" | "perform" | "choices"> {
  return {
    id: `actions.${name}`,
    label,
    icon: icon ?? letters(label.charAt(0).toUpperCase().replace(/[&<>"]/g, "")),
    group: group ?? "Custom",
    keywords: keywords ?? [],
    ...(active ? { active: (context: Context) => !!call(name, "active", () => active(context)) } : {}),
    ...(enabled ? { enabled: (context: Context) => !!call(name, "enabled", () => enabled(context)) } : {}),
  };
}

function isEdit(value: unknown, length: number): value is Edit {
  if (!isObject(value)) return false;
  const { from, to, text } = value;
  return Number.isInteger(from) && Number.isInteger(to) && (from as number) >= 0 && (from as number) <= (to as number) && (to as number) <= length && typeof text === "string";
}

function call<T>(name: string, fn: string, f: () => T): T {
  try {
    const value = f();
    if (isObject(value) && typeof value.then === "function") throw new Error("it returned a promise: it gives its result at once");
    return value;
  } catch (e) {
    throw new Error(`${name}'s ${fn} failed: ${message(e)}`);
  }
}

/** Custom actions, added to those defined before (one of the same name replaced), or replacing them all after `customActionsAnew`; the names defined again */
export function defineCustomActions(actions: readonly Action[]): string[] {
  const before = anew ? new Map<string, Action>() : custom;
  anew = false;
  const again = actions.filter((a, i) => before.has(a.id) || actions.findIndex((b) => b.id === a.id) < i).map((a) => a.id.slice(8));
  custom = new Map([...before, ...actions.map((a) => [a.id, a] as const)]);
  return [...new Set(again)];
}

export function customActionsAnew(): void {
  anew = true;
}

export function resetCustomActions(): void {
  custom = new Map();
  anew = false;
}

/** The modules' actions with the custom ones: one of a built-in action's id in its place, the others after them */
export function withCustomActions(actions: readonly Action[]): Action[] {
  const own = actions.map((a) => custom.get(a.id) ?? a);
  const ids = new Set(actions.map((a) => a.id));
  return [...own, ...[...custom.values()].filter((a) => !ids.has(a.id))];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
