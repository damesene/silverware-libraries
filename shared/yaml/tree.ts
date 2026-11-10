// Nested YAML, in the few forms a plugin writes its own data in (Silverware
// Database's `_database`: maps by indent, maps and lists in brackets on one
// line): a plugin's data in a page (the page writer, shared/pages/) and a
// value on one line (a task's attribute, shared/markdown/task.ts). Not a YAML
// parser: what is not one of these forms (an anchor, a block scalar, a list
// item holding a block) is said so, and the key it is under is left as
// written, never rewritten from a guess. Decided 2026-11-07 over a YAML
// library: the data are ours, so a few forms suffice and the bundle stays
// small. Maps are objects of no prototype, so a key named `constructor` or
// `__proto__` is a key as any.
import { readScalar, stripComment, type YamlScalar, yamlString } from "./scalar.ts";

export type YamlMap = { readonly [key: string]: YamlValue };
export type YamlValue = YamlScalar | readonly YamlValue[] | YamlMap;

/** A value read, or why it is not one of the forms read here */
export type YamlRead = { readonly value: YamlValue } | { readonly problem: string };

export const isYamlMap = (value: YamlValue | undefined): value is YamlMap => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Why a value given from code (JS, or Lua through it) is none of YAML's: what
 * would be written as something else or lost (undefined, a date, a function,
 * an object of a class, a number not kept exactly); undefined where it is one
 */
export function validateYamlValue(value: unknown): string | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return undefined;
  if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)) ? undefined : `${value} is a number not kept exactly`;
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = validateYamlValue(item);
      if (problem) return problem;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return "an object of a class is no value of a page";
    for (const [key, inner] of Object.entries(value)) {
      const problem = validateYamlValue(inner);
      if (problem) return `${key}: ${problem}`;
    }
    return undefined;
  }
  return `${typeof value === "undefined" ? "undefined" : typeof value} is no value of a page`;
}

/** A map of no prototype (a key of any name its own) */
export const emptyMap = (): Record<string, YamlValue> => Object.create(null) as Record<string, YamlValue>;

// Line and paragraph separators: JSON leaves them in a quoted text, where a reader of lines would end the line
const SEPARATORS_RE = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/** A text in double quotes, read back whole */
export const quoted = (text: string) => JSON.stringify(text).replace(SEPARATORS_RE, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

type Line = { readonly indent: number; readonly text: string };

/** Block YAML's lines read as a map (its keys at the first line's indent), or why not */
export function readYamlMap(block: string): YamlRead {
  const lines: Line[] = [];
  for (const raw of block.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    if (/^\s*\t/.test(raw)) return { problem: "indented by a tab" };
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, text: raw.trim() });
  }
  if (!lines.length) return { value: emptyMap() };
  try {
    const [value, next] = blockMap(lines, 0, lines[0]!.indent);
    if (next < lines.length) throw new Error(`"${lines[next]!.text}" is out of place`);
    return { value };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
}

const ENTRY_RE = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#:[\]{},][^:#]*?)\s*:(?:\s+(.*))?$/;

/** A map's entries at `indent`, from line `at`: the map and the line after it */
function blockMap(lines: readonly Line[], at: number, indent: number): [YamlMap, number] {
  const map = emptyMap();
  let i = at;
  while (i < lines.length && lines[i]!.indent === indent) {
    const match = ENTRY_RE.exec(lines[i]!.text);
    if (!match) throw new Error(`"${lines[i]!.text}" is no key and value`);
    const key = keyOf(match[1]!);
    if (Object.hasOwn(map, key)) throw new Error(`the key "${key}" twice`);
    const rest = stripComment(match[2] ?? "");
    i++;
    if (rest) {
      map[key] = inline(rest);
      continue;
    }
    // Nothing after the colon: a map or a list under it (a list may stand at the key's own indent), else empty
    const next = lines[i];
    if (next && next.text.startsWith("-") && next.indent >= indent && (next.indent > indent || /^-(\s|$)/.test(next.text))) [map[key], i] = blockList(lines, i, next.indent);
    else if (next && next.indent > indent) [map[key], i] = blockMap(lines, i, next.indent);
    else map[key] = null;
  }
  if (i < lines.length && lines[i]!.indent > indent) throw new Error(`"${lines[i]!.text}" is indented more than its map`);
  return [map, i];
}

/** A list's items at `indent`, each a value on its line */
function blockList(lines: readonly Line[], at: number, indent: number): [YamlValue[], number] {
  const list: YamlValue[] = [];
  let i = at;
  while (i < lines.length && lines[i]!.indent === indent && /^-(\s|$)/.test(lines[i]!.text)) {
    const rest = stripComment(lines[i]!.text.slice(1));
    if (!rest) throw new Error("a list item holding a block");
    if (ENTRY_RE.test(rest)) throw new Error(`a list item holding a map ("${rest}")`);
    list.push(inline(rest));
    i++;
    if (i < lines.length && lines[i]!.indent > indent) throw new Error(`"${lines[i]!.text}" goes on a list item`);
  }
  return [list, i];
}

function keyOf(raw: string): string {
  const read = readScalar(raw);
  if (!read) throw new Error(`"${raw}" is no key`);
  return read.text;
}

/** A value on one line (a scalar, or a list or map in brackets: an attribute's in a task), or why it is none read here */
export function readYamlInline(text: string): YamlRead {
  try {
    return { value: inline(text.trim()) };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
}

/** A value on one line, as `readYamlInline` reads it back: a list or map in brackets, a text quoted where a bracket's comma or bracket would end it */
export function writeYamlInline(value: YamlValue): string {
  return flowWritten(value);
}

/** A value on one line: a scalar, or a list or map in brackets */
function inline(text: string): YamlValue {
  if (text.startsWith("[") || text.startsWith("{")) {
    const [value, end] = flow(text, 0);
    if (text.slice(end).trim()) throw new Error(`"${text}" goes on past its brackets`);
    return value;
  }
  if (/^[&*!|>]/.test(text)) throw new Error(`"${text}" is a form not read here`);
  return scalar(text);
}

/** A scalar on its own: one YAML reads as written (a plain text holding ": " is none; a whole number past what a number holds exactly is refused, never rounded) */
function scalar(raw: string): YamlScalar {
  const read = readScalar(raw);
  if (!read) throw new Error(`"${raw}" is no value read here`);
  if (!/^["']/.test(raw) && /:\s/.test(raw)) throw new Error(`"${raw}" holds ": " unquoted`);
  if (typeof read.value === "number" && (!Number.isFinite(read.value) || (Number.isInteger(read.value) && !Number.isSafeInteger(read.value)))) throw new Error(`"${raw}" is a number not kept exactly`);
  return read.value;
}

/** A list or map in brackets from `at`: its value and where it ends */
function flow(text: string, at: number): [YamlValue, number] {
  const open = text[at]!;
  const close = open === "[" ? "]" : "}";
  const items: YamlValue[] = [];
  const map = emptyMap();
  let i = at + 1;
  for (;;) {
    i = skipSpace(text, i);
    if (text[i] === close) return [open === "[" ? items : map, i + 1];
    if (open === "{") {
      const [raw, afterKey] = flowScalar(text, i, ":");
      if (text[afterKey] !== ":") throw new Error(`"${text}": a map's entry without a colon`);
      const key = keyOf(raw);
      if (Object.hasOwn(map, key)) throw new Error(`the key "${key}" twice`);
      const [value, afterValue] = flowValue(text, skipSpace(text, afterKey + 1), close);
      map[key] = value;
      i = afterValue;
    } else {
      const [value, afterValue] = flowValue(text, i, close);
      items.push(value);
      i = afterValue;
    }
    i = skipSpace(text, i);
    if (text[i] === ",") i++;
    else if (text[i] !== close) throw new Error(`"${text}" is not closed`);
  }
}

function flowValue(text: string, at: number, close: string): [YamlValue, number] {
  if (text[at] === "[" || text[at] === "{") return flow(text, at);
  const [raw, end] = flowScalar(text, at, close);
  return [scalar(raw), end];
}

/** A scalar's text in brackets, from `at` to the next `,`, `stop` or `:` outside quotes (a map's key) */
function flowScalar(text: string, at: number, stop: string): [string, number] {
  let i = at;
  if (text[i] === '"' || text[i] === "'") {
    const quote = text[i]!;
    for (i++; i < text.length; i++) {
      if (quote === '"' && text[i] === "\\") i++;
      else if (text[i] === quote) {
        if (quote === "'" && text[i + 1] === "'") i++;
        else break;
      }
    }
    if (i >= text.length) throw new Error(`"${text}": a quote not closed`);
    return [text.slice(at, i + 1), i + 1];
  }
  while (i < text.length && text[i] !== "," && text[i] !== stop && text[i] !== "]" && text[i] !== "}" && !(text[i] === ":" && /\s/.test(text[i + 1] ?? " "))) i++;
  if (i >= text.length) throw new Error(`"${text}" is not closed`);
  return [text.slice(at, i).trim(), i];
}

const skipSpace = (text: string, at: number) => {
  let i = at;
  while (text[i] === " " || text[i] === "\t") i++;
  return i;
};

/** A key as written: as it is where YAML reads it back so, else in quotes */
function writtenKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_\-.]*$/.test(key) ? key : quoted(key);
}

/** A scalar as written: a number that would not read back exactly refused (the write fails, nothing written) */
function scalarText(value: YamlScalar): string {
  if (typeof value === "number" && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error(`${value} is a number not written exactly`);
  if (typeof value !== "string") return String(value);
  if (value.search(SEPARATORS_RE) >= 0) return quoted(value);
  const plain = yamlString(value);
  return plain.startsWith('"') ? quoted(value) : plain;
}

/** A scalar in brackets: in quotes where a bracket's comma or bracket would end it */
function flowText(value: YamlScalar): string {
  const plain = scalarText(value);
  return typeof value !== "string" || plain.startsWith('"') || !/[,[\]{}:]/.test(plain) ? plain : quoted(value);
}

function flowWritten(value: YamlValue): string {
  if (Array.isArray(value)) return `[${value.map(flowWritten).join(", ")}]`;
  if (isYamlMap(value)) {
    const entries = Object.entries(value);
    return entries.length ? `{ ${entries.map(([key, one]) => `${writtenKey(key)}: ${flowWritten(one)}`).join(", ")} }` : "{}";
  }
  return flowText(value as YamlScalar);
}

/** Whether a map is written on one line: its values scalars or lists of them (a property's settings), not the key's own map */
const flatMap = (value: YamlMap) => Object.values(value).every((one) => !isYamlMap(one) && (!Array.isArray(one) || one.every((item) => !isYamlMap(item) && !Array.isArray(item))));

/**
 * A key and its value as block YAML, its lines ending in a line break: maps by
 * indent, but a map of scalars below the key's own on one line in brackets
 * (`status: { type: select, options: [Todo, Done] }`), lists in brackets
 */
export function writeYamlEntry(key: string, value: YamlValue, indent = "", depth = 0): string {
  const head = `${indent}${writtenKey(key)}:`;
  if (isYamlMap(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return `${head} {}\n`;
    if (depth > 0 && flatMap(value)) return `${head} ${flowWritten(value)}\n`;
    return `${head}\n${entries.map(([one, inner]) => writeYamlEntry(one, inner, `${indent}  `, depth + 1)).join("")}`;
  }
  if (Array.isArray(value)) return `${head} ${flowWritten(value)}\n`;
  return `${head} ${scalarText(value as YamlScalar)}\n`;
}
