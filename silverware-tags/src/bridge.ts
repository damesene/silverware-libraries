// The SilverBullet API Silverware Tags uses, handed over by the library page's
// Space Lua (`editor.*`, `space.*`, `config.get`, the index queried there), so
// no SilverBullet internals are needed. Only space/silverbullet.ts reads it,
// making the Space the rest works with.

export type Bridge = {
  // Every page (space.listPages: page objects with their name, or names)
  readonly listPages: () => unknown;
  // The index's tags (query[[from index.tag "tag"]]: { name, page, parent }; table rows' and headings' tags with parent "table", "header")
  readonly queryTags: () => unknown;
  readonly readPage: (name: string) => string | Promise<string>;
  readonly writePage: (name: string, text: string) => unknown;
  // The page open in the editor, its text and one edit of it (one undo step)
  readonly getCurrentPage: () => string | Promise<string>;
  readonly getText: () => string | Promise<string>;
  readonly replaceRange: (from: number, to: number, text: string) => unknown;
  readonly navigate: (page: string) => unknown;
  // A notification; `options` as SilverBullet's main has them (buttons: actions), a release before them ignores them
  readonly flash: (message: string, type?: "info" | "error", options?: unknown) => unknown;
  // Optional: waits until the index has caught up (mq.awaitEmptyQueue("indexQueue"))
  readonly awaitIndex?: () => unknown;
  // Optional: without it, settings keep their defaults
  readonly getConfig?: (path: string, defaultValue: unknown) => unknown;
  // Optional, for the settings dialog: asks before closing it with changes (else the browser's confirm)
  readonly confirm?: (message: string) => boolean | Promise<boolean>;
  // Optional, for the settings dialog: the CONFIG page saved as SilverBullet's Configuration Manager saves it (readPage reads it)
  readonly saveConfigPage?: (text: string) => unknown;
  // Optional: the page loaded anew, as a module turned on or off needs (else the window reloaded)
  readonly reloadUI?: () => unknown;
};

/** The bridge's functions it cannot work without, missing from what the library page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["listPages", "queryTags", "readPage", "writePage", "getCurrentPage", "getText", "replaceRange", "navigate", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}

/** The modules: the parts that can be turned off with `silverware.tags.modules.<name>.enabled` (default on) */
export const MODULE_NAMES = ["rename", "pages", "remove", "cleanup", "panel", "custom"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/** A module's name and what it does, as the settings dialog shows them (the library page's config.define says the same) */
export const MODULE_LABELS: Readonly<Record<ModuleName, string>> = { rename: "Rename", pages: "By page", remove: "Delete a tag", cleanup: "Cleanup", panel: "Tags panel", custom: "Custom operations" };
export const MODULE_DESCRIPTIONS: Readonly<Record<ModuleName, string>> = {
  rename: "Rename a tag everywhere it is used; into a tag that exists, the two merge.",
  pages: "The view by page: tags given to the pages picked in a tree of folders, and taken off them; the tags of the page you are on.",
  remove: "Delete a tag everywhere it is used.",
  cleanup: "The window's Cleanup: tags likely one (case, a separator, a plural, a typo) to merge, tags used on one page only.",
  panel: "The tags as a panel beside the page (SilverBullet's navigator): a tag opens the Tags window, F2 renames it, a tag dragged under another moves it there.",
  custom: "Your own operations on a tag, from a JS file of the space given with silverware.tags.defineOperations: a button of the tag, its changes reviewed first.",
};

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  protectMeta: "silverware.tags.protectMeta",
  pageFirst: "silverware.tags.panelPageFirst",
  module: (name: ModuleName) => `silverware.tags.modules.${name}.enabled`,
} as const;

/** Silverware Tags' settings, read as it starts (the settings dialog starts it anew; modules apply on reload) */
export type Settings = {
  readonly modules: ReadonlySet<ModuleName>;
  // SilverBullet's meta pages (a page tagged meta or under it) left out of everything and never changed
  readonly protectMeta: boolean;
  // The Tags panel: the page open's tags first (else as SilverBullet's tree sorts: by name, folders first)
  readonly pageFirst: boolean;
};

/** The settings as configured, each its default where it is not set or not valid */
export async function readSettings(bridge: Partial<Bridge>): Promise<Settings> {
  const get = async (path: string, fallback: unknown) => {
    try {
      return await bridge.getConfig?.(path, fallback);
    } catch {
      return fallback;
    }
  };
  const modules = new Set<ModuleName>();
  for (const name of MODULE_NAMES) if ((await get(PATHS.module(name), true)) !== false) modules.add(name);
  return { modules, protectMeta: (await get(PATHS.protectMeta, true)) !== false, pageFirst: (await get(PATHS.pageFirst, false)) === true };
}

/**
 * A list as handed over: an array, or a Lua table as an object with its
 * items under 1, 2, … (both taken, as the toolbar's bridge does)
 */
export function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([key], i) => key === String(i + 1))) return [];
  return entries.map(([, item]) => item);
}
