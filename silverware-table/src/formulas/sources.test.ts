import { describe, expect, it } from "vitest";
import { sourceTable } from "../features/sources.ts";
import { parseTable, type Table } from "../markdown.ts";
import { CELLS, formulaCell, formulaErrors, pageTables, recalculate, shiftReferences } from "../testing/formulas.ts";
import { evaluateFormula, formulaChoices, FormulaError, formulaSources, listResult, references, sourceChoices, tokenize, withColumnKeys } from "./index.ts";
import { parse } from "./parser.ts";
import { isError } from "./values.ts";

const TASKS = sourceTable({
  columns: ["name", "due", "done"],
  rows: [
    ["Write", "2025-11-10", "TRUE"],
    ["Test", "2025-11-12", "FALSE"],
    ["Ship", "2025-11-14", "FALSE"],
  ],
});

/** The sources of the space as the sources module offers them: `tasks`, `people` defined but not read, no other */
const SOURCES = (name: string): Table | null | undefined => (name.toLowerCase() === "tasks" ? TASKS : name.toLowerCase() === "people" ? undefined : null);

/** A page of no tables, the sources given (or not: none offered) */
const tables = (source: ((name: string) => Table | null | undefined) | undefined = SOURCES) => pageTables(() => [], "Page", undefined, undefined, source);

const value = (formula: string, source?: (name: string) => Table | null | undefined) => evaluateFormula(formula, { cells: CELLS, tables: tables(source) });

describe("sources in formulas", () => {
  it("reads a source's column, its body, or the source alone as its body", () => {
    expect(value("=COUNTA(@tasks[name])")).toBe(3);
    expect(value('=TEXTJOIN(", ", TRUE, @tasks[name])')).toBe("Write, Test, Ship");
    expect(value("=COUNTA(@tasks)")).toBe(9);
    expect(value("=COUNTA(CHOOSECOLS(@tasks[#Data], 2))")).toBe(3);
    expect(value('=COUNTIFS(@Tasks[done], "FALSE")')).toBe(2);
    expect(value('=TAKE(FILTER(@tasks[name], @tasks[done] = "FALSE"), 1)')).toEqual(["Test"]);
  });

  it("is #REF! where the space has no source of the name, or it is not read", () => {
    const none = value("=SUM(@nope[name])");
    expect(isError(none) && none.code).toBe("#REF!");
    expect(isError(none) && none.detail).toMatch(/no source named nope/);
    const unread = value("=SUM(@people[name])");
    expect(isError(unread) && unread.detail).toMatch(/not read yet/);
    const column = value("=SUM(@tasks[owner])");
    expect(isError(column) && column.code).toBe("#REF!");
  });

  it("keeps a cell's result where a source it reads is not read, or sources are not offered", () => {
    const table = parseTable(["| Open |", "|---|", `| ${formulaCell("7", '=COUNTIFS(@people[name], "x")')} |`].join("\n"));
    expect(recalculate(table, tables())).toBe(table);
    const reading = parseTable(["| Open |", "|---|", `| ${formulaCell("7", "=COUNTA(@tasks[name])")} |`].join("\n"));
    expect(recalculate(reading, pageTables(() => [], "Page"))).toBe(reading);
    // Read: calculated
    expect(CELLS.formulaOf(recalculate(reading, tables()).rows[1]!.cells[0]!)?.value).toBe("3");
    // None yet and not read: why, as its error
    const empty = parseTable(["| Open |", "|---|", `| ${formulaCell("", "=COUNTA(@people[name])")} |`].join("\n"));
    expect(formulaErrors(empty, tables()).get("1,0")).toMatch(/the source people is not read yet/);
  });

  it("reads a source's values as data: a hidden tag in one is no formula nor name, an error message names the source whole", () => {
    const rows = sourceTable({ columns: ["total"], rows: [["42 <meta formulas.f='=SUM([qty])' core.n='pear'>"]] });
    const source = (name: string) => (name === "rows" ? rows : null);
    expect(value("=SUM(@rows[total])", source)).toBe(42);
    const missing = value("=SUM(@tasks[nope])");
    expect(isError(missing) && missing.detail).toBe('there is no column named "nope" in @tasks');
  });

  it("reads a source by @ and a name only: no cells, no row of the formula's", () => {
    expect(tokenize("=@tasks!A1").error?.detail).toMatch(/a source has no cells/);
    expect(tokenize("=@ + 1").error?.detail).toMatch(/followed by a source's name/);
    const thisRow = parse("=@tasks[@due]");
    expect(isError(thisRow) && thisRow.detail).toMatch(/no row of the formula's/);
    expect(formulaSources("=SUM(@tasks[n]) + COUNTA(@people)")).toEqual(["tasks", "people"]);
  });

  it("leaves a source's columns out of the page's references: nothing follows the table's own columns into them", () => {
    expect(references("=@tasks[due] + [due]").map((r) => r.from)).toEqual([15]);
    expect(withColumnKeys("=@tasks[Due] & [Due]", ["Due"])).toBe("=@tasks[Due] & [due]");
    // The table's column due renamed: its own reference follows, the source's stays
    const before = parseTable(["| Due | Late |", "|---|---|", `| x | ${formulaCell("", "=COUNTIFS(@tasks[due], [@due])")} |`].join("\n"));
    const after = parseTable(["| When | Late |", "|---|---|", `| x | ${formulaCell("", "=COUNTIFS(@tasks[due], [@due])")} |`].join("\n"));
    const followed = shiftReferences(before, after);
    expect(CELLS.formulaOf(followed.rows[1]!.cells[1]!)?.formula).toBe("=COUNTIFS(@tasks[due], [@when])");
  });
});

describe("sources offered while a formula is typed", () => {
  const names = sourceChoices([
    { name: "tasks", columns: ["name", "Due date"] },
    { name: "people", columns: ["value"] },
  ]);

  it("offers the sources after @, and among the names", () => {
    expect(formulaChoices("=@", 2, 2, names)?.choices.map((c) => c.name)).toEqual(["people", "tasks"]);
    expect(formulaChoices("=COUNTA(@ta", 11, 11, names)).toMatchObject({ from: 8, to: 11, choices: [{ kind: "source", name: "tasks" }] });
    expect(formulaChoices("=ta", 3, 3, names)?.choices[0]).toMatchObject({ kind: "source", name: "tasks" });
  });

  it("offers a source's columns in its brackets, not the table's", () => {
    const found = formulaChoices("=@tasks[du", 10, 10, names, undefined, [{ name: "Duty", id: "duty" }]);
    expect(found?.choices).toEqual([{ kind: "column", name: "Due date", id: "due_date", source: "tasks" }]);
    expect(formulaChoices("=@tasks[@", 9, 9, names)).toBeUndefined();
  });
});

describe("a list's formula (a choice list made by one)", () => {
  const own = parseTable(["| Status | Done |", "|---|---|", "| open | 1 |", "| done | TRUE |", "| open | 2.5 |"].join("\n"));
  const list = (formula: string) => listResult(own, { cells: CELLS, tables: tables() }, formula);

  it("gives a source's values, its own table's columns, numbers and logical values as cells show them", () => {
    expect(list("=@tasks[name]")).toEqual(["Write", "Test", "Ship"]);
    expect(list("=SORT(UNIQUE([status]))")).toEqual(["done", "open"]);
    expect(list("=[done]")).toEqual(["1", "TRUE", "2.5"]);
    expect(list('="one"')).toEqual(["one"]);
  });

  it("is why where its result has several columns or is an error; undefined where it reads a source not read", () => {
    const wide = list("=@tasks") as FormulaError;
    expect(wide.code).toBe("#VALUE!");
    expect(wide.detail).toMatch(/3 columns: pick one/);
    expect((list("=@nope[x]") as FormulaError).code).toBe("#REF!");
    expect(list("=@people[name]")).toBeUndefined();
  });
});
