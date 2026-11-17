// The blank lines of a cell's markdown as the editor shows them (docs/silverware-layout-grid.md, *Blank lines*): the
// editor shows each blank line of a page as a line of its own; the host's rendering of a cell (SilverBullet's
// markdownToHtml, 2.12.1, probed 2026-11-14) keeps those between paragraphs (as line breaks) and drops those next to a
// block (a list, a heading, a table, a code block) and between a loose list's items; in a quote alike, its blank lines
// its marks alone (`>`: kept as line breaks but between a loose list's items, probed 2026-11-17). What a rendered
// element misses of the blank lines before it in the markdown is counted here, its lines read once as markdown's parser
// reads them (shared/markdown/parse.ts: a quote's marks, a list item's, none in a code block). Pure.
import { type MarkedLine, markedLines } from "../../../../shared/markdown/parse.ts";

// Elements the host draws as blocks: after one, no line break ends a line first
const BLOCKS = new Set(["UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "TABLE", "BLOCKQUOTE", "HR", "DIV", "P", "DL", "FIGURE", "DETAILS"]);

/** A cell's markdown read line by line, each with the marks of the blocks holding it, in order */
export type CellLines = readonly MarkedLine[];

/** A cell's markdown read line by line: once for all its places asked */
export const cellLines = (text: string): CellLines => markedLines(text);

/** The line a place is on: its index (a place past the text's end on its last line) */
function lineIndex(lines: CellLines, at: number): number {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lines[mid]!.from <= at) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Where the line a place is on starts */
export const lineStartOf = (lines: CellLines, at: number): number => lines[lineIndex(lines, at)]!.from;

/** Whether nothing but its line's marks (a quote's, a list item's) and indentation lies before a place: a block starts there */
export const startsLine = (lines: CellLines, at: number): boolean => at <= lines[lineIndex(lines, at)]!.content;

/**
 * Where the blank lines right before the line a place is on start, the nearest first. In a quote a blank line is one of
 * its marks alone (`>`), the editor showing it as an empty line of the quote. One counts for a place in a quote as deep
 * or shallower (a deeper quote's last empty line, before the place, ends that quote), not for a place deeper: a blank
 * line shallower than the place's quote lies before that quote, its own. An empty item's line (its marker alone) is none.
 * Read back from that line over them alone, not the text before: a cell's every line is asked for as it is drawn
 */
export function blankLineStarts(lines: CellLines, at: number): readonly number[] {
  const index = lineIndex(lines, at);
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
export const blankLinesBefore = (lines: CellLines, at: number): number => blankLineStarts(lines, at).length;

/**
 * How many blank lines the host drew right before an element of a cell: the line breaks before it, the first of them
 * only ending the line of an inline element before them (a paragraph, the host's `span`), none after a block
 */
export function blankLinesDrawn(breaks: number, before: { readonly tagName: string } | undefined): number {
  const inline = !!before && !BLOCKS.has(before.tagName.toUpperCase());
  return inline ? Math.max(0, breaks - 1) : breaks;
}
