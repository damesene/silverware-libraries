// A new grid put into a page at the cursor (the slash command `/grid`): where a block may start (a grid cannot run on
// from a paragraph's line: SilverBullet's custom syntax would not read it), with a blank line after it so other
// renderers end its HTML block there. Pure.
import { newGridText } from "../../../../shared/markdown/grid.ts";

/** The edit inserting a grid of `cells` cells at `at` of a text, and where the cursor goes: the first cell's content */
export function gridInsertion(text: string, at: number, cells = 2): { readonly from: number; readonly to: number; readonly insert: string; readonly cursor: number } {
  const lineStart = at === 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1;
  const before = text.slice(lineStart, at);
  const lineAbove = lineStart === 0 ? "" : text.slice(text.lastIndexOf("\n", lineStart - 2) + 1, lineStart - 1);
  // Text before it on its line: a new line and a blank one; the line above a paragraph's: a blank one
  const prefix = before.trim() ? "\n\n" : lineAbove.trim() ? "\n" : "";
  const rest = text.slice(at);
  // After it a blank line where text follows (none at the text's end, one where one is)
  const suffix = rest === "" ? "\n" : rest === "\n" || rest.startsWith("\n\n") || rest.startsWith("\r\n\r\n") ? "" : /^\r?\n/.test(rest) ? "\n" : "\n\n";
  const grid = newGridText(cells);
  return { from: at, to: at, insert: prefix + grid.text + suffix, cursor: at + prefix.length + grid.content };
}
