// The modules in the order their actions are listed (the popup's groups
// follow it): the core creates only those turned on, and knows none of them.
// The custom actions (actions.ts) join theirs.
import { withCustomActions } from "./actions.ts";
import type { ModuleName } from "./bridge.ts";
import type { Action, ModuleHost, ToolbarModule } from "./core/action.ts";
import type { ItemKind } from "./core/items.ts";
import { OWN_ICON } from "./core/favorites.ts";
import { type Icons, iconsOf, isReference } from "../../shared/icons.ts";
import { blocksModule } from "./modules/blocks.ts";
import { clearModule } from "./modules/clear.ts";
import { commandsModule } from "./modules/commands.ts";
import { emojiModule } from "./modules/emoji.ts";
import { gesturesModule } from "./modules/gestures.ts";
import { inlineModule } from "./modules/inline.ts";
import { keyboardModule } from "./modules/keyboard.ts";
import { slashModule } from "./modules/slash.ts";
import { snippetsModule } from "./modules/snippets.ts";

const FACTORIES: readonly (readonly [ModuleName, (host: ModuleHost) => ToolbarModule])[] = [
  ["inline", inlineModule],
  ["clear", clearModule],
  ["blocks", blocksModule],
  ["commands", commandsModule],
  ["slash", () => slashModule()],
  ["keyboard", keyboardModule],
  ["gestures", gesturesModule],
  ["snippets", snippetsModule],
  ["emoji", emojiModule],
];

/**
 * The modules turned on: their actions, in their order, and the custom ones;
 * the kinds of favourites they give. Asked for each time they show
 */
export function createModules(on: ReadonlySet<ModuleName>, host: ModuleHost = {}): { readonly actions: () => Action[]; readonly kinds: () => ItemKind[]; readonly refresh: () => Promise<void> } {
  const modules = FACTORIES.filter(([name]) => on.has(name)).map(([, create]) => create(host));
  const icons = host.icons ?? iconsOf(undefined);
  return {
    actions: () => withCustomActions(modules.flatMap((m) => m.actions())).map((action) => drawnIcons(action, icons)),
    kinds: () => modules.flatMap((m) => m.itemKinds?.() ?? []),
    refresh: async () => {
      await Promise.all(modules.map((m) => m.refresh?.()));
    },
  };
}

/**
 * An action whose icon (or a choice's) is an icon of Silverware Icons (`icon = "lucide:rocket"` of a custom action
 * or format) with it drawn, as an own icon is; an SVG or none as it is
 */
function drawnIcons(action: Action, icons: Icons): Action {
  const icon = isReference(action.icon) ? icons.markup(action.icon, OWN_ICON) : action.icon;
  const choices = action.choices?.map((choice) => drawnIcons(choice, icons));
  return icon === action.icon && !choices?.some((choice, i) => choice !== action.choices![i]) ? action : { ...action, icon, ...(choices ? { choices } : {}) };
}
