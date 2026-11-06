// What the functions taking grids share (FILTER, SORT, UNIQUE…): the grid of
// an argument, its rows or columns picked, values ordered as spreadsheets
// sort them, rows compared.
import { parseDate } from "./dates.ts";
import { asGrid, asTime, FormulaError, Grid, isError, type Result, type Scalar, toBoolean, toNumber, toText } from "./values.ts";

/** An argument as a grid, or its error (an argument that is an error: a column that does not exist) */
export function gridOf(value: Result): Grid | FormulaError {
  return isError(value) ? value : asGrid(value);
}

/** An argument left out (none given, or left empty between others: XLOOKUP(a, b, c, , 1)) */
export function given(value: Result | undefined): value is Result {
  return value !== undefined && value !== null;
}

/** A whole number from an argument (one value), or its error */
export function wholeOf(value: Result, what: string): number | FormulaError {
  if (asGrid(value).cells.length !== 1) return new FormulaError("#VALUE!", `${what} is one number`);
  const n = toNumber(asGrid(value).cells[0]!);
  return isError(n) ? n : Math.trunc(n);
}

/** A logical value from an argument (one value; left out: `otherwise`), or its error */
export function flagOf(value: Result | undefined, otherwise: boolean, what: string): boolean | FormulaError {
  if (!given(value)) return otherwise;
  if (asGrid(value).cells.length !== 1) return new FormulaError("#VALUE!", `${what} is TRUE or FALSE`);
  return toBoolean(asGrid(value).cells[0]!);
}

/** The grid with its rows (or with `byColumn` its columns) at these places, in this order */
export function pick(grid: Grid, places: readonly number[], byColumn: boolean): Grid {
  if (byColumn) {
    return Grid.ofRows(
      grid.rows().map((row) => places.map((c) => row[c]!)),
      places.map((c) => grid.names[c]),
      places.length,
    );
  }
  return Grid.ofRows(
    places.map((r) => grid.row(r)),
    grid.names,
    grid.width,
  );
}

/** A grid's lines to pick from: its rows, or with `byColumn` its columns */
export function linesOf(grid: Grid, byColumn: boolean): Scalar[][] {
  return byColumn ? Array.from({ length: grid.width }, (_, c) => grid.column(c)) : grid.rows();
}

/**
 * A line's key, the same for lines UNIQUE takes as one (as sameValue
 * compares values: numbers, times and number text by value, other text and
 * logical values ignoring case, empty cells alike); undefined where it holds
 * an error, which is the same as nothing
 */
export function lineKey(line: readonly Scalar[]): string | undefined {
  const parts: string[] = [];
  for (const value of line) {
    if (isError(value)) return undefined;
    if (value === null || (typeof value === "string" && value.trim() === "")) {
      parts.push("e");
      continue;
    }
    const n = typeof value === "boolean" ? undefined : toNumber(value);
    parts.push(n !== undefined && !isError(n) ? `n${n}` : `t${(toText(value) as string).toLowerCase()}`);
  }
  return parts.join("\u0000");
}

// The kinds in the order spreadsheets sort them, ascending: numbers (dates, times), text, logical values, errors; empty cells always last
function kindOf(value: Scalar): number {
  if (value === null || (typeof value === "string" && value.trim() === "")) return 4;
  if (isError(value)) return 3;
  if (typeof value === "boolean") return 2;
  if (typeof value === "number" || asTime(value)) return 0;
  return 1;
}

/**
 * The order of two values as SORT sorts them (`descending` the other way):
 * numbers and times by value, dates (ISO text) by date, other text ignoring
 * case, FALSE before TRUE; empty cells last either way
 */
export function sortOrder(a: Scalar, b: Scalar, descending = false): number {
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (ka === 4 || kb === 4) return ka === kb ? 0 : ka === 4 ? 1 : -1;
  let order: number;
  if (ka !== kb) order = ka - kb;
  else if (ka === 0) order = (toNumber(a) as number) - (toNumber(b) as number);
  else if (ka === 2) order = Number(a) - Number(b);
  else if (ka === 3) order = 0;
  else {
    const da = parseDate(a as string);
    const db = da && parseDate(b as string);
    if (da && db) order = da.ms - db.ms;
    else order = (toText(a) as string).localeCompare(toText(b) as string, undefined, { sensitivity: "base", numeric: true });
  }
  return descending ? -order : order;
}

/** A sort order argument: 1 ascending (left out too), -1 descending, or its error */
export function orderOf(value: Result | undefined, what = "sort_order"): boolean | FormulaError {
  if (!given(value)) return false;
  const n = wholeOf(value, what);
  if (isError(n)) return n;
  if (n !== 1 && n !== -1) return new FormulaError("#VALUE!", `${what} is 1 (ascending) or -1 (descending), not ${n}`);
  return n === -1;
}

/** Nothing left of an array: #CALC!, saying why (a cell cannot show an empty result, as in Excel) */
export function emptyResult(why: string): FormulaError {
  return new FormulaError("#CALC!", why);
}

/** The grid's rows and columns at these places (TAKE, DROP), or #CALC! where none are left */
export function sliced(grid: Grid, rows: readonly number[], columns: readonly number[], name: string): Grid | FormulaError {
  if (rows.length === 0 || columns.length === 0) return emptyResult(`${name} left nothing of the array`);
  return pick(pick(grid, rows, false), columns, true);
}
