// An operation: what a module wants done to pages, as the core runs it (plan,
// review, apply, undo; core/plan.ts). The core knows no operation: a module
// says which pages it may change and what is to change on each, in the page
// writer's terms (shared/pages/changes.ts); the writer alone knows how that is
// written in a page.
import type { PageBuilder } from "../../../shared/pages/changes.ts";
import type { RecordedChange } from "../../../shared/pages/history.ts";
import type { Catalog } from "./catalog.ts";

/** A change of pages (`pages` and what changes on each), or the undo of one applied (`undoes`) */
export type Operation = OperationCommon &
  (
    | {
        // The pages it may change (the rest are not read); a promise may be given (a custom operation's)
        readonly pages: (catalog: Catalog) => readonly string[] | Promise<readonly string[]>;
        // What is to change on a page, in the page writer's terms
        readonly change: (page: PageBuilder, name: string) => unknown;
      }
    // The change it undoes (the core's Undo): planned by the writer from what it wrote, then taken off the history
    | { readonly undoes: RecordedChange }
  );

type OperationCommon = {
  // What it does, as the review's title says it ("Rename #a to #b")
  readonly label: string;
  // What was done, as the notification says it
  readonly done: (pages: number, changes: number) => string;
  // The choices the review offers (with its subtags; where it takes tags off), each making the operation anew
  readonly options?: readonly OperationOption[];
  // The tag the window shows once it is applied (a rename's new name)
  readonly shows?: string;
};

/** The change an operation undoes, where it is an undo */
export const undoneBy = (operation: Operation): RecordedChange | undefined => ("undoes" in operation ? operation.undoes : undefined);

/** A choice of the review: a box ticked or not, or one of several (a list; `buttons`: each a radio button) */
export type OperationOption =
  | { readonly label: string; readonly on: boolean; readonly toggled: () => Operation }
  | { readonly label: string; readonly choices: readonly string[]; readonly chosen: number; readonly choose: (index: number) => Operation; readonly buttons?: boolean };

/** "1 page", "3 pages" */
export const counted = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;
