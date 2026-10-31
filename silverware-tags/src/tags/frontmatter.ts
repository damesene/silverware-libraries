// The frontmatter's tags, read and written in the page's own form, the rest of
// the frontmatter as written (its comments, its other keys). SilverBullet reads
// `tags` as a list or a string (`a, b`, `a b`, `#a #b`), a leading # dropped
// (plugs/index/frontmatter.ts). Forms kept: a block list (its indent and
// items as written), a list in brackets on one line, a string of names; a
// name the string cannot hold (a space in it) turns it into a block list.
// A form not read here (a list in brackets over several lines, an anchor) is
// `unreadable`: the page is left alone.

export type FrontmatterForm = "block" | "flow" | "string";

type Item = {
  readonly name: string;
  // As written (its quotes, a #, a comment after it), kept where its name stays
  readonly raw: string;
};

export type Frontmatter = {
  // The whole block, its fences included; its YAML (between the fences); where the body starts
  readonly range: { readonly from: number; readonly to: number } | undefined;
  readonly yaml?: { readonly from: number; readonly to: number };
  readonly bodyStart: number;
  // The `tags` key: its lines (from its start to the end of its value's last line, its line break included)
  readonly key: { readonly from: number; readonly to: number; readonly form: FrontmatterForm; readonly items: readonly Item[]; readonly indent: string; readonly separator: string; readonly hashes: boolean } | undefined;
  // Why its tags cannot be edited (they are not read either)
  readonly unreadable?: string;
};

const OPEN_RE = /^---[ \t]*\r?\n/;

/** The page's frontmatter and its tags */
export function readFrontmatter(text: string): Frontmatter {
  const open = OPEN_RE.exec(text);
  if (!open) return { range: undefined, bodyStart: 0, key: undefined };
  const after = text.slice(open[0].length);
  const end = /(^|\n)---[ \t]*(\r?\n|$)/.exec(after);
  if (!end) return { range: undefined, bodyStart: 0, key: undefined };
  const yamlFrom = open[0].length;
  const yamlTo = yamlFrom + end.index + (end[1] ? 1 : 0);
  const to = yamlFrom + end.index + end[0].length;
  const range = { from: 0, to };
  const yaml = { from: yamlFrom, to: yamlTo };
  const lines: { from: number; to: number; text: string }[] = [];
  for (let from = yamlFrom; from < yamlTo; ) {
    const nl = text.indexOf("\n", from);
    const lineEnd = nl < 0 || nl >= yamlTo ? yamlTo : nl + 1;
    lines.push({ from, to: lineEnd, text: text.slice(from, lineEnd).replace(/\r?\n$/, "") });
    from = lineEnd;
  }
  const at = lines.findIndex((line) => /^tags[ \t]*:/.test(line.text));
  if (at < 0) return { range, yaml, bodyStart: to, key: undefined };
  const line = lines[at]!;
  const value = line.text.replace(/^tags[ \t]*:/, "").trim();
  const withoutComment = stripComment(value);
  if (!withoutComment) {
    // A block list under it (its items indented, or at the key's own column)
    const items: Item[] = [];
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
      const name = scalarName(raw);
      if (name === undefined) return { range, yaml, bodyStart: to, key: undefined, unreadable: `its frontmatter's tags hold ${raw || "an empty item"}` };
      items.push({ name, raw });
      last = i;
    }
    return { range, yaml, bodyStart: to, key: { from: line.from, to: lines[last]!.to, form: "block", items, indent, separator: "", hashes: false } };
  }
  if (withoutComment.startsWith("[")) {
    if (!withoutComment.endsWith("]")) return { range, yaml, bodyStart: to, key: undefined, unreadable: "its frontmatter's tags are a list over several lines" };
    const inner = withoutComment.slice(1, -1).trim();
    const raws = inner ? splitFlow(inner) : [];
    const items: Item[] = [];
    for (const raw of raws) {
      const name = scalarName(raw.trim());
      if (name === undefined) return { range, yaml, bodyStart: to, key: undefined, unreadable: `its frontmatter's tags hold ${raw.trim()}` };
      items.push({ name, raw: raw.trim() });
    }
    return { range, yaml, bodyStart: to, key: { from: line.from, to: line.to, form: "flow", items, indent: "", separator: ", ", hashes: false } };
  }
  if (/^[&*!|>{]/.test(withoutComment)) return { range, yaml, bodyStart: to, key: undefined, unreadable: `its frontmatter's tags are written as ${withoutComment}` };
  const string = scalarName(withoutComment);
  if (string === undefined) return { range, yaml, bodyStart: to, key: undefined, unreadable: `its frontmatter's tags are written as ${withoutComment}` };
  const parts = string.split(/,\s*|\s+/).filter(Boolean);
  const separator = /,/.test(string) ? ", " : " ";
  const hashes = parts.length > 0 && parts.every((part) => part.startsWith("#"));
  return {
    range,
    yaml,
    bodyStart: to,
    key: { from: line.from, to: line.to, form: "string", items: parts.map((part) => ({ name: part.replace(/^#/, ""), raw: part })), indent: "", separator, hashes },
  };
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
      // A tag written `#a` at the start is a comment in YAML too: SilverBullet's YAML reads none then
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

/** A scalar's text as written: its name (quotes off, a leading # off); undefined: not a plain name */
function scalarName(raw: string): string | undefined {
  const value = stripComment(raw);
  if (!value) return undefined;
  let name: string;
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) return undefined;
    try {
      name = JSON.parse(value) as string;
    } catch {
      return undefined;
    }
  } else if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) return undefined;
    name = value.slice(1, -1).replace(/''/g, "'");
  } else if (/^[[{&*!|>]/.test(value)) return undefined;
  else name = value;
  return name.replace(/^#/, "").trim() || undefined;
}

/** A name as a YAML scalar: as it is where YAML reads it so, else in quotes */
export function yamlScalar(name: string): string {
  return /^[\p{L}\p{N}_][\p{L}\p{N}_\-/.+]*$/u.test(name) && !/^(true|false|null|yes|no|on|off|~|[-+]?\d[\d_.]*([eE][-+]?\d+)?)$/i.test(name) ? name : JSON.stringify(name);
}

/**
 * The frontmatter's tags made `names` (in that order), as an edit of the text
 * (`from`, `to`, `insert`), its form kept; none where they are as written.
 * Empty: the key goes, and a frontmatter left empty with it.
 */
export function writeTags(text: string, frontmatter: Frontmatter, names: readonly string[]): { from: number; to: number; insert: string } | undefined {
  const { key, range, yaml } = frontmatter;
  const current = key?.items.map((item) => item.name) ?? [];
  if (current.length === names.length && current.every((name, i) => name === names[i])) return undefined;
  if (!range || !yaml) {
    if (!names.length) return undefined;
    return { from: 0, to: 0, insert: `---\n${blockKey(names, "  ")}---\n` };
  }
  if (!key) {
    if (!names.length) return undefined;
    // Before the closing fence
    const before = yaml.to > yaml.from && text[yaml.to - 1] !== "\n" ? "\n" : "";
    return { from: yaml.to, to: yaml.to, insert: before + blockKey(names, "  ") };
  }
  if (!names.length) {
    // The frontmatter left empty (blank lines alone; a comment stays): it goes
    const rest = text.slice(yaml.from, key.from) + text.slice(key.to, yaml.to);
    if (!rest.trim()) return { from: range.from, to: range.to, insert: "" };
    return { from: key.from, to: key.to, insert: "" };
  }
  const raw = (name: string) => key.items.find((item) => item.name === name)?.raw;
  const newline = text.slice(key.from, key.to).endsWith("\n") ? "\n" : "";
  if (key.form === "string" && names.every((name) => !/[\s,]/.test(name))) {
    const value = names.map((name) => (key.hashes ? `#${name}` : name)).join(key.separator);
    const head = /^tags[ \t]*:[ \t]*/.exec(text.slice(key.from))![0];
    return { from: key.from, to: key.to, insert: `${head}${stringValue(value)}${newline}` };
  }
  if (key.form === "flow") {
    const head = /^tags[ \t]*:[ \t]*/.exec(text.slice(key.from))![0];
    return { from: key.from, to: key.to, insert: `${head}[${names.map((name) => raw(name) ?? yamlScalar(name)).join(", ")}]${newline}` };
  }
  const head = key.form === "block" ? text.slice(key.from, text.indexOf("\n", key.from) + 1) : "tags:\n";
  const indent = key.form === "block" ? key.indent : "  ";
  const items = names.map((name) => `${indent}- ${(key.form === "block" && raw(name)) || yamlScalar(name)}\n`).join("");
  const insert = head + items;
  return { from: key.from, to: key.to, insert: newline ? insert : insert.replace(/\n$/, "") };
}

/**
 * A string of names as YAML reads it back whole: one name as a scalar
 * (`yamlScalar`: `yes`, `123` quoted), several in quotes where YAML would read
 * them otherwise (starting with an indicator, `[x] b` a list, `@x` an error;
 * `: ` or ` #` inside)
 */
function stringValue(value: string): string {
  if (!/[\s,]/.test(value)) return yamlScalar(value);
  return /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) || /:(\s|$)|\s#/.test(value) ? JSON.stringify(value) : value;
}

function blockKey(names: readonly string[], indent: string): string {
  return `tags:\n${names.map((name) => `${indent}- ${yamlScalar(name)}\n`).join("")}`;
}

