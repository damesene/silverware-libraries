// Values formulas compute with, and the conversions formula functions use.
import { formatLuaNumber } from "../format.ts";
import { asNumber } from "../view.ts";

// #SPILL!: a cell's result of several values (a cell holds one); #CALC!: a result of no values (FILTER keeping nothing)
export type ErrorCode = "#VALUE!" | "#DIV/0!" | "#REF!" | "#NAME?" | "#NUM!" | "#N/A" | "#CYCLE!" | "#ERROR!" | "#SPILL!" | "#CALC!";

export const ERROR_CODES: readonly ErrorCode[] = ["#VALUE!", "#DIV/0!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#CYCLE!", "#ERROR!", "#SPILL!", "#CALC!"];

/** A formula's error: the cell shows the code, the cell's tooltip the detail */
export class FormulaError {
  constructor(
    readonly code: ErrorCode,
    readonly detail: string,
  ) {}
}

/**
 * A time of day or a length of time, in seconds. Cells write it as 14:30,
 * 09:05:30 or 40:00 (hours past 24 for a length): formulas read such text as a
 * time, compute with it and write their time results so, which keeps the
 * markdown readable. Where a number is expected it is a fraction of a day, as
 * in spreadsheets (12:00 is 0.5). A time read from a cell keeps its text, so
 * as text it stays as written (9:05 is not 09:05).
 */
export class TimeValue {
  constructor(
    readonly seconds: number,
    readonly text?: string,
  ) {}
}

export const DAY_SECONDS = 86_400;

// null: an empty cell
export type Scalar = number | string | boolean | null | TimeValue | FormulaError;

const CLOCK_RE = /^(-)?(\d+):([0-5]\d)(?::([0-5]\d))?$/;

/** The time a text is written as (14:30, 9:05:30, 40:00), or undefined */
export function parseClock(text: string): TimeValue | undefined {
  const m = CLOCK_RE.exec(text.trim());
  if (!m) return undefined;
  const seconds = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] ?? 0);
  return new TimeValue(m[1] ? -seconds : seconds, text.trim());
}

/** A time as cells write it: 09:05, 40:00, 14:30:15 (seconds only when they are not 0) */
export function formatClock(seconds: number): string {
  const total = Math.round(Math.abs(seconds));
  const two = (n: number) => String(n).padStart(2, "0");
  const rest = total % 60;
  const text = `${two(Math.floor(total / 3600))}:${two(Math.floor(total / 60) % 60)}${rest ? `:${two(rest)}` : ""}`;
  return seconds < 0 && total > 0 ? `-${text}` : text;
}

/** A value as a time: a time, or text written as one */
export function asTime(value: Scalar): TimeValue | undefined {
  if (value instanceof TimeValue) return value;
  return typeof value === "string" ? parseClock(value) : undefined;
}

// A range (A1:B3, [Qty]) is passed to functions as the list of its cells' values
export type Value = Scalar | readonly Scalar[];

/**
 * Values with a shape: rows of columns, as a range of several rows and
 * columns (A1:C5), a table's body (prices![#Data]) and the array functions
 * (FILTER, SORT…) give them. `names`: each column's name where it came from a
 * table's column (a view's headers, Show result's), else undefined. Only the
 * functions that say they take grids (`GridFunction`) get one as it is; any
 * other gets its cells as a list, row by row.
 */
export class Grid {
  constructor(
    readonly height: number,
    readonly width: number,
    // Row by row: the cell of row r and column c is cells[r * width + c]
    readonly cells: readonly Scalar[],
    readonly names: readonly (string | undefined)[] = [],
  ) {}

  /** A grid of these rows, each of the same length */
  static ofRows(rows: readonly (readonly Scalar[])[], names: readonly (string | undefined)[] = [], width = rows[0]?.length ?? 0): Grid {
    return new Grid(rows.length, width, rows.flat(), names);
  }

  at(row: number, column: number): Scalar {
    return this.cells[row * this.width + column] ?? null;
  }

  row(row: number): Scalar[] {
    return this.cells.slice(row * this.width, (row + 1) * this.width);
  }

  column(column: number): Scalar[] {
    return Array.from({ length: this.height }, (_, r) => this.at(r, column));
  }

  rows(): Scalar[][] {
    return Array.from({ length: this.height }, (_, r) => this.row(r));
  }
}

// What a formula's parts evaluate to: a value, a list, or a grid
export type Result = Value | Grid;

export function isGrid(value: unknown): value is Grid {
  return value instanceof Grid;
}

/** A result as a grid: a value one cell, a list one column, a grid as it is */
export function asGrid(value: Result): Grid {
  if (isGrid(value)) return value;
  if (isRange(value)) return new Grid(value.length, 1, value);
  return new Grid(1, 1, [value]);
}

/** A result as functions that take no grids get it: a grid's cells as a list, row by row */
export function asValue(value: Result): Value {
  return isGrid(value) ? value.cells : value;
}

/**
 * A cell's result: one value. A list or a grid of one value is that value,
 * of none an empty cell; of several #SPILL!, as a cell holds one (a view is
 * a table made of such a result)
 */
export function cellValue(value: Result): Scalar {
  const cells = isGrid(value) ? value.cells : isRange(value) ? value : undefined;
  if (!cells) return value as Scalar;
  if (cells.length === 0) return null;
  if (cells.length === 1) return cells[0]!;
  const size = isGrid(value) ? `${value.height} × ${value.width}` : `${cells.length}`;
  return new FormulaError("#SPILL!", `the result is ${size} values and a cell holds one: reduce it to one (SUM, COUNTA, TEXTJOIN, TAKE…), or see it with Show result`);
}

export function isError(value: unknown): value is FormulaError {
  return value instanceof FormulaError;
}

export function isRange(value: Value): value is readonly Scalar[] {
  return Array.isArray(value);
}

/** The first error among the values, ranges included */
export function firstError(values: readonly Value[]): FormulaError | undefined {
  for (const value of values) {
    for (const item of isRange(value) ? value : [value]) {
      if (isError(item)) return item;
    }
  }
  return undefined;
}

/** A range of one cell is that cell; a larger one cannot be one value */
export function single(value: Value): Scalar {
  if (!isRange(value)) return value;
  return value.length === 1 ? value[0]! : new FormulaError("#VALUE!", "a range where one value is expected");
}

/**
 * One value as a number: an empty cell is 0, TRUE 1, and text a number as
 * Silverware Table reads it in cells (`12,99 €`, `1 000`, `15 %`)
 */
export function toNumber(value: Value): number | FormulaError {
  const v = single(value);
  if (isError(v) || typeof v === "number") return v;
  if (v === null) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof TimeValue) return v.seconds / DAY_SECONDS;
  if (v.trim() === "") return 0;
  const time = parseClock(v);
  return asNumber(v) ?? (time ? time.seconds / DAY_SECONDS : new FormulaError("#VALUE!", `"${v}" is not a number`));
}

export function toText(value: Value): string | FormulaError {
  const v = single(value);
  if (isError(v)) return v;
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return formatNumber(v);
  if (v instanceof TimeValue) return v.text ?? formatClock(v.seconds);
  return v;
}

export function toBoolean(value: Value): boolean | FormulaError {
  const v = single(value);
  if (isError(v) || typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  if (v instanceof TimeValue) return v.seconds !== 0;
  const upper = v.trim().toUpperCase();
  if (upper === "TRUE") return true;
  if (upper === "FALSE") return false;
  const n = asNumber(v);
  return n !== undefined ? n !== 0 : new FormulaError("#VALUE!", `"${v}" is not TRUE or FALSE`);
}

/**
 * The numbers among the arguments, as spreadsheets take them: in a range,
 * empty cells and text that is not a number are skipped; an argument given
 * directly must be a number. The first error is returned instead.
 */
export function numbers(args: readonly Value[]): number[] | FormulaError {
  const result: number[] = [];
  for (const arg of args) {
    if (isRange(arg)) {
      for (const item of arg) {
        if (isError(item)) return item;
        if (typeof item === "number") result.push(item);
        else if (item instanceof TimeValue) result.push(item.seconds / DAY_SECONDS);
        else if (typeof item === "string") {
          const n = asNumber(item);
          if (n !== undefined) result.push(n);
        }
      }
    } else if (arg !== null) {
      const n = toNumber(arg);
      if (isError(n)) return n;
      result.push(n);
    }
  }
  return result;
}

/**
 * Whether the values a number function takes from the arguments are all times
 * (a sum of times is a time, 40:00), and there is at least one
 */
export function allTimes(args: readonly Value[]): boolean {
  let times = 0;
  for (const arg of args) {
    for (const item of isRange(arg) ? arg : [arg]) {
      if (asTime(item as Scalar)) times++;
      else if (typeof item === "number" || (typeof item === "string" && asNumber(item) !== undefined)) return false;
      else if (!isRange(arg) && typeof item === "boolean") return false;
    }
  }
  return times > 0;
}

/**
 * `+ - * /` with a time: time ± time and time ± days (a number) is a time,
 * as are time × number and time ÷ number; anything else (time ÷ time) is
 * left to the numbers. Undefined without a time among the operands.
 */
export function timeArithmetic(op: string, left: Scalar, right: Scalar): Scalar | undefined {
  const a = asTime(left);
  const b = asTime(right);
  if (!a && !b) return undefined;
  const days = (v: Scalar) => toNumber(v);
  if (op === "+" || op === "-") {
    if (a && b) return new TimeValue(op === "+" ? a.seconds + b.seconds : a.seconds - b.seconds);
    const d = days(a ? right : left);
    if (isError(d)) return d;
    const s = d * DAY_SECONDS;
    if (op === "+") return new TimeValue(Math.round((a ?? b)!.seconds + s));
    return new TimeValue(Math.round(a ? a.seconds - s : s - b!.seconds));
  }
  if (op === "*" && !(a && b)) {
    const k = days(a ? right : left);
    return isError(k) ? k : new TimeValue(Math.round((a ?? b)!.seconds * k));
  }
  if (op === "/" && a && !b) {
    const k = days(right);
    if (isError(k)) return k;
    return k === 0 ? new FormulaError("#DIV/0!", "division by zero") : new TimeValue(Math.round(a.seconds / k));
  }
  return undefined;
}

/** All values of the arguments in one list, ranges flattened */
export function flatten(args: readonly Value[]): Scalar[] {
  return args.flatMap((arg) => (isRange(arg) ? [...arg] : [arg]));
}

/** A number as a cell shows it: at most 14 significant digits, so 0.1 + 0.2 is 0.3 */
export function formatNumber(n: number): string {
  return formatLuaNumber(n);
}

/**
 * Whether two values are the same for looking one up: numbers (and times) by
 * value, text ignoring case, an empty cell only as an empty one
 */
export function sameValue(a: Scalar, b: Scalar): boolean {
  if (isError(a) || isError(b)) return false;
  // Empty text (a formula's "") is empty too, not 0
  const emptyA = a === null || (typeof a === "string" && a.trim() === "");
  const emptyB = b === null || (typeof b === "string" && b.trim() === "");
  if (emptyA || emptyB) return emptyA && emptyB;
  if (typeof a !== "boolean" && typeof b !== "boolean") {
    const na = toNumber(a);
    const nb = toNumber(b);
    if (!isError(na) && !isError(nb)) return na === nb;
  }
  return (toText(a) as string).toLowerCase() === (toText(b) as string).toLowerCase();
}
