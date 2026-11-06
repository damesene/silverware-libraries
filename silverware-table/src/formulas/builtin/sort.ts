import { flagOf, given, gridOf, orderOf, pick, sortOrder, wholeOf } from "../grids.ts";
import { FormulaError, isError } from "../values.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "SORT",
  syntax: "SORT(array, [sort_index], [sort_order], [by_col])",
  description:
    "The array's rows sorted by one of its columns, sort_index (1, the first, by default): sort_order 1 ascending (the default) or -1 descending; numbers, then text ignoring case, then logical values, empty cells last. by_col TRUE sorts its columns by a row.",
  category: "lookup",
  example: '=TEXTJOIN(", ", TRUE, SORT(UNIQUE([tag])))',
  minArgs: 1,
  maxArgs: 4,
  grids: true,
  call: ([array, index, order, byCol]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const byColumn = flagOf(byCol, false, "by_col");
    if (isError(byColumn)) return byColumn;
    const at = given(index) ? wholeOf(index, "sort_index") : 1;
    if (isError(at)) return at;
    const across = byColumn ? grid.height : grid.width;
    if (at < 1 || at > across) return new FormulaError("#VALUE!", `sort_index ${at} is not one of the array's ${across} ${byColumn ? "rows" : "columns"}`);
    const descending = orderOf(order);
    if (isError(descending)) return descending;
    const key = (line: number) => (byColumn ? grid.at(at - 1, line) : grid.at(line, at - 1));
    const lines = Array.from({ length: byColumn ? grid.width : grid.height }, (_, i) => i);
    // Stable: lines of the same key keep their order
    lines.sort((a, b) => sortOrder(key(a), key(b), descending) || a - b);
    return pick(grid, lines, byColumn);
  },
} satisfies GridFunction;
