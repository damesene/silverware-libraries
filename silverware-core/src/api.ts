// Silverware Core's public module (docs/silverware-core.md): what the plugins import of the core, never its other
// files (each plugin's isolation test). Every export carries `@since X.Y`, the core's version that first had it; a
// plugin's need of the core is checked against what it imports (scripts/coreneeds.test.ts).

/**
 * The core's version, its library page's (scripts/versions.mjs checks both alike): the version of its API. A plugin
 * works with a core of the same major and at least the minor it needs (each API page's gate).
 * @since 1.0
 */
export const VERSION = "1.0.0";
