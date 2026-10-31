// The modules in the order their views, commands and parts of the tag picked
// are listed: the core creates only those turned on, and knows none of them.
import type { ModuleName } from "./bridge.ts";
import type { ModuleHost, TagsModule } from "./core/module.ts";
import { pagesModule } from "./modules/pages.ts";
import { removeModule } from "./modules/remove.ts";
import { renameModule } from "./modules/rename.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost) => TagsModule])[] = [
  ["rename", renameModule],
  ["pages", pagesModule],
  ["remove", removeModule],
];

export function createModules(on: ReadonlySet<ModuleName>, host: ModuleHost): TagsModule[] {
  return FACTORIES.filter(([name]) => on.has(name)).map(([, create]) => create(host));
}
