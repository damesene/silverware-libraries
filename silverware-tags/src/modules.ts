// The modules in the order their views, commands and parts of the tag picked
// are listed: the core creates only those turned on, and knows none of them.
import type { ModuleName, Settings } from "./bridge.ts";
import type { ModuleHost, TagsModule } from "./core/module.ts";
import { cleanupModule } from "./modules/cleanup.ts";
import { customModule } from "./modules/custom.ts";
import { pagesModule } from "./modules/pages.ts";
import { panelModule } from "./modules/panel.ts";
import { removeModule } from "./modules/remove.ts";
import { renameModule } from "./modules/rename.ts";

// Each made with its host and the settings (a module reads its own: the panel's order)
const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost, settings: Settings) => TagsModule])[] = [
  ["rename", renameModule],
  ["pages", pagesModule],
  ["remove", removeModule],
  ["cleanup", cleanupModule],
  ["panel", panelModule],
  ["custom", customModule],
];

/** The modules turned on, each made with its own host (`hostFor`: the core's, what it offers its own) */
export function createModules(settings: Settings, hostFor: (name: ModuleName) => ModuleHost): TagsModule[] {
  return FACTORIES.filter(([name]) => settings.modules.has(name)).map(([name, create]) => create(hostFor(name), settings));
}
