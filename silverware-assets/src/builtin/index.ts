// Silverware Layout's own types and actions registered, each only where its name is free: a user's or another
// plugin's of the same name, registered before a reload of Space Lua, is kept.
import type { AssetAction, AssetType } from "../../../shared/assets.ts";
import { BUILTIN_ACTIONS } from "./actions.ts";
import { BUILTIN_TYPES } from "./types.ts";

/** What the built-in parts are registered with: where a name is free */
export type DefaultRegistry = {
  readonly types: { registerDefault(type: AssetType): void };
  readonly actions: { registerDefault(action: AssetAction): void };
};

export function registerBuiltins(registry: DefaultRegistry): void {
  for (const type of BUILTIN_TYPES) registry.types.registerDefault(type);
  for (const action of BUILTIN_ACTIONS) registry.actions.registerDefault(action);
}
