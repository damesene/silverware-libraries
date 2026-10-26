// The SilverBullet API Silverware Toolbar uses, handed over by the library
// page's Space Lua (`editor.*` and `config.get`), so no SilverBullet internals
// are needed.
import { DEFAULT_FAVORITES, favoriteItemOf, type FavoriteItem, type Favorites } from "./core/favorites.ts";

export type Bridge = {
  // The main selection: where it is in the page's text, and its text
  readonly getSelection: () => Selection | Promise<Selection>;
  readonly setSelection: (from: number, to: number) => unknown;
  readonly replaceRange: (from: number, to: number, text: string) => unknown;
  readonly getText: () => string | Promise<string>;
  readonly flash: (message: string, type?: "info" | "error") => unknown;
  // Optional: the keyboard back to the editor after the popup (else its editable area is focused)
  readonly focus?: () => unknown;
  // Optional: without it, settings keep their defaults
  readonly getConfig?: (path: string, defaultValue: unknown) => unknown;
};

export type Selection = { readonly from: number; readonly to: number; readonly text: string };

/** The bridge's functions it cannot work without, missing from what the library page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getSelection", "setSelection", "replaceRange", "getText", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}

/** The modules: the parts that can be turned off with `silverware.toolbar.modules.<name>.enabled` (default on) */
export const MODULE_NAMES = ["inline", "blocks", "clear"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

// The key of the command showing every action (the library page gives it to the command: SilverBullet handles it)
export const DEFAULT_SHORTCUT = "Ctrl-Shift-q";

/** Silverware Toolbar's settings, read once it starts (a change applies on reload) */
export type Settings = {
  readonly favorites: Favorites;
  readonly modules: ReadonlySet<ModuleName>;
};

/**
 * A list as configured: an array, or a Lua table handed over as an object
 * with its items under 1, 2, … (not verified how SilverBullet's config.get
 * gives a list from Space Lua to JS: both are taken)
 */
function listOf(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([key], i) => key === String(i + 1))) return undefined;
  return entries.map(([, item]) => item);
}

/** The settings as configured, each its default where it is not set or not valid */
export async function readSettings(bridge: Bridge): Promise<Settings> {
  const get = async (path: string, fallback: unknown) => {
    try {
      return await bridge.getConfig?.(path, fallback);
    } catch {
      return fallback;
    }
  };
  const favorites = await get("silverware.toolbar.favorites", DEFAULT_FAVORITES);
  const modules = new Set<ModuleName>();
  for (const name of MODULE_NAMES) if ((await get(`silverware.toolbar.modules.${name}.enabled`, true)) !== false) modules.add(name);
  return { favorites: favoritesOf(favorites), modules };
}

/**
 * The favourites as configured: rows of items, an item that is none left out
 * (logged); not rows at all: the defaults
 */
export function favoritesOf(value: unknown): Favorites {
  const rows = listOf(value)?.map(listOf);
  if (!rows || rows.some((row) => !row)) return DEFAULT_FAVORITES;
  return rows.map((items) => {
    return items!.flatMap((item): FavoriteItem[] => {
      const favorite = favoriteItemOf(item);
      if (!favorite) console.warn('Silverware Toolbar: a favourite is not { id = …, show = … } nor { type = "separator" }:', item);
      return favorite ? [favorite] : [];
    });
  });
}
