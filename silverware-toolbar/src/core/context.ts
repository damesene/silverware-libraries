// The context of a selection: the page's text and the lines the selection
// touches, whole.
import { linesOf } from "../../../shared/markdown/lines.ts";
import type { Context } from "./action.ts";

export function contextOf(text: string, from: number, to: number): Context {
  const [a, b] = [Math.min(from, to), Math.max(from, to)];
  return { text, from: a, to: b, lines: linesOf(text, a, b) };
}
