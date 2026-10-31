// What Silverware Tags needs of a space, apart from how it is reached: the
// pages, which tags the index has where, a page's text read and written. The
// core and the modules know only this; silverbullet.ts makes it of
// SilverBullet's API (the bridge), memory.ts of a map of pages (the tests, the
// playground).

/** A tag where the index has it: on a page, in a context (SilverBullet's `parent`: page, item, task, table, …) */
export type TagRecord = { readonly name: string; readonly page: string; readonly parent: string };

export type WriteResult = "written" | "changed";

export interface Space {
  /** Every page's name */
  pageNames(): Promise<readonly string[]>;
  /** The index's tags, one per tag, page and context */
  tagRecords(): Promise<readonly TagRecord[]>;
  /** A page's text as it is now (the editor's, for the page open in it) */
  read(page: string): Promise<string>;
  /**
   * A page's text written where it is still `before` (else "changed", nothing
   * written): the page open in the editor through the editor, as one edit
   */
  write(page: string, text: string, before: string): Promise<WriteResult>;
  /** The page open in the editor */
  currentPage(): Promise<string | undefined>;
  /** Opens a page */
  navigate(page: string): Promise<void>;
  /** Waits until the index has caught up with what was written */
  settled(): Promise<void>;
}

/** What tells the user: SilverBullet's notifications, a question asked */
export interface Notifier {
  flash(message: string, type?: "info" | "error", actions?: readonly { readonly name: string; readonly run: () => void }[]): void;
}

// How long work runs before it gives the browser a turn (to paint the progress, to take a click): a space whose
// reads and writes answer at once (in memory, the playground's) would otherwise run hundreds of pages in one task
const TURN_MS = 30;

/** A turn given to the browser where the work has run TURN_MS since the last one (a macrotask: painting comes first) */
export function breather(): () => Promise<void> {
  let since = performance.now();
  return async () => {
    if (performance.now() - since < TURN_MS) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    since = performance.now();
  };
}

/** The one edit making `before` into `after`: what lies between their common start and end */
export function minimalEdit(before: string, after: string): { from: number; to: number; insert: string } | undefined {
  if (before === after) return undefined;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start++;
  let end = 0;
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}
