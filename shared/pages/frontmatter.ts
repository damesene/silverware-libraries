// A page's frontmatter: any key of it read and written in the page's own
// form, the rest of the frontmatter as written (its comments, its other keys).
// Shared by the plugins: Silverware Tags' `tags` key, Silverware Database's
// properties. Pure, on the page's text.
//
// A key's value is a scalar (a text, a number, a logical value, null) or a list
// of scalars. Forms kept: a scalar plain or in quotes, a block list (its indent
// and items as written), a list in brackets on one line. A form not read here
// (a nested map, a list in brackets over several lines, an anchor, a block
// scalar) is `unreadable`: the key is left alone. A key made anew is in the
// form asked for: a list in brackets on one line by default (`key: [a, b]`).

export type YamlScalar = string | number | boolean | null;
export type FrontmatterValue = YamlScalar | readonly YamlScalar[];
export type ListForm = "block" | "flow";

export type Frontmatter = {
  // The whole block, its fences included; its YAML (between the fences); where the body starts
  readonly range: { readonly from: number; readonly to: number } | undefined;
  readonly yaml?: { readonly from: number; readonly to: number };
  readonly bodyStart: number;
};

export type FrontmatterItem = {
  // Its text as written, quotes and a comment off; its value as YAML reads it
  readonly text: string;
  readonly value: YamlScalar;
  // As written (its quotes, a comment after it), kept where its value stays
  readonly raw: string;
};

/** A key as the page has it: its lines, from its start to the end of its value's last line (its line break included) */
export type FrontmatterEntry = { readonly key: string; readonly from: number; readonly to: number } & (
  | ({ readonly kind: "scalar" } & FrontmatterItem)
  | { readonly kind: "list"; readonly form: ListForm; readonly items: readonly FrontmatterItem[]; readonly indent: string }
);

/** A key read: its entry where the page has it, else why it cannot be read (it is not edited then) */
export type KeyRead = { readonly entry?: FrontmatterEntry; readonly unreadable?: string };

export type TextEdit = { readonly from: number; readonly to: number; readonly insert: string };

const OPEN_RE = /^---[ \t]*\r?\n/;

/** Where the page's frontmatter is, if it has one */
export function readFrontmatter(text: string): Frontmatter {
  const open = OPEN_RE.exec(text);
  if (!open) return { range: undefined, bodyStart: 0 };
  const after = text.slice(open[0].length);
  const end = /(^|\n)---[ \t]*(\r?\n|$)/.exec(after);
  if (!end) return { range: undefined, bodyStart: 0 };
  const yamlFrom = open[0].length;
  const yamlTo = yamlFrom + end.index + (end[1] ? 1 : 0);
  const to = yamlFrom + end.index + end[0].length;
  return { range: { from: 0, to }, yaml: { from: yamlFrom, to: yamlTo }, bodyStart: to };
}

/** Why a key cannot be read and written here (only a plain key at the frontmatter's top level), undefined where it can */
export function validateFrontmatterKey(key: string): string | undefined {
  if (!/^[^\s#:\-?[\]{},&*!|>'"%@`][^\s:#]*$/u.test(key)) return `${JSON.stringify(key)} is no plain key of a frontmatter`;
  return undefined;
}

function keyRe(key: string): RegExp {
  const problem = validateFrontmatterKey(key);
  if (problem) throw new Error(problem);
  return new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*:`);
}

/** A key of the frontmatter: as written, or why it cannot be read */
export function readKey(text: string, frontmatter: Frontmatter, key: string): KeyRead {
  const { yaml } = frontmatter;
  if (!yaml) return {};
  const re = keyRe(key);
  const lines: { from: number; to: number; text: string }[] = [];
  for (let from = yaml.from; from < yaml.to; ) {
    const nl = text.indexOf("\n", from);
    const lineEnd = nl < 0 || nl >= yaml.to ? yaml.to : nl + 1;
    lines.push({ from, to: lineEnd, text: text.slice(from, lineEnd).replace(/\r?\n$/, "") });
    from = lineEnd;
  }
  const at = lines.findIndex((line) => re.test(line.text));
  if (at < 0) return {};
  const line = lines[at]!;
  const value = line.text.replace(re, "").trim();
  const withoutComment = stripComment(value);
  if (!withoutComment) {
    // A block list under it (its items indented, or at the key's own column); none: an empty value
    const items: FrontmatterItem[] = [];
    let last = at;
    let indent = "  ";
    for (let i = at + 1; i < lines.length; i++) {
      const item = /^(\s*)-(?:[ \t]+(.*))?$/.exec(lines[i]!.text);
      if (!item) {
        if (!lines[i]!.text.trim() || /^\s+#/.test(lines[i]!.text)) continue;
        break;
      }
      if (items.length === 0) indent = item[1]!;
      const raw = (item[2] ?? "").trim();
      const read = scalarOf(raw);
      if (!read) return { unreadable: `its frontmatter's ${key} hold ${raw || "an empty item"}` };
      items.push({ ...read, raw });
      last = i;
    }
    if (goesOn(lines, last)) return { unreadable: `its frontmatter's ${key} are written over several lines` };
    if (items.length === 0) return { entry: { key, from: line.from, to: line.to, kind: "scalar", text: "", value: null, raw: "" } };
    return { entry: { key, from: line.from, to: lines[last]!.to, kind: "list", form: "block", items, indent } };
  }
  // (A list in brackets left open and a block scalar said as such first, as Silverware Tags has always said them)
  if (withoutComment.startsWith("[") && !withoutComment.endsWith("]")) return { unreadable: `its frontmatter's ${key} are a list over several lines` };
  if (/^[&*!|>{]/.test(withoutComment)) return { unreadable: `its frontmatter's ${key} are written as ${withoutComment}` };
  if (goesOn(lines, at)) return { unreadable: `its frontmatter's ${key} are written over several lines` };
  if (withoutComment.startsWith("[")) {
    const inner = withoutComment.slice(1, -1).trim();
    const items: FrontmatterItem[] = [];
    for (const part of inner ? splitFlow(inner) : []) {
      const raw = part.trim();
      const read = scalarOf(raw);
      if (!read) return { unreadable: `its frontmatter's ${key} hold ${raw}` };
      items.push({ ...read, raw });
    }
    return { entry: { key, from: line.from, to: line.to, kind: "list", form: "flow", items, indent: "" } };
  }
  const read = scalarOf(withoutComment);
  if (!read) return { unreadable: `its frontmatter's ${key} are written as ${withoutComment}` };
  return { entry: { key, from: line.from, to: line.to, kind: "scalar", ...read, raw: withoutComment } };
}

/**
 * Whether the value goes on past line `last`: the next line that is neither
 * blank nor a comment is indented (a nested map, a scalar over several lines,
 * an item's continuation), which this reader leaves alone
 */
function goesOn(lines: readonly { readonly text: string }[], last: number): boolean {
  for (let i = last + 1; i < lines.length; i++) {
    const text = lines[i]!.text;
    if (!text.trim() || /^\s*#/.test(text)) continue;
    return /^\s/.test(text);
  }
  return false;
}

/** A value without a comment after it (` # …`, outside quotes) */
function stripComment(value: string): string {
  let quote: string | undefined;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (quote) {
      if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]!))) {
      // A value written `#a` at the start is a comment in YAML too: SilverBullet's YAML reads none then
      return value.slice(0, i).trim();
    }
  }
  return value.trim();
}

/** Items of a list in brackets, split at commas outside quotes */
function splitFlow(inner: string): string[] {
  const parts: string[] = [];
  let quote: string | undefined;
  let from = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (quote) {
      if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ",") {
      parts.push(inner.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(inner.slice(from));
  return parts.filter((part) => part.trim());
}

/** A scalar as written: its text (quotes and a comment off) and its value; undefined: not a scalar read here */
function scalarOf(raw: string): { text: string; value: YamlScalar } | undefined {
  const value = stripComment(raw);
  if (!value) return { text: "", value: null };
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) return undefined;
    try {
      const text = JSON.parse(value) as string;
      return { text, value: text };
    } catch {
      return undefined;
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) return undefined;
    const text = value.slice(1, -1).replace(/''/g, "'");
    return { text, value: text };
  }
  if (/^[[{&*!|>]/.test(value)) return undefined;
  return { text: value, value: plainValue(value) };
}

/** A plain scalar's value as YAML 1.2's core schema reads it (a date stays text, as SilverBullet's index keeps it) */
function plainValue(text: string): YamlScalar {
  if (/^(~|null|Null|NULL)$/.test(text)) return null;
  if (/^(true|True|TRUE)$/.test(text)) return true;
  if (/^(false|False|FALSE)$/.test(text)) return false;
  if (/^0x[\da-fA-F]+$/.test(text)) return parseInt(text.slice(2), 16);
  if (/^0o[0-7]+$/.test(text)) return parseInt(text.slice(2), 8);
  if (/^[-+]?(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?$/.test(text)) return Number(text);
  return text;
}

/** A text as a YAML scalar: as it is where YAML reads it so, else in quotes */
export function yamlScalar(name: string): string {
  // (Read otherwise unquoted: booleans, null, numbers, hex and octal numbers, dates as timestamps)
  return /^[\p{L}\p{N}_][\p{L}\p{N}_\-/.+]*$/u.test(name) && !/^(true|false|null|yes|no|on|off|~|[-+]?\d[\d_.]*([eE][-+]?\d+)?|0x[\da-f_]+|0o[0-7_]+|\d{4}-\d\d?-\d\d?\b.*)$/i.test(name) ? name : JSON.stringify(name);
}

/**
 * A text as a key's value that YAML reads back whole: a word as a scalar
 * (`yamlScalar`: `yes`, `123` quoted), words in quotes where YAML would read
 * them otherwise (starting with an indicator, `[x] b` a list, `@x` an error;
 * `: ` or ` #` inside; space at an end, a line break)
 */
export function yamlString(value: string): string {
  if (!/[\s,]/.test(value)) return yamlScalar(value);
  if (value !== value.trim() || /[\r\n]/.test(value)) return JSON.stringify(value);
  return /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) || /:(\s|$)|\s#/.test(value) ? JSON.stringify(value) : value;
}

function yamlItem(value: YamlScalar): string {
  return typeof value === "string" ? yamlScalar(value) : String(value);
}

function yamlValue(value: YamlScalar): string {
  return typeof value === "string" ? yamlString(value) : String(value);
}

export type WriteOptions = {
  // A list made anew, or made of a scalar, in this form (a block list stays one, a list in brackets too)
  readonly form?: ListForm;
  // An item's text as the page has it, where it is to stay so; by default an item of the same value
  readonly rawItem?: (value: YamlScalar) => string | undefined;
};

/**
 * A key of the frontmatter made `value`, as an edit of the text, the form the
 * page has kept (`entry`: the key as read, undefined where the page has none);
 * none where nothing changes. Undefined: the key goes, and a frontmatter left
 * empty with it.
 */
export function writeKey(text: string, frontmatter: Frontmatter, key: string, entry: FrontmatterEntry | undefined, value: FrontmatterValue | undefined, options: WriteOptions = {}): TextEdit | undefined {
  keyRe(key);
  const { range, yaml } = frontmatter;
  const form = options.form ?? "flow";
  if (!range || !yaml) {
    if (value === undefined) return undefined;
    return { from: 0, to: 0, insert: `---\n${newKey(key, value, form)}---\n` };
  }
  if (!entry) {
    if (value === undefined) return undefined;
    // Before the closing fence
    const before = yaml.to > yaml.from && text[yaml.to - 1] !== "\n" ? "\n" : "";
    return { from: yaml.to, to: yaml.to, insert: before + newKey(key, value, form) };
  }
  if (value === undefined) {
    // The frontmatter left empty (blank lines alone; a comment stays): it goes
    const rest = text.slice(yaml.from, entry.from) + text.slice(entry.to, yaml.to);
    if (!rest.trim()) return { from: range.from, to: range.to, insert: "" };
    return { from: entry.from, to: entry.to, insert: "" };
  }
  const written = text.slice(entry.from, entry.to);
  const newline = written.endsWith("\n") ? "\n" : "";
  const head = new RegExp(`${keyRe(key).source}[ \\t]*`).exec(text.slice(entry.from))![0];
  const changed = (insert: string) => (insert === written ? undefined : { from: entry.from, to: entry.to, insert });
  if (!Array.isArray(value)) {
    const scalar = yamlValue(value as YamlScalar);
    // A list's line may have no space after its colon
    return changed(`${entry.kind === "list" && !/[ \t]$/.test(head) ? `${head} ` : head}${scalar}${newline}`);
  }
  const values = value as readonly YamlScalar[];
  const raw = (item: YamlScalar) => (entry.kind !== "list" ? undefined : options.rawItem ? options.rawItem(item) : entry.items.find((one) => one.value === item)?.raw);
  if (values.length === 0) return changed(`${head}${/[ \t]$/.test(head) ? "" : " "}[]${newline}`);
  // A block list as the page has it, or under a key without a value
  const block = entry.kind === "list" ? entry.form === "block" : entry.raw === "" && form === "block";
  if (block) {
    const line = text.slice(entry.from, text.indexOf("\n", entry.from) + 1);
    const indent = entry.kind === "list" ? entry.indent : "  ";
    const insert = line + values.map((item) => `${indent}- ${raw(item) || yamlItem(item)}\n`).join("");
    return changed(newline ? insert : insert.replace(/\n$/, ""));
  }
  return changed(`${head}[${values.map((item) => raw(item) || yamlItem(item)).join(", ")}]${newline}`);
}

/** A key made anew, in the form asked for where it is a list */
function newKey(key: string, value: FrontmatterValue, form: ListForm): string {
  if (!Array.isArray(value)) return `${key}: ${yamlValue(value as YamlScalar)}\n`;
  const values = value as readonly YamlScalar[];
  if (form === "block" && values.length > 0) return `${key}:\n${values.map((item) => `  - ${yamlItem(item)}\n`).join("")}`;
  return `${key}: [${values.map(yamlItem).join(", ")}]\n`;
}
