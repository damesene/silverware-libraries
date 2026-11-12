// Silverware Layout's settings (SilverBullet's configuration, `silverware.layout.*`, the init page's config.define):
// where each is, its default, and how a value as configured is read. Pure: the host reads the configuration.
import { readWidth, type Width } from "./width.ts";

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  textWidth: "silverware.layout.textWidth",
  minPaneWidth: "silverware.layout.minPaneWidth",
  guides: "silverware.layout.guides",
  fontSize: "silverware.layout.fontSize",
  fontZoom: "silverware.layout.fontZoom.enabled",
} as const;

/** A guide: a width a drag snaps to and shows a line at, in pixels, or `full` (the editor's pane) */
export type Guide = number | "full";

export type Settings = {
  // The text's width on a page without its own; none: the theme's
  readonly textWidth: Width | undefined;
  // Narrower than this (px), the pane gets no layout of Silverware Layout's
  readonly minPaneWidth: number;
  readonly guides: readonly Guide[];
  // The editor's font size on every page (px); none: the theme's
  readonly fontSize: number | undefined;
  // Whether Ctrl + scroll and Ctrl+0 change the font size on this device (docs/silverware-layout-font-size.md)
  readonly fontZoom: boolean;
};

export const DEFAULT_MIN_PANE_WIDTH = 600;

export const DEFAULT_GUIDES: readonly Guide[] = [900, 1200, "full"];

/** The widths a guide may have (px): narrower is no widget, wider no screen */
export const GUIDE_LIMITS = { min: 200, max: 10000 } as const;

/** The font sizes Silverware Layout sets (px), from the setting or a zoom */
export const FONT_SIZE_LIMITS = { min: 5, max: 40 } as const;

/** Why a number cannot be a font size, as text, undefined where it can */
export function validateFontSize(size: number): string | undefined {
  if (!Number.isInteger(size) || size < FONT_SIZE_LIMITS.min || size > FONT_SIZE_LIMITS.max) return `A font size is a whole number of ${FONT_SIZE_LIMITS.min} to ${FONT_SIZE_LIMITS.max} px`;
  return undefined;
}

/** A font size as configured or kept (`18`, `"18px"`, `"18"`); none where it is not one */
export function readFontSize(value: unknown): number | undefined {
  const size = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim().replace(/px$/i, "")) : NaN;
  return typeof value === "string" && !value.trim() ? undefined : validateFontSize(size) ? undefined : size;
}

/** A guide as it is named where it shows (`1200 px`, `Full width`) */
export const guideName = (guide: Guide): string => (guide === "full" ? "Full width" : `${guide} px`);

/** Why a number cannot be a guide, as text, undefined where it can */
export function validateGuide(width: number): string | undefined {
  if (!Number.isInteger(width) || width < GUIDE_LIMITS.min || width > GUIDE_LIMITS.max) return `A guide is a whole number of ${GUIDE_LIMITS.min} to ${GUIDE_LIMITS.max} px`;
  return undefined;
}

/** The settings as configured (each value as SilverBullet's config.get gives it), a value not read taking its default */
export function readSettings(get: (path: string) => unknown): Settings {
  const pane = get(PATHS.minPaneWidth);
  return {
    textWidth: readWidth(get(PATHS.textWidth)),
    minPaneWidth: typeof pane === "number" && Number.isFinite(pane) && pane >= 0 ? pane : DEFAULT_MIN_PANE_WIDTH,
    guides: readGuides(get(PATHS.guides)) ?? DEFAULT_GUIDES,
    fontSize: readFontSize(get(PATHS.fontSize)),
    fontZoom: get(PATHS.fontZoom) !== false,
  };
}

/**
 * The guides as configured: a list of widths in px (`1200`, `"1200px"`) or `full`, each once; one not read left out.
 * Undefined where nothing is configured (the defaults then). A list from Lua may arrive as an object of 1, 2, …
 */
function readGuides(value: unknown): readonly Guide[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : typeof value === "object" ? Object.values(value) : [];
  const guides: Guide[] = [];
  for (const item of list) {
    const guide: Guide | undefined = item === "full" ? "full" : pixelsOf(item);
    if (guide !== undefined && !guides.includes(guide)) guides.push(guide);
  }
  return guides;
}

const pixelsOf = (value: unknown): number | undefined => {
  const width = readWidth(value);
  return width?.unit === "px" && !validateGuide(width.amount) ? width.amount : undefined;
};

/** The guides as the configuration keeps them (`{ "900px", "1200px", "full" }`) */
export const keptGuides = (guides: readonly Guide[]): string[] => guides.map((guide) => (guide === "full" ? "full" : `${guide}px`));
