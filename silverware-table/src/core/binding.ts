// What a host binds the core to (docs/silverware-table-store-plan.md, step 6):
// the adapter of the tables it renders, the features in the order they get
// events (its own among them: the adapter's modules), how a table rendered
// anew is marked with its look before the browser lays it out, and the
// provider it registers the tables with in Silverware Layout. SilverBullet's
// is host/silverbullet/binding.ts, handed to the controller by its Space Lua
// API's `init` (host/silverbullet/api.ts) and the tests' page: the core imports nothing of a host.
import type { LayoutProvider } from "../../../shared/layout.ts";
import type { FeatureName, SETTINGS, SettingValue } from "../bridge.ts";
import type { TableModel } from "../../../shared/table/model.ts";
import type { SourceTables } from "../sources.ts";
import type { AdapterContext, TableAdapter } from "./adapter.ts";
import type { AdapterFeature, Feature, TableHost, TableLook, TableTarget, WriteResult } from "./feature.ts";
import type { TableRows } from "./rows.ts";
import type { TablePlatform } from "./platform.ts";
import type { MetadataPart, PageFormulaStore, StoredMetadata, StoredTable, TableStore, TableWriteEdit } from "./store.ts";
import type { TableKey, TableRegister } from "./tables.ts";

/**
 * What the core gives a host to make its store with: the platform as it is,
 * the register (the one maker of keys), the settings (how a table is written
 * is the store's: the formatting settings), and what to do before a write of the open page (the
 * features', the history marker), given its text, the span of its tables,
 * the edit's range; what it gives is run after, told where places went
 */
export type StoreContext = {
  platform(): TablePlatform;
  readonly register: TableRegister;
  setting<K extends keyof typeof SETTINGS>(name: K): Promise<SettingValue<K>>;
  beforeWrite(
    text: string,
    span: { readonly from: number; readonly to: number },
    edit: { readonly from: number; readonly to: number },
  ): Promise<((moved: (position: number, after: boolean) => number) => void) | undefined>;
};

/**
 * The store a host keeps the open page's tables in, as the core uses it: its
 * tables, transactions and page formulas, where a table is in its document
 * as the host counts (a markdown page's offsets: a custom menu's table's
 * `from`, `to`; undefined: not read), what a table it read stores beyond
 * its content and the table without it (Remove metadata: written as any
 * change, the other tables following it), and whether a model written over
 * a table read would write it as it is (a write that changes nothing)
 */
export type BoundStore = TableStore &
  PageFormulaStore & {
    placeOf(document: string, key: TableKey): { readonly from: number; readonly to: number } | undefined;
    metadataOf(table: TableModel, part: MetadataPart | "all"): StoredMetadata;
    withoutMetadata(table: TableModel, part: MetadataPart | "all"): TableModel;
    writesSame(document: string, read: StoredTable, model: TableModel, options?: Pick<TableWriteEdit, "tidy" | "columnMap">): Promise<boolean>;
    /** Rows of a table as plain markdown (Copy as Markdown): in `read`'s form where it is the table read, no hidden tags */
    plainMarkdown(table: TableModel, rows: readonly number[], read?: TableModel): string;
  };

/**
 * A feature to create: a module (by its name), or one always there (no name);
 * made with its host: a module's its own (core/modulehost.ts), the core's for the others
 */
export type FeatureEntry = { readonly name: FeatureName | undefined; readonly create: (host: TableHost) => AdapterFeature };

/** What the provider for Silverware Layout is given of the tables (the core's) */
export type LayoutTables = {
  // A rendered table's rows as SilverBullet rendered them (some may be out of the document: largeTables), read only:
  // a table the core has not taken yet stays new, so its features are told of it before it is laid out
  renderedRows(table: HTMLTableElement): readonly HTMLTableRowElement[];
  // The table a widget shows, where it is enhanced (known in its store), so it can be written; undefined: not yet
  tableOf(widget: HTMLElement): TableTarget | undefined;
  write(table: TableTarget, change: (table: TableModel) => TableModel | undefined): Promise<WriteResult>;
  // The metadata setting
  metadataOn(): boolean;
};

/** A host's binding; `S` its store, which its own adapter and modules are given as it made it */
export type TableBinding<S extends BoundStore = BoundStore> = {
  /** The store the open page's tables are kept in, made once for the core */
  store(context: StoreContext): S;
  /** The adapter of the tables the host renders */
  adapter(doc: Document, rows: TableRows, context: AdapterContext, store: S): TableAdapter;
  /**
   * The features in the order they get events; `metadata` the core's own
   * (Remove metadata, also a page command), `sources` the space's sources as
   * the core gives them the sources module
   */
  features(metadata: Feature, sources: SourceTables, store: S): readonly FeatureEntry[];
  /** A table rendered anew marked with its look (`look` of the table its rendered metadata makes), before the browser lays it out */
  markRendered(widget: HTMLElement, rows: readonly HTMLTableRowElement[], look: (table: TableModel) => TableLook): void;
  /** The provider of the tables for Silverware Layout */
  layoutProvider(tables: LayoutTables): LayoutProvider;
};
