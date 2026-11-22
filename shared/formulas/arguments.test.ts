// Each built-in function's arguments as it declares them (`argument`, docs/silverware-formulas-lifting.md): one it
// declares a range reads a range given there, one of one value (not declared) refuses one, so a function added must
// say which of its arguments read a range, and a declaration says what its `call` does
import { describe, expect, it } from "vitest";
import { BUILT_IN_FUNCTIONS } from "./builtin/index.ts";
import { type FormulaFunction, takesGrids } from "./function.ts";
import { asValue, FormulaError, type Value } from "./values.ts";

// (What `single` says of a range of other than one value: what an argument of one value gives for a range)
const RANGE_REFUSED = "a range where one value is expected";

// Arguments every function reads, its optional ones too (a number of 1 where none is listed, a date of the 1st of
// January 2026, a text where one is needed, a range two values where one is read)
const SAMPLE: Readonly<Record<string, readonly Value[]>> = {
  DATEADD: ["2026-01-01", 1, "d"],
  DATEDIF: ["2026-01-01", "2026-02-01", "d"],
  DATE: [2026, 1, 1],
  TIME: [1, 1, 1],
  TEXT: [1, "0"],
  SEARCH: ["a", "abc", 1],
  SUBSTITUTE: ["abc", "a", "b", 1],
  MID: ["abc", 1, 1],
  NETWORKDAYS: ["2026-01-01", "2026-02-01", ["2026-01-05", "2026-01-06"]],
  WORKDAY: ["2026-01-01", 5, ["2026-01-05", "2026-01-06"]],
  EOMONTH: ["2026-01-01", 1],
  XLOOKUP: [1, [1, 2], [3, 4], 0, 0, 1],
  SUMIFS: [[1, 2], [1, 2], 1],
  AVERAGEIFS: [[1, 2], [1, 2], 1],
  MAXIFS: [[1, 2], [1, 2], 1],
  MINIFS: [[1, 2], [1, 2], 1],
  COUNTIFS: [[1, 2], 1],
  RANK: [1, [1, 2], 0],
  LARGE: [[1, 2], 1],
  SMALL: [[1, 2], 1],
  REGEXTEST: ["abc", "b", 0],
  TEXTJOIN: [",", true, 1],
  SWITCH: [1, 1, "a", "b"],
  WEEKDAY: ["2026-01-01", 1],
  SUMPRODUCT: [[1, 2], [3, 4]],
  IFS: [true, "a"],
};

// The functions that read every argument as one value only (no `argument`): a list of them kept, so one added says
const OF_ONE_VALUE = [
  "ROUND", "ROUNDUP", "ROUNDDOWN", "ABS", "INT", "MOD", "MROUND", "CEILING", "FLOOR", "TODAY", "NOW", "DATE", "YEAR", "MONTH",
  "DAY", "HOUR", "MINUTE", "SECOND", "TIME", "WEEKDAY", "ISOWEEKNUM", "EOMONTH", "DATEADD", "DATEDIF", "TEXT", "LEN",
  "MID", "SEARCH", "SUBSTITUTE", "UPPER", "LOWER", "PROPER", "TRIM", "NOT", "ISNUMBER", "REGEXTEST", "ROW",
];

// The arguments whose function does not refuse a range where its declaration says what it reads otherwise, and why
const READ_OTHERWISE: Readonly<Record<string, readonly number[]>> = {
  // (An error read as their result: a range's refusal is one, so IFERROR gives its value_if_error and ISNUMBER FALSE;
  // lifted, each value is read)
  IFERROR: [0],
  ISNUMBER: [0],
  // (Its delimiter and ignore_empty one value each, refusing a range, declared as ranges so they are not lifted: Excel
  // 365 takes a list of delimiters in turn, which lifting would not do)
  TEXTJOIN: [0, 1],
};

// Its arguments: those listed, else as many as it takes at most (two of one taking any number), each 1
const sample = (f: FormulaFunction): Value[] => {
  const given = SAMPLE[f.name];
  if (given) return [...given];
  return Array.from({ length: f.maxArgs ?? Math.max(f.minArgs, 2) }, () => 1);
};

// The built-in functions not taking grids: those whose arguments a declaration speaks of
const NOT_GRIDS = Object.values(BUILT_IN_FUNCTIONS).filter((one): one is FormulaFunction => !takesGrids(one));

describe("the built-in functions' arguments", () => {
  it("are declared, or every one of one value is (a list of them kept): none left unsaid", () => {
    const undeclared = NOT_GRIDS.filter((f) => !f.argument).map((f) => f.name).sort();
    expect(undeclared).toEqual([...OF_ONE_VALUE].sort());
  });

  it.each(NOT_GRIDS.map((f) => [f.name, f] as const))("of %s read a range where declared one, refuse one where of one value", (_name, f) => {
    const args = sample(f);
    args.forEach((_, at) => {
      const kind = f.argument?.(at, args.length) ?? "value";
      if (kind === "branch") return;
      const given = args.map((one, i) => (i === at ? (Array.isArray(one) ? one : [one, one]) : one));
      const result = asValue(f.call(given, { row: 1, column: 1 }));
      const otherwise = READ_OTHERWISE[f.name]?.includes(at) ?? false;
      // (One of one value refuses the range; one reading a range gives a result, no error at all)
      const refused = result instanceof FormulaError && result.detail === RANGE_REFUSED;
      const read = !(result instanceof FormulaError);
      if (kind === "value" && !otherwise) expect([at, refused]).toEqual([at, true]);
      else if (kind === "range" && !otherwise) expect([at, read, result]).toEqual([at, true, result]);
      else expect([at, refused]).toEqual([at, kind === "range"]);
    });
  });

  it("of the choosing functions: what decides one value, what they choose among branches", () => {
    const kinds = (name: string, count: number) => Array.from({ length: count }, (_, at) => BUILT_IN_FUNCTIONS[name]!.argument?.(at, count));
    expect(kinds("IF", 3)).toEqual(["value", "branch", "branch"]);
    expect(kinds("IFS", 4)).toEqual(["value", "branch", "value", "branch"]);
    expect(kinds("IFERROR", 2)).toEqual(["value", "branch"]);
    // (SWITCH's cases compared place by place where its value is a list, as its results are chosen)
    expect(kinds("SWITCH", 5)).toEqual(["value", "branch", "branch", "branch", "branch"]);
    expect(kinds("XLOOKUP", 6)).toEqual(["value", "range", "range", "branch", "value", "value"]);
  });
});
