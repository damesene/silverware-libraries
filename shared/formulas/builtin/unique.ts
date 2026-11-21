import { emptyResult, flagOf, gridOf, lineKey, linesOf, pick } from "../grids.ts";
import { isError } from "../values.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "UNIQUE",
  syntax: "UNIQUE(array, [by_col], [exactly_once])",
  description:
    "The array's rows, each once, in their order (text compared ignoring case), e.g. UNIQUE(tasks![assignee]). by_col TRUE compares its columns; exactly_once TRUE keeps only those that occur once.",
  category: "lookup",
  example: "=COUNTA(UNIQUE([assignee]))",
  minArgs: 1,
  maxArgs: 3,
  grids: true,
  call: ([array, byCol, once]) => {
    const grid = gridOf(array!);
    if (isError(grid)) return grid;
    const byColumn = flagOf(byCol, false, "by_col");
    if (isError(byColumn)) return byColumn;
    const exactlyOnce = flagOf(once, false, "exactly_once");
    if (isError(exactlyOnce)) return exactlyOnce;
    // Each distinct line's first place, and how many times it occurs (a line with an error: one of its own)
    const firsts: { at: number; count: number }[] = [];
    const byKey = new Map<string, { at: number; count: number }>();
    linesOf(grid, byColumn).forEach((line, at) => {
      const key = lineKey(line);
      const seen = key === undefined ? undefined : byKey.get(key);
      if (seen) {
        seen.count++;
        return;
      }
      const first = { at, count: 1 };
      firsts.push(first);
      if (key !== undefined) byKey.set(key, first);
    });
    const places = firsts.filter((first) => !exactlyOnce || first.count === 1).map((first) => first.at);
    return places.length ? pick(grid, places, byColumn) : emptyResult("UNIQUE kept nothing: no value occurs exactly once");
  },
} satisfies GridFunction;
