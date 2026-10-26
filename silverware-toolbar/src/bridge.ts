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
  // Optional, for the settings dialog: asks before closing it with changes (else the browser's confirm)
  readonly confirm?: (message: string) => boolean | Promise<boolean>;
  // Optional, for the settings dialog: the CONFIG page read and saved (as SilverBullet's Configuration Manager saves it)
  readonly readPage?: (name: string) => string | Promise<string>;
  readonly saveConfigPage?: (text: string) => unknown;
  // Optional: a store of its own instead of the CONFIG page (the playground's); values by path, undefined removes one
  readonly saveSettings?: (values: Readonly<Record<string, unknown>>) => unknown;
  // Optional: the page loaded anew, as a module turned on or off and the key need (else the window reloaded)
  readonly reloadUI?: () => unknown;
  // Optional, for the commands module: SilverBullet's commands (system.listCommands: definitions by name) and running one
  readonly listCommands?: () => unknown;
  readonly invokeCommand?: (name: string) => unknown;
  // Optional: one of SilverBullet's UI options (editor.getUiOption: `keyboardBar`, its bar over the on-screen keyboard)
  readonly getUiOption?: (key: string) => unknown;
};

export type Selection = { readonly from: number; readonly to: number; readonly text: string };

/** The bridge's functions it cannot work without, missing from what the library page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getSelection", "setSelection", "replaceRange", "getText", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}

/** The modules: the parts that can be turned off with `silverware.toolbar.modules.<name>.enabled` (default on) */
export const MODULE_NAMES = ["inline", "blocks", "clear", "commands"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/** A module's name and what it does, as the settings dialog shows them (the library page's config.define says the same) */
export const MODULE_LABELS: Readonly<Record<ModuleName, string>> = { inline: "Inline formats", blocks: "Turn into", clear: "Clear formatting", commands: "Commands" };
export const MODULE_DESCRIPTIONS: Readonly<Record<ModuleName, string>> = {
  inline: "Bold, italic, strikethrough, highlight, code, links and wiki links.",
  blocks: "Turn lines into a paragraph, a heading, a list, a task or a quote.",
  clear: "Remove the inline formats of the selection.",
  commands: "Every SilverBullet command, found by typing its name in the list of every action, and as a favourite.",
};

// The key of the command showing every action (the library page gives it to the command: SilverBullet handles it)
export const DEFAULT_SHORTCUT = "Ctrl-Shift-q";

/**
 * Where the toolbar shows: by the selection, or docked at the bottom of the
 * window over the on-screen keyboard (on a phone the system's menu of a
 * selection, Cut / Copy / Paste, is where the toolbar would be); `auto`: docked
 * when the selection was made by touch, else by it
 */
export const PLACEMENTS = ["auto", "selection", "bottom"] as const;
export type Placement = (typeof PLACEMENTS)[number];
/**
 * When the toolbar shows: always while the page's text is edited (docked, or by
 * the caret), always where it is docked (a phone) and after a selection elsewhere,
 * or only after a selection
 */
export const SHOWS = ["always", "mobile", "selection"] as const;
export type Show = (typeof SHOWS)[number];
export const SHOW_LABELS: Readonly<Record<Show, string>> = { always: "Always while you write", mobile: "Always on a phone, else after selecting text", selection: "After selecting text" };

export const PLACEMENT_LABELS: Readonly<Record<Placement, string>> = { auto: "Docked at the bottom after a touch, else by the selection", selection: "By the selection", bottom: "Docked at the bottom" };

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  favorites: "silverware.toolbar.favorites",
  shortcut: "silverware.toolbar.shortcut",
  placement: "silverware.toolbar.placement",
  show: "silverware.toolbar.show",
  module: (name: ModuleName) => `silverware.toolbar.modules.${name}.enabled`,
} as const;

/** Silverware Toolbar's settings, read once it starts (a change applies on reload) */
export type Settings = {
  readonly favorites: Favorites;
  readonly modules: ReadonlySet<ModuleName>;
  readonly placement: Placement;
  readonly show: Show;
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
  const favorites = await get(PATHS.favorites, DEFAULT_FAVORITES);
  const modules = new Set<ModuleName>();
  for (const name of MODULE_NAMES) if ((await get(PATHS.module(name), true)) !== false) modules.add(name);
  const placement = await get(PATHS.placement, "auto");
  const show = await get(PATHS.show, "mobile");
  return {
    favorites: favoritesOf(favorites),
    modules,
    placement: PLACEMENTS.includes(placement as Placement) ? (placement as Placement) : "auto",
    show: SHOWS.includes(show as Show) ? (show as Show) : "mobile",
  };
}

/** The key as configured (the command's: SilverBullet takes it as the library page defines the command) */
export async function readShortcut(bridge: Bridge): Promise<string> {
  try {
    const key = await bridge.getConfig?.(PATHS.shortcut, DEFAULT_SHORTCUT);
    return typeof key === "string" && key.trim() ? key : DEFAULT_SHORTCUT;
  } catch {
    return DEFAULT_SHORTCUT;
  }
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
