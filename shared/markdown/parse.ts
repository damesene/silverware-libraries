// Markdown's blocks as SilverBullet's parser reads them: lezer's markdown
// parser (@lezer/markdown, the version SilverBullet builds on) with GFM's
// tables, its tree read into one of this module's own. The one place knowing
// lezer: its node names, its tree and its version stay here, so what reads
// blocks (blocks.ts `readBlocks`, the tag scanner) is written and tested
// against `MarkdownNode` alone.
//
// SilverBullet's own extensions making blocks are read here where something
// needs them: a task of a state of its own (task.ts, as its
// client/markdown_parser/extended_task.ts: any paragraph directly in a list's
// item), an HTML comment's body read as markdown but a marker comment's
// (`<!--#…`, `<!--/…`, a baked section's: none), as its html_block.ts. Read
// otherwise, kept so: a table's row is split at every `|` not escaped, as GFM's
// (SilverBullet's own table keeps a wiki link's `|` in its cell); a footnote's
// definition (`[^1]: …`) is a paragraph. Pure, synchronous.
import { parser as commonMark, Table } from "@lezer/markdown";
import { readTaskState } from "./task.ts";

const parser = commonMark.configure([Table]);
type SyntaxNode = ReturnType<typeof parser.parse>["topNode"];

/** Where something is in the text given: `to` past its end */
export type Span = { readonly from: number; readonly to: number };

/**
 * A block of its own text: that text on each of its lines (a blank line's empty), the markers of the blocks holding
 * it not in it (a quote's `>`, a list item's marker and indentation)
 */
type Leaf = Span & { readonly lines: readonly Span[] };

/** A block holding blocks */
type Container = Span & { readonly children: readonly MarkdownNode[] };

/** A block of a text, as markdown's parser reads it */
export type MarkdownNode =
  // A paragraph's lines without their indentation; `inline` where the elements of its own text are (emphasis, code,
  // links, HTML, entities, escapes, hard line breaks; no hashtag, lezer knows none), in order
  | (Leaf & { readonly kind: "paragraph"; readonly inline: readonly Span[] })
  // HTML's lines with the indentation it has of its own; `inline` where its text is read inline as SilverBullet reads
  // block-level HTML's (a div's), not a raw block's (pre, script, style, a comment's of its own, a tag alone)
  | (Leaf & { readonly kind: "html"; readonly inline: boolean })
  // A link's definition (`[label]: url "title"`), no text read inline
  | (Leaf & { readonly kind: "definition" })
  // Its text: an ATX heading's without its #s, a setext heading's lines without its underline
  | (Leaf & { readonly kind: "heading"; readonly level: number })
  // A paragraph directly in a list's item starting with a state in brackets (`[ ]`, `[x]`, one of its own): its
  // lines the text after the state
  | (Leaf & { readonly kind: "task"; readonly state: string; readonly done: boolean })
  // Its lines between its fences without the fence's indentation (indented code's four columns); its language
  // undefined where it is indented
  | (Leaf & { readonly kind: "code"; readonly language: string | undefined })
  // Its rows' cells, the header's first; its lines its rows' (its line of dashes, no text of it, none)
  | (Leaf & { readonly kind: "table"; readonly rows: readonly (readonly Span[])[] })
  | (Span & { readonly kind: "rule" })
  // Its lines as a leaf's from its content (after its marker), the indentation of its content off, more kept
  | (Container & Leaf & { readonly kind: "item"; readonly list: "bullet" | "numbered"; readonly number?: number })
  | (Container & { readonly kind: "quote" })
  // An HTML comment: its body (between `<!--` and `-->`) read as markdown (a marker comment's none)
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
  return new Reader(text, place).children(parser.parse(text).topNode, []);
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

/**
 * What a block holding others puts before each of their lines, outermost first: a quote's marker, a list item's
 * indentation (on its first line its marker, its content starting at `contentFrom`)
 */
type Prefix = { readonly kind: "quote" } | { readonly kind: "item"; readonly indent: number; readonly firstLine: number; readonly contentFrom: number };

// A quote's marker: up to three spaces of indentation, `>`, a space or a tab after it
const QUOTE_MARKER_RE = /^ {0,3}>[ \t]?/;
// A marker comment, which SilverBullet reads no markdown in (a baked section's `<!--#lua …-->`, `<!--/lua-->`)
const MARKER_COMMENT_RE = /^\s*<!--[ \t]*[#/]/;
// Block-level HTML (CommonMark's sixth kind of HTML block: its tags), whose text SilverBullet reads inline; the other
// kinds (pre, script, style, a tag alone on its line) it keeps raw
const BLOCK_HTML_RE =
  /^\s*<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;

const isSpace = (c: string | undefined) => c === " " || c === "\t";

class Reader {
  constructor(
    private readonly text: string,
    // Where a place in the text read is in the text given
    private readonly place: (at: number) => number,
  ) {}

  /** A container's blocks: its marks left out, a list's items its own */
  children(node: SyntaxNode, prefixes: readonly Prefix[]): MarkdownNode[] {
    const blocks: MarkdownNode[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "BulletList" || child.name === "OrderedList") blocks.push(...this.children(child, prefixes));
      else if (!child.name.endsWith("Mark")) blocks.push(this.block(child, prefixes));
    }
    return blocks;
  }

  private span(from: number, to: number): Span {
    return { from: this.place(from), to: this.place(to) };
  }

  private block(node: SyntaxNode, prefixes: readonly Prefix[]): MarkdownNode {
    const { from, to } = this.span(node.from, node.to);
    const heading = /^(?:ATXHeading|SetextHeading)(\d)$/.exec(node.name);
    if (heading) return { kind: "heading", level: Number(heading[1]), from, to, lines: this.headingLines(node, prefixes) };
    switch (node.name) {
      case "Blockquote":
        return { kind: "quote", from, to, children: this.children(node, [...prefixes, { kind: "quote" }]) };
      case "ListItem":
        return this.item(node, prefixes);
      case "FencedCode": {
        const info = node.getChild("CodeInfo");
        return { kind: "code", language: info ? this.text.slice(info.from, info.to) : "", from, to, lines: this.fencedLines(node, prefixes) };
      }
      case "CodeBlock":
        // (From its first line's start: its indentation is the four columns taken off each line)
        return { kind: "code", language: undefined, from, to, lines: this.lines(this.lineStart(node.from), node.to, prefixes, 4) };
      case "Table":
        return { kind: "table", from, to, ...this.rows(node) };
      case "HorizontalRule":
        return { kind: "rule", from, to };
      case "HTMLBlock":
      case "ProcessingInstructionBlock": {
        const inline = node.name === "HTMLBlock" && BLOCK_HTML_RE.test(this.text.slice(node.from, this.lineEnd(node.from)));
        return { kind: "html", inline, from, to, lines: this.lines(node.from, node.to, prefixes, 0) };
      }
      case "CommentBlock":
        return this.comment(node);
      // (A footnote's definition, `[^1]: …`, SilverBullet's own: a paragraph, its text read inline)
      case "LinkReference":
        if (!this.text.startsWith("[^", node.from)) return { kind: "definition", from, to, lines: this.lines(node.from, node.to, prefixes, Infinity) };
      // falls through
      default: {
        // A paragraph (a footnote's definition too; a block of no kind known here, its text as one's), a task where it is
        // directly in a list's item and starts with a state
        const task = node.parent?.name === "ListItem" ? readTaskState(this.text.slice(node.from, node.to)) : undefined;
        if (task) return { kind: "task", state: task.state, done: task.done, from, to, lines: this.lines(node.from, node.to, prefixes, Infinity, node.from + task.textFrom) };
        const inline: Span[] = [];
        for (let child = node.firstChild; child; child = child.nextSibling) if (child.name !== "QuoteMark") inline.push(this.span(child.from, child.to));
        return { kind: "paragraph", inline, from, to, lines: this.lines(node.from, node.to, prefixes, Infinity) };
      }
    }
  }

  /** A list's item: where its content starts, how far it is indented past its container's markers */
  private item(node: SyntaxNode, prefixes: readonly Prefix[]): MarkdownNode {
    const mark = node.getChild("ListMark")!;
    const firstLine = this.lineStart(node.from);
    const lineEnd = this.lineEnd(node.from);
    const first = mark.nextSibling;
    // Its content: where its first block starts on the marker's line, else (an item starting with a blank line, or
    // with indented code) a column after its marker
    const onMarkerLine = !!first && first.from < lineEnd && first.name !== "CodeBlock";
    const contentFrom = onMarkerLine ? first.from : Math.min(mark.to + (isSpace(this.text[mark.to]) ? 1 : 0), lineEnd);
    const contentColumn = onMarkerLine ? this.column(first.from) : this.column(mark.to) + 1;
    const indent = contentColumn - this.column(this.stripped(firstLine, lineEnd, prefixes));
    const inside: Prefix[] = [...prefixes, { kind: "item", indent, firstLine, contentFrom }];
    const ordered = node.parent?.name === "OrderedList";
    const { from, to } = this.span(node.from, node.to);
    return {
      kind: "item",
      list: ordered ? "numbered" : "bullet",
      ...(ordered ? { number: parseInt(this.text.slice(mark.from, mark.to), 10) } : {}),
      from,
      to,
      lines: this.lines(node.from, node.to, inside, 0),
      children: this.children(node, inside),
    };
  }

  /** An ATX heading's text between its #s, a setext heading's lines above its underline */
  private headingLines(node: SyntaxNode, prefixes: readonly Prefix[]): Span[] {
    const marks = node.getChildren("HeaderMark");
    if (node.name.startsWith("Setext")) return this.lines(node.from, this.lineStart(marks[0]!.from) - 1, prefixes, Infinity);
    const open = marks[0]!;
    const close = marks.length > 1 ? marks.at(-1)!.from : node.to;
    const text = this.text.slice(open.to, close);
    const start = open.to + (text.length - text.trimStart().length);
    return [this.span(start, Math.max(start, open.to + text.trimEnd().length))];
  }

  /** A fenced code's lines between its fences (to its container's end where it is not closed, blank lines at its end not its) */
  private fencedLines(node: SyntaxNode, prefixes: readonly Prefix[]): Span[] {
    const marks = node.getChildren("CodeMark");
    const open = marks[0]!;
    const firstLine = this.lineEnd(open.to);
    const closed = marks.length > 1 && this.lineStart(marks.at(-1)!.from) > firstLine;
    const end = closed ? this.lineStart(marks.at(-1)!.from) - 1 : node.to;
    if (end <= firstLine) return [];
    // (Each line as indented as the opening fence is, past its containers' markers, taken off)
    const indent = this.column(open.from) - this.column(this.stripped(this.lineStart(open.from), open.from, prefixes));
    const lines = this.lines(firstLine + 1, end, prefixes, indent);
    while (!closed && lines.length && lines.at(-1)!.from === lines.at(-1)!.to) lines.pop();
    return lines;
  }

  /** A table's rows as their cells (the text between its row's bars, each trimmed), and the rows' lines */
  private rows(node: SyntaxNode): { rows: Span[][]; lines: Span[] } {
    const rows: Span[][] = [];
    const lines: Span[] = [];
    for (let row = node.firstChild; row; row = row.nextSibling) {
      if (row.name !== "TableHeader" && row.name !== "TableRow") continue;
      const source = this.text.slice(row.from, row.to);
      const end = row.from + source.trimEnd().length;
      lines.push(this.span(row.from, end));
      const bars = row.getChildren("TableDelimiter").map((bar) => bar.from);
      const starts = [row.from, ...bars.map((bar) => bar + 1)];
      const ends = [...bars, end];
      const cells: Span[] = [];
      starts.forEach((start, at) => {
        // (No cell before a leading bar nor after a closing one)
        if ((at === 0 && bars[0] === row.from) || (at === starts.length - 1 && bars.at(-1) === end - 1)) return;
        const cell = this.text.slice(start, ends[at]);
        const trimmed = start + (cell.length - cell.trimStart().length);
        cells.push(this.span(trimmed, Math.max(trimmed, start + cell.trimEnd().length)));
      });
      rows.push(cells);
    }
    return { rows, lines };
  }

  /** A comment, its body read as markdown of its own (its places the text's); a marker comment's not read */
  private comment(node: SyntaxNode): MarkdownNode {
    const source = this.text.slice(node.from, node.to);
    const open = source.indexOf("<!--") + 4;
    const close = source.indexOf("-->", open);
    const bodyFrom = node.from + open;
    const bodyTo = node.from + (close < 0 ? source.length : close);
    const { from, to } = this.span(node.from, node.to);
    const children = MARKER_COMMENT_RE.test(source) ? [] : readTree(this.text.slice(bodyFrom, bodyTo), (at) => this.place(bodyFrom + at));
    return { kind: "comment", from, to, body: this.span(bodyFrom, bodyTo), children };
  }

  private lineStart(at: number): number {
    // (At 0 no line break can be before: lastIndexOf would read a negative start as 0 and find one there)
    return at === 0 ? 0 : this.text.lastIndexOf("\n", at - 1) + 1;
  }

  private lineEnd(at: number): number {
    const end = this.text.indexOf("\n", at);
    return end < 0 ? this.text.length : end;
  }

  /** The column `at` is in, a tab reaching the next multiple of four */
  private column(at: number): number {
    let column = 0;
    for (let i = this.lineStart(at); i < at; i++) column = this.text[i] === "\t" ? column + 4 - (column % 4) : column + 1;
    return column;
  }

  /** Past as many columns of indentation from `at` as `columns` (a tab reaching past them taken whole), less where there is less */
  private indented(at: number, end: number, columns: number): number {
    const target = this.column(at) + columns;
    let column = this.column(at);
    for (; at < end && isSpace(this.text[at]) && column < target; at++) column = this.text[at] === "\t" ? column + 4 - (column % 4) : column + 1;
    return at;
  }

  /** Where a line's containers' markers end: those it has (a line going on lazily has fewer), outermost first */
  private stripped(lineStart: number, end: number, prefixes: readonly Prefix[]): number {
    let at = lineStart;
    for (const prefix of prefixes) {
      if (prefix.kind === "quote") {
        const marker = QUOTE_MARKER_RE.exec(this.text.slice(at, end));
        if (!marker) return at;
        at += marker[0].length;
      } else at = lineStart === prefix.firstLine ? Math.max(at, prefix.contentFrom) : this.indented(at, end, prefix.indent);
    }
    return at;
  }

  /**
   * A leaf's text on each of its lines from..to: each after its containers' markers and as many columns of its own
   * indentation as `indent` (Infinity: all of it), its first line's text from `first` at the earliest
   */
  private lines(from: number, to: number, prefixes: readonly Prefix[], indent: number, first = from): Span[] {
    const lines: Span[] = [];
    const firstLine = this.lineStart(from);
    for (let start = firstLine; ; ) {
      const end = Math.min(this.lineEnd(start), to);
      let at = this.indented(this.stripped(start, end, prefixes), end, indent);
      if (start === firstLine) at = Math.max(at, first);
      lines.push(this.span(Math.min(at, end), end));
      if (end >= to) break;
      start = end + 1;
    }
    return lines;
  }
}
