// Silverware Layout's settings (SilverBullet's configuration, `silverware.layout.*`, the init page's config.define):
// where each is, its default, and how a value as configured is read. Pure: the host reads the configuration.
import { readTextWidth, readWidth, type Width, type WidthUnit } from "./width.ts";

/** Where each setting is in SilverBullet's configuration */
export const PATHS = {
  textWidth: "silverware.layout.textWidth",
  textAlign: "silverware.layout.textAlign",
  minPaneWidth: "silverware.layout.minPaneWidth",
  guides: "silverware.layout.guides",
  alignments: "silverware.layout.alignments",
  fontSize: "silverware.layout.fontSize",
  fontZoom: "silverware.layout.fontZoom.enabled",
  fontPinch: "silverware.layout.fontZoom.pinch",
  fontScaleFiles: "silverware.layout.fontZoom.scaleFiles",
  syntaxHides: "silverware.layout.syntaxMode.hideGrids",
  linkClicks: "silverware.layout.links.clickPlacesCursor",
} as const;

/**
 * How the page's markdown is met (the settings dialog's Markdown tab): while SilverBullet shows the markdown as
 * written (Editor: Toggle Markdown Syntax Rendering), its grids hidden (SilverBullet draws them there still), their
 * markdown alone shown; a click on a link shown as its markdown (the caret in it, or all of them in that mode) placing
 * the cursor alone, Ctrl+click following it. Each on unless the user turns it off
 */
export type SyntaxModeSettings = { readonly hideGrids: boolean; readonly clickPlacesCursor: boolean };

/** The settings of the page's markdown, as configured (anything but false: on) */
export const readSyntaxModeSettings = (get: (path: string) => unknown): SyntaxModeSettings => ({
  hideGrids: get(PATHS.syntaxHides) !== false,
  clickPlacesCursor: get(PATHS.linkClicks) !== false,
});

/** A percent of the editor's pane, as a guide or a widget's width keeps it (`80%`) */
export type Percent = `${number}%`;

/** A guide: a width a drag snaps to and shows a line at: pixels, a percent of the editor's pane, or `full` (the pane) */
export type Guide = number | Percent | "full";

/** Where a widget stands: at the left, centred, at the right (the contract's `LayoutAlign`, shared/layout.ts) */
export type Align = "left" | "center" | "right";
export const ALIGNS: readonly Align[] = ["left", "center", "right"];
export const ALIGN_NAMES: Readonly<Record<Align, string>> = { left: "Left", center: "Center", right: "Right" };

/** An alignment as kept: left, center or right; anything else none */
export const readAlign = (value: unknown): Align | undefined => (ALIGNS.includes(value as Align) ? (value as Align) : undefined);

/**
 * Where the page's text stands in its pane (docs/silverware-layout-text-align.md): centred (the host's own), at the
 * left, or centred and at the left while a side panel is open (a panel lying over the page's right, marked so:
 * shared/sidepanel.ts)
 */
export type TextAlign = "center" | "left" | "left-with-panel";
export const TEXT_ALIGNS: readonly TextAlign[] = ["center", "left", "left-with-panel"];
export const TEXT_ALIGN_NAMES: Readonly<Record<TextAlign, string>> = { center: "Centred", left: "Left", "left-with-panel": "Left while a panel is open" };

/** The text's alignment as kept (a page's `_layout.align`, the setting); anything else none */
export const readTextAlign = (value: unknown): TextAlign | undefined => (TEXT_ALIGNS.includes(value as TextAlign) ? (value as TextAlign) : undefined);

export type Settings = {
  // The text's width on a page without its own; none: the theme's
  readonly textWidth: Width | undefined;
  // Where the text of a page without its own stands; none: centred
  readonly textAlign: TextAlign | undefined;
  // Narrower than this (px), the pane gets no layout of Silverware Layout's
  readonly minPaneWidth: number;
  readonly guides: readonly Guide[];
  // The editor's font size on every page (px); none: the theme's
  readonly fontSize: number | undefined;
  // Whether Ctrl + scroll and Ctrl+0 change the font size on this device (docs/silverware-layout-font-size.md)
  readonly fontZoom: boolean;
  // Whether a pinch with two fingers changes it too, the host's own two-finger gesture held back for it, a tap with two
  // fingers given back to it (on unless turned off)
  readonly fontPinch: boolean;
  // Whether the files a page shows (and the widths laid out of those that say so) grow and shrink with this device's
  // zoom, as the text does (shared/contentscale.ts; on unless turned off)
  readonly fontScaleFiles: boolean;
  // Where each kind of widget stands where it says nothing itself, the user's (by `<provider>/<kind>`; none: the kind's
  // own; docs/silverware-layout-align.md)
  readonly alignments: Readonly<Record<string, Align>>;
};

export const DEFAULT_MIN_PANE_WIDTH = 600;

export const DEFAULT_GUIDES: readonly Guide[] = [900, 1200, "full"];

/** The widths a guide may have: narrower is no widget, wider no screen (px); a share of the pane up to it whole (%) */
export const GUIDE_LIMITS: Readonly<Record<WidthUnit, { readonly min: number; readonly max: number }>> = {
  px: { min: 200, max: 10000 },
  "%": { min: 10, max: 100 },
};

/** A guide's percent of the pane; none for pixels or full */
export const percentOf = (guide: Guide): number | undefined => (typeof guide === "string" && guide !== "full" ? parseFloat(guide) : undefined);

/** A guide of an amount in a unit (`1200`, `80%`) */
export const guideOf = (amount: number, unit: WidthUnit): Guide => (unit === "%" ? `${amount}%` : amount);

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

/** A guide as it is named where it shows (`1200 px`, `80 %`, `Full width`) */
export const guideName = (guide: Guide): string => (guide === "full" ? "Full width" : typeof guide === "string" ? `${percentOf(guide)} %` : `${guide} px`);

/** Why a number in a unit cannot be a guide, as text, undefined where it can */
export function validateGuide(amount: number, unit: WidthUnit = "px"): string | undefined {
  const { min, max } = GUIDE_LIMITS[unit];
  if (!Number.isInteger(amount) || amount < min || amount > max) return `A guide is a whole number of ${min} to ${max} ${unit === "px" ? "px" : "%"}`;
  return undefined;
}

/** The settings as configured (each value as SilverBullet's config.get gives it), a value not read taking its default */
export function readSettings(get: (path: string) => unknown): Settings {
  const pane = get(PATHS.minPaneWidth);
  return {
    textWidth: readTextWidth(get(PATHS.textWidth)),
    textAlign: readTextAlign(get(PATHS.textAlign)),
    minPaneWidth: typeof pane === "number" && Number.isFinite(pane) && pane >= 0 ? pane : DEFAULT_MIN_PANE_WIDTH,
    guides: readGuides(get(PATHS.guides)) ?? DEFAULT_GUIDES,
    fontSize: readFontSize(get(PATHS.fontSize)),
    fontZoom: get(PATHS.fontZoom) !== false,
    fontPinch: get(PATHS.fontPinch) !== false,
    fontScaleFiles: get(PATHS.fontScaleFiles) !== false,
    alignments: readAlignments(get(PATHS.alignments)),
  };
}

/** The kinds' alignments as configured: each a kind's key and left, center or right; anything else left out */
export function readAlignments(value: unknown): Readonly<Record<string, Align>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const alignments: Record<string, Align> = {};
  for (const [kind, value_] of Object.entries(value)) {
    const align = readAlign(value_);
    if (align) alignments[kind] = align;
  }
  return alignments;
}

/**
 * The guides as configured: a list of widths in px (`1200`, `"1200px"`), in % of the pane (`"80%"`) or `full`, each
 * once; one not read left out. Undefined where nothing is configured (the defaults then). A list from Lua may arrive
 * as an object of 1, 2, …
 */
function readGuides(value: unknown): readonly Guide[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : typeof value === "object" ? Object.values(value) : [];
  const guides: Guide[] = [];
  for (const item of list) {
    const guide: Guide | undefined = item === "full" ? "full" : readGuide(item);
    if (guide !== undefined && !guides.includes(guide)) guides.push(guide);
  }
  return guides;
}

const readGuide = (value: unknown): Guide | undefined => {
  const width = readWidth(value);
  return width && !validateGuide(width.amount, width.unit) ? guideOf(width.amount, width.unit) : undefined;
};

/** The guides as the configuration keeps them (`{ "900px", "80%", "full" }`) */
export const keptGuides = (guides: readonly Guide[]): string[] => guides.map((guide) => (typeof guide === "number" ? `${guide}px` : guide));
