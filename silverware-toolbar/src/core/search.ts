// The popup's list: every action the modules give, a list's choices (Turn
// into: the block types) as actions of their own under its label, and
// finding them by what is typed: every word typed starts a word of an
// action's label, group or keywords, ignoring case and diacritics ("li" finds
// Link and Bullet list, not Italic).
import { findByWords } from "../../../shared/search.ts";
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
