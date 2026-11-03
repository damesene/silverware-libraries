// Custom formats: the user's own ways of writing a chart in a code block,
// defined in a JS file of the space and given from Space Lua
// (silverware.chart.defineFormats on the API page), as the toolbar's
// formats are: a definition, a function given HELPERS returning one or a list,
// or a list. Each is a format as the built-in ones: `read` a block's text as a
// chart's model, `write` the model as its text. What they give or throw is
// checked as they run: a block they fail on shows why.
import type { ChartFormat } from "./core/format.ts";
import { type ChartModel, isUnreadable, type Unreadable } from "./core/model.ts";
import { listItems, readMermaid, writeMermaid } from "./formats/mermaid.ts";

/** What a custom format may build on: the built-in formats' functions (one format read as another's) */
export const HELPERS = { readMermaid, writeMermaid, listItems };

// A name as a format's id is written
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
// A code block's language
const LANGUAGE_RE = /^[\w+#.-]+$/;

let custom: ChartFormat[] = [];

/** The custom formats as last defined */
export function customFormats(): readonly ChartFormat[] {
  return custom;
}

/** Space Lua loads (again): the definitions made anew, those of before kept until the first of them */
let fresh = true;
export function customFormatsAnew(): void {
  fresh = true;
}

/** Formats defined (replacing those of before on the first definition after a load); the names defined again */
export function defineCustomFormats(formats: readonly ChartFormat[]): string[] {
  if (fresh) {
    custom = [];
    fresh = false;
  }
  const again = formats.filter((format) => custom.some((c) => c.name === format.name)).map((format) => format.name);
  custom = [...custom.filter((c) => !formats.some((format) => format.name === c.name)), ...formats];
  return again;
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

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

/** What a format's read gave, checked: a model (labels and series as the model has them), Unreadable, or nothing */
function checkedModel(name: string, value: unknown): ChartModel | Unreadable | undefined {
  if (value === undefined || value === null) return undefined;
  if (isUnreadable(value)) return value;
  if (!isObject(value)) return { problem: `the format ${name} gave no chart` };
  const { type, labels, series } = value;
  if (typeof type !== "string" || !type) return { problem: `the format ${name} gave a chart without a type` };
  if (!Array.isArray(labels)) return { problem: `the format ${name} gave labels that are not a list` };
  if (!Array.isArray(series) || !series.every((s) => isObject(s) && Array.isArray(s.values))) return { problem: `the format ${name} gave series that are not a list of { values }` };
  return { ...(value as ChartModel), labels: labels.map(String) };
}

/** One definition as a format, or what is wrong with it */
function formatOf(definition: unknown): ChartFormat | string {
  if (!isObject(definition)) return "not an object";
  const { name, label, languages, read, write } = definition;
  if (typeof name !== "string" || !NAME_RE.test(name)) return `its name ${JSON.stringify(name)} is not letters, digits and _ starting with a letter`;
  if (label !== undefined && typeof label !== "string") return "its label is not text";
  const langs = typeof languages === "string" ? [languages] : languages;
  if (!Array.isArray(langs) || !langs.length || !langs.every((l) => typeof l === "string" && LANGUAGE_RE.test(l))) return "its languages are not a code block's language or a list of them";
  if (typeof read !== "function") return "its read is not a function";
  if (typeof write !== "function") return "its write is not a function";
  return {
    name,
    label: (label as string | undefined) ?? name,
    languages: langs as string[],
    read: (text) => checkedModel(name, (read as (text: string) => unknown)(text)),
    write: (model, previous) => {
      const text = (write as (model: ChartModel, previous?: string) => unknown)(model, previous);
      if (typeof text !== "string") throw new Error(`the format ${name} wrote no text`);
      return text;
    },
  };
}

/** The formats defined, and what is wrong with the others */
export function formatsOf(definitions: unknown): { formats: ChartFormat[]; problems: string[] } {
  const problems: string[] = [];
  const formats: ChartFormat[] = [];
  definitionsOf(definitions, problems).forEach((definition, i) => {
    const format = formatOf(definition);
    if (typeof format === "string") problems.push(`format ${isObject(definition) && typeof definition.name === "string" ? definition.name : i + 1}: ${format}`);
    else formats.push(format);
  });
  return { formats, problems };
}
