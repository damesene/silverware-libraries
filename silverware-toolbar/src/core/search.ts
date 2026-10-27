// The popup's list: every action the modules give, a list's choices (Turn
// into: the block types) as actions of their own under its label, and
// finding them by what is typed: every word typed starts a word of an
// action's label, group or keywords, ignoring case and diacritics ("li" finds
// Link and Bullet list, not Italic).
import type { Action } from "./action.ts";

/** An action as the popup lists it, under its group (a list's choices: under the list's label) */
export type Entry = { readonly action: Action; readonly group: string };

/** Every action to run, in the modules' order: a list's choices in place of the list */
export function entriesOf(actions: readonly Action[]): Entry[] {
  return actions.flatMap((action) =>
    action.choices ? action.choices.map((choice) => ({ action: choice, group: action.label })) : [{ action, group: action.group }],
  );
}

/** The entries every word typed starts a word of (all of them for nothing typed); those whose label starts with it first */
export function findEntries(entries: readonly Entry[], query: string): Entry[] {
  return findByWords(entries, query, (entry) => [entry.action.label, entry.group, ...(entry.action.keywords ?? [])].join(" "), (entry) => entry.action.label);
}

/**
 * Items found by what is typed, as the popup finds actions: every word typed
 * starts a word of an item's text, ignoring case and diacritics; those whose
 * label starts with what is typed first, else in their order (the emoji picker's too)
 */
export function findByWords<T>(items: readonly T[], query: string, textOf: (item: T) => string, labelOf: (item: T) => string): T[] {
  const words = wordsOf(query);
  if (!words.length) return [...items];
  const found = items.filter((item) => {
    const own = wordsOf(textOf(item));
    return words.every((word) => own.some((w) => w.startsWith(word)));
  });
  const first = words.join(" ");
  // A stable sort: the order kept within each
  return found.sort((a, b) => Number(fold(labelOf(b)).startsWith(first)) - Number(fold(labelOf(a)).startsWith(first)));
}

function wordsOf(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Text compared ignoring case and diacritics */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
