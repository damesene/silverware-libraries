// Definitions of conditions and formats checked: the user's (a module of the
// space: its default export a list, or a function given HELPERS returning
// one; each item a definition, or a function given HELPERS returning one, as
// a built-in file is) and the built-in ones alike, through the same checks.
// What a definition's function gives is checked as it is called (evaluate.ts).
import type { ConditionDefinition, FormatDefinition } from "./api.ts";
import { HELPERS } from "./helpers.ts";
import { specsProblem } from "./params.ts";
import { checkStyle } from "./style.ts";

const NAME_RE = /^[a-z][a-z0-9_]*$/i;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A definition given as a function of the helpers called; what it gives, or why it failed */
function made(definition: unknown): unknown {
  if (typeof definition !== "function") return definition;
  try {
    return (definition as (helpers: typeof HELPERS) => unknown)(HELPERS);
  } catch (e) {
    return new Error(message(e));
  }
}

/** Why a definition is none (as a condition, or as a format); undefined: it is one */
function definitionProblem(d: unknown, kind: "condition" | "format"): string | undefined {
  if (d instanceof Error) return `failed: ${d.message}`;
  if (!isObject(d)) return `is no ${kind} (an object, or a function of the helpers giving one)`;
  if (typeof d.name !== "string" || !NAME_RE.test(d.name)) return "has no name (letters, digits and _, starting with a letter)";
  const name = d.name;
  if (typeof d.label !== "string" || !d.label.trim()) return `${name}: has no label`;
  if (d.description !== undefined && typeof d.description !== "string") return `${name}: its description is no text`;
  const params = specsProblem(d.params);
  if (params) return `${name}: ${params}`;
  if (d.excel !== undefined && typeof d.excel !== "function") return `${name}: its excel is no function (params, at)`;
  if (kind === "condition") return typeof d.test === "function" ? undefined : `${name}: has no test(cell, context)`;
  const hasStyle = d.style !== undefined;
  const hasLook = d.look !== undefined;
  if (hasStyle === hasLook) return `${name}: has either a style or a look(cell, context)`;
  if (hasLook && typeof d.look !== "function") return `${name}: its look is no function`;
  if (hasStyle && typeof d.style !== "function") {
    const style = checkStyle(d.style);
    if (typeof style === "string") return `${name}: ${style}`;
  }
  return undefined;
}

/** The definitions given (a module, a list, a function of the helpers), checked: those that are ones, and what is wrong with the others */
export function checkedDefinitions<T>(definitions: unknown, kind: "condition" | "format"): { readonly list: T[]; readonly problems: string[] } {
  let list = definitions;
  if (isObject(list) && !Array.isArray(list) && "default" in list) list = list.default;
  if (typeof list === "function") {
    const given = made(list);
    if (given instanceof Error) return { list: [], problems: [`the definitions failed: ${given.message}`] };
    list = given;
  }
  if (!Array.isArray(list)) return { list: [], problems: [`the definitions are not a list of ${kind}s (or a function returning one)`] };
  const out: T[] = [];
  const problems: string[] = [];
  list.forEach((item: unknown, i) => {
    const definition = made(item);
    const problem = definitionProblem(definition, kind);
    if (problem) problems.push(`${kind} ${i + 1} ${problem}`);
    else out.push(definition as T);
  });
  return { list: out, problems };
}

export const checkedConditions = (definitions: unknown) => checkedDefinitions<ConditionDefinition>(definitions, "condition");
export const checkedFormats = (definitions: unknown) => checkedDefinitions<FormatDefinition>(definitions, "format");
