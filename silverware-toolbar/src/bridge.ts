// The SilverBullet API Silverware Toolbar uses, handed over by the library
// page's Space Lua (`editor.*` and `config.get`), so no SilverBullet internals
// are needed.
import { DEFAULT_FAVORITES, DEFAULT_TOUCH_FAVORITES, favoriteItemOf, type FavoriteItem, type Favorites } from "./core/favorites.ts";

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
  // Optional, for actions that open a page: editor.navigate
  readonly navigate?: (page: string) => unknown;
  // Optional: one of SilverBullet's UI options (editor.getUiOption: `keyboardBar`, its bar over the on-screen keyboard)
  readonly getUiOption?: (key: string) => unknown;
};

export type Selection = { readonly from: number; readonly to: number; readonly text: string };

/** The bridge's functions it cannot work without, missing from what the library page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getSelection", "setSelection", "replaceRange", "getText", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}

/** The modules: the parts that can be turned off with `silverware.toolbar.modules.<name>.enabled` (default on) */
export const MODULE_NAMES = ["inline", "blocks", "clear", "commands", "keyboard", "gestures", "snippets", "emoji"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/** A module's name and what it does, as the settings dialog shows them (the library page's config.define says the same) */
export const MODULE_LABELS: Readonly<Record<ModuleName, string>> = { inline: "Inline formats", blocks: "Turn into", clear: "Clear formatting", commands: "Commands", keyboard: "Hide the keyboard", gestures: "Gestures", snippets: "Snippets", emoji: "Emoji" };
export const MODULE_DESCRIPTIONS: Readonly<Record<ModuleName, string>> = {
  inline: "Bold, italic, strikethrough, highlight, code, links and wiki links.",
  blocks: "Turn lines into a paragraph, a heading, a list, a task or a quote.",
  clear: "Remove the inline formats of the selection.",
  commands: "Every SilverBullet command, found by typing its name in the list of every action, and as a favourite.",
  keyboard: "On a phone or tablet: an action hiding the on-screen keyboard, the selection kept as it is (to see more of the page while you format it).",
  gestures: "A gesture button among the favourites: two actions in one, a click runs the first, swiping it up the second.",
  emoji: "An action picking an emoji to write at the cursor, found by its name and keywords.",
  snippets: "A text snippet among the favourites: a button of your own character (an emoji too) and label writing your text at the cursor, {s} in it the text selected, {c} where the cursor goes.",
};

// The key of the command showing every action (the library page gives it to the command: SilverBullet handles it)
export const DEFAULT_SHORTCUT = "Ctrl-Shift-q";

/** A device as the settings tell them apart: worked by a finger (`byTouch` in core/favorites.ts) or not */
export type Device = "click" | "touch";

/**
 * Where the toolbar shows: by the selection, or docked at the bottom over the
 * on-screen keyboard (on a phone the system's menu of a selection, Cut / Copy /
 * Paste, is where the toolbar would be) or at the top, under SilverBullet's top
 * bar, across its editor
 */
export const PLACEMENTS = ["selection", "bottom", "top"] as const;
export type Placement = (typeof PLACEMENTS)[number];
/** When the toolbar shows: always while the page's text is edited (docked, or by the caret), or only after a selection */
export const SHOWS = ["always", "selection"] as const;
export type Show = (typeof SHOWS)[number];
export const SHOW_LABELS: Readonly<Record<Show, string>> = { always: "While writing", selection: "After selecting text" };

export const PLACEMENT_LABELS: Readonly<Record<Placement, string>> = { selection: "By the selection", bottom: "Docked at the bottom", top: "Docked at the top" };

// By touch docked at the bottom while writing (a phone's own menu of the selection is by it), else by the selection after one
export const DEFAULT_PLACEMENT: Readonly<Record<Device, Placement>> = { click: "selection", touch: "bottom" };
export const DEFAULT_SHOW: Readonly<Record<Device, Show>> = { click: "selection", touch: "always" };

// The toolbar's own block of the CONFIG page, for tables (the favourites): the Configuration Manager's block
// would lose them on its next save (shared/configpage.ts)
export const OWN_MARKER = "-- managed-by: silverware-toolbar";

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  favorites: "silverware.toolbar.favorites",
  // For a device worked by a finger (byTouch in core/favorites.ts); not set: the same as the favourites
  touchFavorites: "silverware.toolbar.favorites-touch",
  // Off: touch shows the favourites, its own kept for when it is on again
  touchOn: "silverware.toolbar.favorites-touch-enabled",
  shortcut: "silverware.toolbar.shortcut",
  placement: "silverware.toolbar.placement",
  placementTouch: "silverware.toolbar.placement-touch",
  show: "silverware.toolbar.show",
  showTouch: "silverware.toolbar.show-touch",
  wordAtCaret: "silverware.toolbar.wordAtCaret",
  module: (name: ModuleName) => `silverware.toolbar.modules.${name}.enabled`,
} as const;

/** Silverware Toolbar's settings, read once it starts (a change applies on reload) */
export type Settings = {
  readonly favorites: Favorites;
  // For a device worked by a finger (the defaults for touch where not set); undefined: the favourites there too
  readonly touchFavorites: Favorites | undefined;
  // Whether touch's own show (they are kept while off)
  readonly touchOn: boolean;
  readonly modules: ReadonlySet<ModuleName>;
  // Each device's own
  readonly placement: Readonly<Record<Device, Placement>>;
  readonly show: Readonly<Record<Device, Show>>;
  // A caret touching a word stands for the word, as if selected (inline formats, Clear formatting)
  readonly wordAtCaret: boolean;
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
  // Not set: undefined (config.define gives them no default, so SilverBullet copies none in)
  const favorites = await get(PATHS.favorites, undefined);
  const touch = await get(PATHS.touchFavorites, undefined);
  const touchOn = await get(PATHS.touchOn, undefined);
  const modules = new Set<ModuleName>();
  for (const name of MODULE_NAMES) if ((await get(PATHS.module(name), true)) !== false) modules.add(name);
  // A space's own: set
  const ownFavorites = favorites != null;
  const ownTouch = touch != null;
  // Each its device's default where it is none of the values (as before: auto, mobile)
  const one = async <T extends string>(path: string, values: readonly T[], fallback: T): Promise<T> => {
    const value = await get(path, fallback);
    return values.includes(value as T) ? (value as T) : fallback;
  };
  return {
    favorites: ownFavorites ? favoritesOf(favorites) : DEFAULT_FAVORITES,
    // Not set: the defaults for touch, gesture buttons, so without the Gestures module none (Click's show)
    touchFavorites: ownTouch ? rowsOf(touch) : modules.has("gestures") ? DEFAULT_TOUCH_FAVORITES : undefined,
    // Not set: on, unless the favourites are a space's own and those for touch are not (its own show by finger too,
    // as before there were favourites for touch); the settings dialog writes it with the favourites, so editing
    // them does not change it
    touchOn: touchOn == null ? !(ownFavorites && !ownTouch) : touchOn !== false,
    modules,
    placement: { click: await one(PATHS.placement, PLACEMENTS, DEFAULT_PLACEMENT.click), touch: await one(PATHS.placementTouch, PLACEMENTS, DEFAULT_PLACEMENT.touch) },
    show: { click: await one(PATHS.show, SHOWS, DEFAULT_SHOW.click), touch: await one(PATHS.showTouch, SHOWS, DEFAULT_SHOW.touch) },
    wordAtCaret: (await get(PATHS.wordAtCaret, true)) !== false,
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
  return rowsOf(value) ?? DEFAULT_FAVORITES;
}

/** Rows of favourites as configured, an item that is none left out (logged); not rows at all: undefined */
function rowsOf(value: unknown): Favorites | undefined {
  const rows = listOf(value)?.map(listOf);
  if (!rows || rows.some((row) => !row)) return undefined;
  return rows.map((items) => {
    return items!.flatMap((item): FavoriteItem[] => {
      const favorite = favoriteItemOf(item);
      if (!favorite) console.warn('Silverware Toolbar: a favourite is not { id = …, show = … }, { type = "separator" } nor { type = <a kind>, … }:', item);
      return favorite ? [favorite] : [];
    });
  });
}
