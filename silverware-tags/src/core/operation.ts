// An operation: what a module wants done to pages, as the core runs it (plan,
// review, apply, undo; core/plan.ts). The core knows no operation: a module
// says which pages it may change and how it edits a page's text.
import type { EditResult } from "../tags/edit.ts";
import type { Catalog } from "./catalog.ts";

export type Operation = {
  // What it does, as the review's title says it ("Rename #a to #b")
  readonly label: string;
  // The pages it may change (the rest are not read)
  readonly pages: (catalog: Catalog) => readonly string[];
  // Its edit of a page's text (pure)
  readonly edit: (text: string, page: string) => EditResult;
  // What was done, as the notification says it
  readonly done: (pages: number, changes: number) => string;
  // A choice the review offers (with its subtags), the operation made anew by it
  readonly option?: { readonly label: string; readonly on: boolean; readonly toggled: () => Operation };
  // The tag the window shows once it is applied (a rename's new name)
  readonly shows?: string;
};

/** "1 page", "3 pages" */
export const counted = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;
