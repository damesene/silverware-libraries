// A text's blocks as a tree, as SilverBullet's parser reads them (`readBlocks`:
// a list's items with what is under them, a quote's blocks, a heading with its
// section, a table's cells: what a converter of Silverware Database reads).
// Read by parse.ts (lezer's parser), here made what a converter works with:
// texts, lines, sections. A line's block alone is blockline.ts'. Pure, on the
// text.
import { type MarkdownNode, parseBlocks, type Span } from "./parse.ts";

/** The lines a block was read from: their indexes in the text given, `to` past the last */
export type BlockLines = { readonly from: number; readonly to: number };

/** A block of a text, as `readBlocks` reads it */
export type Block =
  // A heading and its section: the blocks after it up to a heading of its level or above; `title` the heading's own
  // lines (a setext heading's two or more), `lines` with its section
  | { readonly kind: "heading"; readonly level: number; readonly text: string; readonly children: readonly Block[]; readonly title: BlockLines; readonly lines: BlockLines }
  // A list's item: its text (its first paragraph's, a line going on lazily too; a task's after its state), `title` that
  // text's lines; the blocks after it (items nested, paragraphs…) and those lines as written, dedented
  | {
      readonly kind: "item";
      readonly list: "bullet" | "numbered";
      readonly number?: number;
      readonly task?: { readonly state: string; readonly done: boolean };
      readonly text: string;
      readonly children: readonly Block[];
      readonly body: string;
      readonly title: BlockLines;
      readonly lines: BlockLines;
    }
  | { readonly kind: "quote"; readonly children: readonly Block[]; readonly lines: BlockLines }
  // Lines one after another, their texts joined by line breaks: a paragraph's, HTML's, a comment's body (as written)
  | { readonly kind: "paragraph" | "html" | "comment"; readonly text: string; readonly lines: BlockLines }
  // Code as written, fenced (its language, "" where it names none) or indented ("")
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

/**
 * The text's blocks, in its order: a heading holding its section, an item and a quote what is in them. A text starting
 * with a frontmatter (`---`, keys, `---`) gives no block of it. A table's row is split at every `|` not escaped (write
 * `\|` in a cell: GFM's rule), a wiki link's too
 */
export function readBlocks(text: string): Block[] {
  return new BlockReader(text).blocks();
}

/** Every block of a tree, depth first in the text's order: a table under a heading, a paragraph in an item or a quote too */
export function allBlocks(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => [block, ...("children" in block ? allBlocks(block.children) : [])]);
}

// A frontmatter's first key: what tells it from a rule above a paragraph
const KEY_RE = /^[A-Za-z_][\w-]*[ \t]*:/;

/** Where a frontmatter at the lines' start ends (the line after its closing `---`), 0 where there is none */
function frontmatterEnd(lines: readonly string[]): number {
  if (lines[0]?.trimEnd() !== "---" || !KEY_RE.test(lines[1] ?? "")) return 0;
  const close = lines.findIndex((line, at) => at > 0 && line.trimEnd() === "---");
  return close < 0 ? 0 : close + 1;
}

class BlockReader {
  private readonly lines: readonly string[];
  // Where each line starts in the text
  private readonly starts: readonly number[];

  constructor(private readonly text: string) {
    this.lines = text.split("\n");
    let at = 0;
    this.starts = this.lines.map((line) => {
      const start = at;
      at += line.length + 1;
      return start;
    });
  }

  blocks(): Block[] {
    const start = frontmatterEnd(this.lines.map((line) => line.replace(/\r$/, "")));
    return this.made(parseBlocks(this.text, this.starts[start] ?? this.text.length));
  }

  /** Blocks made of the parser's, headings holding their sections */
  private made(nodes: readonly MarkdownNode[]): Block[] {
    return sections(nodes.map((node) => this.block(node)));
  }

  private block(node: MarkdownNode): Block {
    const lines = this.lineSpan(node);
    switch (node.kind) {
      case "heading":
        return { kind: "heading", level: node.level, text: this.texts(node.lines).join(" "), children: [], title: lines, lines };
      case "item":
        return this.item(node, lines);
      case "quote":
        return { kind: "quote", children: this.made(node.children), lines };
      case "comment":
        return { kind: "comment", text: this.text.slice(node.body.from, node.body.to), lines };
      case "code":
        return { kind: "code", language: node.language ?? "", text: node.lines.map((line) => this.of(line)).join("\n"), lines };
      case "table": {
        const [header = [], ...rows] = node.rows.map((row) => row.map((cell) => this.of(cell).replace(/\\\|/g, "|")));
        return { kind: "table", header, rows, lines };
      }
      case "rule":
        return { kind: "rule", lines };
      // A task outside an item the parser never gives: its text a paragraph's
      default:
        return { kind: node.kind === "html" ? "html" : "paragraph", text: this.texts(node.lines).join("\n"), lines };
    }
  }

  /** An item: its text its first block's where that is a paragraph or a task, what follows its body */
  private item(node: Extract<MarkdownNode, { kind: "item" }>, lines: BlockLines): Block {
    const [first, ...rest] = node.children;
    const text = first?.kind === "paragraph" || first?.kind === "task" ? first : undefined;
    const title = text ? this.lineSpan(text) : { from: lines.from, to: lines.from + 1 };
    const body = dedentedLines(this.lines.slice(title.to, lines.to).map((line) => line.replace(/\r$/, "")));
    return {
      kind: "item",
      list: node.list,
      ...(node.number !== undefined ? { number: node.number } : {}),
      ...(text?.kind === "task" ? { task: { state: text.state, done: text.done } } : {}),
      text: text ? this.texts(text.lines).join("\n") : "",
      children: this.made(text ? rest : node.children),
      body: body.join("\n"),
      title,
      lines,
    };
  }

  private of(span: Span): string {
    return this.text.slice(span.from, span.to);
  }

  /** A leaf's lines' texts, each trimmed */
  private texts(lines: readonly Span[]): string[] {
    return lines.map((line) => this.of(line).trim());
  }

  /** The lines a node spans */
  private lineSpan(span: Span): BlockLines {
    return { from: this.lineAt(span.from), to: this.lineAt(Math.max(span.from, span.to - 1)) + 1 };
  }

  private lineAt(at: number): number {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid]! <= at) low = mid;
      else high = mid - 1;
    }
    return low;
  }
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
