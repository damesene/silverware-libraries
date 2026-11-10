// A task's line as SilverBullet reads one (client/markdown_parser/extended_task.ts
// of main, 2026-11-10): a list item's marker, its state in brackets (`[ ]`,
// `[x]`, or one of its own, `[IN PROGRESS]`, which cannot hold `:` lest it be
// an attribute), the text after. Its attributes are inline.ts' marks; their
// values are YAML on one line, read and written by shared/yaml/tree.ts.
import { quoted, readYamlInline, writeYamlInline, type YamlRead, type YamlValue } from "../yaml/tree.ts";

const TASK_RE = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+\[([^\]:\n]+)\](?:[ \t]+|$)/;
const ATTRIBUTE_NAME_RE = /^[\w$]+$/;

/** A task's line read */
export type TaskLine = {
  // What its marker is indented by
  readonly indent: string;
  // Its list marker: `-`, `*`, `+`, `1.`, `1)`
  readonly marker: string;
  // What is in its brackets: " ", "x", or a state of its own
  readonly state: string;
  readonly done: boolean;
  // The text after the brackets, and where it starts in the line
  readonly text: string;
  readonly textFrom: number;
};

/** Whether a task's state is done (`x`, as SilverBullet's `[x]` and `[X]`) */
export const isDoneState = (state: string) => state === "x" || state === "X";

/** A line as a task, if it is one */
export function readTaskLine(line: string): TaskLine | undefined {
  const m = TASK_RE.exec(line);
  if (!m) return undefined;
  const state = m[3]!;
  return { indent: m[1]!, marker: m[2]!, state, done: isDoneState(state), text: line.slice(m[0].length), textFrom: m[0].length };
}

/** Why a task cannot have a state (empty, a `]`, a `:` or a line break), undefined where it can */
export function validateTaskState(state: string): string | undefined {
  if (!state) return "a task's state cannot be empty";
  return /[\]:\n]/.test(state) ? `a task's state cannot hold "]", ":" nor a line break: "${state}"` : undefined;
}

/** A task's line: `- [state] text`, indented by `indent`; its text one line (what goes under it is the caller's) */
export function writeTaskLine(state: string, text: string, indent = ""): string {
  const problem = validateTaskState(state);
  if (problem) throw new Error(problem);
  if (/[\r\n]/.test(text)) throw new Error("a task's text is one line: what goes under it is written on lines of its own");
  return `${indent}- [${state}]${text ? ` ${text}` : ""}`;
}

/** Why a name cannot be an attribute's (letters, digits, `_` and `$` of ASCII only), undefined where it can */
export function validateAttributeName(name: string): string | undefined {
  return ATTRIBUTE_NAME_RE.test(name) ? undefined : `"${name}" cannot be an attribute's name: letters, digits, _ and $ (no accents, spaces nor dashes)`;
}

/** An attribute's value as written (inline.ts' `value`) read as YAML, or why it is none read here */
export function readAttributeValue(written: string): YamlRead {
  return readYamlInline(written);
}

/**
 * An attribute, `[name: value]`, its value YAML on one line that SilverBullet
 * reads back: its brackets balanced (an attribute ends at the `]` matching its
 * `[`, quotes not minded), so a text holding one is quoted, its brackets escaped
 */
export function writeAttribute(name: string, value: YamlValue): string {
  const problem = validateAttributeName(name);
  if (problem) throw new Error(problem);
  return `[${name}: ${attributeValue(value)}]`;
}

function attributeValue(value: YamlValue): string {
  if (Array.isArray(value)) return `[${value.map(attributeValue).join(", ")}]`;
  const written = writeYamlInline(value);
  if (typeof value === "string" && /[[\]]/.test(written)) return quoted(value).replace(/\[/g, "\\u005b").replace(/\]/g, "\\u005d");
  if (balanced(written)) return written;
  // A map (none of the values a converter writes) holding a bracket in a text
  throw new Error(`${written} cannot be written as an attribute's value: a bracket in its text`);
}

/** Whether every `]` closes a `[` before it and every `[` is closed */
function balanced(text: string): boolean {
  let depth = 0;
  for (const c of text) {
    if (c === "[") depth++;
    else if (c === "]" && --depth < 0) return false;
  }
  return depth === 0;
}
