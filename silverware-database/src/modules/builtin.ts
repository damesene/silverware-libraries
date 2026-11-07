// The built-in modules, in their order: made through the module API alone
// (modules import only types from the core: isolation.test.ts).
import type { ModuleDefinition } from "../core/module.ts";
import { PEEK_MODULE } from "./peek/index.ts";
import { PROPERTIES_MODULE } from "./properties/index.ts";

export const BUILT_IN_MODULES: readonly ModuleDefinition[] = [PROPERTIES_MODULE, PEEK_MODULE];
