import { emptyResult, given, gridOf, pick } from "../grids.ts";
import { FormulaError, isError, toBoolean } from "../values.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "FILTER",
  syntax: "FILTER(array, include, [if_empty])",
  description:
    "The rows of the array (a range, a column, a whole table) for which include is TRUE, e.g. FILTER(tasks![name], tasks![done] = FALSE); include as long as the array's rows, or a row as wide as its columns to keep columns. Nothing kept: if_empty, else #CALC!.",
  category: "lookup",
  example: "=SUM(FILTER([price], [qty] > 10, 0))",
  minArgs: 2,
  maxArgs: 3,
  grids: true,
  call: ([array, include, ifEmpty]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const keep = gridOf(include!);
    if (isError(keep)) return keep;
    if (keep.width > 1 && keep.height > 1) return new FormulaError("#VALUE!", "include is one column (to keep rows) or one row (to keep columns)");
    // A column (or a list) as long as the rows keeps rows; a row as wide as the columns keeps columns
    const byColumn = keep.height === 1 && keep.width > 1;
    const lines = byColumn ? grid.width : grid.height;
    const flags = keep.cells;
    if (flags.length !== lines) {
      return new FormulaError("#VALUE!", `include has ${flags.length} values and the array ${lines} ${byColumn ? "columns" : "rows"}`);
    }
    const places: number[] = [];
    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i]!;
      if (flag === null) continue;
      const b = toBoolean(flag);
      if (isError(b)) return b;
      if (b) places.push(i);
    }
    if (places.length > 0) return pick(grid, places, byColumn);
    return given(ifEmpty) ? ifEmpty : emptyResult("FILTER kept nothing: its if_empty, the third argument, says what to give then");
  },
} satisfies GridFunction;
