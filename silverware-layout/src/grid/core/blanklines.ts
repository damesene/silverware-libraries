// The blank lines of a cell's markdown as the editor shows them (docs/silverware-layout-grid.md, *Blank lines*): the
// editor shows each blank line of a page as a line of its own; the host's rendering of a cell (SilverBullet's
// markdownToHtml, 2.12.1, probed 2026-11-14) keeps those between paragraphs (as line breaks) and drops those next to a
// block (a list, a heading, a table, a code block) and between a loose list's items; in a quote alike, its blank lines
// its marks alone (`>`, probed 2026-11-17). What a rendered element misses of the blank lines before it in the markdown
// is counted here. Pure.

// Elements the host draws as blocks: after one, no line break ends a line first
const BLOCKS = new Set(["UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "TABLE", "BLOCKQUOTE", "HR", "DIV", "P", "DL", "FIGURE", "DETAILS"]);

/** Where the line a place of a text is on starts */
// (At 0 the first line, whatever it holds: `lastIndexOf` would read a from-index of -1 as 0 and find a line break there)
export const lineStartOf = (text: string, at: number): number => (at <= 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1);

// A line's quote marks (`> > `)
const QUOTE_MARKS = /^(?:[ \t]*>)*/;
const quoteMarks = (line: string): string => QUOTE_MARKS.exec(line)![0];
const depthOf = (marks: string): number => marks.split(">").length - 1;

/**
 * Where the blank lines right before the line a place of a text is on start, the nearest first. In a quote a blank line
 * is one of its marks alone (`>`), as deep as the place's or less: the editor shows it as an empty line of the quote.
 * Read back from that line over them alone, not the text before: a cell's every line is asked for as it is drawn
 */
function blankLineStarts(text: string, at: number): readonly number[] {
  const lineStart = lineStartOf(text, at);
  const depth = depthOf(quoteMarks(text.slice(lineStart, Math.max(lineStart, at))));
  const starts: number[] = [];
  // (Each line before ends where the one after starts, its line break between)
  for (let end = lineStart; end > 0; ) {
    const start = lineStartOf(text, end - 1);
    const line = text.slice(start, end - 1);
    const marks = quoteMarks(line);
    if (line.slice(marks.length).trim() !== "" || depthOf(marks) > depth) break;
    starts.push(start);
    end = start;
  }
  return starts;
}

/** How many blank lines lie right before the line a place of a text is on */
export const blankLinesBefore = (text: string, at: number): number => blankLineStarts(text, at).length;

/**
 * How many blank lines the host drew right before an element of a cell: the line breaks before it, the first of them
 * only ending the line of an inline element before them (a paragraph, the host's `span`), none after a block
 */
export function blankLinesDrawn(breaks: number, before: { readonly tagName: string } | undefined): number {
  const inline = !!before && !BLOCKS.has(before.tagName.toUpperCase());
  return inline ? Math.max(0, breaks - 1) : breaks;
}

/** Where the `nth` blank line above the line a place of a text is on starts (1: the nearest); none where there are not as many */
export function blankLineStart(text: string, at: number, nth: number): number | undefined {
  return nth < 1 ? undefined : blankLineStarts(text, at)[nth - 1];
}
