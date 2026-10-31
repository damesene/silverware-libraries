// An operation over its pages: planned (each page read and edited, nothing
// written: what the preview shows), applied (each page written where it is
// still as it was read, the others skipped and said), undone (each page
// written back where it is still as applied).
import type { Space } from "../space/space.ts";
import type { Catalog } from "./catalog.ts";
import type { Operation } from "./operation.ts";

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

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function makePlan(space: Space, catalog: Catalog, operation: Operation): Promise<Plan> {
  const changes: PageChange[] = [];
  const skipped: Skipped[] = [];
  for (const page of operation.pages(catalog)) {
    let before: string;
    try {
      before = await space.read(page);
    } catch (e) {
      skipped.push({ page, reason: `could not be read (${reasonOf(e)})` });
      continue;
    }
    const result = operation.edit(before, page);
    if (result.problem) skipped.push({ page, reason: result.problem });
    else if (result.changes && result.text !== before) changes.push({ page, before, after: result.text, changes: result.changes });
  }
  return { operation, changes, skipped };
}

/** The plan written, page by page (`progress` after each) */
export async function applyPlan(space: Space, plan: Plan, progress?: (done: number, of: number) => void): Promise<Applied> {
  const written: PageChange[] = [];
  const skipped: Skipped[] = [...plan.skipped];
  let done = 0;
  for (const change of plan.changes) {
    try {
      if ((await space.write(change.page, change.after, change.before)) === "written") written.push(change);
      else skipped.push({ page: change.page, reason: "changed since it was read: left alone" });
    } catch (e) {
      skipped.push({ page: change.page, reason: `could not be written (${reasonOf(e)})` });
    }
    progress?.(++done, plan.changes.length);
  }
  await space.settled();
  return { operation: plan.operation, written, skipped };
}

/** What was applied written back, where a page is still as it was written */
export async function undoApplied(space: Space, applied: Applied): Promise<{ readonly restored: readonly string[]; readonly skipped: readonly Skipped[] }> {
  const restored: string[] = [];
  const skipped: Skipped[] = [];
  for (const change of applied.written) {
    try {
      if ((await space.write(change.page, change.before, change.after)) === "written") restored.push(change.page);
      else skipped.push({ page: change.page, reason: "changed since: left as it is" });
    } catch (e) {
      skipped.push({ page: change.page, reason: `could not be written (${reasonOf(e)})` });
    }
  }
  await space.settled();
  return { restored, skipped };
}
