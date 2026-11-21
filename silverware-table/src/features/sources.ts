// The sources module: the sources of the space (SilverBullet's Space Lua
// functions, the playground's in memory), as the core gives them read as tables
// of the model (SourceTables: store/sources.ts), offered to the formulas, which
// they read as `@name`
// (`@tasks[due]`, `@tasks[#Data]`). A source read anew makes the modules check
// the tables shown again (`tablesChanged`): what is out of date is said, nothing
// written. Turned off, no source is offered: formulas, views and pivots reading
// one keep what they show (a source is `unread`).
import type { Feature, ModelHost } from "../core/feature.ts";
import type { SourcesOffer, SourceTables } from "../sources.ts";

export class Sources implements Feature {
  private version = 0;
  private stopListening: (() => void) | undefined;

  constructor(
    private readonly host: ModelHost,
    private readonly sources: SourceTables,
  ) {
    host.offer({
      // (Names are of letters, digits and _: "en" orders them so in every locale)
      names: () => [...sources.names()].sort((a, b) => a.localeCompare(b, "en")),
      columns: (name) => sources.columns(name),
      table: (name) => sources.table(name),
      version: () => this.version,
    } satisfies SourcesOffer);
  }

  start(): void {
    this.stopListening = this.sources.changed(() => {
      this.version++;
      this.host.tablesChanged();
    });
  }

  stop(): void {
    this.stopListening?.();
  }
}
