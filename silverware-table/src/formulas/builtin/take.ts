import { given, gridOf, sliced, wholeOf } from "../grids.ts";
import { FormulaError, isError, type Result } from "../values.ts";
import type { GridFunction } from "../function.ts";

/** The places of `count` lines from the start (from the end where negative) of `size`; all of them where left out */
function taken(size: number, count: Result | undefined, what: string): number[] | FormulaError {
  if (!given(count)) return Array.from({ length: size }, (_, i) => i);
  const n = wholeOf(count, what);
  if (isError(n)) return n;
  const length = Math.min(Math.abs(n), size);
  return Array.from({ length }, (_, i) => (n >= 0 ? i : size - length + i));
}

export default {
  name: "TAKE",
  syntax: "TAKE(array, rows, [columns])",
  description:
    "The first rows of the array (the last where rows is negative), and with columns its first (or last) columns, e.g. TAKE(SORT([score], 1, -1), 3) the three highest; rows left empty takes all of them.",
  category: "lookup",
  example: "=SUM(TAKE(SORT([score], 1, -1), 3))",
  minArgs: 2,
  maxArgs: 3,
  grids: true,
  call: ([array, rows, columns]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const r = taken(grid.height, rows, "rows");
    if (isError(r)) return r;
    const c = taken(grid.width, columns, "columns");
    if (isError(c)) return c;
    return sliced(grid, r, c, "TAKE");
  },
} satisfies GridFunction;
