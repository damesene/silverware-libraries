// The blank lines of a cell's markdown as the editor shows them (docs/silverware-layout-grid.md, *Blank lines*): the
// editor shows each blank line of a page as a line of its own; the host's rendering of a cell (SilverBullet's
// markdownToHtml, 2.12.1, probed 2026-11-14) keeps those between paragraphs (as line breaks) and drops those next to a
// block (a list, a heading, a table, a code block) and between a loose list's items; in a quote alike, its blank lines
// its marks alone (`>`: kept as line breaks but between a loose list's items, probed 2026-11-17). What a rendered
// element misses of the blank lines before it in the markdown is counted here, its lines read once as markdown's parser
// reads them (shared/markdown/parse.ts: a quote's marks, a list item's, none in a code block). Pure.
import { lineIndexAt, type MarkedLine, markedLines } from "../../../../shared/markdown/parse.ts";

// Elements the host draws as blocks: after one, no line break ends a line first
const BLOCKS = new Set(["UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "TABLE", "BLOCKQUOTE", "HR", "DIV", "P", "DL", "FIGURE", "DETAILS"]);

// The cells' markdown read lately, by its text, the latest last: a grid drawn anew asks again for its cells unchanged
const READ = new Map<string, readonly MarkedLine[]>();
// How many are kept (the oldest dropped)
const READ_KEPT = 64;

/**
 * A cell's markdown read line by line as markdown's parser reads it (`markedLines`), once for the same text: each
 * drawing of a grid asks for its every cell, and each point found in a cell after (a press, a drop) for that cell
 */
export function cellLines(content: string): readonly MarkedLine[] {
  const read = READ.get(content);
  if (read) {
    READ.delete(content);
    READ.set(content, read);
    return read;
  }
  const lines = markedLines(content);
  READ.set(content, lines);
  if (READ.size > READ_KEPT) READ.delete(READ.keys().next().value!);
  return lines;
}

/**
 * Where the blank lines right before the line a place is on start, the nearest first. In a quote a blank line is one of
 * its marks alone (`>`), the editor showing it as an empty line of the quote. One counts for a place in a quote as deep
 * or shallower (a deeper quote's last empty line, before the place, ends that quote), not for a place deeper: a blank
 * line shallower than the place's quote lies before that quote, its own. An empty item's line (its marker alone) is none.
 * Read back from that line over them alone, not the text before: a cell's every line is asked for as it is drawn
 */
export function blankLineStarts(lines: readonly MarkedLine[], at: number): readonly number[] {
  const index = lineIndexAt(lines, at);
  // (The quotes the place is in on its line: those whose marks are before it)
  const depth = lines[index]!.quotes.filter((quote) => quote < at).length;
  const starts: number[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (!line.empty || line.item || line.quotes.length < depth) break;
    starts.push(line.from);
  }
  return starts;
}

/** How many blank lines lie right before the line a place is on */
export const blankLinesBefore = (lines: readonly MarkedLine[], at: number): number => blankLineStarts(lines, at).length;

/**
 * How many blank lines the host drew right before an element of a cell: the line breaks before it, the first of them
 * only ending the line of what is inline before them (a paragraph, the host's `span`; text), none after a block
 */
export function blankLinesDrawn(breaks: number, before: { readonly nodeName: string } | undefined): number {
  const inline = !!before && !BLOCKS.has(before.nodeName.toUpperCase());
  return inline ? Math.max(0, breaks - 1) : breaks;
}
