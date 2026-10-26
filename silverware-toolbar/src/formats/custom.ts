// Definitions of formats checked and made formats the engines use: the
// built-in ones (builtin/) and the user's (silverware.toolbar.defineFormats on
// the library page) alike. A definition is an object, a function given
// HELPERS that returns one or a list, or a list of them (a module's default
// export too). What a format's function gives or throws is checked when it is
// called: a mistake is the action failing, shown, never a page written wrong.
import { letters } from "../icons.ts";
import type { BlockInfo, BlockItem, Format, FormatEditor, Found, ReadContext, Written } from "./format.ts";
import { HELPERS } from "./helpers.ts";

// A name as ids are written (formats.<name>)
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** The definitions given as a flat list of objects, or what failed making them */
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

/** The formats defined, and what is wrong with the others */
export function formatsOf(definitions: unknown): { formats: Format[]; problems: string[] } {
  const problems: string[] = [];
  const formats: Format[] = [];
  definitionsOf(definitions, problems).forEach((definition, i) => {
    const format = formatOf(definition);
    if (typeof format === "string") problems.push(`format ${isObject(definition) && typeof definition.name === "string" ? definition.name : i + 1}: ${format}`);
    else formats.push(format);
  });
  return { formats, problems };
}

/** One definition as a format, or what is wrong with it */
function formatOf(definition: unknown): Format | string {
  if (!isObject(definition)) return "not an object";
  // Checked here, field by field: a definition from JS may be anything
  const { name, scope, label, icon, group, keywords, marker, multiline, literal, joins } = definition;
  if (typeof name !== "string" || !NAME_RE.test(name)) return `its name ${JSON.stringify(name)} is not letters, digits and _ starting with a letter`;
  if (scope !== "block" && scope !== "inline") return `its scope is not "block" or "inline"`;
  if (label !== undefined && typeof label !== "string") return "its label is not text";
  if (icon !== undefined && typeof icon !== "string") return "its icon is not text (an SVG)";
  if (group !== undefined && typeof group !== "string") return "its group is not text";
  if (keywords !== undefined && !(Array.isArray(keywords) && keywords.every((k) => typeof k === "string"))) return "its keywords are not a list of texts";
  for (const fn of ["read", "write", "afterWrite"] as const) if (definition[fn] !== undefined && typeof definition[fn] !== "function") return `its ${fn} is not a function`;
  // Functions of the user's: called through checked(), which checks what they give
  const read = definition.read as ((...args: unknown[]) => unknown) | undefined;
  const write = definition.write as ((...args: unknown[]) => unknown) | undefined;
  const afterWrite = definition.afterWrite as ((written: Written, editor: FormatEditor) => void) | undefined;
  const common = {
    id: `formats.${name}`,
    name,
    scope: scope as Format["scope"],
    label,
    icon: icon ?? letters(escape((label ?? name).charAt(0).toUpperCase())),
    group,
    keywords: (keywords as string[] | undefined) ?? [],
    ...(afterWrite ? { afterWrite: afterWriteOf(name, afterWrite) } : {}),
  };
  if (scope === "block") {
    if (marker !== undefined && (typeof marker !== "string" || !marker)) return "its marker is not text";
    if (multiline !== undefined && typeof multiline !== "boolean") return "multiline is not true or false";
    if (joins !== undefined && typeof joins !== "boolean") return "joins is not true or false";
    if (marker === undefined && !read) return "it has neither a marker nor read";
    if (multiline && !write) return "it is multiline without write";
    const readOwn = read ?? (markerRead(marker as string) as (...args: unknown[]) => unknown);
    const writeLine = write ?? (marker === undefined || multiline ? undefined : (text: unknown) => (marker as string) + String(text));
    return {
      ...common,
      markers: undefined,
      literal: false,
      multiline: !!multiline,
      joins: !!joins,
      readBlock: (text: string, info: BlockInfo) => checked(name, "read", () => readOwn(text, info), isTextOrNone),
      ...(writeLine && !multiline ? { writeLine: (text: string, info: BlockInfo) => checked(name, "write", () => writeLine(text, info), isText) } : {}),
      ...(write && multiline ? { writeLines: (items: readonly BlockItem[]) => checkedLines(name, () => write(items), items.length) } : {}),
    };
  }
  const markers = marker === undefined ? undefined : typeof marker === "string" ? [marker] : marker;
  // One character repeated, as markdown's markers are (the engine reads runs of them)
  if (markers !== undefined && !(Array.isArray(markers) && markers.length && markers.every((m) => typeof m === "string" && /^([^\p{L}\p{N}\s])\1*$/u.test(m)))) {
    return "its marker is not one sign written once or more (**, ==, ^), or a list of them";
  }
  if (literal !== undefined && typeof literal !== "boolean") return "literal is not true or false";
  if (markers === undefined && (!read || !write)) return "it has neither a marker nor read and write";
  return {
    ...common,
    markers: markers as string[] | undefined,
    literal: !!literal,
    multiline: false,
    joins: false,
    ...(read ? { readInline: (text: string, context: ReadContext) => checked(name, "read", () => read(text, context), isFound) } : {}),
    ...(write ? { writeInline: (text: string, info: { readonly index: number }) => checked(name, "write", () => write(text, info), isText) } : {}),
  };
}

/** A marker's read: the text after it (the spaces after it left out), a line of the marker alone empty */
function markerRead(marker: string): (text: string) => string | undefined {
  return (text) => {
    if (text.startsWith(marker)) return text.slice(marker.length).replace(/^[ \t]+/, "");
    return text === marker.trimEnd() ? "" : undefined;
  };
}

function afterWriteOf(name: string, afterWrite: (written: Written, editor: FormatEditor) => void) {
  return (written: Written, editor: FormatEditor) => {
    try {
      afterWrite(written, editor);
    } catch (e) {
      throw new Error(`${name}'s afterWrite failed: ${message(e)}`);
    }
  };
}

const isText = (v: unknown): v is string => typeof v === "string";
const isTextOrNone = (v: unknown): v is string | undefined => v === undefined || typeof v === "string";
const isFound = (v: unknown): v is Found | undefined =>
  v === undefined ||
  typeof v === "string" ||
  (isObject(v) && typeof v.text === "string" && (v.start === undefined || typeof v.start === "string") && (v.end === undefined || typeof v.end === "string"));

/** A format's function called: what it gave, checked, else an error naming it (a throw too) */
function checked<T>(name: string, fn: string, call: () => unknown, valid: (v: unknown) => v is T): T {
  const value = attempt(name, fn, call);
  if (isObject(value) && typeof value.then === "function") throw new Error(`${name}'s ${fn} returned a promise: it gives its result at once`);
  if (!valid(value)) throw new Error(`${name}'s ${fn} gave ${describe(value)}`);
  return value;
}

/** A multiline write's lines: as many texts as it got items */
function checkedLines(name: string, call: () => unknown, count: number): readonly string[] {
  const value = attempt(name, "write", call);
  if (!Array.isArray(value) || value.length !== count || !value.every(isText)) throw new Error(`${name}'s write did not give ${count} lines of text`);
  return value;
}

function attempt(name: string, fn: string, call: () => unknown): unknown {
  try {
    return call();
  } catch (e) {
    throw new Error(`${name}'s ${fn} failed: ${message(e)}`);
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  return typeof value === "object" ? "an object of the wrong shape" : `a ${typeof value}`;
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
