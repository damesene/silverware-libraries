// Toolbars: what shows is one toolbar's rows (core/favorites.ts), where (`placement`: by the selection, docked at
// the bottom or the top) and when (`show`), the toolbar a way of working it uses (`useFor`: "click" with a mouse or
// a touchpad, "touch" by finger: `byTouch`). A toolbar is stored by its name, whatever it is used for, or for none
// (kept to switch to); every way of working has exactly one, so a toolbar for both, one of one, none of none.
// Decided with the user on 2026-11-10: rows, where and when are a toolbar's, not a device's, as a toolbar docked
// and one by the selection want rows of their own (one line docked, several by the selection): switching where a
// device's toolbar shows is giving it another toolbar.

import { byTouch, DEFAULT_FAVORITES, DEFAULT_TOUCH_FAVORITES, type Favorites } from "./favorites.ts";

/**
 * Where a toolbar shows: by the selection, or docked at the bottom over the
 * on-screen keyboard (on a phone the system's menu of a selection, Cut / Copy /
 * Paste, is where the toolbar would be) or at the top, under SilverBullet's top
 * bar, across its editor
 */
export const PLACEMENTS = ["selection", "bottom", "top"] as const;
export type Placement = (typeof PLACEMENTS)[number];
/**
 * When a toolbar shows: always, the page's text edited or not (docked, or by
 * the caret); while the page's text is edited; or only after a selection
 */
export const SHOWS = ["always", "writing", "selection"] as const;
export type ShowWhen = (typeof SHOWS)[number];

/** Whether a toolbar shown there is docked (its rows lines, its pinned items at their ends) */
export const docks = (placement: Placement): boolean => placement !== "selection";

/** The ways of working a toolbar is used for (later perhaps a pen's) */
export const INPUTS = ["click", "touch"] as const;
export type Input = (typeof INPUTS)[number];

/** The way this device is worked: by a finger (`byTouch`), else a mouse or a touchpad */
export const inputOf = (win: Window | null | undefined): Input => (byTouch(win) ? "touch" : "click");

export type Toolbar = { readonly name: string; readonly useFor: readonly Input[]; readonly placement: Placement; readonly show: ShowWhen; readonly rows: Favorites };

// As many toolbars at most: more is more to choose from than to tell apart
export const MAX_TOOLBARS = 5;

/**
 * The toolbars where none are configured: Float, by the selection after one (a mouse's: several rows), and Docked,
 * at the bottom always (a finger's: one line of gesture buttons; there a phone's own menu of the selection is
 * by it); without the Gestures module Docked shows none of them, so Float is for both
 */
export function defaultToolbars(gestures = true): readonly Toolbar[] {
  return [
    { name: "Float", useFor: gestures ? ["click"] : ["click", "touch"], placement: "selection", show: "selection", rows: DEFAULT_FAVORITES },
    { name: "Docked", useFor: gestures ? ["touch"] : [], placement: "bottom", show: "always", rows: DEFAULT_TOUCH_FAVORITES },
  ];
}

/** The toolbar a way of working the toolbar uses (normalized toolbars have one for each: `normalizedToolbars`) */
export function toolbarFor(toolbars: readonly Toolbar[], input: Input): Toolbar {
  // (None: the defaults' first, as reading the settings gives one at least)
  return toolbars.find((toolbar) => toolbar.useFor.includes(input)) ?? toolbars[0] ?? defaultToolbars()[0]!;
}

/**
 * Lists every way of working the toolbar has exactly one of: the first that says it is used for one keeps it (the
 * others' left out), one no toolbar is used for given to the first
 */
export function normalizedToolbars(toolbars: readonly Toolbar[]): Toolbar[] {
  const claimed = new Set<Input>();
  const out = toolbars.map((toolbar) => {
    const useFor = INPUTS.filter((input) => toolbar.useFor.includes(input) && !claimed.has(input));
    for (const input of useFor) claimed.add(input);
    return { ...toolbar, useFor };
  });
  const unclaimed = INPUTS.filter((input) => !claimed.has(input));
  if (unclaimed.length && out[0]) out[0] = { ...out[0], useFor: INPUTS.filter((input) => out[0]!.useFor.includes(input) || unclaimed.includes(input)) };
  return out;
}

/** A toolbar used for a way of working, which the one using it before is no longer */
export function useToolbarFor(toolbars: readonly Toolbar[], index: number, input: Input): Toolbar[] {
  return toolbars.map((toolbar, i) => {
    const useFor = INPUTS.filter((one) => (one === input ? i === index : toolbar.useFor.includes(one)));
    return useFor.length === toolbar.useFor.length && useFor.every((one, j) => one === toolbar.useFor[j]) ? toolbar : { ...toolbar, useFor };
  });
}

/** The toolbars as written to the configuration: `{ name, useFor, placement, show, rows }`, `useFor` left out where empty, empty rows left out */
export function toolbarsSetting(toolbars: readonly Toolbar[]): unknown[] {
  return toolbars.map((toolbar) => ({
    name: toolbar.name,
    ...(toolbar.useFor.length ? { useFor: [...toolbar.useFor] } : {}),
    placement: toolbar.placement,
    show: toolbar.show,
    rows: toolbar.rows.filter((row) => row.length > 0).map((row) => [...row]),
  }));
}

/** Why a name cannot be a toolbar's (empty, another toolbar's, whatever its case); undefined: it can. `except`: the toolbar renamed */
export function validateToolbarName(name: string, toolbars: readonly Toolbar[], except?: number): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "A toolbar needs a name";
  if (toolbars.some((toolbar, i) => i !== except && toolbar.name.trim().toLowerCase() === trimmed.toLowerCase())) return `Another toolbar is named ${trimmed}`;
  return undefined;
}

/** A name no toolbar has: `base`, else `base 2`, `base 3`… */
export function freeToolbarName(toolbars: readonly Toolbar[], base: string): string {
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!validateToolbarName(name, toolbars)) return name;
  }
}
