// The modules in the order their actions are listed (the popup's groups
// follow it): the core creates only those turned on, and knows none of them.
// The custom actions (actions.ts) join theirs.
import { withCustomActions } from "./actions.ts";
import type { ModuleName } from "./bridge.ts";
import type { Action, ModuleHost, ToolbarModule } from "./core/action.ts";
import { blocksModule } from "./modules/blocks.ts";
import { clearModule } from "./modules/clear.ts";
import { commandsModule } from "./modules/commands.ts";
import { inlineModule } from "./modules/inline.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost) => ToolbarModule])[] = [
  ["inline", inlineModule],
  ["clear", clearModule],
  ["blocks", blocksModule],
  ["commands", commandsModule],
];

/** The actions of the modules turned on, in their order, and the custom ones: asked for each time they show */
export function createActions(on: ReadonlySet<ModuleName>, host: ModuleHost = {}): () => Action[] {
  const modules = FACTORIES.filter(([name]) => on.has(name)).map(([, create]) => create(host));
  return () => withCustomActions(modules.flatMap((m) => m.actions()));
}
