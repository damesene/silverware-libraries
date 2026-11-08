// The transactions the core applied, kept for Undo, as the page writer's
// `PageHistory` keeps a plugin's changes (shared/pages/history.ts): each the
// store's report with a label shown to the user ("Set Status of Fix login").
// Undone, a transaction goes off the list, also where the undo could write
// none of it because all of it changed since: kept, it would stand before
// every earlier one forever, and nothing is lost, the store having left it
// all. But where its undo was kept from putting back what only it holds (a
// document it removed, whose name was taken since; its database not made
// again), it stays, to be undone again once what kept it is gone: going, the
// text of what it removed would go with it. An undo is no change to undo
// itself. An undo puts back only what is still as the transaction left it:
// the store's `planUndo`, whatever the store.
import type { DatabaseStore, TransactionPlan, TransactionReport, WriteProgress } from "./store.ts";

// At most this many kept per database (a busy one pushes out none of a quiet one's)
const KEPT = 50;

// `undoAlso`: what else the transaction changed beside the store, put back after the store's undo (a key changed: the
// places' states naming it, renamed back)
export type RecordedTransaction = { readonly report: TransactionReport; readonly label: string; readonly undoAlso?: () => Promise<void> };

export class TransactionHistory {
  private readonly recorded: RecordedTransaction[] = [];

  constructor(private readonly store: DatabaseStore) {}

  /**
   * What `apply` reported, kept with its label; the report of an undo takes
   * the transaction it undid off instead, whatever it wrote. A report that
   * wrote nothing is not kept.
   */
  record(report: TransactionReport, label: string, undoAlso?: () => Promise<void>): void {
    if (report.undoes) {
      if (!heldBack(report)) this.forget(report.undoes);
      return;
    }
    if (!report.written.length) return;
    this.recorded.push({ report, label, ...(undoAlso ? { undoAlso } : {}) });
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

  /** An undo planned (`planUndo`) written, recorded so, what the transaction changed besides put back after it; `progress` told as it is written */
  async applyUndo(plan: TransactionPlan, progress?: WriteProgress): Promise<TransactionReport> {
    const also = this.recorded.find((one) => one.report === plan.undoes)?.undoAlso;
    const undone = await this.store.apply(plan, progress);
    this.record(undone, "");
    // (Put back only with the store's whole undo: a part left keeps the new state, and so do the places with it)
    if (also && undone.written.length && !undone.skipped.length) await also();
    return undone;
  }

  /** Whether `report` (an undo) left its transaction to be undone again: kept from putting back what only it holds */
  stillToUndo(report: TransactionReport): boolean {
    return !!report.undoes && this.has(report.undoes);
  }

  private forget(report: TransactionReport): void {
    const at = this.recorded.findIndex((one) => one.report === report);
    if (at >= 0) this.recorded.splice(at, 1);
  }
}

/**
 * Whether an undo was kept from putting back a part by something that may go
 * (a name taken since, the database not there to put an item back into), not
 * by the part having changed since: the transaction still holds what it would
 * put back
 */
function heldBack(undone: TransactionReport): boolean {
  return undone.skipped.some((one) => one.cause === "refused" || one.cause === "missing");
}
