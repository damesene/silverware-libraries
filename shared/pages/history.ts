// The changes a plugin applied, kept for its Undo: each the writer's report
// with a label shown to the user ("Rename #bug → #defect"). A plugin keeps one
// of its own, so its Undo never takes back another plugin's change. Undone,
// a change goes off the list; an undo is no change to undo itself.
import type { ApplyReport, PagePlan, PageWriter } from "./writer.ts";

// At most this many kept: each holds every page's text before and after (a change of hundreds of pages, megabytes)
const KEPT = 10;

export type RecordedChange = { readonly report: ApplyReport; readonly label: string };

export class PageHistory {
  private readonly recorded: RecordedChange[] = [];

  constructor(private readonly writer: PageWriter) {}

  /**
   * What `apply` reported, kept with its label; the report of an undo takes
   * the change it undid off instead (where it wrote anything: an undo that
   * wrote nothing leaves it to undo). A report that wrote nothing is not kept.
   */
  record(report: ApplyReport, label: string): void {
    if (report.undoes) {
      if (report.written.length) this.forget(report.undoes);
      return;
    }
    if (!report.written.length) return;
    this.recorded.push({ report, label });
    if (this.recorded.length > KEPT) this.recorded.shift();
  }

  /** The last change, still to undo */
  get last(): RecordedChange | undefined {
    return this.recorded[this.recorded.length - 1];
  }

  /** Whether a change is still to undo */
  has(report: ApplyReport): boolean {
    return this.recorded.some((one) => one.report === report);
  }

  /** The plan putting `report` back (the last change by default), to preview; undefined where nothing is to undo */
  async planUndo(report: ApplyReport | undefined = this.last?.report): Promise<PagePlan | undefined> {
    return report && this.has(report) ? this.writer.planUndo(report) : undefined;
  }

  /** `report` (the last change by default) put back at once, recorded so; undefined where nothing is to undo */
  async undo(report?: ApplyReport): Promise<ApplyReport | undefined> {
    const plan = await this.planUndo(report);
    if (!plan) return undefined;
    const undone = await this.writer.apply(plan);
    this.record(undone, "");
    return undone;
  }

  private forget(report: ApplyReport): void {
    const at = this.recorded.findIndex((one) => one.report === report);
    if (at >= 0) this.recorded.splice(at, 1);
  }
}
