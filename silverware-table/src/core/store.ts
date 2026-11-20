// Where tables are kept, as the core asks for them (docs/silverware-table-store-plan.md,
// *The store*): a document's tables in order, each by its key with its model
// and a revision, whichever store keeps them (markdown in a page:
// store/markdown/). Modules never see a store: they get tables through the
// host (TableInfo.model and .revision; host.tables). Step 2 of the plan has
// the read side; transactions and the rest come with steps 2 to 4. Formulas
// written in a document's text, not as its tables' formula cells, are a store
// of their own beside it (PageFormulaStore), which a store keeping none does
// not have.
import type { KeyedModel } from "../model/model.ts";
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

export interface TableStore {
  /** A document's tables in its order (a page's name in SilverBullet); none where it has none; null where it is not there (or not read) */
  tables(document: string): Promise<readonly StoredTable[] | null>;
  /** The document a table's key is of; undefined: a key the store did not give */
  documentOf(key: TableKey): string | undefined;
}
