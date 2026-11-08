// What the core asks of where databases are kept, and nothing of how: a store
// reads databases and items as the model has them and writes transactions of
// changes (changes.ts), as the page writer writes pages: planned (nothing
// written), applied document by document where each is still as read,
// reported, undone the same way. One store keeps them in pages
// (store/pages/, step 4), another in memory (store/memory.ts: the tests, the
// playground); every store passes the same contract (store/contract.ts).
// Modules and views never see a store: they ask the core.
import type { Database, DatabaseSummary, Item, ItemKey, Revised, Value } from "../model/database.ts";
import type { Changes } from "./changes.ts";

/** What a store can and another cannot: the core offers by these, never assumes */
export type StoreCapabilities = {
  // A rename of an item follows the links to it (a store of pages: SilverBullet's rename)
  readonly renameFollowsLinks: boolean;
  // An item has a body of its own (content in the markdown language)
  readonly itemBody: boolean;
  // An item is a document of its own (a page): a change of many items writes as many documents, one after another
  readonly itemDocument: boolean;
};

/** Told as a transaction is written: how many of its parts are done (written or left) of how many */
export type WriteProgress = (done: number, of: number) => void;

/** Progress told, a listener that throws taken as none: never stopping a write halfway (the pages written before it, then out of every report and Undo) */
export function told(progress: WriteProgress | undefined, done: number, of: number): void {
  try {
    progress?.(done, of);
  } catch {
    // (Its own mistake: the write goes on)
  }
}

/** What a part of a transaction is about: an item, one it makes (by its `ref`), or the database's own record */
export type Target = { readonly item: ItemKey } | { readonly ref: string } | { readonly database: string };

/** A line run of what changes in a document, before and after, ready to show (where the store keeps text) */
export type PreviewRun = { readonly line: number; readonly removed: readonly string[]; readonly added: readonly string[] };

/** A part of a transaction as planned: its target, how many things change there, what it shows of itself */
export type Planned = {
  readonly target: Target;
  readonly changes: number;
  // Lines before and after, where the store keeps text (a store in memory has none)
  preview?(): readonly PreviewRun[];
};

/**
 * Why a part is left alone, as a code to act on (the words are the store's):
 * `changed` since it was read (or, an undo, since it was written), `refused`
 * by the store (a name taken, a key it cannot keep), `missing` (no such item
 * or database), `version` (kept in another version than the store writes:
 * older, migrate it first; newer, read only)
 */
export type SkipCause = "changed" | "refused" | "missing" | "version";

/** A part left alone, why in words and as a code */
export type Skipped = { readonly target: Target; readonly cause: SkipCause; readonly reason: string };

export type TransactionPlan = {
  readonly database: string;
  readonly planned: readonly Planned[];
  readonly skipped: readonly Skipped[];
  // The report this plan undoes (made by `planUndo`)
  readonly undoes?: TransactionReport;
};

/** What `apply` did: the parts written, those left and why, the keys of the items it made (by their `ref`) */
export type TransactionReport = {
  readonly database: string;
  readonly written: readonly Planned[];
  readonly skipped: readonly Skipped[];
  readonly created: ReadonlyMap<string, ItemKey>;
  // The report it undoes, where its plan was an undo
  readonly undoes?: TransactionReport;
};

/** The version of the form a database is kept in, and the latest the store writes (docs/silverware-database.md, *Decided* 26) */
export type VersionStatus = { readonly version: number; readonly latest: number };

/**
 * What a migration brings to the latest version: a database, the databases
 * kept in one document (a page), or the whole space. The blocks showing
 * databases are the binding's (its view states), migrated by it, not here.
 */
export type MigrationScope = { readonly database: string } | { readonly document: string } | { readonly space: true };

export interface DatabaseStore {
  readonly capabilities: StoreCapabilities;
  databases(): Promise<readonly DatabaseSummary[]>;
  /** A database with its revision, undefined where the store has none of that id */
  database(id: string): Promise<Revised<Database> | undefined>;
  /** A database's items with their revision (one that changes whenever any of them does); their bodies where the store reads them with them (else: `body`) */
  items(id: string): Promise<Revised<readonly Item[]>>;
  /** An item's body as kept (none: it has none, or the store keeps none), read apart: a store of pages reads its page for it */
  body(id: string, item: ItemKey): Promise<string | undefined>;
  /**
   * What a transaction would do, part by part; nothing written. A part is
   * left where it cannot be made (with why), where an item's revision is not
   * the one `expects` names, and all of it where the database is kept in
   * another version than the store writes (*Decided* 26)
   */
  plan(changes: Changes): Promise<TransactionPlan>;
  /** A plan written part by part, each where still as read, the rest left and reported; `progress` told as parts are done, last with all of them */
  apply(plan: TransactionPlan, progress?: WriteProgress): Promise<TransactionReport>;
  /** What `report` wrote put back, where each part is still as it left it */
  planUndo(report: TransactionReport): Promise<TransactionPlan>;
  /** The version a database is kept in and the latest the store writes */
  version(id: string): Promise<VersionStatus>;
  /** The plans bringing what `scope` holds to the latest version, one per database (none: nothing to migrate) */
  planMigration(scope: MigrationScope): Promise<readonly TransactionPlan[]>;
  /** Told as a database or its items change outside the core's transactions (edited by hand, synced); the function given back stops it */
  onChanged(listener: (change: { readonly database: string }) => void): () => void;
  /** Why a property's key cannot be kept by this store (beside the model's rule), undefined where it can */
  validatePropertyKey(key: string): string | undefined;
  /** Why an item's name cannot be kept by this store (a page's name: no `|`), undefined where it can */
  validateItemName(name: string): string | undefined;
  /** Where an item can be opened (a page's name), undefined where nowhere */
  documentOf(item: ItemKey): string | undefined;
  /** A database's own document (its root page), as last read; undefined where it has none */
  databaseDocumentOf(database: string): string | undefined;
  /**
   * The documents `report` removed for `targets` (items' pages) that an undo
   * could not make again, kept as documents of their own, outside the
   * database (none written over): where none is to be kept (it is back as it
   * was, or `report` removed none for it), nothing written. Those kept named;
   * `left`: those it could not keep (their text still `report`'s alone). A
   * store without it keeps none (its undo then stays to try again)
   */
  recoverRemoved?(report: TransactionReport, targets: readonly Target[]): Promise<{ readonly kept: readonly string[]; readonly left: readonly Target[] }>;
  /**
   * The values items keep under keys the schema has none of (a property
   * removed with its values kept, a key typed by hand or another tool's), by
   * key: how many items, their values; none of the store's own keys. A value
   * of them is taken off by a `setValue` to undefined, as any
   */
  looseValues(id: string): Promise<readonly LooseKey[]>;
}

/** A key items keep that the schema has none of: the items keeping it, each its value */
export type LooseKey = { readonly key: string; readonly values: readonly { readonly item: ItemKey; readonly value: Value }[] };

/**
 * What a view keeps where a database is shown (`board.groupBy`): one place's
 * values by key. In SilverBullet its block's text; in memory a map. Views know
 * no block: the core gives each view its own keys of it.
 */
/**
 * Where a database's places keep their states apart from its store, every
 * place of every document (SilverBullet: a `silverware-database` block in any
 * page): found by what their states name, and changed. The core knows no
 * document nor block: it says what a state becomes (`change`), the binding
 * finds, reads and writes them (through the page writer: a place written only
 * where it is still as read).
 */
export interface PlaceStore {
  /**
   * The places of `database` whose state `change` changes (only the entries
   * that change; undefined: none), each read now (every document read:
   * `progress` told as they are), and what each becomes: nothing written
   */
  plan(database: string, change: PlaceChange, progress?: WriteProgress, leave?: (document: string) => boolean): Promise<PlacesPlan>;
  /** A plan written, each place where it is still as read */
  apply(plan: PlacesPlan): Promise<PlacesReport>;
  /** What `apply` wrote put back, each place where it is still as written (changed since: left) */
  undo(report: PlacesReport): Promise<PlacesReport>;
}

/**
 * What a change makes of a place's state: the entries that change, as the
 * place writes them (undefined: none); `REMOVE_PLACE`: the place taken out of
 * its document whole (its database deleted)
 */
export type PlaceChange = (state: ReadonlyMap<string, unknown>) => Readonly<Record<string, unknown>> | typeof REMOVE_PLACE | undefined;

/** What a `PlaceChange` gives for a place to be taken out of its document whole */
export const REMOVE_PLACE = "remove";

/**
 * Places to change: the documents they are in (as said to the user), the rest
 * the binding's own; `byHand`: documents holding places the change would
 * reach that cannot be written (a block indented in a list item), to be
 * changed by hand
 */
export type PlacesPlan = { readonly documents: readonly string[]; readonly byHand?: readonly string[] };

/** Places written, and those left (changed since they were read) with why */
export type PlacesReport = { readonly written: readonly string[]; readonly skipped: readonly { readonly document: string; readonly reason: string }[] };

export interface ViewStateStore {
  /** A key's value, undefined where it has none */
  get(key: string): unknown;
  /** Every key it has */
  keys(): readonly string[];
  /** Values written together (undefined: the key goes); one write, which may render the place anew */
  set(values: Readonly<Record<string, unknown>>): Promise<void>;
}
