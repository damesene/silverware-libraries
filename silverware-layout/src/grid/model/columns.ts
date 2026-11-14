// A grid's columns as its `columns` attribute gives them (docs/silverware-layout-grid.md, *Layout*): a number of equal
// columns (`3`) or their widths (`1fr 2fr`, `30% 70%`, `200px 1fr`), made a CSS grid's column template. Pure.

/** A grid of no `columns`: as many equal columns as it has cells, this many at most (a column of its own each) */
export const DEFAULT_MAX_COLUMNS = 4;

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
 * The CSS column template of a grid: its `columns` where they can be read (a count: that many equal columns; widths:
 * each, a share `fr` never narrower than its content allows to shrink, so a long word does not widen a column); else
 * as many equal columns as cells, at most DEFAULT_MAX_COLUMNS, one at least
 */
export function columnTemplate(columns: string | undefined, cells: number): string {
  const text = columns?.trim() ?? "";
  if (text && validateColumns(text) === undefined) {
    if (/^\d+$/.test(text)) return `repeat(${Number(text)}, minmax(0, 1fr))`;
    return text
      .split(/\s+/)
      .map((track) => (track.endsWith("fr") ? `minmax(0, ${track})` : track))
      .join(" ");
  }
  return `repeat(${Math.min(Math.max(cells, 1), DEFAULT_MAX_COLUMNS)}, minmax(0, 1fr))`;
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

/**
 * Two neighbouring columns' widths (px) after the divider between them moved by `moved` px: their sum kept, neither
 * narrower than a tenth of it; a ratio of COLUMN_RATIOS taken where the first's width comes within RATIO_SNAP of it
 */
export function dividedWidths(first: number, second: number, moved: number): { readonly first: number; readonly second: number; readonly ratio?: readonly [number, number] } {
  const sum = first + second;
  const wanted = Math.min(sum * (1 - MIN_SHARE), Math.max(sum * MIN_SHARE, first + moved));
  let best: { readonly ratio: readonly [number, number]; readonly at: number } | undefined;
  for (const ratio of COLUMN_RATIOS) {
    const at = (sum * ratio[0]) / (ratio[0] + ratio[1]);
    if (Math.abs(at - wanted) <= RATIO_SNAP && (!best || Math.abs(at - wanted) < Math.abs(best.at - wanted))) best = { ratio, at };
  }
  const width = best ? best.at : wanted;
  return { first: width, second: sum - width, ...(best ? { ratio: best.ratio } : {}) };
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
