// Markdown's blocks as SilverBullet's parser reads them: a line's block (its
// kind, indentation, marker and text: `readLine`, what Silverware Toolbar's
// Turn into reads, line by line) and a text's blocks as a tree (`readBlocks`:
// a list's items with what is under them, a heading with its section, a
// table's cells: what a converter of Silverware Database reads). Standard
// markdown only: kinds of a plugin's own (the toolbar's formats of its user)
// are the plugin's. Pure, on the text.
import { closesFence, fenceOf, indentWidth } from "./lines.ts";
import { readTaskLine } from "./task.ts";

type LineCommon = {
  // What the line is indented by
  readonly indent: string;
  // What stands between the indentation and the text (`## `, `- `, `1. `, `- [x] `, `> `; none for a paragraph)
  readonly marker: string;
  // The text after the marker, and where it starts in the line
  readonly content: string;
  readonly contentFrom: number;
};

/** A line read as a block's: its kind, and what the kind has of its own */
export type BlockLine =
  | (LineCommon & { readonly kind: "blank" | "paragraph" | "bullet" | "quote" | "table" | "rule" })
  | (LineCommon & { readonly kind: "heading"; readonly level: number })
  | (LineCommon & { readonly kind: "numbered"; readonly number: number })
  // A list's item with a state in brackets (`[ ]`, `[x]`, one of its own); `list` its marker's kind
  | (LineCommon & { readonly kind: "task"; readonly state: string; readonly done: boolean; readonly list: "bullet" | "numbered" });

export type LineKind = BlockLine["kind"];

const HEADING_RE = /^(#{1,6})(?:[ \t]+|$)/;
// A horizontal rule (`---`, `***`, `- - -`): read before a bullet, which `- - -` would otherwise be
const RULE_RE = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BULLET_RE = /^[-*+](?:[ \t]+|$)/;
const NUMBERED_RE = /^(\d{1,9})[.)](?:[ \t]+|$)/;
const QUOTE_RE = /^>[ \t]?/;

/**
 * A line as a block's, read as SilverBullet reads it (a fenced code block's lines are `lines.ts`' to tell). The line
 * as given, its text kept whole: a caller rewriting it finds its content in it (Silverware Toolbar), so a line break
 * (`\r` of a CRLF) is the caller's to take off, as `readBlocks` does
 */
export function readLine(line: string): BlockLine {
  const indent = /^[ \t]*/.exec(line)![0];
  const rest = line.slice(indent.length);
  const at = (kind: "blank" | "paragraph" | "table" | "rule", marker = ""): BlockLine => ({ kind, indent, marker, content: rest.slice(marker.length), contentFrom: indent.length + marker.length });
  if (!rest.trim()) return at("blank");
  const heading = HEADING_RE.exec(rest);
  if (heading) return { kind: "heading", level: heading[1]!.length, indent, marker: heading[0], content: rest.slice(heading[0].length), contentFrom: indent.length + heading[0].length };
  if (RULE_RE.test(rest)) return at("rule");
  const task = readTaskLine(line);
  if (task) return { kind: "task", state: task.state, done: task.done, list: /^\d/.test(task.marker) ? "numbered" : "bullet", indent, marker: line.slice(indent.length, task.textFrom), content: task.text, contentFrom: task.textFrom };
  const bullet = BULLET_RE.exec(rest);
  if (bullet) return { kind: "bullet", indent, marker: bullet[0], content: rest.slice(bullet[0].length), contentFrom: indent.length + bullet[0].length };
  const numbered = NUMBERED_RE.exec(rest);
  if (numbered) return { kind: "numbered", number: Number(numbered[1]), indent, marker: numbered[0], content: rest.slice(numbered[0].length), contentFrom: indent.length + numbered[0].length };
  const quote = QUOTE_RE.exec(rest);
  if (quote) return { kind: "quote", indent, marker: quote[0], content: rest.slice(quote[0].length), contentFrom: indent.length + quote[0].length };
  if (rest.startsWith("|")) return at("table");
  return at("paragraph");
}

/** The lines a block was read from: their indexes in the text given, `to` past the last */
export type BlockLines = { readonly from: number; readonly to: number };

/** A block of a text, as `readBlocks` reads it */
export type Block =
  // A heading and its section: the blocks after it up to a heading of its level or above; `title` the heading's own
  // lines (a setext heading's two or more), `lines` with its section
  | { readonly kind: "heading"; readonly level: number; readonly text: string; readonly children: readonly Block[]; readonly title: BlockLines; readonly lines: BlockLines }
  // A list's item: its text, the blocks under it (items nested, paragraphs…) and those lines as written, dedented
  | {
      readonly kind: "item";
      readonly list: "bullet" | "numbered";
      readonly number?: number;
      readonly task?: { readonly state: string; readonly done: boolean };
      readonly text: string;
      readonly children: readonly Block[];
      readonly body: string;
      readonly lines: BlockLines;
    }
  // Lines one after another: their texts joined by line breaks
  | { readonly kind: "paragraph" | "quote"; readonly text: string; readonly lines: BlockLines }
  | { readonly kind: "code"; readonly language: string; readonly text: string; readonly lines: BlockLines }
  // A table: its header's cells and each row's (the line of dashes under the header left out)
  | { readonly kind: "table"; readonly header: readonly string[]; readonly rows: readonly (readonly string[])[]; readonly lines: BlockLines }
  | { readonly kind: "rule"; readonly lines: BlockLines };

const blank = (line: string) => !line.trim();

/** Lines without their common indentation (a blank line empty), blank lines at the ends taken off */
export function dedentedLines(lines: readonly string[]): string[] {
  const given = lines.filter((line) => !blank(line));
  const common = given.length ? Math.min(...given.map((line) => /^[ \t]*/.exec(line)![0].length)) : 0;
  const out = lines.map((line) => (blank(line) ? "" : line.slice(common)));
  while (out.length && !out[0]) out.shift();
  while (out.length && !out.at(-1)) out.pop();
  return out;
}

// A table's line of dashes under its header (`|---|:--:|`)
const TABLE_RULE_RE = /^\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** A table's row as its cells: split at each `|` not escaped, the outer ones left out, each trimmed */
function cellsOf(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  const text = row.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && text[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (text[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += text[i];
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * The text's blocks, in its order: a heading holding its section, an item what is under it. A text starting with a
 * frontmatter (`---`, keys, `---`) gives no block of it. Read as SilverBullet reads markdown, but simpler where a
 * selection is not likely to differ: an item holds the lines indented more than its marker (as `lines.ts`
 * `linesUnder`, not CommonMark's content offset), a table starts with `|` and has its line of dashes, a `|` in a cell
 * ends the cell even in inline code (write `\|`: GFM's rule), no line goes on a paragraph lazily
 */
export function readBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const start = frontmatterEnd(lines);
  return sections(blocksOf(lines.slice(start), start));
}

// A frontmatter's first key: what tells it from a rule above a paragraph
const KEY_RE = /^[A-Za-z_][\w-]*[ \t]*:/;

/** Where a frontmatter at the lines' start ends (the line after its closing `---`), 0 where there is none */
function frontmatterEnd(lines: readonly string[]): number {
  if (lines[0]?.trimEnd() !== "---" || !KEY_RE.test(lines[1] ?? "")) return 0;
  const close = lines.findIndex((line, at) => at > 0 && line.trimEnd() === "---");
  return close < 0 ? 0 : close + 1;
}

// A setext heading's underline (the line under a paragraph's): `===` level 1, `---` level 2
const SETEXT_RE = /^ {0,3}(=+|-+)[ \t]*$/;

/** A heading's text without the `#`s closing it (`## Title ##`) */
const headingText = (content: string) => content.replace(/(^|[ \t]+)#+[ \t]*$/, "").trim();

/** The blocks of lines (their first one the text's `base`-th), flat but for what a list's item holds */
function blocksOf(lines: readonly string[], base: number): Block[] {
  const blocks: Block[] = [];
  const span = (from: number, to: number): BlockLines => ({ from: base + from, to: base + to });
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (blank(line)) {
      i++;
      continue;
    }
    const fence = fenceOf(line);
    if (fence) {
      let end = i + 1;
      while (end < lines.length && !closesFence(lines[end]!, fence)) end++;
      const language = line.trim().slice(fence.length).trim();
      // (Its lines as written: only the fence's own indentation taken off, blank lines kept)
      const indent = /^[ \t]*/.exec(line)![0].length;
      const code = lines.slice(i + 1, end).map((one) => one.slice(Math.min(indent, /^[ \t]*/.exec(one)![0].length)));
      blocks.push({ kind: "code", language, text: code.join("\n"), lines: span(i, Math.min(end + 1, lines.length)) });
      i = end + 1;
      continue;
    }
    const read = readLine(line);
    if (read.kind === "bullet" || read.kind === "numbered" || read.kind === "task") {
      // What is under it: the lines indented more, blank lines among them
      const width = indentWidth(line);
      let last = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (blank(lines[j]!)) continue;
        if (indentWidth(lines[j]!) <= width) break;
        last = j;
      }
      const under = dedentedLines(lines.slice(i + 1, last + 1));
      const first = lines.slice(i + 1, last + 1).findIndex((one) => !blank(one));
      const list = read.kind === "task" ? read.list : read.kind;
      blocks.push({
        kind: "item",
        list,
        ...(read.kind === "numbered" ? { number: read.number } : {}),
        ...(read.kind === "task" ? { task: { state: read.state, done: read.done } } : {}),
        text: read.content,
        children: under.length ? sections(blocksOf(under, base + i + 1 + first)) : [],
        body: under.join("\n"),
        lines: span(i, last + 1),
      });
      i = last + 1;
      continue;
    }
    if (read.kind === "heading") {
      blocks.push({ kind: "heading", level: read.level, text: headingText(read.content), children: [], title: span(i, i + 1), lines: span(i, i + 1) });
      i++;
      continue;
    }
    if (read.kind === "rule") {
      blocks.push({ kind: "rule", lines: span(i, i + 1) });
      i++;
      continue;
    }
    // Lines of one kind one after another: a quote's, a table's, a paragraph's
    let end = i + 1;
    while (end < lines.length && !blank(lines[end]!) && !fenceOf(lines[end]!) && readLine(lines[end]!).kind === read.kind) end++;
    const run = lines.slice(i, end).map(readLine);
    if (read.kind === "paragraph") {
      // A setext heading: the paragraph's lines up to an underline (`===`, a line of the paragraph's run; `---`, read as
      // a rule, the line after it), its text theirs
      const equals = run.findIndex((one, at) => at > 0 && SETEXT_RE.exec(lines[i + at]!)?.[1]![0] === "=");
      const dashes = equals < 0 && end < lines.length && SETEXT_RE.exec(lines[end]!)?.[1]![0] === "-";
      if (equals > 0 || dashes) {
        const texts = run.slice(0, equals > 0 ? equals : run.length).map((one) => one.content.trim());
        const to = equals > 0 ? i + equals + 1 : end + 1;
        blocks.push({ kind: "heading", level: equals > 0 ? 1 : 2, text: texts.join(" "), children: [], title: span(i, to), lines: span(i, to) });
        i = to;
        continue;
      }
    }
    if (read.kind === "table" && run.length > 1 && TABLE_RULE_RE.test(run[1]!.content)) {
      const rows = run.map((one) => cellsOf(one.content)).filter((_, at) => at !== 1);
      blocks.push({ kind: "table", header: rows[0]!, rows: rows.slice(1), lines: span(i, end) });
    } else blocks.push({ kind: read.kind === "quote" ? "quote" : "paragraph", text: run.map((one) => one.content).join("\n"), lines: span(i, end) });
    i = end;
  }
  return blocks;
}

/** Headings made to hold their sections: the blocks after each up to a heading of its level or above */
function sections(blocks: readonly Block[]): Block[] {
  type Open = { level: number; text: string; children: Block[]; title: BlockLines; from: number; to: number };
  const top: Block[] = [];
  const open: Open[] = [];
  const close = (heading: Open): Block => ({ kind: "heading", level: heading.level, text: heading.text, children: heading.children, title: heading.title, lines: { from: heading.from, to: heading.to } });
  // (Each heading open reaches as far as what it holds, a heading in it too)
  const reach = (to: number) => {
    for (const one of open) one.to = Math.max(one.to, to);
  };
  const shut = (level: number) => {
    while (open.length && open.at(-1)!.level >= level) {
      const made = close(open.pop()!);
      const parent = open.at(-1);
      if (parent) parent.children.push(made);
      else top.push(made);
    }
  };
  for (const block of blocks) {
    if (block.kind === "heading") {
      shut(block.level);
      reach(block.lines.to);
      open.push({ level: block.level, text: block.text, children: [...block.children], title: block.title, from: block.lines.from, to: block.lines.to });
    } else {
      const parent = open.at(-1);
      if (parent) parent.children.push(block);
      else top.push(block);
      reach(block.lines.to);
    }
  }
  shut(0);
  return top;
}
