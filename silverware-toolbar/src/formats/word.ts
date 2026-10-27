// A caret touching a word stands for the word, as if it were selected (as a
// word processor does: Bold with the caret in a word bolds the word). Applied
// to the context before an inline engine reads it, so no format knows of it:
// each gets the word as it would a selection. The caret stays where it was in
// the word's text once written, the markers put on or taken off around it left
// out, unless the change marks a caret of its own (a link: where its url goes).
import type { Change, Context } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { formatsIn } from "./registry.ts";

// A sentence's punctuation at a word's ends, not the word's (as a word processor leaves it out): after it, and before it
const AFTER_RE = /[.,;:!?…"'”’»]/u;
const BEFORE_RE = /["'“‘«¿¡]/u;
// Brackets: one at an end is the word's only where its other half is in the word too (`[[Page]]`, `f(x)`)
const CLOSING: Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{" };
const OPENING: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

const count = (text: string, ch: string) => text.split(ch).length - 1;

/**
 * The word the caret touches (in it, or at its start or end): what white space
 * separates on its line, its formats' markers with it, the punctuation of a
 * sentence at its ends without it (`word.` is `word`, `(word)` is `word`);
 * undefined: a selection, or no word there (the caret in that punctuation)
 */
export function wordAt(context: Context): { readonly from: number; readonly to: number } | undefined {
  if (context.from !== context.to) return undefined;
  const { text } = context;
  const line = context.lines[0];
  if (!line) return undefined;
  let from = context.from;
  let to = context.to;
  while (from > line.from && /\S/u.test(text[from - 1]!)) from--;
  while (to < line.to && /\S/u.test(text[to]!)) to++;
  for (let trimmed = true; trimmed && from < to; ) {
    trimmed = false;
    const word = text.slice(from, to);
    const last = word.at(-1)!;
    const first = word[0]!;
    if (AFTER_RE.test(last) || (CLOSING[last] && count(word, CLOSING[last]) < count(word, last))) {
      to--;
      trimmed = true;
    } else if (BEFORE_RE.test(first) || (OPENING[first] && count(word, OPENING[first]) < count(word, first))) {
      from++;
      trimmed = true;
    } else if (first === "(" && last === ")" && word.length > 2) {
      // A word in parentheses: they are the sentence's (not square ones: a wiki link's, a link's)
      from++;
      to--;
      trimmed = true;
    }
  }
  return from < to && from <= context.from && context.from <= to ? { from, to } : undefined;
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
export function keptCaret(context: Context, change: Change | undefined, cleared?: (text: string) => string): Change | undefined {
  const word = wordAt(context);
  if (!word || !change?.select) return change;
  // The word written as it was, put inside what the format writes (`#word`, `**word**`): the caret where it was in it
  const own = context.text.slice(word.from, word.to);
  const found = change.insert.indexOf(own);
  if (!cleared && found >= 0 && change.insert.indexOf(own, found + 1) < 0) {
    const at = change.from + found + (context.from - word.from);
    return { ...change, select: { from: at, to: at } };
  }
  const markers = new Set(formatsIn("inline").flatMap((f) => (f.markers ?? []).map((m) => m[0]!)));
  const counts = (ch: string) => !markers.has(ch);
  // `cleared`: the change takes the formats off (Clear formatting, a format's tags too): the caret's place in the word
  // as it is left, told by a mark put at the caret before the word is cleared
  const MARK = "\uE010";
  const marked = cleared?.(context.text.slice(word.from, context.from) + MARK + context.text.slice(context.from, word.to)).indexOf(MARK) ?? -1;
  // (Not told so, the mark lost or inside a pair it broke: the word's characters but markers counted)
  const byMark = marked >= 0;
  const before = byMark ? marked : [...context.text.slice(word.from, context.from)].filter(counts).length;
  const { from, to } = change.select;
  let at = from;
  // What was written is the cleared word where told by the mark: each of its characters counts
  for (let seen = 0; seen < before && at < to; at++) if (byMark || counts(change.insert[at - change.from] ?? "")) seen++;
  return { ...change, select: { from: at, to: at } };
}
