import { gridOf, orderOf, pick, sortOrder } from "../grids.ts";
import { FormulaError, isError, type Scalar } from "../values.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "SORTBY",
  syntax: "SORTBY(array, by_array1, [sort_order1], …)",
  description:
    "The array's rows sorted by other columns of as many rows, the first by_array first, each with its sort_order: 1 ascending (the default) or -1 descending, e.g. SORTBY(people![name], people![score], -1). Rows as wide as the array's columns sort its columns.",
  category: "lookup",
  example: "=TAKE(SORTBY([name], [score], -1), 1)",
  minArgs: 2,
  grids: true,
  call: ([array, ...rest]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const keys: { values: readonly Scalar[]; descending: boolean }[] = [];
    let byColumn: boolean | undefined;
    for (let i = 0; i < rest.length; i += 2) {
      const n = i / 2 + 1;
      const by = gridOf(rest[i]!);
      if (isError(by)) return by;
      if (by.width > 1 && by.height > 1) return new FormulaError("#VALUE!", `by_array${n} is one column (or one row)`);
      // A row as wide as the array's columns sorts its columns
      const columns = by.height === 1 && by.width > 1;
      if (byColumn !== undefined && byColumn !== columns) return new FormulaError("#VALUE!", "the by_arrays are all columns or all rows");
      byColumn = columns;
      const lines = columns ? grid.width : grid.height;
      if (by.cells.length !== lines) {
        return new FormulaError("#VALUE!", `by_array${n} has ${by.cells.length} values and the array ${lines} ${columns ? "columns" : "rows"}`);
      }
      const descending = orderOf(rest[i + 1], `sort_order${n}`);
      if (isError(descending)) return descending;
      keys.push({ values: by.cells, descending });
    }
    const lines = Array.from({ length: byColumn ? grid.width : grid.height }, (_, i) => i);
    lines.sort((a, b) => {
      for (const key of keys) {
        const order = sortOrder(key.values[a]!, key.values[b]!, key.descending);
        if (order) return order;
      }
      return a - b;
    });
    return pick(grid, lines, !!byColumn);
  },
} satisfies GridFunction;
