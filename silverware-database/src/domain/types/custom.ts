// The user's property types (`silverware.database.defineTypes`): checked as
// they are defined, and each method guarded as it is called, so a type that
// throws or gives the wrong kind of answer never breaks a view, an editor or a
// change of a property's type, and never empties a value: a value whose type
// failed shows as kept (`keptText`) and reads as invalid, with why; a text
// typed that the type failed to read is not written. What failed is told once
// per type and method (`told`), as Silverware Table's custom types are.
import { isEmpty, isValue, type Params, type Value } from "../../model/database.ts";
import { BUILT_IN_TYPES } from "./builtin/index.ts";
import { keptText, type Parsed, type PropertyType } from "./type.ts";

// The built-in types' names: a property names its type by it, so a type of one's name would stand for two: refused, its own
// name asked for. How a type is edited and shown it says itself (`editor`, `look`), a type of the user's as a built-in one
const BUILT_IN_NAMES = new Set(BUILT_IN_TYPES.map((type) => type.name));

/** What a type's definition is given where it is a function: what the built-in types use */
export const TYPE_HELPERS = {
  /** A value as kept, as text (what to show of a value that does not read as the type) */
  keptText,
  /** Whether a value is empty (none, "", an empty list): every type reads an empty value */
  isEmpty,
  /** Whether something is a value the model keeps (a text, a finite number, a logical value, null, a list of texts) */
  isValue,
} as const;

// A type's name, as a property's `type` names it
const TYPE_NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Why a definition cannot be a type, undefined where it can */
export function validateType(type: PropertyType): string | undefined {
  if (!type || typeof type.name !== "string" || !TYPE_NAME_RE.test(type.name)) return `"${String(type?.name)}" is no type's name: lower case letters, digits and -, starting with a letter`;
  if (BUILT_IN_NAMES.has(type.name)) return `"${type.name}" is a built-in type's name: give yours a name of its own`;
  if (typeof type.label !== "string" || !type.label.trim()) return `the type "${type.name}" has no label`;
  for (const method of ["validate", "text", "parse"] as const) if (typeof type[method] !== "function") return `the type "${type.name}" has no ${method}`;
  for (const method of ["validateParams", "sortKey", "groupValue"] as const) if (type[method] !== undefined && typeof type[method] !== "function") return `the type "${type.name}": ${method} is no function`;
  if (type.editor !== undefined && !EDITORS.includes(type.editor)) return `the type "${type.name}": its editor is one of ${EDITORS.join(", ")}`;
  if (type.look !== undefined && !LOOKS.includes(type.look)) return `the type "${type.name}": its look is one of ${LOOKS.join(", ")}`;
  // (A value turned by a press is a box, and a box is turned by a press: one without the other would be drawn one way and edited another)
  if ((type.editor === "toggle") !== (type.look === "check")) return `the type "${type.name}": the editor "toggle" and the look "check" go together`;
  return undefined;
}

// The kinds of editor and of look a type may say (domain/types/type.ts)
const EDITORS: readonly string[] = ["select", "multi-select", "date", "time", "datetime-local", "link", "toggle", "documents"];
const LOOKS: readonly string[] = ["options", "share", "link", "check", "documents"];

// What is done where a method failed, as the user is told
const DONE: Readonly<Record<string, string>> = {
  validate: "its values shown as kept, invalid",
  text: "its values shown as kept",
  sortKey: "its values sorted by their text",
  groupValue: "a group per value",
  parse: "the text typed not written",
  validateParams: "its properties' settings taken as not its own",
};

/** A type whose every method is guarded: a throw or a wrong answer taken as safely as it can be, told (`told`) once per method */
export function guardedType(type: PropertyType, told: (problem: string) => void): PropertyType {
  const toldOf = new Set<string>();
  const failed = (method: string, why: string) => {
    const problem = `the type "${type.name}" failed in ${method}: ${why}`;
    if (!toldOf.has(method)) {
      toldOf.add(method);
      told(`${problem} (${DONE[method] ?? "nothing written"})`);
    }
    return problem;
  };
  const call = <T>(method: string, run: () => unknown, valid: (answer: unknown) => answer is T, fallback: (problem: string) => T): T => {
    try {
      const answer = run();
      return valid(answer) ? answer : fallback(failed(method, `it gave ${describe(answer)}`));
    } catch (error) {
      return fallback(failed(method, error instanceof Error ? error.message : String(error)));
    }
  };
  // (A problem says why: an empty one is no answer, read one way only)
  const problemOrNone = (answer: unknown): answer is string | undefined => answer === undefined || (typeof answer === "string" && answer.trim() !== "");
  const text = (answer: unknown): answer is string => typeof answer === "string";
  // (One of the two, never both: an editor and a change of type would read both one way each)
  const parsed = (answer: unknown): answer is Parsed => {
    if (typeof answer !== "object" || answer === null || ("value" in answer && "problem" in answer)) return false;
    if ("value" in answer) return isValue((answer as { value: unknown }).value);
    const problem = (answer as { problem?: unknown }).problem;
    return typeof problem === "string" && problem.trim() !== "";
  };
  return {
    name: type.name,
    label: type.label,
    ...(type.editor ? { editor: type.editor } : {}),
    ...(type.look ? { look: type.look } : {}),
    ...(type.offered === false ? { offered: false } : {}),
    ...(type.lists === true ? { lists: true } : {}),
    ...(type.validateParams ? { validateParams: (params: Params) => call("validateParams", () => type.validateParams!(params), problemOrNone, (problem) => problem) } : {}),
    validate: (value: Value, params: Params) => call("validate", () => type.validate(value, params), problemOrNone, (problem) => problem),
    text: (value: Value, params: Params) => call("text", () => type.text(value, params), text, () => keptText(value)),
    ...(type.sortKey ? { sortKey: (value: Value, params: Params) => call("sortKey", () => type.sortKey!(value, params), text, () => keptText(value)) } : {}),
    // (A value's group never the group of none: an empty answer for a value is a wrong one)
    ...(type.groupValue ? { groupValue: (value: Value, params: Params) => call("groupValue", () => type.groupValue!(value, params), (answer): answer is Value => isValue(answer) && (isEmpty(value) || !isEmpty(answer)), () => value) } : {}),
    parse: (typed: string, params: Params, was?: Value) => call("parse", () => type.parse(typed, params, was), parsed, (problem): Parsed => ({ problem })),
  };
}

function describe(answer: unknown): string {
  if (answer === undefined) return "nothing";
  if (answer === null) return "null";
  return typeof answer === "object" ? (Array.isArray(answer) ? "a list" : "an object of the wrong shape") : `a ${typeof answer}`;
}
