// The space's sources as a store (docs/silverware-table-store-plan.md, step 5):
// each source a document of its name (`@tasks`) holding its one table, read
// only. A source's values are text as SilverBullet's index keeps a table's
// cells (a hidden tag in one among them): its table is read as a table of a
// page is, by the markdown codec, so what a renderer hides is an attribute,
// and the same model while its data are the same.
import type { StoredTable, TablePlan, TableReport, TableRevision, TableStore } from "../core/store.ts";
import type { TableKey, TableRegister } from "../core/tables.ts";
import { type Align, escapeCell, type Table } from "../markdown.ts";
import type { TableModel } from "../../../shared/table/model.ts";
import type { SourceData, SourceProvider, SourceTables } from "../sources.ts";
import { decode } from "./markdown/codec.ts";

/** A source's data as a table: its columns the header, each value escaped as a cell's text */
export function sourceTable(data: SourceData): Table {
  return {
    indent: "",
    align: data.columns.map((): Align => ""),
    rows: [{ cells: data.columns.map(escapeCell) }, ...data.rows.map((row) => ({ cells: data.columns.map((_, c) => escapeCell(row[c] ?? "")) }))],
    padded: false,
  };
}

/** A source's document: its name after `@` */
export const sourceDocument = (name: string): string => `@${name}`;

const READ_ONLY = { cause: "refused", reason: "a source is read only" } as const;

export class SourceStore implements TableStore, SourceTables {
  // The table made of each source's data: the same object while the data are (the formulas keep their sheets by table)
  private readonly models = new WeakMap<SourceData, { readonly model: TableModel; readonly revision: TableRevision }>();
  // Each source's key by its name (compared ignoring case), with its name as defined
  private readonly keys = new Map<string, { readonly key: TableKey; readonly name: string }>();
  private revisions = 0;

  constructor(
    private readonly provider: SourceProvider,
    private readonly register: TableRegister,
  ) {}

  names(): readonly string[] {
    return this.provider.names();
  }

  columns(name: string): readonly string[] | undefined {
    return this.provider.read(name)?.columns;
  }

  table(name: string): TableModel | null | undefined {
    const wanted = name.toLowerCase();
    if (!this.provider.names().some((n) => n.toLowerCase() === wanted)) return null;
    const data = this.provider.read(name);
    return data && this.read(data).model;
  }

  changed(listener: () => void): () => void {
    return this.provider.changed(listener);
  }

  async tables(document: string): Promise<readonly StoredTable[] | null> {
    const name = document.startsWith("@") ? document.slice(1) : undefined;
    const data = name === undefined ? undefined : this.table(name) && this.provider.read(name);
    if (!name || !data) return null;
    const { model, revision } = this.read(data);
    return [{ key: this.keyOf(name), revision, model }];
  }

  documentOf(key: TableKey): string | undefined {
    for (const one of this.keys.values()) if (one.key === key) return sourceDocument(one.name);
    return undefined;
  }

  async plan(transaction: { readonly document: string }): Promise<TablePlan> {
    return { document: transaction.document, changes: 0, skipped: READ_ONLY };
  }

  async apply(plan: TablePlan): Promise<TableReport> {
    return { document: plan.document, written: false, inserted: [], revisions: new Map(), skipped: READ_ONLY };
  }

  async planUndo(report: TableReport): Promise<TablePlan> {
    return { document: report.document, changes: 0, skipped: READ_ONLY };
  }

  asRead(model: TableModel): TableModel {
    return model;
  }

  private read(data: SourceData): { readonly model: TableModel; readonly revision: TableRevision } {
    let made = this.models.get(data);
    // (Read as a table of the page is: a value's hidden tag hidden, as a renderer hides it)
    if (!made) this.models.set(data, (made = { model: decode(sourceTable(data)), revision: String(++this.revisions) as TableRevision }));
    return made;
  }

  /** A source's key: the same for its name (compared ignoring case) */
  private keyOf(name: string): TableKey {
    const lower = name.toLowerCase();
    let one = this.keys.get(lower);
    if (!one) {
      const defined = this.provider.names().find((n) => n.toLowerCase() === lower) ?? name;
      this.keys.set(lower, (one = { key: this.register.newKey(sourceDocument(defined)), name: defined }));
    }
    return one.key;
  }
}
