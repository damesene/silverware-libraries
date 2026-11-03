import { describe, expect, it } from "vitest";
import { meets } from "./criteria.ts";
import { dataOf, tablesOf } from "./markdown.ts";
import { conditionOf, readMermaid, writeMermaid } from "../formats/mermaid.ts";
import type { ChartModel } from "../core/model.ts";

describe("criteria as the -IFS functions write them", () => {
  it("compares numbers as numbers, texts in any case, with wildcards", () => {
    expect([meets("120", "> 100"), meets("90", ">100"), meets("100", ">=100"), meets("12,5 €", "<13"), meets("7", "7")]).toEqual([true, false, true, true, true]);
    expect([meets("Done", "done"), meets("done", "= Done"), meets("open", "<>done"), meets("apple", "app*"), meets("cat", "?at"), meets("a*b", "a~*b"), meets("axb", "a~*b")]).toEqual([true, true, true, true, true, true, false]);
    expect([meets("", ""), meets("x", "="), meets("x", "<>"), meets("", "<>")]).toEqual([true, false, true, false]);
    expect([meets("b", "> a"), meets("", "> a")]).toEqual([true, false]);
    // A code with digits in it is a text: A1 is not B1, Q1 not 1, Room 12 not over 5
    expect([meets("B1", "= A1"), meets("A1", "= A1"), meets("Q1", "= 1"), meets("Room 12", "> 5")]).toEqual([false, true, false, false]);
  });
});

const TABLE = `| Month | Status | Revenue |
|---|---|--:|
| Jan | done | 10 |
| Feb | open | 20 |
| Mar | done | 30 |
| Apr | done | 40 |
`;

describe("a source's rows", () => {
  const table = tablesOf(TABLE)[0]!;
  const source = { table: "above", labels: "Month", series: ["Revenue"] };

  it("are those where every condition holds, then the first or last so many", () => {
    expect(dataOf(table, { ...source, where: [{ column: "Status", criterion: "= done" }] }, "t")).toEqual({ labels: ["Jan", "Mar", "Apr"], series: [[10, 30, 40]] });
    expect(dataOf(table, { ...source, where: [{ column: "status", criterion: "done" }, { column: "Revenue", criterion: "> 15" }] }, "t")).toEqual({ labels: ["Mar", "Apr"], series: [[30, 40]] });
    expect(dataOf(table, { ...source, rows: { from: "first", count: 2 } }, "t")).toEqual({ labels: ["Jan", "Feb"], series: [[10, 20]] });
    expect(dataOf(table, { ...source, where: [{ column: "Status", criterion: "done" }], rows: { from: "last", count: 2 } }, "t")).toEqual({ labels: ["Mar", "Apr"], series: [[30, 40]] });
    expect(dataOf(table, { ...source, rows: { from: "last", count: 9 } }, "t")).toMatchObject({ labels: ["Jan", "Feb", "Mar", "Apr"] });
  });

  it("say a condition's column the table has not", () => {
    expect(dataOf(table, { ...source, where: [{ column: "State", criterion: "done" }] }, "the table")).toEqual({ problem: "the table has no column State to filter by (it has Month, Status, Revenue)" });
  });
});

describe("rows and where in Mermaid's comments", () => {
  it("are read and written back, a where a line each", () => {
    const block = 'xychart-beta\n  x-axis ["Mar"]\n  bar "Revenue" [30]\n%% chart.source: above\n%% chart.labels: Month\n%% chart.series: Revenue\n%% chart.where: Status = done\n%% chart.where: Revenue > 15\n%% chart.rows: last 2';
    const model = readMermaid(block) as ChartModel;
    expect(model.source).toEqual({ table: "above", labels: "Month", series: ["Revenue"], where: [{ column: "Status", criterion: "= done" }, { column: "Revenue", criterion: "> 15" }], rows: { from: "last", count: 2 } });
    expect(writeMermaid(model)).toBe(block);
  });

  it("read a condition's column up to its operator, a rows that says nothing kept as written", () => {
    expect(conditionOf("Unit price <= 3")).toEqual({ column: "Unit price", criterion: "<= 3" });
    expect(conditionOf("no operator")).toBeUndefined();
    expect((readMermaid('pie\n  "a" : 1\n%% chart.source: above\n%% chart.series: a\n%% chart.rows: some') as ChartModel).extra).toEqual({ rows: "some" });
  });
});
