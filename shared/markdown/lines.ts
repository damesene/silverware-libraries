// Markdown's lines as a selection touches them, and its fenced code blocks
// read line by line: what any plugin reading the text selected needs (Silverware
// Toolbar's formats, Silverware Database's converters). Pure, on the text. Its
// lines with the marks of the blocks holding them (`MarkedLine`, read by
// parse.ts) and the line a place is on: what reads them needs no parser.

/** A line of a text: where it is, its text without its line break */
export type Line = { readonly from: number; readonly to: number; readonly text: string };

/** The lines from..to touches (a selection ending at a line's start leaves that line out, as an editor does) */
export function linesOf(text: string, from: number, to: number): Line[] {
  // (At 0 no line break can be before: lastIndexOf would read a negative start as 0 and find one there)
  const start = from === 0 ? 0 : text.lastIndexOf("\n", from - 1) + 1;
  // A selection of whole lines ends at the next line's start: that line is not selected
  const end = to > from && text[to - 1] === "\n" ? to - 1 : to;
  const lines: Line[] = [];
  let at = start;
  for (;;) {
    const lineEnd = text.indexOf("\n", at);
    const stop = lineEnd < 0 ? text.length : lineEnd;
    lines.push({ from: at, to: stop, text: text.slice(at, stop) });
    if (lineEnd < 0 || lineEnd >= end) break;
    at = lineEnd + 1;
  }
  return lines;
}

/** How wide a line's indentation is, a tab as four spaces */
export const indentWidth = (line: string) => /^[ \t]*/.exec(line)![0].replace(/\t/g, "    ").length;

/**
 * The line at `at` with the lines under it, as a list's item holds its own (those indented more, blank lines among
 * them): where they start and end (the last one's end, before its line break)
 */
export function linesUnder(text: string, at: number): { readonly from: number; readonly to: number } {
  const [line] = linesOf(text, at, at);
  const lines = linesOf(text, line!.from, text.length);
  const width = indentWidth(line!.text);
  let last = 0;
  for (let i = 1; i < lines.length; i++) {
    const { text: one } = lines[i]!;
    if (!one.trim()) continue;
    if (indentWidth(one) <= width) break;
    last = i;
  }
  return { from: line!.from, to: lines[last]!.to };
}

// A fence: its character and how many (a block opened by ``` ends at a line of
// as many backticks or more, not at ~~~); indented any amount, as in a list's item
const FENCE_RE = /^\s*(`{3,}|~{3,})/;

/** The fence a line is (its characters), if it is one: a backtick fence has no backtick after it (```a``` b is inline code) */
export function fenceOf(text: string): string | undefined {
  const fence = FENCE_RE.exec(text)?.[1];
  if (!fence || (fence[0] === "`" && text.slice(text.indexOf(fence) + fence.length).includes("`"))) return undefined;
  return fence;
}

/** Whether a line closes the block a fence opened: the same character, as many or more, nothing after it */
export function closesFence(text: string, open: string): boolean {
  const fence = fenceOf(text);
  return fence !== undefined && fence[0] === open[0] && fence.length >= open.length && text.trim() === fence;
}

/** A line read for fences: opens one (when none is open), closes the one open, else leaves it as it was */
export function nextFence(text: string, open: string | undefined): string | undefined {
  if (open === undefined) return fenceOf(text);
  return closesFence(text, open) ? undefined : open;
}

/** The fence open where the text up to `at` ends (undefined: none, `at` is outside any code block) */
export function fenceOpenAt(text: string, at: number): string | undefined {
  let open: string | undefined;
  for (const line of text.slice(0, at).split("\n")) open = nextFence(line, open);
  return open;
}

/**
 * A line of a text (`to` at its line break) with the marks the blocks holding it put on it, as markdown's parser reads
 * them (parse.ts `markedLines`, the one knowing the parser): where each of its quotes' `>` is, whether a list's item
 * starts on it (its marker), where its own text starts past them and the indentation, and whether it holds nothing past
 * them (a quote's empty line, `>`, a blank line). A mark in a code block is its text: none. A CRLF is read as
 * `parseBlocks` reads it, its `\r` in no line. The parser's own reading, none of SilverBullet's extensions: an HTML
 * comment's body is no markdown here (`parseBlocks` reads it)
 */
export type MarkedLine = { readonly from: number; readonly to: number; readonly quotes: readonly number[]; readonly item: boolean; readonly content: number; readonly empty: boolean };

/** How many of `count` places in order (the `i`th `placeOf(i)`) are before `at` */
export function countBelow(count: number, placeOf: (i: number) => number, at: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (placeOf(mid) < at) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Which of a text's marked lines (in order) a place is on: its index (past the text's end, the last) */
export const lineIndexAt = (lines: readonly MarkedLine[], at: number): number => Math.max(0, countBelow(lines.length, (i) => lines[i]!.from, at + 1) - 1);
