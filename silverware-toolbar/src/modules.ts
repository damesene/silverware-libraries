// The modules in the order their actions are listed (the popup's groups
// follow it): the core creates only those turned on, and knows none of them.
// The custom actions (actions.ts) join theirs.
import { withCustomActions } from "./actions.ts";
import type { ModuleName } from "./bridge.ts";
import type { Action, ModuleHost, ToolbarModule } from "./core/action.ts";
import type { ItemKind } from "./core/items.ts";
import { blocksModule } from "./modules/blocks.ts";
import { clearModule } from "./modules/clear.ts";
import { commandsModule } from "./modules/commands.ts";
import { emojiModule } from "./modules/emoji.ts";
import { gesturesModule } from "./modules/gestures.ts";
import { inlineModule } from "./modules/inline.ts";
import { keyboardModule } from "./modules/keyboard.ts";
import { snippetsModule } from "./modules/snippets.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost) => ToolbarModule])[] = [
  ["inline", inlineModule],
  ["clear", clearModule],
  ["blocks", blocksModule],
  ["commands", commandsModule],
  ["keyboard", keyboardModule],
  ["gestures", gesturesModule],
  ["snippets", snippetsModule],
  ["emoji", () => emojiModule()],
];

/**
 * The modules turned on: their actions, in their order, and the custom ones;
 * the kinds of favourites they give. Asked for each time they show
 */
export function createModules(on: ReadonlySet<ModuleName>, host: ModuleHost = {}): { readonly actions: () => Action[]; readonly kinds: () => ItemKind[] } {
  const modules = FACTORIES.filter(([name]) => on.has(name)).map(([, create]) => create(host));
  return {
    actions: () => withCustomActions(modules.flatMap((m) => m.actions())),
    kinds: () => modules.flatMap((m) => m.itemKinds?.() ?? []),
  };
}
