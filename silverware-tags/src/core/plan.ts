// An operation over its pages, through the page writer
// (shared/pages/writer.ts): planned (each page read and changed in memory,
// nothing written: what the review shows), applied (each page written where
// it is still as it was read, the others left and said), undone (each page
// written back where it is still as applied). What is written and how is the
// writer's; this is what Silverware Tags keeps around it: its operation, its
// guard of meta pages, its wait for the index.
import { pageChanges } from "../../../shared/pages/changes.ts";
import type { RecordedChange } from "../../../shared/pages/history.ts";
import type { ApplyReport, PagePlan, PageRead, PageWriter, PlannedPage, Progress, Skipped } from "../../../shared/pages/writer.ts";
import type { Catalog } from "./catalog.ts";
import { counted, type Operation } from "./operation.ts";

export type { PlannedPage, Progress, Skipped } from "../../../shared/pages/writer.ts";

export type Plan = {
  readonly operation: Operation;
  // The pages it changes (each its preview), as the review lists them
  readonly pages: readonly PlannedPage[];
  readonly skipped: readonly Skipped[];
  // The writer's plan, which `applyPlan` hands back to it
  readonly planned: PagePlan;
};

export type Applied = {
  readonly operation: Operation;
  readonly written: readonly PlannedPage[];
  readonly skipped: readonly Skipped[];
  // The writer's report, which the history keeps for Undo
  readonly report: ApplyReport;
};

/** Why a page is left alone whatever an operation would do (a meta page, protected), as read; none: undefined */
export type Guard = (page: PageRead) => string | undefined;

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** An operation planned by the writer (the controller's one): its pages read and changed in memory, nothing written */
export async function makePlan(writer: PageWriter, catalog: Catalog, operation: Operation, progress?: Progress, guard?: Guard): Promise<Plan> {
  let planned: PagePlan;
  if ("undoes" in operation) planned = await writer.planUndo(operation.undoes.report, { progress });
  else {
    let pages: readonly string[];
    try {
      pages = await operation.pages(catalog);
    } catch (e) {
      throw new Error(`${operation.label}: its pages could not be told (${reasonOf(e)})`);
    }
    const changes = pageChanges();
    // (A page listed twice is changed once, as before: a custom operation's list may repeat one)
    for (const page of new Set(pages)) changes.page(page, (p) => operation.change(p, page));
    planned = await writer.plan(changes.build(), { progress, leaveAlone: guard });
  }
  return { operation, pages: planned.pages, skipped: planned.skipped, planned };
}

/** The plan written by the writer, its pages a few at a time; `settled` waited for after (the space's index) */
export async function applyPlan(writer: PageWriter, plan: Plan, progress?: Progress, settled?: () => Promise<void>): Promise<Applied> {
  const report = await writer.apply(plan.planned, { progress });
  await settled?.();
  return { operation: plan.operation, written: report.written, skipped: report.skipped, report };
}

/** What was applied written back, as an operation reviewed as any other (a page changed since is left as it is, said in the review) */
export function undoOperation(recorded: RecordedChange): Operation {
  return {
    label: `Undo: ${recorded.label}`,
    done: (pages) => `Undone: ${recorded.label} (${counted(pages, "page")})`,
    undoes: recorded,
  };
}
