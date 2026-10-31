// An operation over its pages: planned (each page read and edited, nothing
// written: what the preview shows), applied (each page written where it is
// still as it was read, the others skipped and said), undone (each page
// written back where it is still as applied). A tag may be on hundreds of
// pages: they are read and written a few at a time (each a call into
// SilverBullet), in their order, the progress reported after each.
import { breather, type Space } from "../space/space.ts";
import type { Catalog } from "./catalog.ts";
import { counted, type Operation } from "./operation.ts";

export type PageChange = { readonly page: string; readonly before: string; readonly after: string; readonly changes: number };
export type Skipped = { readonly page: string; readonly reason: string };

export type Plan = {
  readonly operation: Operation;
  readonly changes: readonly PageChange[];
  readonly skipped: readonly Skipped[];
};

export type Applied = {
  readonly operation: Operation;
  readonly written: readonly PageChange[];
  readonly skipped: readonly Skipped[];
};

export type Progress = (done: number, of: number) => void;

// Pages read or written at once
const AT_ONCE = 6;
const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `work` for each item, `AT_ONCE` at a time; the results in the items' order, `progress` after each */
async function each<T, R>(items: readonly T[], work: (item: T) => Promise<R>, progress?: Progress): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const breathe = breather();
  const worker = async () => {
    while (next < items.length) {
      const at = next++;
      results[at] = await work(items[at]!);
      progress?.(++done, items.length);
      await breathe();
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
  return results;
}

type Outcome<T> = { readonly ok: T } | { readonly skipped: Skipped } | undefined;

/** Why a page is left alone whatever an operation would do (a meta page, protected), as read; none: undefined */
export type Guard = (text: string, page: string) => string | undefined;

export async function makePlan(space: Space, catalog: Catalog, operation: Operation, progress?: Progress, guard?: Guard): Promise<Plan> {
  let pages: readonly string[];
  try {
    pages = await operation.pages(catalog);
  } catch (e) {
    throw new Error(`${operation.label}: its pages could not be told (${reasonOf(e)})`);
  }
  const outcomes = await each(
    pages,
    async (page): Promise<Outcome<PageChange>> => {
      let before: string;
      try {
        before = await space.read(page);
      } catch (e) {
        return { skipped: { page, reason: `could not be read (${reasonOf(e)})` } };
      }
      // (Told by its text as it is now: the index may not have caught up with it)
      const guarded = guard?.(before, page);
      if (guarded) return { skipped: { page, reason: guarded } };
      let result: Awaited<ReturnType<Operation["edit"]>>;
      try {
        result = await operation.edit(before, page);
      } catch (e) {
        return { skipped: { page, reason: `its edit failed (${reasonOf(e)}): left alone` } };
      }
      if (result.problem) return { skipped: { page, reason: result.problem } };
      return result.changes && result.text !== before ? { ok: { page, before, after: result.text, changes: result.changes } } : undefined;
    },
    progress,
  );
  return { operation, changes: oks(outcomes), skipped: skips(outcomes) };
}

const oks = <T>(outcomes: readonly Outcome<T>[]): T[] => outcomes.flatMap((o) => (o && "ok" in o ? [o.ok] : []));
const skips = <T>(outcomes: readonly Outcome<T>[]): Skipped[] => outcomes.flatMap((o) => (o && "skipped" in o ? [o.skipped] : []));

/** The plan written, its pages a few at a time */
export async function applyPlan(space: Space, plan: Plan, progress?: Progress): Promise<Applied> {
  const outcomes = await each(
    plan.changes,
    async (change): Promise<Outcome<PageChange>> => {
      try {
        return (await space.write(change.page, change.after, change.before)) === "written" ? { ok: change } : { skipped: { page: change.page, reason: "changed since it was read: left alone" } };
      } catch (e) {
        return { skipped: { page: change.page, reason: `could not be written (${reasonOf(e)})` } };
      }
    },
    progress,
  );
  await space.settled();
  return { operation: plan.operation, written: oks(outcomes), skipped: [...plan.skipped, ...skips(outcomes)] };
}

/**
 * What was applied written back, as an operation reviewed as any other: each
 * page as it was before, where it is still as it was written (a page changed
 * since is left as it is, said in the review)
 */
export function undoOperation(applied: Applied): Operation {
  const byPage = new Map(applied.written.map((change) => [change.page, change]));
  const label = `Undo: ${applied.operation.label}`;
  return {
    label,
    pages: () => applied.written.map((change) => change.page),
    edit: (text, page) => {
      const change = byPage.get(page)!;
      if (text !== change.after) return { text, changes: 0, problem: "changed since it was written: left as it is" };
      return { text: change.before, changes: change.changes };
    },
    done: (pages) => `Undone: ${applied.operation.label} (${counted(pages, "page")})`,
    undoes: applied,
  };
}
