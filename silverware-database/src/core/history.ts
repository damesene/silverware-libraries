// The transactions the core applied, kept for Undo, as the page writer's
// `PageHistory` keeps a plugin's changes (shared/pages/history.ts): each the
// store's report with a label shown to the user ("Set Status of Fix login").
// Undone, a transaction goes off the list, also where the undo could write
// none of it (all changed since): kept, it would stand before every earlier
// one forever, and nothing is lost, the store having left it all. An undo is
// no change to undo itself. An undo puts back only what is still as the
// transaction left it: the store's `planUndo`, whatever the store.
import type { DatabaseStore, TransactionPlan, TransactionReport, WriteProgress } from "./store.ts";

// At most this many kept per database (a busy one pushes out none of a quiet one's)
const KEPT = 50;

export type RecordedTransaction = { readonly report: TransactionReport; readonly label: string };

export class TransactionHistory {
  private readonly recorded: RecordedTransaction[] = [];

  constructor(private readonly store: DatabaseStore) {}

  /**
   * What `apply` reported, kept with its label; the report of an undo takes
   * the transaction it undid off instead, whatever it wrote. A report that
   * wrote nothing is not kept.
   */
  record(report: TransactionReport, label: string): void {
    if (report.undoes) {
      this.forget(report.undoes);
      return;
    }
    if (!report.written.length) return;
    this.recorded.push({ report, label });
    const own = this.recorded.filter((one) => one.report.database === report.database);
    if (own.length > KEPT) this.forget(own[0]!.report);
  }

  /** The last transaction still to undo (of one database where named) */
  last(database?: string): RecordedTransaction | undefined {
    return this.recorded.findLast((one) => database === undefined || one.report.database === database);
  }

  /** Whether a transaction is still to undo */
  has(report: TransactionReport): boolean {
    return this.recorded.some((one) => one.report === report);
  }

  /** The plan putting `report` back (the last by default), to preview; undefined where nothing is to undo */
  async planUndo(report: TransactionReport | undefined = this.last()?.report): Promise<TransactionPlan | undefined> {
    return report && this.has(report) ? this.store.planUndo(report) : undefined;
  }

  /** `report` (the last by default) put back at once, recorded so; undefined where nothing is to undo */
  async undo(report?: TransactionReport): Promise<TransactionReport | undefined> {
    const plan = await this.planUndo(report);
    return plan && this.applyUndo(plan);
  }

  /** An undo planned (`planUndo`) written, recorded so; `progress` told as it is written */
  async applyUndo(plan: TransactionPlan, progress?: WriteProgress): Promise<TransactionReport> {
    const undone = await this.store.apply(plan, progress);
    this.record(undone, "");
    return undone;
  }

  private forget(report: TransactionReport): void {
    const at = this.recorded.findIndex((one) => one.report === report);
    if (at >= 0) this.recorded.splice(at, 1);
  }
}
