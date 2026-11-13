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
