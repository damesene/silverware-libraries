// The modules in the order their commands and their actions on a tag are
// listed: the core creates only those turned on, and knows none of them.
import type { ModuleName } from "./bridge.ts";
import type { ModuleHost, TagsModule } from "./core/module.ts";
import { assignModule } from "./modules/assign.ts";
import { pageTagsModule } from "./modules/pagetags.ts";
import { removeModule } from "./modules/remove.ts";
import { renameModule } from "./modules/rename.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost) => TagsModule])[] = [
  ["rename", renameModule],
  ["assign", assignModule],
  ["pageTags", pageTagsModule],
  ["remove", removeModule],
];

export function createModules(on: ReadonlySet<ModuleName>, host: ModuleHost): TagsModule[] {
  return FACTORIES.filter(([name]) => on.has(name)).map(([, create]) => create(host));
}
