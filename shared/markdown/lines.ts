// Markdown's lines as a selection touches them, and its fenced code blocks
// read line by line: what any plugin reading the text selected needs (Silverware
// Toolbar's formats, Silverware Database's converters). Pure, on the text.

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
