// An operation: what a module wants done to pages, as the core runs it (plan,
// review, apply, undo; core/plan.ts). The core knows no operation: a module
// says which pages it may change and how it edits a page's text.
import type { EditResult } from "../tags/edit.ts";
import type { Catalog } from "./catalog.ts";

export type Operation = {
  // What it does, as the review's title says it ("Rename #a to #b")
  readonly label: string;
  // The pages it may change (the rest are not read); a promise may be given (a custom operation's)
  readonly pages: (catalog: Catalog) => readonly string[] | Promise<readonly string[]>;
  // Its edit of a page's text (pure; a promise may be given: a custom operation's, as Space Lua gives one)
  readonly edit: (text: string, page: string) => EditResult | Promise<EditResult>;
  // What was done, as the notification says it
  readonly done: (pages: number, changes: number) => string;
  // The choices the review offers (with its subtags; where it takes tags off), each making the operation anew
  readonly options?: readonly OperationOption[];
  // The tag the window shows once it is applied (a rename's new name)
  readonly shows?: string;
  // The change it undoes (the core's Undo): applied, that change is taken off the history, not kept as one of its own
  readonly undoes?: object;
};

/** A choice of the review: a box ticked or not, or one of several (a list; `buttons`: each a radio button) */
export type OperationOption =
  | { readonly label: string; readonly on: boolean; readonly toggled: () => Operation }
  | { readonly label: string; readonly choices: readonly string[]; readonly chosen: number; readonly choose: (index: number) => Operation; readonly buttons?: boolean };

/** "1 page", "3 pages" */
export const counted = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;
