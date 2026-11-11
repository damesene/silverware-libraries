// The hashtags of a page's body, found as SilverBullet's parser finds them
// (`Hashtag`, an inline element wherever text is read inline): not in the
// frontmatter (frontmatter.ts reads it), code, raw HTML, a link's definition,
// a marker comment, nor where a line's marks leave none
// (shared/markdown/inline.ts: inline code, wiki links, attributes' values, a
// link's target, URLs, HTML, a `#` escaped). Each with its place in the text
// and its context, as SilverBullet's index tells them apart
// (plugs/index/tags.ts `hashtagParent`, its main at 01d6b0e7, 2026-11-06): a
// task's own text a task, anything else within a list's item an item, then a
// table, a heading, else a paragraph (a quote's, block-level HTML's, a
// comment's too); and the page's tag line (frontmatter.ts), a paragraph
// directly under the document as it reads one. A hashtag SilverBullet's index
// gives no context (in block-level HTML, a setext heading, a footnote) is
// still one its user sees: found, renamed and removed as the others.
//
// Its blocks are shared/markdown/parse.ts' (lezer's parser, as SilverBullet's),
// each block's lines read here for their marks, one line at a time (a span of
// inline code over two lines is not read as one). Behind `TagScanner`, so
// another could take its place.
import { type InlineMark, inlineMarks } from "../../markdown/inline.ts";
import { type Line, linesOf } from "../../markdown/lines.ts";
import { type MarkdownNode, parseBlocks, type Span } from "../../markdown/parse.ts";

export type TagContext = "page" | "paragraph" | "item" | "task" | "table" | "heading";

export type Hashtag = {
  readonly name: string;
  // The hashtag's text in the page's text, its # included
  readonly from: number;
  readonly to: number;
  readonly context: TagContext;
  // The line it is on (without its line break)
  readonly line: { readonly from: number; readonly to: number };
};

export type TagScanner = (text: string, bodyStart: number) => readonly Hashtag[];

/** A line's mark, its place the text's */
type Mark = InlineMark & { readonly line: Line };

/** The hashtags of the body (the text from `bodyStart`, after the frontmatter) */
export const scanHashtags: TagScanner = (text, bodyStart) => {
  const found: Hashtag[] = [];
  // `inItem`: within a list's item, where anything but a task's own text is the item's
  const visit = (nodes: readonly MarkdownNode[], inItem: boolean, top: boolean) => {
    for (const node of nodes) {
      switch (node.kind) {
        case "item":
          visit(node.children, true, false);
          break;
        case "quote":
        case "comment":
          visit(node.children, inItem, false);
          break;
        case "code":
        case "rule":
        case "definition":
          break;
        default: {
          if (node.kind === "html" && !node.inline) break;
          const marks = marksOf(text, node.lines);
          const tags = marks.filter((mark) => mark.kind === "tag");
          const onTagLine = top && node.kind === "paragraph" ? tagLineCount(text, node, marks) : 0;
          const context = contextOf(node, inItem);
          tags.forEach((tag, at) => found.push({ name: tag.name, from: tag.from, to: tag.to, context: at < onTagLine ? "page" : context, line: { from: tag.line.from, to: tag.line.to } }));
        }
      }
    }
  };
  visit(parseBlocks(text, bodyStart), false, true);
  return found;
};

/** A hashtag's context by its block, as SilverBullet's `hashtagParent` ranks them: a task, an item, a table, a heading */
function contextOf(node: MarkdownNode, inItem: boolean): TagContext {
  if (node.kind === "task") return "task";
  if (inItem) return "item";
  if (node.kind === "table" || node.kind === "heading") return node.kind;
  return "paragraph";
}

/** The marks of a block's lines, in order, their places the text's */
function marksOf(text: string, lines: readonly Span[]): Mark[] {
  return lines.flatMap((span) => {
    const [line] = linesOf(text, span.from, span.from);
    return inlineMarks(text.slice(span.from, span.to)).map((mark) => ({ ...mark, from: span.from + mark.from, to: span.from + mark.to, line: line! }));
  });
}

/**
 * How many of a paragraph's first hashtags are the page's, as SilverBullet's frontmatter.ts reads a paragraph directly
 * under the document, element by element: its hashtags up to a text starting with a line break and more after it
 * (`#a\ntext`: `a`); none where any other text or element comes first (`#a text`, `#a\n*x*`, a hard line break)
 */
function tagLineCount(text: string, paragraph: Extract<MarkdownNode, { kind: "paragraph" }>, marks: readonly Mark[]): number {
  // Its elements in order: lezer's (emphasis, code, links…; none starting in a hashtag, which SilverBullet reads from
  // its #: `#<two words>` no HTML), and the marks SilverBullet reads as elements; a hashtag in another element (a
  // link's text) none of its own
  const tags = marks.filter((mark) => mark.kind === "tag");
  const inTag = (span: Span) => tags.some((tag) => tag.from < span.from && span.from < tag.to);
  const others: Span[] = [...paragraph.inline.filter((span) => !inTag(span)), ...marks.filter((mark) => mark.kind !== "tag")];
  const within = (mark: Span) => others.some((other) => other.from <= mark.from && mark.to <= other.to);
  const elements = [...others.map((span) => ({ span, tag: false })), ...tags.filter((tag) => !within(tag)).map((span) => ({ span, tag: true }))];
  elements.sort((a, b) => a.span.from - b.span.from);
  // (A CRLF's `\r` none of the text, as SilverBullet reads it)
  const textTo = (from: number, to: number) => text.slice(from, to).replace(/\r/g, "");
  let count = 0;
  let at = paragraph.from;
  for (const { span, tag } of [...elements, { span: { from: paragraph.to, to: paragraph.to }, tag: false }]) {
    const between = textTo(at, span.from);
    if (between.startsWith("\n") && between !== "\n") return count;
    if (between.trim()) return 0;
    if (span.from === paragraph.to) return count;
    if (!tag) return 0;
    count++;
    at = span.to;
  }
  return count;
}
