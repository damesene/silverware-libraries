// The modules in the order their views, commands and parts of the tag picked
// are listed: the core creates only those turned on, and knows none of them.
import type { ModuleName } from "./bridge.ts";
import type { ModuleHost, TagsModule } from "./core/module.ts";
import { pagesModule } from "./modules/pages.ts";
import { panelModule } from "./modules/panel.ts";
import { removeModule } from "./modules/remove.ts";
import { renameModule } from "./modules/rename.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost) => TagsModule])[] = [
  ["rename", renameModule],
  ["pages", pagesModule],
  ["remove", removeModule],
  ["panel", panelModule],
];

/** The modules turned on, each made with its own host (`hostFor`: the core's, what it offers its own) */
export function createModules(on: ReadonlySet<ModuleName>, hostFor: (name: ModuleName) => ModuleHost): TagsModule[] {
  return FACTORIES.filter(([name]) => on.has(name)).map(([name, create]) => create(hostFor(name)));
}
