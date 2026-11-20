// Where tables are kept, as the core asks for them (docs/silverware-table-store-plan.md,
// *The store*): a document's tables in order, each by its key with its model
// and a revision, whichever store keeps them (markdown in a page:
// store/markdown/). Modules never see a store: they get tables through the
// host (TableInfo.model and .revision; host.tables). Step 2 of the plan has
// the read side; transactions, places and the rest come with steps 2 to 4.
import type { Table } from "../markdown.ts";
import type { TableKey } from "./tables.ts";

/**
 * What a table's model is at, told apart from any other of the same table:
 * equal revisions, equal models. Opaque: compared, never read
 */
export type TableRevision = string & { readonly __tableRevision: unique symbol };

/** A table as a store keeps it: its key, its model, the model's revision */
export type StoredTable = {
  readonly key: TableKey;
  readonly revision: TableRevision;
  readonly model: Table;
};

export interface TableStore {
  /** A document's tables in its order (a page's name in SilverBullet); none where it has none; null where it is not there (or not read) */
  tables(document: string): Promise<readonly StoredTable[] | null>;
  /** The document a table's key is of; undefined: a key the store did not give */
  documentOf(key: TableKey): string | undefined;
}
