// A width as Silverware Layout keeps it: an amount in pixels or in percent of the editor's pane. Read from what a page's
// frontmatter or a setting holds (`1100`, `"1100px"`, `"90%"`), written back in the form each keeps, given to CSS.
// Pure: what reads and writes pages and settings is the host's.

export type WidthUnit = "px" | "%";

export type Width = { readonly amount: number; readonly unit: WidthUnit };

/** The widths a text may have: narrower is no column of text, wider no screen */
export const TEXT_WIDTH_LIMITS: Readonly<Record<WidthUnit, { readonly min: number; readonly max: number }>> = {
  px: { min: 300, max: 10000 },
  "%": { min: 20, max: 100 },
};

const WIDTH_RE = /^(\d+(?:\.\d+)?)\s*(px|%)?$/;

/**
 * A width as a page or a setting holds it: a number (pixels), or text of a number with `px` or `%` after it (`1100`,
 * `"1100px"`, `"90 %"`); undefined for anything else (nothing, an empty text, a word)
 */
export function readWidth(value: unknown): Width | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? { amount: value, unit: "px" } : undefined;
  if (typeof value !== "string") return undefined;
  const match = WIDTH_RE.exec(value.trim());
  if (!match) return undefined;
  return { amount: Number(match[1]), unit: (match[2] as WidthUnit | undefined) ?? "px" };
}

/**
 * A text's width as a page or a setting holds it: as `readWidth` reads it, and within TEXT_WIDTH_LIMITS (a width typed
 * by hand into a frontmatter, `0` or `5`, would collapse the text: none then, the default's or the theme's)
 */
export function readTextWidth(value: unknown): Width | undefined {
  const width = readWidth(value);
  return width && !validateTextWidth(width) ? width : undefined;
}

/** Why a width cannot be a text's, as text, undefined where it can */
export function validateTextWidth(width: Width): string | undefined {
  const { min, max } = TEXT_WIDTH_LIMITS[width.unit];
  if (!Number.isFinite(width.amount) || width.amount < min || width.amount > max) return `A text's width is ${min} to ${max} ${width.unit === "px" ? "px" : "%"}`;
  return undefined;
}

/** The width as CSS takes it (`1100px`, `90%`) */
export const cssWidth = (width: Width): string => `${width.amount}${width.unit}`;

/** The width as a page's frontmatter keeps it: pixels a number (`width: 1100`), percent text (`width: "90%"`) */
export const storedWidth = (width: Width): number | string => (width.unit === "px" ? width.amount : cssWidth(width));

/** Whether two widths are the same (none and none too) */
export const sameWidth = (a: Width | undefined, b: Width | undefined): boolean => a === b || (!!a && !!b && a.amount === b.amount && a.unit === b.unit);
