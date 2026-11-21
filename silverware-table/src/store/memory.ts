// Tables kept in memory (docs/silverware-table-store-plan.md, *Stores*, step
// 5): a document is its tables in order, each a model with a key and a
// revision of its own; for tests (modules over a store, no text) and the
// playground's benchmark. Keys are made by the register (core/tables.ts, the
// one maker of keys), revisions by a count: a table changed gets a new one.
import { type StoredTable, type TablePlan, type TableReport, type TableRevision, type TableSkip, type TableStore, type TableTransaction, validateTransaction } from "../core/store.ts";
import type { TableKey, TableRegister } from "../core/tables.ts";
import type { TableModel } from "../model/model.ts";

type Document = readonly StoredTable[];

/** A plan's own: the document as planned on, and as it is to be */
type PlanOwn = { readonly before: Document; readonly after: Document; readonly inserted: readonly TableKey[] };

export class MemoryStore implements TableStore {
  private readonly documents = new Map<string, Document>();
  private readonly owners = new Map<TableKey, string>();
  private revisions = 0;
  private readonly plans = new WeakMap<TablePlan, PlanOwn>();
  private readonly reports = new WeakMap<TableReport, PlanOwn>();

  constructor(
    private readonly register: TableRegister,
    documents: Readonly<Record<string, readonly TableModel[]>> = {},
  ) {
    for (const [name, tables] of Object.entries(documents)) this.replace(name, tables);
  }

  async tables(document: string): Promise<readonly StoredTable[] | null> {
    return this.documents.get(document) ?? null;
  }

  documentOf(key: TableKey): string | undefined {
    return this.owners.get(key);
  }

  /**
   * A document's tables made these, as an edit outside the store would: each
   * table keeps the key of the one at its place (as the markdown store's
   * register matches a page's tables), a table changed gets a new revision
   */
  replace(document: string, tables: readonly TableModel[]): void {
    const was = this.documents.get(document) ?? [];
    this.documents.set(
      document,
      tables.map((model, i) => {
        const same = was[i];
        if (same && same.model === model) return same;
        return same ? { key: same.key, revision: this.revision(), model } : this.made(document, model);
      }),
    );
  }

  async plan(transaction: TableTransaction): Promise<TablePlan> {
    const { document } = transaction;
    const left = (skipped: TableSkip): TablePlan => ({ document, changes: 0, skipped });
    const invalid = validateTransaction(transaction);
    if (invalid) return left({ cause: "refused", reason: invalid });
    const before = this.documents.get(document);
    if (!before) return left({ cause: "missing", reason: "the document is not there" });
    let after: StoredTable[] = [...before];
    const inserted: TableKey[] = [];
    for (const edit of transaction.edits) {
      if (edit.kind === "insert") {
        const table = this.made(document, edit.model, false);
        inserted.push(table.key);
        const at = edit.after === undefined ? after.length : after.findIndex((one) => one.key === edit.after) + 1;
        if (at === 0) return left({ cause: "changed", reason: "the table a new one goes after is not there" });
        after.splice(at, 0, table);
        continue;
      }
      const index = after.findIndex((one) => one.key === edit.key);
      const read = before.find((one) => one.key === edit.key);
      if (index < 0 || !read) return left({ cause: "changed", reason: "a table of it is not there" });
      if (read.revision !== edit.expects) return left({ cause: "changed", reason: "a table of it changed since it was read" });
      after = edit.kind === "remove" ? after.filter((one) => one.key !== edit.key) : after.map((one, i) => (i === index ? { key: one.key, revision: this.revision(), model: edit.model } : one));
    }
    // (No page formulas kept here: any given is left)
    const formulas = transaction.formulas?.length ?? 0;
    const plan: TablePlan = { document, changes: transaction.edits.length, ...(formulas ? { formulasLeft: Array.from({ length: formulas }, () => "this store keeps no page formulas") } : {}) };
    this.plans.set(plan, { before, after, inserted });
    return plan;
  }

  async apply(plan: TablePlan): Promise<TableReport> {
    const { document } = plan;
    const own = this.plans.get(plan);
    const none = new Map<TableKey, TableRevision>();
    if (plan.skipped || !own) return { document, written: false, inserted: [], revisions: none, skipped: plan.skipped ?? { cause: "refused", reason: "not planned by this store, or applied already" } };
    this.plans.delete(plan);
    if (this.documents.get(document) !== own.before) return { document, written: false, inserted: [], revisions: none, skipped: { cause: "changed", reason: "the document changed since it was planned" } };
    this.documents.set(document, own.after);
    for (const key of own.inserted) this.owners.set(key, document);
    // (A table written or made is a new one of the document's: the others are kept as they were)
    const revisions = new Map(own.after.filter((table) => !own.before.includes(table)).map((table) => [table.key, table.revision]));
    const report: TableReport = { document, written: plan.changes > 0, inserted: own.inserted, revisions };
    this.reports.set(report, own);
    return report;
  }

  async planUndo(report: TableReport): Promise<TablePlan> {
    const { document } = report;
    const own = this.reports.get(report);
    if (!own) return { document, changes: 0, skipped: { cause: "refused", reason: "not written by this store" } };
    if (this.documents.get(document) !== own.after) return { document, changes: 0, skipped: { cause: "changed", reason: "the document changed since it was written" } };
    const plan: TablePlan = { document, changes: report.written ? 1 : 0 };
    this.plans.set(plan, { before: own.after, after: own.before, inserted: [] });
    return plan;
  }

  asRead(model: TableModel): TableModel {
    return model;
  }

  private revision(): TableRevision {
    return String(++this.revisions) as TableRevision;
  }

  /** A new table of a document, its key made by the register (`owned`: told the store's at once; else as it is written) */
  private made(document: string, model: TableModel, owned = true): StoredTable {
    const key = this.register.newKey(document);
    if (owned) this.owners.set(key, document);
    return { key, revision: this.revision(), model };
  }
}
