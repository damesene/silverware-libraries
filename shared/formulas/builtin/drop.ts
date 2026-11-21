import { given, gridOf, sliced, wholeOf } from "../grids.ts";
import { FormulaError, isError, type Result } from "../values.ts";
import type { GridFunction } from "../function.ts";

/** The places left of `size` lines once `count` are dropped from the start (from the end where negative); all where left out */
function kept(size: number, count: Result | undefined, what: string): number[] | FormulaError {
  const all = Array.from({ length: size }, (_, i) => i);
  if (!given(count)) return all;
  const n = wholeOf(count, what);
  if (isError(n)) return n;
  return n >= 0 ? all.slice(n) : all.slice(0, Math.max(0, size + n));
}

export default {
  name: "DROP",
  syntax: "DROP(array, rows, [columns])",
  description:
    "The array without its first rows (its last where rows is negative), and with columns without its first (or last) columns, e.g. DROP(SORT([score], 1, -1), 1) all but the highest; rows left empty drops none.",
  category: "lookup",
  example: "=AVERAGE(DROP(SORT([score]), 1))",
  minArgs: 2,
  maxArgs: 3,
  grids: true,
  call: ([array, rows, columns]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const r = kept(grid.height, rows, "rows");
    if (isError(r)) return r;
    const c = kept(grid.width, columns, "columns");
    if (isError(c)) return c;
    return sliced(grid, r, c, "DROP");
  },
} satisfies GridFunction;
