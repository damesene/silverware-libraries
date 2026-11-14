// The blank lines of a cell's markdown as the editor shows them (docs/silverware-layout-grid.md, *Blank lines*): the
// editor shows each blank line of a page as a line of its own; the host's rendering of a cell (SilverBullet's
// markdownToHtml, 2.12.1, probed 2026-11-14) keeps those between paragraphs (as line breaks) and drops those next to a
// block (a list, a heading, a table, a code block) and between a loose list's items. What a rendered element misses of
// the blank lines before it in the markdown is counted here. Pure.

// Elements the host draws as blocks: after one, no line break ends a line first
const BLOCKS = new Set(["UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "TABLE", "BLOCKQUOTE", "HR", "DIV", "P", "DL", "FIGURE", "DETAILS"]);

/** How many blank lines lie right before the line a place of a text is on */
export function blankLinesBefore(text: string, at: number): number {
  const lines = text.slice(0, Math.max(0, at)).split("\n");
  // (The line the place is on, up to the place: not one of them)
  lines.pop();
  let blank = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i]!.trim() === ""; i--) blank++;
  return blank;
}

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
  if (nth < 1 || nth > blankLinesBefore(text, at)) return undefined;
  let start = text.lastIndexOf("\n", Math.max(0, at) - 1) + 1;
  for (let i = 0; i < nth; i++) start = text.lastIndexOf("\n", start - 2) + 1;
  return start;
}
