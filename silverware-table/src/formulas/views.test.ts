import { describe, expect, it } from "vitest";
import { metaName, metaValue } from "../meta.ts";
import { pageTablesOf, parseTable, type Table } from "../markdown.ts";
import { VIEW_CELLS } from "../testing/formulas.ts";
import { evaluateFormula, FormulaError, Grid, recalculate, referredPages, referredTableNames, viewResult } from "./index.ts";
import { pageTables, tablesWritten } from "./page.ts";

const TASKS = [
  "| Name | Assignee | Hours |",
  "|---|---|--:|",
  "| Write | anna | 3 |",
  "| Test | petr | 1 |",
  "| Ship | anna | 2 |",
  "| <meta core.table core.name='tasks'> |",
].join("\n");

/** A view of `formula`, as written before (its body stale) */
const VIEW = (formula: string, name = "mine", body = "| x |\n|---|\n| old |") => `${body}\n| <meta core.table core.name='${name}' view.formula='${formula}'> |`;

/** The page's tables as formulas see them, with views */
function sourceOf(page: string, here = "Page", others?: Record<string, string>) {
  const named = (text: string) => pageTablesOf(text).map((t) => ({ ...t, name: metaName(t.table) }));
  return pageTables(VIEW_CELLS, () => named(page), here, undefined, others && { pages: { tables: (p) => (p in others ? named(others[p]!) : undefined) } });
}

/** The page's table named so */
const tableNamed = (page: string, name: string): Table => pageTablesOf(page).find((t) => metaName(t.table) === name)!.table;

/** A view's formula as written in its metadata row */
const formulaOf = (table: Table) => metaValue(table, "view", "formula") ?? "";

const resultOf = (page: string, name: string) => {
  const table = tableNamed(page, name);
  return metaValue(table, "view", "formula") === undefined ? undefined : viewResult(table, { cells: VIEW_CELLS, tables: sourceOf(page), name }, formulaOf(table));
};

describe("views in formulas", () => {
  it("calculates a view's formula as a grid, its columns named after their sources", () => {
    const page = `${TASKS}\n\n${VIEW("=FILTER(tasks![#Data], tasks![assignee] = \"anna\")")}\n`;
    const result = resultOf(page, "mine") as Grid;
    expect(result.rows()).toEqual([
      ["Write", "anna", 3],
      ["Ship", "anna", 2],
    ]);
    expect(result.names).toEqual(["Name", "Assignee", "Hours"]);
  });

  it("makes one value a table of one cell and a list one column", () => {
    const one = resultOf(`${TASKS}\n\n${VIEW("=SUM(tasks![hours])")}\n`, "mine") as Grid;
    expect([one.height, one.width, one.at(0, 0)]).toEqual([1, 1, 6]);
    const list = resultOf(`${TASKS}\n\n${VIEW("=UNIQUE(tasks![assignee])")}\n`, "mine") as Grid;
    expect([list.height, list.width]).toEqual([2, 1]);
    expect(list.column(0)).toEqual(["anna", "petr"]);
  });

  it("gives an empty result no rows, and an error as the error (nothing is written)", () => {
    const none = "| Name |\n|---|\n| <meta core.table core.name='none'> |";
    const empty = resultOf(`${none}\n\n${VIEW("=SORT(none![#Data])")}\n`, "mine") as Grid;
    expect([empty.height, empty.width]).toEqual([0, 1]);
    // (A value's > written &gt;, as the view module writes it: a > ends the <meta> tag)
    const nothing = resultOf(`${TASKS}\n\n${VIEW("=FILTER(tasks![name], tasks![hours] &gt; 10)")}\n`, "mine");
    expect(nothing).toBeInstanceOf(FormulaError);
    expect((nothing as FormulaError).code).toBe("#CALC!");
    const gone = resultOf(`${VIEW("=SORT(nothing![#Data])")}\n`, "mine");
    expect((gone as FormulaError).code).toBe("#REF!");
  });

  it("is no view without a formula", () => {
    expect(resultOf(`${TASKS}\n`, "tasks")).toBeUndefined();
  });

  it("is #CYCLE! where the view reads itself, by its name or bare, or two views read each other", () => {
    expect((resultOf(`${VIEW("=SORT(mine![#Data])")}\n`, "mine") as FormulaError).code).toBe("#CYCLE!");
    expect((resultOf(`${VIEW("=SORT([x])")}\n`, "mine") as FormulaError).code).toBe("#CYCLE!");
    expect((resultOf(`${VIEW("=A1")}\n`, "mine") as FormulaError).code).toBe("#CYCLE!");
    // A name of no cell of its own: as in any formula, #NAME? saying why, not a cycle
    expect((resultOf(`${TASKS}\n\n${VIEW("=FILTER(tasks![name], vat)")}\n`, "mine") as FormulaError).code).toBe("#NAME?");
    const pair = `${VIEW("=SORT(b![#Data])", "a")}\n\n${VIEW("=SORT(a![#Data])", "b")}\n`;
    expect((resultOf(pair, "a") as FormulaError).code).toBe("#CYCLE!");
    expect((resultOf(pair, "b") as FormulaError).code).toBe("#CYCLE!");
    // Told by its name, whichever object of its table is calculated (a copy, as a view's Out of date check holds)
    const copy = parseTable(pageTablesOf(pair)[0]!.range.text);
    const cycle = viewResult(copy, { cells: VIEW_CELLS, tables: sourceOf(pair), name: "a" }, formulaOf(copy)) as FormulaError;
    expect(cycle.detail).toBe("the table b cannot be calculated: the table a depends on its own result");
  });

  it("is read by other formulas as calculated now, not as written: a table reading it follows its source", () => {
    const view = VIEW("=FILTER(tasks![#Data], tasks![assignee] = \"anna\")", "mine", "| Name | Assignee | Hours |\n|---|---|--:|\n| Write | anna | 3 |");
    const page = `${TASKS}\n\n${view}\n`;
    // Written before Ship was anna's: 3; calculated now, 5
    expect(evaluateFormula("=SUM(mine![hours])", { cells: VIEW_CELLS, tables: sourceOf(page) })).toBe(5);
    expect(evaluateFormula("=ROWS(mine![#Data])", { cells: VIEW_CELLS, tables: sourceOf(page) })).toBeInstanceOf(FormulaError);
    // A view's error, read by another formula: that error, saying which view
    const broken = `${VIEW("=SORT(gone![#Data])")}\n`;
    const read = evaluateFormula("=SUM(mine![x])", { cells: VIEW_CELLS, tables: sourceOf(broken) }) as FormulaError;
    expect(read.code).toBe("#REF!");
    expect(read.detail).toContain("the table mine cannot be calculated");
  });

  it("is calculated by a cell reading a view that reads another view", () => {
    const first = VIEW("=FILTER(tasks![#Data], tasks![hours] &gt; 1)", "big");
    const second = VIEW("=CHOOSECOLS(big![#Data], 3)", "hours");
    const total = "| Total |\n|---|\n| 0 <meta formulas.f='=SUM(hours![hours])'> |";
    const page = `${TASKS}\n\n${first}\n\n${second}\n\n${total}\n`;
    const table = recalculate(parseTable(total), { cells: VIEW_CELLS, tables: sourceOf(page) });
    expect(table.rows[1]!.cells[0]).toBe("5 <meta formulas.f='=SUM(hours![hours])'>");
  });

  it("keeps what it shows where its formula reads a page formulas may not read", () => {
    const page = `${VIEW("=SORT([[Other]]tasks![#Data])")}\n`;
    expect(viewResult(tableNamed(page, "mine"), { cells: VIEW_CELLS, tables: sourceOf(page), name: "mine" }, formulaOf(tableNamed(page, "mine")))).toBeUndefined();
    // Read: calculated
    const read = viewResult(tableNamed(page, "mine"), { cells: VIEW_CELLS, tables: sourceOf(page, "Page", { Other: TASKS }), name: "mine" }, formulaOf(tableNamed(page, "mine"))) as Grid;
    expect(read.height).toBe(3);
  });

  it("counts a view's formula among what its table refers to: tables, pages, and so the tables a write recalculates", () => {
    const view = parseTable(VIEW("=SORT(tasks![#Data])"));
    expect(referredTableNames(VIEW_CELLS, view)).toEqual(new Set(["tasks"]));
    expect(referredPages(VIEW_CELLS, parseTable(VIEW("=SORT([[Other]]tasks![#Data])")))).toEqual(new Set(["Other"]));
    const total = "| Total |\n|---|\n| 0 <meta formulas.f='=SUM(mine![hours])'> |";
    const page = `${TASKS}\n\n${VIEW("=SORT(tasks![#Data])")}\n\n${total}\n`;
    const all = pageTablesOf(page).map((t) => ({ ...t, name: metaName(t.table) }));
    expect(tablesWritten(VIEW_CELLS, all, all[0]!.range.text).length).toBe(3);
  });
});
