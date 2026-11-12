// Silverware Layout's settings (SilverBullet's configuration, `silverware.layout.*`, the init page's config.define):
// where each is, its default, and how a value as configured is read. Pure: the host reads the configuration.
import { readWidth, type Width } from "./width.ts";

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  textWidth: "silverware.layout.textWidth",
  minPaneWidth: "silverware.layout.minPaneWidth",
  presets: "silverware.layout.presets",
} as const;

/** A preset: a width a widget is set to in one click, named; `full` the editor's pane */
export type Preset = { readonly name: string; readonly width: Width | "full" };

export type Settings = {
  // The text's width on a page without its own; none: the theme's
  readonly textWidth: Width | undefined;
  // Narrower than this (px), the pane gets no layout of Silverware Layout's
  readonly minPaneWidth: number;
  readonly presets: readonly Preset[];
};

export const DEFAULT_MIN_PANE_WIDTH = 600;

export const DEFAULT_PRESETS: readonly Preset[] = [
  { name: "Wide", width: { amount: 1200, unit: "px" } },
  { name: "Full width", width: "full" },
];

/** The settings as configured (each value as SilverBullet's config.get gives it), a value not read taking its default */
export function readSettings(get: (path: string) => unknown): Settings {
  const pane = get(PATHS.minPaneWidth);
  return {
    textWidth: readWidth(get(PATHS.textWidth)),
    minPaneWidth: typeof pane === "number" && Number.isFinite(pane) && pane >= 0 ? pane : DEFAULT_MIN_PANE_WIDTH,
    presets: readPresets(get(PATHS.presets)) ?? DEFAULT_PRESETS,
  };
}

/**
 * The presets as configured: a list of `{ name, width }`, a width as a text's (`1200px`, `90%`) or `full`; a preset
 * not read left out. Undefined where nothing is configured (the defaults then). A list from Lua may arrive as an object
 * of 1, 2, …
 */
function readPresets(value: unknown): readonly Preset[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : typeof value === "object" ? Object.values(value) : [];
  return list.flatMap((item): Preset[] => {
    if (!item || typeof item !== "object") return [];
    const { name, width } = item as { name?: unknown; width?: unknown };
    if (typeof name !== "string" || !name.trim()) return [];
    if (width === "full") return [{ name: name.trim(), width: "full" }];
    const read = readWidth(width);
    return read ? [{ name: name.trim(), width: read }] : [];
  });
}
