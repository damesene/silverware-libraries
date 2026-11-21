import { gridOf, pick, wholeOf } from "../grids.ts";
import { FormulaError, isError } from "../values.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "CHOOSECOLS",
  syntax: "CHOOSECOLS(array, col_num1, [col_num2], …)",
  description: "The columns of the array at these places, in this order: 1 the first, -1 the last, e.g. CHOOSECOLS(A1:D9, 1, 3).",
  category: "lookup",
  example: '=TEXTJOIN(", ", TRUE, CHOOSECOLS(FILTER(prices![#Data], prices![price] > 10), 1))',
  minArgs: 2,
  grids: true,
  call: ([array, ...columns]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const places: number[] = [];
    for (const column of columns) {
      const n = wholeOf(column, "col_num");
      if (isError(n)) return n;
      if (n === 0 || Math.abs(n) > grid.width) return new FormulaError("#VALUE!", `the array has no column ${n}: it has ${grid.width}`);
      places.push(n > 0 ? n - 1 : grid.width + n);
    }
    return pick(grid, places, true);
  },
} satisfies GridFunction;
