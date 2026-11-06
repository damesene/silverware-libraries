import { describe, expect, it } from "vitest";
import { parseTable } from "../markdown.ts";
import { metaName } from "../meta.ts";
import { formulaCell, formulaOf, recalculate } from "../testing/formulas.ts";
import { BUILT_IN_FUNCTIONS } from "./builtin/index.ts";
import { errorCodeIn } from "./cell.ts";
import type { TableSource } from "./evaluate.ts";
import { takesGrids } from "./function.ts";
import { cellValue, FormulaError, Grid, type Result, type Scalar } from "./values.ts";

// A table with `formula` in its last row's last cell (or `at`); what that cell shows once calculated
function shown(markdown: string, formula: string, tables?: TableSource, at?: { row: number; column: number }): string {
  const table = parseTable(markdown);
  const row = at?.row ?? table.rows.length - 1;
  const column = at?.column ?? table.rows[0]!.cells.length - 1;
  const rows = table.rows.map((r, i) => (i === row ? { cells: r.cells.map((c, j) => (j === column ? formulaCell("", formula) : c)) } : r));
  const value = formulaOf(recalculate({ ...table, rows }, tables).rows[row]!.cells[column]!)!.value;
  return errorCodeIn(value) ?? value;
}

const call = (name: string, ...args: Result[]): Result => {
  const f = BUILT_IN_FUNCTIONS[name]!;
  if (!takesGrids(f)) throw new Error(`${name} takes no grids`);
  return f.call(args, { row: 1, column: 1 });
};
// A grid's rows (a result that is no grid fails the test)
const rowsOf = (result: Result): Scalar[][] => {
  expect(result).toBeInstanceOf(Grid);
  return (result as Grid).rows();
};

const PEOPLE = new Grid(
  4,
  3,
  ["Anna", "dev", 30, "Petr", "ops", 12, "anna", "dev", 30, "Eva", "dev", null],
  ["Name", "Team", "Score"],
);

const TASKS = [
  "| Name | Assignee | Done | Hours |",
  "|---|---|---|---|",
  "| Login | anna | FALSE | 3 |",
  "| Docs | petr | TRUE | 2 |",
  "| Tests | anna | FALSE | 5 |",
  "| Deploy | eva | FALSE | 1 |",
  "| Total | | | 11 <meta formulas.f='=SUM([hours])'> |",
  "| <meta core.table core.name='tasks'> |",
].join("\n");

const tasks: TableSource = (name, page) => (page === undefined && name.toLowerCase() === "tasks" ? parseTable(TASKS) : undefined);
const OWN = "| A |\n|---|\n| |";

describe("a cell's result", () => {
  it("is one value: of one cell that cell, of none empty, of several #SPILL!", () => {
    expect(cellValue(new Grid(1, 1, [5]))).toBe(5);
    expect(cellValue([7])).toBe(7);
    expect(cellValue(new Grid(0, 2, []))).toBe(null);
    expect((cellValue(new Grid(2, 1, [1, 2])) as FormulaError).code).toBe("#SPILL!");
    expect((cellValue([1, 2]) as FormulaError).detail).toContain("Show result");
  });
});

describe("FILTER", () => {
  it("keeps the rows include is TRUE for, every column and their names", () => {
    const result = call("FILTER", PEOPLE, [true, false, "TRUE", 0]) as Grid;
    expect(result.rows()).toEqual([
      ["Anna", "dev", 30],
      ["anna", "dev", 30],
    ]);
    expect(result.names).toEqual(["Name", "Team", "Score"]);
  });

  it("keeps columns by a row as wide as them", () => {
    expect(rowsOf(call("FILTER", PEOPLE, new Grid(1, 3, [true, false, true])))).toEqual([
      ["Anna", 30],
      ["Petr", 12],
      ["anna", 30],
      ["Eva", null],
    ]);
  });

  it("is #CALC! when nothing is kept, unless if_empty says what to give", () => {
    expect((call("FILTER", PEOPLE, [false, false, false, false]) as FormulaError).code).toBe("#CALC!");
    expect(call("FILTER", PEOPLE, [false, false, false, false], 0)).toBe(0);
  });

  it("says what is wrong with include", () => {
    expect((call("FILTER", PEOPLE, [true, false]) as FormulaError).detail).toBe("include has 2 values and the array 4 rows");
    expect((call("FILTER", PEOPLE, [true, "maybe", true, true]) as FormulaError).code).toBe("#VALUE!");
    expect((call("FILTER", PEOPLE, PEOPLE) as FormulaError).code).toBe("#VALUE!");
    const error = new FormulaError("#REF!", "gone");
    expect(call("FILTER", error, [true])).toBe(error);
  });
});

describe("SORT and SORTBY", () => {
  it("sorts rows by a column, stable, empty cells last either way", () => {
    expect(rowsOf(call("SORT", PEOPLE, 3))).toEqual([
      ["Petr", "ops", 12],
      ["Anna", "dev", 30],
      ["anna", "dev", 30],
      ["Eva", "dev", null],
    ]);
    expect(rowsOf(call("SORT", PEOPLE, 3, -1)).map((r) => r[0])).toEqual(["Anna", "anna", "Petr", "Eva"]);
  });

  it("sorts numbers before text before logical values, text ignoring case, dates as dates", () => {
    expect(rowsOf(call("SORT", [true, "b", 10, "A", 2]))).toEqual([[2], [10], ["A"], ["b"], [true]]);
    expect(rowsOf(call("SORT", ["2025-11-06", "2025-02-10 14:00", "2024-12-31"]))).toEqual([["2024-12-31"], ["2025-02-10 14:00"], ["2025-11-06"]]);
  });

  it("sorts columns with by_col", () => {
    expect(rowsOf(call("SORT", new Grid(2, 3, [3, 1, 2, "c", "a", "b"]), 1, 1, true))).toEqual([
      [1, 2, 3],
      ["a", "b", "c"],
    ]);
  });

  it("refuses a sort_index or sort_order it cannot take", () => {
    expect((call("SORT", PEOPLE, 4) as FormulaError).detail).toBe("sort_index 4 is not one of the array's 3 columns");
    expect((call("SORT", PEOPLE, 1, 2) as FormulaError).code).toBe("#VALUE!");
  });

  it("SORTBY sorts by other columns in turn", () => {
    const names = ["Anna", "Petr", "Eva", "Ota"];
    expect(rowsOf(call("SORTBY", names, ["dev", "ops", "dev", "ops"], 1, [1, 5, 3, 2], -1))).toEqual([["Eva"], ["Anna"], ["Petr"], ["Ota"]]);
    expect((call("SORTBY", names, [1, 2]) as FormulaError).detail).toBe("by_array1 has 2 values and the array 4 rows");
  });
});

describe("UNIQUE", () => {
  it("keeps each row once in its order, text ignoring case", () => {
    expect(rowsOf(call("UNIQUE", PEOPLE))).toEqual([
      ["Anna", "dev", 30],
      ["Petr", "ops", 12],
      ["Eva", "dev", null],
    ]);
    expect(rowsOf(call("UNIQUE", ["b", "a", "B", 1, "1"]))).toEqual([["b"], ["a"], [1]]);
  });

  it("takes numbers by value and empty cells alike, an error as no other", () => {
    expect(rowsOf(call("UNIQUE", [1, "1", "1,0", null, "", 2]))).toEqual([[1], [null], [2]]);
    const error = new FormulaError("#N/A", "x");
    expect(rowsOf(call("UNIQUE", [error, error]))).toEqual([[error], [error]]);
  });

  it("keeps those occurring once, or compares columns", () => {
    expect(rowsOf(call("UNIQUE", ["a", "b", "a"], false, true))).toEqual([["b"]]);
    expect((call("UNIQUE", ["a", "a"], false, true) as FormulaError).code).toBe("#CALC!");
    expect(rowsOf(call("UNIQUE", new Grid(1, 3, ["x", "y", "x"]), true))).toEqual([["x", "y"]]);
  });
});

describe("CHOOSECOLS, TAKE and DROP", () => {
  it("picks columns by place, from the end where negative", () => {
    const result = call("CHOOSECOLS", PEOPLE, -1, 1) as Grid;
    expect(result.row(0)).toEqual([30, "Anna"]);
    expect(result.names).toEqual(["Score", "Name"]);
    expect((call("CHOOSECOLS", PEOPLE, 4) as FormulaError).detail).toBe("the array has no column 4: it has 3");
  });

  it("takes and drops rows and columns from either end", () => {
    expect(rowsOf(call("TAKE", PEOPLE, 1))).toEqual([["Anna", "dev", 30]]);
    expect(rowsOf(call("TAKE", PEOPLE, -1, 1))).toEqual([["Eva"]]);
    expect(rowsOf(call("TAKE", PEOPLE, null, -1)).map((r) => r[0])).toEqual([30, 12, 30, null]);
    expect(rowsOf(call("DROP", PEOPLE, 3))).toEqual([["Eva", "dev", null]]);
    expect(rowsOf(call("DROP", PEOPLE, -3, 2))).toEqual([[30]]);
    expect((call("TAKE", PEOPLE, 0) as FormulaError).code).toBe("#CALC!");
    expect((call("DROP", PEOPLE, 9) as FormulaError).code).toBe("#CALC!");
  });
});

describe("HSTACK and VSTACK", () => {
  const TEAMS = new Grid(2, 2, ["dev", 3, "ops", 1], ["Team", "Size"]);

  it("HSTACK puts arrays side by side, each keeping its columns' names, a shorter one padded with #N/A", () => {
    const result = call("HSTACK", PEOPLE, TEAMS, "x") as Grid;
    expect(result.names).toEqual(["Name", "Team", "Score", "Team", "Size", undefined]);
    expect(result.row(0)).toEqual(["Anna", "dev", 30, "dev", 3, "x"]);
    const last = result.row(3);
    expect(last.slice(0, 3)).toEqual(["Eva", "dev", null]);
    expect(last.slice(3).map((v) => (v as FormulaError).code)).toEqual(["#N/A", "#N/A", "#N/A"]);
  });

  it("VSTACK puts arrays one under another, named as the first, a narrower one padded with #N/A", () => {
    const result = call("VSTACK", TEAMS, PEOPLE, ["a", "b"]) as Grid;
    expect(result.names).toEqual(["Team", "Size"]);
    expect(result.width).toBe(3);
    expect(result.height).toBe(8);
    expect(result.row(0).slice(0, 2)).toEqual(["dev", 3]);
    expect((result.row(0)[2] as FormulaError).code).toBe("#N/A");
    expect(result.row(2)).toEqual(["Anna", "dev", 30]);
    expect(result.column(0).slice(6)).toEqual(["a", "b"]);
  });

  it("an array that is no grid is a column, a value one cell; an argument that is an error is the result", () => {
    expect(rowsOf(call("VSTACK", 1, [2, 3]))).toEqual([[1], [2], [3]]);
    expect(rowsOf(call("HSTACK", 1, 2))).toEqual([[1, 2]]);
    const error = new FormulaError("#CALC!", "nothing kept");
    expect(call("HSTACK", PEOPLE, error)).toBe(error);
  });

  it("an empty array adds no rows (VSTACK) and is padded (HSTACK)", () => {
    const none = new Grid(0, 2, [], ["Name", "Due"]);
    expect(rowsOf(call("VSTACK", none, TEAMS))).toEqual([["dev", 3], ["ops", 1]]);
    expect((call("VSTACK", none, TEAMS) as Grid).names).toEqual(["Name", "Due"]);
    expect((call("HSTACK", TEAMS, none) as Grid).row(1).slice(2).map((v) => (v as FormulaError).code)).toEqual(["#N/A", "#N/A"]);
  });

  it("in formulas: a column calculated beside a table's", () => {
    expect(shown(OWN, '=TEXTJOIN(";", TRUE, TAKE(HSTACK(tasks![name], "[[" & tasks![assignee] & "]]"), 1))', tasks)).toBe("Login;[[anna]]");
    expect(shown(OWN, "=COUNTA(VSTACK(tasks![name], tasks![assignee]))", tasks)).toBe("8");
    expect(shown(OWN, "=HSTACK(tasks![name], FILTER(tasks![name], tasks![hours] > 99))", tasks)).toBe("#CALC!");
  });
});

describe("SEQUENCE", () => {
  it("counts along each row first, from start by step", () => {
    expect(rowsOf(call("SEQUENCE", 3))).toEqual([[1], [2], [3]]);
    expect(rowsOf(call("SEQUENCE", 2, 3))).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(rowsOf(call("SEQUENCE", 1, 3, 0, 10))).toEqual([[0, 10, 20]]);
    expect(rowsOf(call("SEQUENCE", 2, null, 5, -1))).toEqual([[5], [4]]);
    expect((call("SEQUENCE", 2) as Grid).names).toEqual([]);
  });

  it("is #CALC! of none, #VALUE! of fewer or more than Excel's sheet has", () => {
    expect((call("SEQUENCE", 0) as FormulaError).code).toBe("#CALC!");
    expect((call("SEQUENCE", 2, 0) as FormulaError).code).toBe("#CALC!");
    expect((call("SEQUENCE", -1) as FormulaError).detail).toBe("rows is a count, not -1");
    expect((call("SEQUENCE", 1_048_577) as FormulaError).detail).toBe("rows is at most 1,048,576, as in Excel");
    expect((call("SEQUENCE", 1, 16_385) as FormulaError).code).toBe("#VALUE!");
    expect((call("SEQUENCE", 2, 1, "x") as FormulaError).code).toBe("#VALUE!");
  });

  it("in formulas: reduced to one value, else #SPILL!", () => {
    expect(shown(OWN, "=SUM(SEQUENCE(10))", tasks)).toBe("55");
    expect(shown(OWN, "=SEQUENCE(1, 1, 0.1)", tasks)).toBe("0.1");
    expect(shown(OWN, "=SEQUENCE(3)", tasks)).toBe("#SPILL!");
  });
});

describe("arrays in formulas", () => {
  it("reduce to one value in a cell", () => {
    expect(shown(OWN, "=COUNTA(UNIQUE(tasks![assignee]))", tasks)).toBe("3");
    expect(shown(OWN, "=SUM(FILTER(tasks![hours], tasks![done] = FALSE))", tasks)).toBe("9");
    expect(shown(OWN, '=TEXTJOIN(", ", TRUE, SORT(UNIQUE(tasks![assignee])))', tasks)).toBe("anna, eva, petr");
    expect(shown(OWN, "=SUM(TAKE(SORT(tasks![hours], 1, -1), 2))", tasks)).toBe("8");
  });

  it("of one value are that value", () => {
    expect(shown(OWN, "=TAKE(SORTBY(tasks![name], tasks![hours], -1), 1)", tasks)).toBe("Tests");
  });

  it("of several values are #SPILL! in a cell", () => {
    expect(shown(OWN, "=UNIQUE(tasks![assignee])", tasks)).toBe("#SPILL!");
    expect(shown(OWN, "=FILTER(tasks![name], tasks![hours] > 100)", tasks)).toBe("#CALC!");
    expect(shown(OWN, '=FILTER(tasks![name], tasks![hours] > 100, "none")', tasks)).toBe("none");
  });

  it("[#Data] is the table's body without its total rows, its columns named", () => {
    expect(shown(OWN, "=COUNTA(tasks![#Data])", tasks)).toBe("16");
    expect(shown(OWN, "=COUNTA(CHOOSECOLS(FILTER(tasks![#Data], tasks![assignee] = \"anna\"), 1))", tasks)).toBe("2");
    expect(shown(OWN, "=TAKE(SORT(tasks![#Data], 4), 1, 1)", tasks)).toBe("Deploy");
    // A table's own, bare: its row is a total row then, left out of it (as Excel's totals row is out of [#Data])
    expect(shown(TASKS, "=COUNTA([#Data])", undefined, { row: 5, column: 0 })).toBe("16");
    expect(shown(TASKS, "=SUM([#Data])", undefined, { row: 1, column: 0 })).toBe("8");
  });

  it("keeps a reference's shape for the functions taking arrays, a list for the others", () => {
    const table = "| A | B |\n|---|---|\n| 3 | x |\n| 1 | y |\n| 2 | z |\n| | |";
    expect(shown(table, "=TAKE(SORT(A1:B3), -1, -1)", undefined, { row: 4, column: 0 })).toBe("x");
    expect(shown(table, '=TEXTJOIN("", TRUE, A1:B3)', undefined, { row: 4, column: 0 })).toBe("3x1y2z");
    expect(shown(table, '=TEXTJOIN("", TRUE, SORT(A1:B3))', undefined, { row: 4, column: 0 })).toBe("1y2z3x");
  });

  it("operators work on a column or row of them, not on several rows and columns; on none, none", () => {
    // A table without rows: an operator on its body is on no values
    const empty: TableSource = (name) => (name === "empty" ? parseTable(["| A | B |", "|---|---|"].join("\n")) : undefined);
    expect(shown(OWN, "=SUM(empty![#Data] * 1)", empty)).toBe("0");
    expect(shown(OWN, "=SUM(FILTER(tasks![hours], tasks![done] = FALSE) * 2)", tasks)).toBe("18");
    expect(shown(OWN, "=SUM(tasks![#Data] * 1)", tasks)).toBe("#VALUE!");
  });

  it("of a table the page has not are #REF!", () => {
    expect(metaName(parseTable(TASKS))).toBe("tasks");
    expect(shown(OWN, "=SUM(nope![#Data])", tasks)).toBe("#REF!");
  });
});
