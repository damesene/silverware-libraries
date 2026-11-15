// A grid's columns as its `columns` attribute gives them (docs/silverware-layout-grid.md, *Layout*): a number of equal
// columns (`3`), their widths (`1fr 2fr`, `30% 70%`, `200px 1fr`), or `auto`: as many equal columns in a row as fit,
// none narrower than its `min` attribute (a gallery); made a CSS grid's column template. Pure.

/** The most columns a grid's menu offers, and a grid of no `columns` has (a column of its own per cell up to it) */
export const MAX_COLUMNS = 8;

/** The `columns` of a grid whose columns are as many as fit, each as wide as the others, none under its `min` */
export const FIT = "auto";

/** Whether a grid's columns are as many as fit (`columns="auto"`): equal, none resized by hand */
export const fitsColumns = (columns: string | undefined): boolean => columns?.trim().toLowerCase() === FIT;

/** The named narrowest widths of a column of a grid of `columns="auto"` (px), its `min` attribute */
export const MIN_WIDTHS = { xs: 100, s: 160, m: 240, l: 360 } as const;
export type MinWidthName = keyof typeof MIN_WIDTHS;
/** A grid of `columns="auto"` without a `min`: its columns at least this wide */
export const DEFAULT_MIN_WIDTH: MinWidthName = "m";
// The narrowest and widest a `min` given in px may be
const MIN_PX = 40;
const MAX_PX = 1200;

/** Whether a text is a min width's name (its own keys alone: never `constructor`, `toString`) */
const isMinWidthName = (text: string): text is MinWidthName => Object.hasOwn(MIN_WIDTHS, text);

/** Why a `min` value cannot be read (a name, xs, s, m or l, or px from 40 to 1200, as `180` or `180px`), as text; undefined where it can */
export function validateMinWidth(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  if (isMinWidthName(text)) return undefined;
  const px = /^(\d+)(px)?$/.exec(text);
  if (!px) return `"${value.trim()}" is no column's width (xs, s, m, l, or px as 180)`;
  const n = Number(px[1]);
  return n >= MIN_PX && n <= MAX_PX ? undefined : `${n} px: from ${MIN_PX} to ${MAX_PX}`;
}

/** A grid's `min` as px (one that cannot be read, or none: the default's) */
export function minWidthOf(min: string | undefined): number {
  const text = min?.trim().toLowerCase() ?? "";
  if (!text || validateMinWidth(text) !== undefined) return MIN_WIDTHS[DEFAULT_MIN_WIDTH];
  return isMinWidthName(text) ? MIN_WIDTHS[text] : parseInt(text, 10);
}

/** A grid's `min` as its menu shows it: a name it is (none: the default's), or its px (`custom`) */
export function minWidthChoice(min: string | undefined): { readonly name: MinWidthName } | { readonly custom: number } {
  const text = min?.trim().toLowerCase() ?? "";
  if (!text || validateMinWidth(text) !== undefined) return { name: DEFAULT_MIN_WIDTH };
  return isMinWidthName(text) ? { name: text } : { custom: parseInt(text, 10) };
}

const TRACK = /^(\d+(\.\d+)?(fr|%|px)|auto)$/;

/** Why a `columns` value cannot be read (a count of 1 to 12, or widths each `<n>fr`, `<n>%`, `<n>px` or `auto`), as text; undefined where it can */
export function validateColumns(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "no columns given";
  if (/^\d+$/.test(text)) {
    const count = Number(text);
    return count >= 1 && count <= 12 ? undefined : `${count} columns: from 1 to 12`;
  }
  const bad = text.split(/\s+/).find((track) => !TRACK.test(track));
  return bad === undefined ? undefined : `"${bad}" is no column's width (as 1fr, 30%, 200px or auto)`;
}

/**
 * The CSS column template of a grid: its `columns` where they can be read (`auto`: as many equal columns as fit, none
 * narrower than `min` nor than the grid, fewer cells than fit sharing the row's whole width, none left empty; a count: that many equal columns; widths: each, a share `fr` never narrower
 * than its content allows to shrink, so a long word does not widen a column); else as many equal columns as cells, at
 * most MAX_COLUMNS, one at least
 */
export function columnTemplate(columns: string | undefined, cells: number, min?: string): string {
  const text = columns?.trim() ?? "";
  if (fitsColumns(text)) return `repeat(auto-fit, minmax(min(${minWidthOf(min)}px, 100%), 1fr))`;
  if (text && validateColumns(text) === undefined) {
    if (/^\d+$/.test(text)) return `repeat(${Number(text)}, minmax(0, 1fr))`;
    return text
      .split(/\s+/)
      .map((track) => (track.endsWith("fr") ? `minmax(0, ${track})` : track))
      .join(" ");
  }
  return `repeat(${columnsWithout(cells)}, minmax(0, 1fr))`;
}

/** How many columns a grid of no `columns` has: one per cell, at most MAX_COLUMNS, one at least */
export const columnsWithout = (cells: number): number => Math.min(Math.max(cells, 1), MAX_COLUMNS);

/** How many equal columns a grid's menu shows it has: its count, or one per cell where it has no `columns`; none for widths or `auto` */
export function columnCount(columns: string | undefined, cells: number): number | undefined {
  const text = columns?.trim() ?? "";
  if (!text) return columnsWithout(cells);
  return /^\d+$/.test(text) && validateColumns(text) === undefined ? Number(text) : undefined;
}

/** The ratios two neighbouring columns snap to as the divider between them is dragged (the first's share : the second's) */
export const COLUMN_RATIOS: readonly (readonly [number, number])[] = [
  [1, 1],
  [1, 2],
  [2, 1],
  [1, 3],
  [3, 1],
  [2, 3],
  [3, 2],
];
// The narrowest a column of the two is made, a share of their sum
const MIN_SHARE = 0.1;
// How near a ratio a drag has to come to take it (px)
const RATIO_SNAP = 8;

/** Where each ratio puts the first of two columns' right edge (px from its left edge, `sum` their widths): the guides a divider is dragged along */
export const ratioPlaces = (sum: number): readonly { readonly ratio: readonly [number, number]; readonly at: number }[] =>
  COLUMN_RATIOS.map((ratio) => ({ ratio, at: (sum * ratio[0]) / (ratio[0] + ratio[1]) }));

/** A place the first of two columns' width snaps to as the divider between them is dragged: a ratio's, or another's (the text's edge) by its name */
export type DividerPlace = { readonly at: number; readonly ratio?: readonly [number, number]; readonly name?: string };

/** Whether a place lies where a column of the two may be made (neither under a tenth of their sum) */
export const withinShares = (at: number, sum: number): boolean => at >= sum * MIN_SHARE && at <= sum * (1 - MIN_SHARE);

/**
 * Two neighbouring columns' widths (px) after the divider between them moved by `moved` px: their sum kept, neither
 * narrower than a tenth of it; a place taken where the first's width comes within RATIO_SNAP of it, the nearest: a
 * ratio of COLUMN_RATIOS, or one of `others` (the text's edges)
 */
export function dividedWidths(
  first: number,
  second: number,
  moved: number,
  others: readonly DividerPlace[] = [],
): { readonly first: number; readonly second: number; readonly ratio?: readonly [number, number]; readonly name?: string } {
  const sum = first + second;
  const wanted = Math.min(sum * (1 - MIN_SHARE), Math.max(sum * MIN_SHARE, first + moved));
  let best: DividerPlace | undefined;
  for (const place of [...ratioPlaces(sum), ...others.filter((one) => withinShares(one.at, sum))]) {
    if (Math.abs(place.at - wanted) <= RATIO_SNAP && (!best || Math.abs(place.at - wanted) < Math.abs(best.at - wanted))) best = place;
  }
  const width = best ? best.at : wanted;
  return { first: width, second: sum - width, ...(best?.ratio ? { ratio: best.ratio } : {}), ...(best?.name ? { name: best.name } : {}) };
}

/**
 * The `columns` written for columns' widths (px): equal ones as their count (`3`); else the least whole shares that
 * give each within 1 % of the whole (`1fr 2fr`, `1fr 1fr 2fr`), at most 24 in all; else shares to a tenth of the
 * narrowest (`1fr 1.4fr`)
 */
export function columnsOf(widths: readonly number[]): string {
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (!widths.length || total <= 0) return String(Math.max(widths.length, 1));
  const close = (shares: readonly number[], of: number) => shares.every((share, i) => share >= 1 && Math.abs((share * total) / of - widths[i]!) <= total * 0.01);
  for (let of = widths.length; of <= 24; of++) {
    const shares = widths.map((width) => Math.round((width / total) * of));
    if (shares.reduce((sum, share) => sum + share, 0) !== of || !close(shares, of)) continue;
    if (shares.every((share) => share === shares[0])) return String(widths.length);
    return shares.map((share) => `${share}fr`).join(" ");
  }
  const narrowest = Math.min(...widths);
  return widths.map((width) => `${Number((width / narrowest).toFixed(1))}fr`).join(" ");
}

/** A column template as a share each of the widths given (px), shown while a divider is dragged */
export const templateOf = (widths: readonly number[]): string => widths.map((width) => `minmax(0, ${Number(width.toFixed(2))}fr)`).join(" ");
