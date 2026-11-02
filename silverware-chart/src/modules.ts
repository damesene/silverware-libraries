// The modules in the order their formats, types and sources are tried: the
// core creates only those turned on, and knows none of them.
import type { ModuleName, Settings } from "./bridge.ts";
import type { ChartModule, ModuleHost } from "./core/module.ts";
import { insertModule } from "./modules/insert.ts";
import { mermaidModule } from "./modules/mermaid.ts";
import { settingsModule } from "./modules/settings.ts";
import { silverwareTableModule } from "./modules/silverwareTable.ts";
import { tablesModule } from "./modules/tables.ts";
import { typesModule } from "./modules/types.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost, settings: Settings) => ChartModule])[] = [
  ["mermaid", mermaidModule],
  ["types", typesModule],
  ["settings", settingsModule],
  ["tables", tablesModule],
  ["silverwareTable", silverwareTableModule],
  ["insert", insertModule],
];

/** The modules turned on, each made with its own host */
export function createModules(settings: Settings, hostFor: (name: ModuleName) => ModuleHost): ChartModule[] {
  return FACTORIES.filter(([name]) => settings.modules.has(name)).map(([name, create]) => create(hostFor(name), settings));
}
