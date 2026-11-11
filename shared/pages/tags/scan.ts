// The hashtags of a page's body, found as SilverBullet's parser finds them
// (`Hashtag`, an inline element wherever text is read inline): not in the
// frontmatter (frontmatter.ts reads it), code, nor where a line's marks leave
// none (shared/markdown/inline.ts: inline code, wiki links, attributes' values,
// a link's target, URLs, HTML, a `#` escaped). Each with its place in the text
// and its context, as SilverBullet's index tells them apart
// (plugs/index/tags.ts `hashtagParent`, main of 2026-11-06): a task's own text
// a task, anything else within a list's item an item, then a table, a
// heading, else a paragraph (a quote's, HTML's, a comment's too); and the
// page's tag line (frontmatter.ts): a paragraph directly under the document,
// its hashtags before any other text, up to a line break with more after it.
// A hashtag SilverBullet's index gives no context (in HTML, a setext heading, a
// footnote) is still one its user sees: found, renamed and removed as the
// others.
//
// Its blocks are shared/markdown/parse.ts' (lezer's parser, as SilverBullet's),
// each block's lines read here for their marks. Behind `TagScanner`, so another
// could take its place.
import { inlineMarks } from "../../markdown/inline.ts";
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
          break;
        default: {
          const tags = hashtagsOf(text, node.lines);
          const context: TagContext = node.kind === "task" ? "task" : inItem ? "item" : node.kind === "table" ? "table" : node.kind === "heading" ? "heading" : "paragraph";
          const onTagLine = top && node.kind === "paragraph" ? tagLineCount(text, node, tags) : 0;
          tags.forEach((tag, at) => found.push({ ...tag, context: at < onTagLine ? "page" : context }));
        }
      }
    }
  };
  visit(parseBlocks(text, bodyStart), false, true);
  return found;
};

/** The hashtags of a block's lines, in order, their context to be given */
function hashtagsOf(text: string, lines: readonly Span[]): Omit<Hashtag, "context">[] {
  const tags: Omit<Hashtag, "context">[] = [];
  for (const span of lines) {
    const line = lineOf(text, span.from);
    for (const mark of inlineMarks(text.slice(span.from, span.to))) {
      if (mark.kind === "tag") tags.push({ name: mark.name, from: span.from + mark.from, to: span.from + mark.to, line });
    }
  }
  return tags;
}

/**
 * How many of a paragraph's first hashtags are the page's, as SilverBullet's frontmatter.ts reads a paragraph directly
 * under the document: none where any text but spaces is before or between them, those before a line break with more
 * after it (`#a\ntext`: `a`)
 */
function tagLineCount(text: string, paragraph: Span, tags: readonly Span[]): number {
  // (A CRLF's `\r` none of the text)
  const gap = (from: number, to: number) => text.slice(from, to).replace(/\r/g, "");
  if (gap(paragraph.from, tags[0]?.from ?? paragraph.to).trim()) return 0;
  for (let at = 0; at < tags.length; at++) {
    const after = gap(tags[at]!.to, tags[at + 1]?.from ?? paragraph.to);
    if (after.startsWith("\n") && after !== "\n") return at + 1;
    if (after.trim()) return 0;
  }
  return tags.length;
}

/** The line `at` is on, without its line break */
function lineOf(text: string, at: number): Hashtag["line"] {
  const end = text.indexOf("\n", at);
  // (At 0 no line break can be before: lastIndexOf would read a negative start as 0 and find one there)
  return { from: at === 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1, to: end < 0 ? text.length : end };
}
