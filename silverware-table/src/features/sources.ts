// The sources module: the sources of the space the host gives (a SourceProvider:
// SilverBullet's Space Lua functions, the playground's in memory), offered to
// the formulas as tables of the markdown model, which they read as `@name`
// (`@tasks[due]`, `@tasks[#Data]`). A source read anew makes the modules check
// the tables shown again (`tablesChanged`): what is out of date is said, nothing
// written. Turned off, no source is offered: formulas, views and pivots reading
// one keep what they show (a source is `unread`).
import type { Feature, ModelHost } from "../core/feature.ts";
import { type Align, escapeCell, type Table } from "../markdown.ts";
import type { SourceData, SourceProvider, SourcesOffer } from "../sources.ts";

/** A source's data as a table: its columns the header, each value escaped as a cell's text */
export function sourceTable(data: SourceData): Table {
  return {
    indent: "",
    align: data.columns.map((): Align => ""),
    rows: [{ cells: data.columns.map(escapeCell) }, ...data.rows.map((row) => ({ cells: data.columns.map((_, c) => escapeCell(row[c] ?? "")) }))],
    padded: false,
  };
}

export class Sources implements Feature {
  // The table made of each source's data: the same object while the data are (the formulas keep their sheets by table)
  private readonly tables = new WeakMap<SourceData, Table>();
  private version = 0;
  private stopListening: (() => void) | undefined;

  constructor(
    private readonly host: ModelHost,
    private readonly provider: SourceProvider,
  ) {
    host.offer({
      names: () => provider.names(),
      table: (name) => this.table(name),
      version: () => this.version,
    } satisfies SourcesOffer);
  }

  start(): void {
    this.stopListening = this.provider.changed(() => {
      this.version++;
      this.host.tablesChanged();
    });
  }

  stop(): void {
    this.stopListening?.();
  }

  private table(name: string): Table | null | undefined {
    const wanted = name.toLowerCase();
    if (!this.provider.names().some((n) => n.toLowerCase() === wanted)) return null;
    const data = this.provider.read(name);
    if (!data) return undefined;
    let table = this.tables.get(data);
    if (!table) this.tables.set(data, (table = sourceTable(data)));
    return table;
  }
}
