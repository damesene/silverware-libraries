// Where tables are kept, as the core asks for them (docs/silverware-table-store-plan.md,
// *The store*): a document's tables in order, each by its key with its model
// and a revision, whichever store keeps them (markdown in a page:
// store/markdown/). Modules never see a store: they get tables through the
// host (TableInfo.model and .revision; host.tables). Step 2 of the plan gave
// the read side, step 5 transactions. Formulas
// written in a document's text, not as its tables' formula cells, are a store
// of their own beside it (PageFormulaStore), which a store keeping none does
// not have.
import type { KeyedModel, TableModel } from "../model/model.ts";
import type { IndexMap } from "../model/ops.ts";
import type { TableKey } from "./tables.ts";

/**
 * What a table's model is at, told apart from any other of the same table:
 * equal revisions, equal models. Opaque: compared, never read
 */
export type TableRevision = string & { readonly __tableRevision: unique symbol };

/** A table as a store keeps it: its key, its model, the model's revision */
export type StoredTable = KeyedModel<TableKey> & { readonly revision: TableRevision };

/** A page formula's address: its document, told apart from the document's other page formulas, from a read to a write. Opaque */
export type PageFormulaKey = string & { readonly __pageFormulaKey: unique symbol };

/**
 * A formula written in a document's text, not as a table's formula cell (a
 * page's Space Lua giving it to silverware.table.evaluate, a table cell's text
 * too): its key and its text as written (its "=" may be left out)
 */
export type PageFormula = { readonly key: PageFormulaKey; readonly text: string };

/** Where formulas written in a document's text are kept (the markdown store: a page's Space Lua) */
export interface PageFormulaStore {
  /** A document's page formulas in its order; none where it has none; null where it is not there (or not read) */
  pageFormulas(document: string): Promise<readonly PageFormula[] | null>;
}

/**
 * A part of a table whose stored metadata goes (Remove metadata): cells, by
 * their row in the markdown (header 0) and column (a header cell's own, not
 * its column's), and whole columns (what the table keeps of them too)
 */
export type MetadataPart = { readonly cells: readonly { readonly row: number; readonly column: number }[]; readonly columns: ReadonlySet<number> };

/**
 * What a table, or a part of it, stores beyond its content (Remove
 * metadata asks): whose it is (an owner, `<owner>.…` of its attributes'
 * names, the core first, with how many cells hold some), whether it holds
 * any, and whether settings shown as a view go with it (a sorting stored)
 */
export type StoredMetadata = {
  readonly owners: readonly { readonly owner: string; readonly cells: number }[];
  readonly any: boolean;
  readonly settings: boolean;
};

/**
 * A table's model written where its revision is still the one read
 * (`expects`). `columnMap`: where its columns went (undefined: deleted), for
 * what follows a write (a markdown page's other plugins, told). `tidy`:
 * written anew in the store's tidiest form (a markdown table's cells padded
 * to line up)
 */
export type TableWriteEdit = {
  readonly kind: "write";
  readonly key: TableKey;
  readonly expects: TableRevision;
  readonly model: TableModel;
  readonly columnMap?: IndexMap;
  readonly tidy?: true;
};

/**
 * A change of a document's tables in a transaction: a table's model written;
 * a new table (after a table, else at the document's end, or where the place
 * a store gives for the document's cursor is: `at`; `key`: one reserved for
 * it, TableRegister.reserve), a table taken out where its revision is still
 * the one read
 */
export type TableEdit =
  | TableWriteEdit
  | { readonly kind: "insert"; readonly model: TableModel; readonly after?: TableKey; readonly at?: InsertAt; readonly key?: TableKey }
  | { readonly kind: "remove"; readonly key: TableKey; readonly expects: TableRevision };

/** A place in a document a new table goes at, as its store gives it (cursorPlace: a markdown page's cursor); opaque */
export type InsertAt = { readonly __insertAt: unique symbol };

/**
 * A document's tables changed as one step (one edit of a page: one undo step
 * where it is open), with its page formulas (`formulas`: each given its new
 * text, a store keeping them: PageFormulaStore; one in a table the
 * transaction writes is the table's)
 */
export type TableTransaction = { readonly document: string; readonly edits: readonly TableEdit[]; readonly formulas?: readonly PageFormula[] };

/**
 * Why a transaction cannot be made as one step, whatever its document holds
 * (a store refuses it): a table edited twice (which edit is the table's?), a
 * new one after a table it takes out, a new one with page formulas; undefined
 * where it can
 */
export function validateTransaction(transaction: TableTransaction): string | undefined {
  const edited = new Set<TableKey>();
  for (const edit of transaction.edits) {
    if (edit.kind === "insert") continue;
    if (edited.has(edit.key)) return "a table is edited twice in one transaction";
    edited.add(edit.key);
  }
  const removed = new Set(transaction.edits.flatMap((edit) => (edit.kind === "remove" ? [edit.key] : [])));
  if (transaction.edits.some((edit) => edit.kind === "insert" && edit.after !== undefined && removed.has(edit.after))) return "a new table goes after a table the transaction takes out";
  // (A new table's place is found in the document as read, which its page formulas, written first, would change)
  if (transaction.formulas?.length && transaction.edits.some((edit) => edit.kind === "insert")) return "a new table and page formulas in one transaction";
  return undefined;
}

/** Why a transaction was left: a table changed since it was read, the document not there, or the store refusing it (read only, a change it cannot make) */
export type TableSkip = { readonly cause: "changed" | "missing" | "refused"; readonly reason: string };

/**
 * What a transaction would do, nothing written: how many tables and page formulas it changes,
 * or why it is left (the whole of it: a transaction is one step). Opaque
 * beyond that: applied by the store that planned it
 */
export type TablePlan = {
  readonly document: string;
  readonly changes: number;
  readonly skipped?: TableSkip;
  /** Page formulas of the transaction left as written, each why (the transaction written without them) */
  readonly formulasLeft?: readonly string[];
};

/**
 * What `apply` did: written (the keys of the tables it made, in its edits'
 * order; each table written or made with its revision now) or left, and
 * why; what its undo puts back is the store's
 */
export type TableReport = {
  readonly document: string;
  readonly written: boolean;
  readonly inserted: readonly TableKey[];
  readonly revisions: ReadonlyMap<TableKey, TableRevision>;
  readonly skipped?: TableSkip;
};

export interface TableStore {
  /** A document's tables in its order (a page's name in SilverBullet); none where it has none; null where it is not there (or not read) */
  tables(document: string): Promise<readonly StoredTable[] | null>;
  /** The document a table's key is of; undefined: a key the store did not give */
  documentOf(key: TableKey): string | undefined;
  /** What a transaction would do; nothing written (the database store's shape: plan, apply, planUndo) */
  plan(transaction: TableTransaction): Promise<TablePlan>;
  /** A plan written as one step where the document is still as planned (a page open: planned anew where it changed), once; else left, said why */
  apply(plan: TablePlan): Promise<TableReport>;
  /** What `report` wrote put back, where the document is still as it left it */
  planUndo(report: TableReport): Promise<TablePlan>;
  /**
   * A model as the store reads it back once it is written: what its form makes
   * of it (a markdown table's tag typed into a cell's text is an attribute
   * once read); the same model where its form adds nothing
   */
  asRead(model: TableModel): TableModel;
  /** Where a new table goes in a document where its cursor is (a store's editor's), for an insert's `at`; undefined: none */
  insertAtCursor?(document: string): Promise<InsertAt | undefined>;
}
