// The context of a selection: the page's text and the lines the selection
// touches, whole.
import type { Context, Line } from "./action.ts";

/** The lines from..to touches (a selection ending at a line's start leaves that line out, as an editor does) */
export function linesOf(text: string, from: number, to: number): Line[] {
  const start = text.lastIndexOf("\n", from - 1) + 1;
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

export function contextOf(text: string, from: number, to: number): Context {
  const [a, b] = [Math.min(from, to), Math.max(from, to)];
  return { text, from: a, to: b, lines: linesOf(text, a, b) };
}
