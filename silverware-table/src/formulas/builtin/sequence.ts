import { emptyResult, given, numberOf, wholeOf } from "../grids.ts";
import { FormulaError, Grid, isError, type Result } from "../values.ts";
import type { GridFunction } from "../function.ts";

// Excel's sheet: as many rows and columns as an array may have there
const MAX_ROWS = 1_048_576;
const MAX_COLUMNS = 16_384;
// All its cells: the rows and columns a sheet has would be 17 billion values, more than a page can hold (decided 2026-11-06)
const MAX_CELLS = 1_048_576;

/** A count of lines (left out: 1), or its error: none #CALC! as in Excel, negative #VALUE!, more than a sheet has #VALUE! */
function countOf(value: Result | undefined, what: string, max: number): number | FormulaError {
  if (!given(value)) return 1;
  const n = wholeOf(value, what);
  if (isError(n)) return n;
  if (n === 0) return emptyResult(`SEQUENCE of no ${what}`);
  if (n < 0) return new FormulaError("#VALUE!", `${what} is a count, not ${n}`);
  if (n > max) return new FormulaError("#VALUE!", `${what} is at most ${max.toLocaleString("en-US")}, as in Excel`);
  return n;
}

export default {
  name: "SEQUENCE",
  syntax: "SEQUENCE(rows, [columns], [start], [step])",
  description:
    "Numbers in rows and columns, along each row first: from start (1) by step (1), e.g. SEQUENCE(5) 1 to 5 in a column, SEQUENCE(1, 3, 0, 10) 0, 10, 20 in a row.",
  category: "math",
  example: "=SUM(SEQUENCE(10))",
  minArgs: 1,
  maxArgs: 4,
  grids: true,
  call: ([rows, columns, start, step]) => {
    const height = countOf(rows, "rows", MAX_ROWS);
    if (isError(height)) return height;
    const width = countOf(columns, "columns", MAX_COLUMNS);
    if (isError(width)) return width;
    if (height * width > MAX_CELLS) {
      return new FormulaError("#VALUE!", `SEQUENCE makes at most ${MAX_CELLS.toLocaleString("en-US")} values, not ${(height * width).toLocaleString("en-US")}`);
    }
    const first = given(start) ? numberOf(start, "start") : 1;
    if (isError(first)) return first;
    const by = given(step) ? numberOf(step, "step") : 1;
    if (isError(by)) return by;
    return new Grid(
      height,
      width,
      Array.from({ length: height * width }, (_, i) => first + i * by),
    );
  },
} satisfies GridFunction;
