// The built-in converters, in the order offered: made through the converter API
// alone, as a user's converter is (converters import only types from the core:
// isolation.test.ts).
import type { ConverterDefinition } from "../../core/converter.ts";

export const BUILT_IN_CONVERTERS: readonly ConverterDefinition[] = [];
