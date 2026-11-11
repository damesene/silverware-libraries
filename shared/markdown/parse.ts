// Markdown's blocks as SilverBullet's parser reads them: lezer's markdown
// parser (@lezer/markdown, the version SilverBullet builds on) with GFM's
// tables, its tree read into one of this module's own. The one place knowing
// lezer: its node names, its tree and its version stay here, so what reads
// blocks (blocks.ts `readBlocks`, the tag scanner) is written and tested
// against `MarkdownNode` alone.
//
// SilverBullet's own extensions making blocks are read here where something
// needs them: a task of a state of its own (task.ts, as its
// client/markdown_parser/extended_task.ts), an HTML comment's body read as
// markdown (as its html_block.ts). Read otherwise, kept so: a table's row is
// split at every `|` not escaped, as GFM's (SilverBullet's own table keeps a wiki
// link's `|` in its cell); a footnote's definition (`[^1]: …`) is a paragraph.
// Pure, synchronous.
import { parser as commonMark, Table } from "@lezer/markdown";
import { readTaskState } from "./task.ts";

const parser = commonMark.configure([Table]);
type SyntaxNode = ReturnType<typeof parser.parse>["topNode"];

/** Where something is in the text given: `to` past its end */
export type Span = { readonly from: number; readonly to: number };

/**
 * A block of its own text: that text on each of its lines (a blank line's empty), the markers of the blocks holding
 * it not in it (a quote's `>`, a list item's indentation)
 */
type Leaf = Span & { readonly lines: readonly Span[] };

/** A block holding blocks */
type Container = Span & { readonly children: readonly MarkdownNode[] };

/** A block of a text, as markdown's parser reads it */
export type MarkdownNode =
  | (Leaf & { readonly kind: "paragraph" | "html" })
  // Its text: an ATX heading's without its #s, a setext heading's lines without its underline
  | (Leaf & { readonly kind: "heading"; readonly level: number })
  // A list item's text starting with a state in brackets (`[ ]`, `[x]`, one of its own): its lines the text after them
  | (Leaf & { readonly kind: "task"; readonly state: string; readonly done: boolean })
  // Its lines without the fence's indentation (indented code's four columns); its language undefined where it is indented
  | (Leaf & { readonly kind: "code"; readonly language: string | undefined })
  // Its rows' cells, the header's first (its line of dashes none); its lines its rows'
  | (Leaf & { readonly kind: "table"; readonly rows: readonly (readonly Span[])[] })
  | (Span & { readonly kind: "rule" })
  | (Container & { readonly kind: "item"; readonly list: "bullet" | "numbered"; readonly number?: number })
  | (Container & { readonly kind: "quote" })
  // An HTML comment: its body (between `<!--` and `-->`) read as markdown
  | (Container & { readonly kind: "comment"; readonly body: Span });

/**
 * The blocks of the text from `from` (after a frontmatter: lezer knows none), their places the text's. A CRLF is read
 * as a line break alone, as an editor gives the text (lezer would take its `\r` for text: a marker alone, `-\r`, would
 * be none, nor would a table's line of dashes), no span holding its `\r`
 */
export function parseBlocks(text: string, from = 0): MarkdownNode[] {
  // Where each line break that had a `\r` before it is in the text read
  const breaks: number[] = [];
  const read = text.slice(from).replace(/\r\n/g, (_, at: number) => {
    breaks.push(at - breaks.length);
    return "\n";
  });
  return readTree(read, (at) => from + at + below(breaks, at));
}

/** A text's blocks, `place` giving where a place in it is in the text given */
function readTree(text: string, place: (at: number) => number): MarkdownNode[] {
  const tree = parser.parse(text);
  const quoteMarks: number[] = [];
  tree.iterate({ enter: (node) => void (node.name === "QuoteMark" && quoteMarks.push(node.to)) });
  return new Reader(text, place, quoteMarks).children(tree.topNode);
}

/** How many of the places in order are before `at` */
function below(places: readonly number[], at: number): number {
  let low = 0;
  let high = places.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (places[mid]! < at) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** A tab as four columns, as `lines.ts` `indentWidth` reads one */
const width = (text: string) => text.replace(/\t/g, "    ").length;

class Reader {
  constructor(
    private readonly text: string,
    // Where a place in the text read is in the text given
    private readonly place: (at: number) => number,
    // Where each quote's marker ends, in order
    private readonly quoteMarks: readonly number[],
  ) {}

  /** A container's blocks: its marks left out, a list's items its own */
  children(node: SyntaxNode): MarkdownNode[] {
    const blocks: MarkdownNode[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "BulletList" || child.name === "OrderedList") blocks.push(...this.children(child));
      else if (!child.name.endsWith("Mark")) blocks.push(this.block(child));
    }
    return blocks;
  }

  private span(from: number, to: number): Span {
    return { from: this.place(from), to: this.place(to) };
  }

  private block(node: SyntaxNode): MarkdownNode {
    const { from, to } = this.span(node.from, node.to);
    const heading = /^(?:ATXHeading|SetextHeading)(\d)$/.exec(node.name);
    if (heading) return { kind: "heading", level: Number(heading[1]), from, to, lines: this.headingLines(node) };
    switch (node.name) {
      case "Blockquote":
        return { kind: "quote", from, to, children: this.children(node) };
      case "ListItem": {
        const mark = node.getChild("ListMark")!;
        const ordered = node.parent?.name === "OrderedList";
        return { kind: "item", list: ordered ? "numbered" : "bullet", ...(ordered ? { number: parseInt(this.text.slice(mark.from, mark.to), 10) } : {}), from, to, children: this.children(node) };
      }
      case "FencedCode": {
        const info = node.getChild("CodeInfo");
        return { kind: "code", language: info ? this.text.slice(info.from, info.to) : "", from, to, lines: this.fencedLines(node) };
      }
      case "CodeBlock":
        return { kind: "code", language: undefined, from, to, lines: this.lines(node.from, node.to) };
      case "Table":
        return { kind: "table", from, to, ...this.rows(node) };
      case "HorizontalRule":
        return { kind: "rule", from, to };
      case "HTMLBlock":
      case "ProcessingInstructionBlock":
        return { kind: "html", from, to, lines: this.lines(node.from, node.to) };
      case "CommentBlock":
        return this.comment(node);
      default: {
        // A paragraph (a link's or a footnote's definition too; a block of no kind known here, its text as one's), a task
        // where it is a list item's starting with a state
        const task = node.parent?.name === "ListItem" ? readTaskState(this.text.slice(node.from, node.to)) : undefined;
        if (task) return { kind: "task", state: task.state, done: task.done, from, to, lines: this.lines(node.from, node.to, node.from + task.textFrom) };
        return { kind: "paragraph", from, to, lines: this.lines(node.from, node.to) };
      }
    }
  }

  /** An ATX heading's text between its #s, a setext heading's lines above its underline */
  private headingLines(node: SyntaxNode): Span[] {
    const marks = node.getChildren("HeaderMark");
    if (node.name.startsWith("Setext")) return this.lines(node.from, this.lineStart(marks[0]!.from) - 1);
    const open = marks[0]!;
    const close = marks.length > 1 ? marks.at(-1)!.from : node.to;
    const text = this.text.slice(open.to, close);
    const start = open.to + (text.length - text.trimStart().length);
    return [this.span(start, Math.max(start, open.to + text.trimEnd().length))];
  }

  /** A fenced code's lines between its fences (to its container's end where it is not closed) */
  private fencedLines(node: SyntaxNode): Span[] {
    const marks = node.getChildren("CodeMark");
    const open = marks[0]!;
    const firstLine = this.text.indexOf("\n", open.to);
    if (firstLine < 0 || firstLine >= node.to) return [];
    const closed = marks.length > 1 && this.lineStart(marks.at(-1)!.from) > firstLine;
    const end = closed ? this.lineStart(marks.at(-1)!.from) - 1 : node.to;
    // (Each line as indented as the opening fence taken off, its container's markers and indentation with it)
    return end > firstLine ? this.lines(firstLine + 1, end, undefined, this.columnIn(open.from)) : [];
  }

  /** A table's rows as their cells (the text between its row's bars, each trimmed), and the rows' lines */
  private rows(node: SyntaxNode): { rows: Span[][]; lines: Span[] } {
    const rows: Span[][] = [];
    const lines: Span[] = [];
    for (let row = node.firstChild; row; row = row.nextSibling) {
      if (row.name !== "TableHeader" && row.name !== "TableRow") continue;
      lines.push(this.span(row.from, row.to));
      const bars = row.getChildren("TableDelimiter").map((bar) => bar.from);
      const edges = [row.from, ...bars.map((bar) => bar + 1)];
      const ends = [...bars, row.to];
      const cells: Span[] = [];
      edges.forEach((start, at) => {
        // (No cell before a leading bar nor after a closing one)
        if ((at === 0 && bars[0] === row.from) || (at === edges.length - 1 && bars.at(-1) === row.to - 1)) return;
        const cell = this.text.slice(start, ends[at]);
        const trimmedStart = start + (cell.length - cell.trimStart().length);
        cells.push(this.span(trimmedStart, Math.max(trimmedStart, start + cell.trimEnd().length)));
      });
      rows.push(cells);
    }
    return { rows, lines };
  }

  /** A comment, its body read as markdown of its own (its places the text's) */
  private comment(node: SyntaxNode): MarkdownNode {
    const source = this.text.slice(node.from, node.to);
    const open = source.indexOf("<!--") + 4;
    const close = source.indexOf("-->", open);
    const bodyFrom = node.from + open;
    const bodyTo = node.from + (close < 0 ? source.length : close);
    const { from, to } = this.span(node.from, node.to);
    return { kind: "comment", from, to, body: this.span(bodyFrom, bodyTo), children: readTree(this.text.slice(bodyFrom, bodyTo), (at) => this.place(bodyFrom + at)) };
  }

  private lineStart(at: number): number {
    // (At 0 no line break can be before: lastIndexOf would read a negative start as 0 and find one there)
    return at === 0 ? 0 : this.text.lastIndexOf("\n", at - 1) + 1;
  }

  /** Where a line's containers' markers end before `at`: after the last quote's marker on it (and a space after it) */
  private markersEnd(lineStart: number, at: number): number {
    const mark = this.quoteMarks[below(this.quoteMarks, at + 1) - 1];
    if (mark === undefined || mark <= lineStart) return lineStart;
    return Math.min(mark + (this.text[mark] === " " || this.text[mark] === "\t" ? 1 : 0), at);
  }

  /** How many columns `at` is into its line, its containers' markers not counted */
  private columnIn(at: number): number {
    const lineStart = this.lineStart(at);
    return width(this.text.slice(this.markersEnd(lineStart, at), at));
  }

  /**
   * A leaf's text on each of its lines from..to: its first line's from `first` (where its text starts, `from` unless
   * a marker of its own is before), each other's after its containers' markers and as many columns of indentation
   * as `indent` (the leaf's own first line's: its list item's content, its fence's), less where it has less (a line
   * going on lazily)
   */
  private lines(from: number, to: number, first = from, indent = this.columnIn(from)): Span[] {
    const lines: Span[] = [];
    const firstLine = this.lineStart(from);
    for (let start = firstLine; ; ) {
      const newline = this.text.indexOf("\n", start);
      const end = Math.min(newline < 0 ? this.text.length : newline, to);
      // (A leaf starting within its first line starts its text there; one starting at a line's start, code between
      // fences, has its containers' markers and indentation on it too)
      const own = start === firstLine && from > firstLine;
      let at = own ? first : this.markersEnd(start, end);
      for (let taken = 0; !own && at < end && taken < indent && (this.text[at] === " " || this.text[at] === "\t"); at++) taken += this.text[at] === "\t" ? 4 : 1;
      lines.push(this.span(Math.min(at, end), end));
      if (newline < 0 || newline >= to) break;
      start = newline + 1;
    }
    return lines;
  }
}
