// A caret touching a word stands for the word, as if it were selected (as a
// word processor does: Bold with the caret in a word bolds the word). Applied
// to the context before an inline engine reads it, so no format knows of it:
// each gets the word as it would a selection. The caret stays where it was in
// the word's text once written, the markers put on or taken off around it left
// out, unless the change marks a caret of its own (a link: where its url goes).
import type { Change, Context } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { formatsIn } from "./registry.ts";

/** The word the caret touches (in it, or at its start or end), what white space separates on its line; undefined: a selection, or no word there */
export function wordAt(context: Context): { readonly from: number; readonly to: number } | undefined {
  if (context.from !== context.to) return undefined;
  const { text } = context;
  const line = context.lines[0];
  if (!line) return undefined;
  let from = context.from;
  let to = context.to;
  while (from > line.from && /\S/u.test(text[from - 1]!)) from--;
  while (to < line.to && /\S/u.test(text[to]!)) to++;
  return from < to ? { from, to } : undefined;
}

/** The context with the word the caret touches as its selection (as it is where there is none) */
export function asWord(context: Context): Context {
  const word = wordAt(context);
  return word ? contextOf(context.text, word.from, word.to) : context;
}

/**
 * A change made on the word for a caret, the caret put back where it was in
 * the word's text: after as many of its characters as were before it, the
 * formats' markers not counted (they are what the change puts on or takes off)
 */
export function keptCaret(context: Context, change: Change | undefined): Change | undefined {
  const word = wordAt(context);
  if (!word || !change?.select) return change;
  const markers = new Set(formatsIn("inline").flatMap((f) => (f.markers ?? []).map((m) => m[0]!)));
  const counts = (ch: string) => !markers.has(ch);
  const before = [...context.text.slice(word.from, context.from)].filter(counts).length;
  const { from, to } = change.select;
  let at = from;
  for (let seen = 0; seen < before && at < to; at++) if (counts(change.insert[at - change.from] ?? "")) seen++;
  return { ...change, select: { from: at, to: at } };
}
