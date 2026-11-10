// The SilverBullet API Silverware Toolbar uses, handed over by the library
// page's Space Lua (`editor.*` and `config.get`), so no SilverBullet internals
// are needed.
import { favoriteItemOf, type FavoriteItem, type Favorites } from "./core/favorites.ts";
import { defaultToolbars, type Toolbar, type Input, INPUTS, MAX_TOOLBARS, normalizedToolbars, type Placement, PLACEMENTS, type Show, SHOWS, validateToolbarName } from "./core/toolbars.ts";
import { listOf } from "./lists.ts";
import { migrate, VERSION_PATH } from "./migrations/index.ts";

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
  // Optional, for the slash module: the editor's completion started at the caret (editor.startCompletion)
  readonly startCompletion?: () => unknown;
  // Optional: one of SilverBullet's UI options (editor.getUiOption: `keyboardBar`, its bar over the on-screen keyboard)
  readonly getUiOption?: (key: string) => unknown;
};

export type Selection = { readonly from: number; readonly to: number; readonly text: string };

/** The bridge's functions it cannot work without, missing from what the init page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getSelection", "setSelection", "replaceRange", "getText", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}

/** The modules: the parts that can be turned off with `silverware.toolbar.modules.<name>.enabled` (default on) */
export const MODULE_NAMES = ["inline", "blocks", "clear", "commands", "slash", "keyboard", "gestures", "snippets", "emoji"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/** A module's name and what it does, as the settings dialog shows them (the init page's config.define says the same) */
export const MODULE_LABELS: Readonly<Record<ModuleName, string>> = { inline: "Inline formats", blocks: "Turn into", clear: "Clear formatting", commands: "Commands", slash: "Slash commands", keyboard: "Hide the keyboard", gestures: "Gestures", snippets: "Snippets", emoji: "Emoji" };
export const MODULE_DESCRIPTIONS: Readonly<Record<ModuleName, string>> = {
  inline: "Bold, italic, strikethrough, highlight, code, links and wiki links.",
  blocks: "Turn lines into a paragraph, a heading, a list, a task or a quote.",
  clear: "Remove the inline formats of the selection.",
  commands: "Every SilverBullet command, found by typing its name in the list of every action, and as a favourite.",
  slash: "An action opening SilverBullet's slash commands at the cursor, as typing / does (a phone's keyboard has / a page away).",
  keyboard: "On a phone or tablet: an action hiding the on-screen keyboard, the selection kept as it is (to see more of the page while you format it).",
  gestures: "A gesture button among the favourites: two actions in one, a click runs the first, swiping it up the second.",
  emoji: "An action picking an emoji to write at the cursor, found by its name and keywords.",
  snippets: "A text snippet among the favourites: a button of your own character (an emoji too) and label writing your text at the cursor, {s} in it the text selected, {c} where the cursor goes.",
};

// The key of the command showing every action (the init page gives it to the command: SilverBullet handles it)
export const DEFAULT_SHORTCUT = "Ctrl-Shift-q";

/** A device as the settings tell them apart: worked by a finger (`byTouch` in core/favorites.ts) or not */
export type Device = Input;

export { type Placement, PLACEMENTS, type Show, SHOWS } from "./core/toolbars.ts";
export const SHOW_LABELS: Readonly<Record<Show, string>> = { always: "Always", writing: "While writing", selection: "After selecting text" };
export const PLACEMENT_LABELS: Readonly<Record<Placement, string>> = { selection: "By the selection", bottom: "Docked at the bottom", top: "Docked at the top" };

// The toolbar's own block of the CONFIG page, for tables (the favourites): the Configuration Manager's block
// would lose them on its next save (shared/configpage.ts)
export const OWN_MARKER = "-- managed-by: silverware-toolbar";

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  // The toolbars (core/toolbars.ts): each its rows, where and when it shows, what it is used for
  favorites: "silverware.toolbar.favorites",
  shortcut: "silverware.toolbar.shortcut",
  wordAtCaret: "silverware.toolbar.wordAtCaret",
  // The settings' model's version (migrations/index.ts)
  version: VERSION_PATH,
  module: (name: ModuleName) => `silverware.toolbar.modules.${name}.enabled`,
} as const;

/** Silverware Toolbar's settings, read once it starts (a change applies on reload) */
export type Settings = {
  // The toolbars, every way of working one used by one (normalized: core/toolbars.ts)
  readonly toolbars: readonly Toolbar[];
  readonly modules: ReadonlySet<ModuleName>;
  // A caret touching a word stands for the word, as if selected (inline formats, Clear formatting)
  readonly wordAtCaret: boolean;
  // What the migrations changed of the settings as configured (read so already), by path, the version among them,
  // to be written back; empty: nothing (migrations/index.ts)
  readonly migrated: Readonly<Record<string, unknown>>;
};

/** The settings as configured, each its default where it is not set or not valid */
export async function readSettings(bridge: Bridge): Promise<Settings> {
  const configured = async (path: string, fallback: unknown) => {
    try {
      return await bridge.getConfig?.(path, fallback);
    } catch {
      return fallback;
    }
  };
  // Read as the model is now: what an older one set migrated (not written back here: the caller writes `migrated`)
  const migrated = await migrate((path) => configured(path, undefined));
  const get = async (path: string, fallback: unknown) => (path in migrated ? (migrated[path] ?? fallback) : configured(path, fallback));
  // Not set: undefined (config.define gives them no default, so SilverBullet copies none in)
  const favorites = await get(PATHS.favorites, undefined);
  const modules = new Set<ModuleName>();
  for (const name of MODULE_NAMES) if ((await get(PATHS.module(name), true)) !== false) modules.add(name);
  return {
    // Not set or none valid: the defaults (without the Gestures module, the one by the selection for both)
    toolbars: toolbarsOf(favorites) ?? defaultToolbars(modules.has("gestures")),
    modules,
    wordAtCaret: (await get(PATHS.wordAtCaret, true)) !== false,
    migrated,
  };
}

/** The key as configured (the command's: SilverBullet takes it as the init page defines the command) */
export async function readShortcut(bridge: Bridge): Promise<string> {
  try {
    const key = await bridge.getConfig?.(PATHS.shortcut, DEFAULT_SHORTCUT);
    return typeof key === "string" && key.trim() ? key : DEFAULT_SHORTCUT;
  } catch {
    return DEFAULT_SHORTCUT;
  }
}

/**
 * The toolbars as configured (`{ name, useFor, placement, show, rows }`, `useFor` a list of "click" and "touch",
 * left out: used for none; `placement` and `show` not set or unknown: by the selection, after selecting text),
 * normalized: one that is none, a name taken already or more than MAX_TOOLBARS left out (logged), an unknown way of
 * working left out; undefined where none is left (the defaults then)
 */
export function toolbarsOf(value: unknown): Toolbar[] | undefined {
  const lists: Toolbar[] = [];
  for (const entry of listOf(value) ?? []) {
    const { name, useFor, placement, show, rows } = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const favorites = rowsOf(rows);
    const inputs = useFor === undefined ? [] : listOf(useFor);
    if (typeof name !== "string" || !favorites || !inputs || validateToolbarName(name, lists) || lists.length >= MAX_TOOLBARS) {
      console.warn("Silverware Toolbar: a list of favourites is not { name = …, useFor = { … }, rows = { … } } (or its name is taken, or there are more than 5):", entry);
      continue;
    }
    lists.push({
      name: name.trim(),
      useFor: INPUTS.filter((input) => inputs.includes(input)),
      placement: PLACEMENTS.includes(placement as Placement) ? (placement as Placement) : "selection",
      show: SHOWS.includes(show as Show) ? (show as Show) : "selection",
      rows: favorites,
    });
  }
  return lists.length ? normalizedToolbars(lists) : undefined;
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
