// The types module: the built-in types of charts (types/)
import type { ChartModule } from "../core/module.ts";
import { BUILTIN_TYPES } from "../types/index.ts";

export function typesModule(): ChartModule {
  return { types: () => BUILTIN_TYPES };
}
