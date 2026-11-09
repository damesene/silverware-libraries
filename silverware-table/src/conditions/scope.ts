// A cell as definitions get it (its value read once), and the statistics of
// the cells a definition applies to (Scope), each computed only when asked.
import type { Cell, Scope } from "./api.ts";
import { parseDate } from "../formulas/dates.ts";
import { asNumber, normalizeForFilter } from "../../../shared/filter.ts";

/** A cell from what it shows and what sorting compares (a column type's value, else the text) */
export function cellOf(text: string, value: string, column: string): Cell {
  const number = asNumber(value);
  const date = parseDate(value.trim())?.ms;
  return { text, value, column, ...(number !== undefined ? { number } : {}), ...(date !== undefined ? { date } : {}) };
}

// What makes two cells the same value: a number by its value and its unit (1 and 1.0 alike, as Excel counts
// duplicates; 3 kg and 3 m not), text as the text conditions compare it (case and diacritics ignored)
const sameValue = (cell: Cell) =>
  cell.number !== undefined ? `\u0000${cell.number}\u0000${cell.value.replace(/[-+\d.,\s ]/g, "").toLowerCase()}` : normalizeForFilter(cell.value).trim();

/** The statistics of these cells, each computed the first time it is asked for */
export function scopeOf(cells: readonly Cell[]): Scope {
  let numbers: number[] | undefined;
  let counts: Map<string, number> | undefined;
  const sorted = () => (numbers ??= cells.flatMap((c) => (c.number === undefined ? [] : [c.number])).sort((a, b) => a - b));
  // How many numbers are smaller than n (the first place of n in the sorted numbers)
  const below = (n: number) => {
    const list = sorted();
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]! < n) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  // How many numbers are larger than n
  const above = (n: number) => {
    const list = sorted();
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]! <= n) lo = mid + 1;
      else hi = mid;
    }
    return list.length - lo;
  };
  const scope: Scope = {
    size: cells.length,
    get numbers() {
      return sorted();
    },
    get min() {
      return sorted()[0];
    },
    get max() {
      const list = sorted();
      return list[list.length - 1];
    },
    get sum() {
      return sorted().reduce((a, b) => a + b, 0);
    },
    get average() {
      const list = sorted();
      return list.length ? this.sum / list.length : undefined;
    },
    position(cell) {
      const { min, max } = this;
      if (cell.number === undefined || min === undefined || max === undefined) return undefined;
      return max === min ? 1 : (cell.number - min) / (max - min);
    },
    share(cell) {
      const { min, max } = this;
      if (cell.number === undefined || min === undefined || max === undefined) return undefined;
      const from = Math.min(0, min);
      return max === from ? 0 : Math.min(1, Math.max(0, (cell.number - from) / (max - from)));
    },
    rank(cell, ascending = false) {
      if (cell.number === undefined) return undefined;
      return 1 + (ascending ? below(cell.number) : above(cell.number));
    },
    percentile(p) {
      const list = sorted();
      if (!list.length || !Number.isFinite(p)) return undefined;
      const at = (Math.min(100, Math.max(0, p)) / 100) * (list.length - 1);
      const i = Math.floor(at);
      return i + 1 < list.length ? list[i]! + (list[i + 1]! - list[i]!) * (at - i) : list[i];
    },
    quantile(cell) {
      if (cell.number === undefined) return undefined;
      // From 0 (the smallest) to 1 (the largest), by the cells' places: the first and last levels always taken
      const count = sorted().length;
      return count ? (count === 1 ? 0 : below(cell.number) / (count - 1)) : undefined;
    },
    count(cell) {
      if (!counts) {
        counts = new Map();
        for (const c of cells) counts.set(sameValue(c), (counts.get(sameValue(c)) ?? 0) + 1);
      }
      return counts.get(sameValue(cell)) ?? 0;
    },
  };
  return scope;
}
