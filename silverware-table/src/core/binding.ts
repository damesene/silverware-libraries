// What a host binds the core to (docs/silverware-table-store-plan.md, step 6):
// the adapter of the tables it renders, the features in the order they get
// events (its own among them: the adapter's modules), how a table rendered
// anew is marked with its look before the browser lays it out, and the
// provider it registers the tables with in Silverware Layout. SilverBullet's
// is host/silverbullet/binding.ts, handed to the controller by its Space Lua
// API's `init` (host/silverbullet/api.ts) and the tests' page: the core imports nothing of a host.
import type { LayoutProvider } from "../../../shared/layout.ts";
import type { FeatureName } from "../bridge.ts";
import type { TableModel } from "../model/model.ts";
import type { SourceTables } from "../sources.ts";
import type { AdapterContext, TableAdapter } from "./adapter.ts";
import type { AdapterFeature, Feature, TableHost, TableLook, WriteResult } from "./feature.ts";
import type { TableRows } from "./rows.ts";

/**
 * A feature to create: a module (by its name), or one always there (no name);
 * made with its host: a module's its own (core/modulehost.ts), the core's for the others
 */
export type FeatureEntry = { readonly name: FeatureName | undefined; readonly create: (host: TableHost) => AdapterFeature };

/** What the provider for Silverware Layout is given of the tables (the core's) */
export type LayoutTables = {
  // A rendered table's rows as SilverBullet rendered them (some may be out of the document: largeTables)
  renderedRows(table: HTMLTableElement): readonly HTMLTableRowElement[];
  // Whether a widget is enhanced (known in the page's markdown), so it can be written
  enhanced(widget: HTMLElement): boolean;
  write(widget: HTMLElement, change: (table: TableModel) => TableModel | undefined): Promise<WriteResult>;
  // The metadata setting
  metadataOn(): boolean;
};

export type TableBinding = {
  /** The adapter of the tables the host renders */
  adapter(doc: Document, rows: TableRows, context: AdapterContext): TableAdapter;
  /**
   * The features in the order they get events; `metadata` the core's own
   * (Remove metadata, also a page command), `sources` the space's sources as
   * the core gives them the sources module
   */
  features(metadata: Feature, sources: SourceTables): readonly FeatureEntry[];
  /** A table rendered anew marked with its look (`look` of the table its rendered metadata makes), before the browser lays it out */
  markRendered(widget: HTMLElement, rows: readonly HTMLTableRowElement[], look: (table: TableModel) => TableLook): void;
  /** The provider of the tables for Silverware Layout */
  layoutProvider(tables: LayoutTables): LayoutProvider;
};
