import { describe, expect, it } from "vitest";
import { parseTable } from "../markdown.ts";
import { CELLS } from "../testing/formulas.ts";
import { definitionAttributes, groupFormula, type Key, type PivotDefinition, readDefinition, splitList, valueItem, valueParts } from "./definition.ts";
import { pivotOf } from "./pivot.ts";

const ORDERS = parseTable(`| Date | Region | Product | Category | Qty | Revenue |
|---|---|---|---|--:|--:|
| 2026-01-08 | East | Laptop | Hardware | 2 | 2400 |
| 2026-01-15 | West | Mouse | Hardware | 10 | 250 |
| 2026-01-21 | East | Support plan | Services | 1 | 600 |
| 2026-01-29 | North | Laptop | Hardware | 1 | 1200 |
| 2026-02-03 | West | Laptop | Hardware | 3 | 3600 |
| 2026-02-11 | East | Mouse | Hardware | 5 | 125 |
| 2026-02-17 | North | Training | Services | 2 | 900 |
| 2026-02-25 | West | Support plan | Services | 2 | 1200 |
| 2026-03-04 | East | Laptop | Hardware | 1 | 1200 |
| 2026-03-12 | North | Mouse | Hardware | 8 | 200 |
| 2026-03-19 | West | Training | Services | 1 | 450 |
| 2026-03-27 | East | Support plan | Services | 3 | 1800 |`);

const definition = (attributes: Partial<Record<Key, string>>): PivotDefinition => {
  const read = readDefinition((key) => ({ source: "orders", ...attributes })[key]);
  if (!read || "problem" in read) throw new Error(`no definition: ${read && read.problem}`);
  return read;
};
const pivot = (attributes: Partial<Record<Key, string>>, source = ORDERS) => pivotOf(source, definition(attributes), { cells: CELLS });
const table = (attributes: Partial<Record<Key, string>>) => {
  const { columns, body } = pivot(attributes);
  return [columns.map((c) => c.header), ...body];
};

describe("a pivot's definition", () => {
  it("splits lists at the commas outside parentheses and quotes", () => {
    expect(splitList('SUM([revenue]), TEXT([@date], "yyyy, mm"), AVERAGE([qty])')).toEqual(["SUM([revenue])", 'TEXT([@date], "yyyy, mm")', "AVERAGE([qty])"]);
    expect(splitList(" region ,  ")).toEqual(["region"]);
  });

  it("is read from its attributes, written back with what it says apart from the defaults", () => {
    const read = definition({ rows: "region", values: "SUM([revenue])", sort: "SUM([revenue]) desc, region" });
    expect(read).toEqual({ source: "orders", rows: ["region"], columns: [], values: ["SUM([revenue])"], sort: [{ by: "SUM([revenue])", descending: true }, { by: "region", descending: false }], totals: "both" });
    expect(definitionAttributes(read)).toEqual([
      ["source", "orders"],
      ["rows", "region"],
      ["values", "SUM([revenue])"],
      ["sort", "SUM([revenue]) desc, region"],
    ]);
  });

  it("is none without a source, and says what is missing or wrong", () => {
    expect(readDefinition(() => undefined)).toBeUndefined();
    expect(readDefinition((key) => ({ source: "orders", rows: "region" })[key as "source"])).toEqual({ problem: "it says no values (pivot.values: SUM([revenue]))" });
    expect(readDefinition((key) => ({ source: "orders", rows: "region", values: "SUM([qty])", totals: "all" })[key as "source"])).toEqual({ problem: 'its totals are "all" (both, rows, columns or none)' });
  });

  it("reads a value's share as a call of SHARE, the whole value only, of the total where it says no other", () => {
    expect(valueParts("SHARE(SUM([revenue]))")).toEqual({ formula: "SUM([revenue])", show: "total" });
    expect(valueParts('share( SUM([qty] * 2), "Row" )')).toEqual({ formula: "SUM([qty] * 2)", show: "row" });
    expect(valueParts("SUM([revenue])")).toEqual({ formula: "SUM([revenue])", show: "" });
    // Not a share: SHARE within a formula, of something else, with an argument it does not take
    for (const item of ["SHARE(SUM([a])) + SHARE(SUM([b]))", "SHARE(SUM([a])) * 100", 'SHARE(SUM([a]), "page")', 'SHARE(SUM([a]), "row", 1)', "SHARE()"]) expect(valueParts(item)).toEqual({ formula: item, show: "" });
    expect(valueItem("SUM([qty])", "column")).toBe('SHARE(SUM([qty]), "column")');
    expect(valueItem("SUM([qty])", "total")).toBe("SHARE(SUM([qty]))");
    expect(splitList('SHARE(SUM([revenue]), "row"), COUNTA([date])')).toEqual(['SHARE(SUM([revenue]), "row")', "COUNTA([date])"]);
  });

  it("is not a share where SHARE is not the whole value: an unknown function there", () => {
    expect(table({ rows: "region", values: "SHARE(SUM([revenue])) * 100", totals: "none" })[1]).toEqual(["East", "#NAME?"]);
  });

  it("takes a column's name for its cell in the row, a formula as it is", () => {
    expect(groupFormula("region")).toBe("[@region]");
    expect(groupFormula("Unit price")).toBe("[@Unit price]");
    expect(groupFormula('TEXT([@date], "yyyy")')).toBe('TEXT([@date], "yyyy")');
  });
});

describe("a pivot calculated", () => {
  it("groups by a column, sums each group, a total row last", () => {
    expect(table({ rows: "region", values: "SUM([revenue])" })).toEqual([
      ["Region", "Sum of Revenue"],
      ["East", "6125"],
      ["North", "2300"],
      ["West", "5500"],
      ["Total", "13925"],
    ]);
  });

  it("makes columns of a column's groups, with the rows' totals and the totals' row", () => {
    expect(table({ rows: "region", columns: 'TEXT([@date], "mm")', values: "SUM([revenue])" })).toEqual([
      ["Region", "01", "02", "03", "Total"],
      ["East", "3000", "125", "3000", "6125"],
      ["North", "1200", "900", "200", "2300"],
      ["West", "250", "4800", "450", "5500"],
      ["Total", "4450", "5825", "3650", "13925"],
    ]);
    // Year and month: the months of each year apart, in their order
    expect(table({ rows: "region", columns: 'TEXT([@date], "yyyy-mm")', values: "SUM([revenue])", totals: "none" })[0]).toEqual(["Region", "2026-01", "2026-02", "2026-03"]);
  });

  it("calculates several values, each over the group's rows (an average of its rows, not of the others')", () => {
    expect(table({ rows: "category", values: "COUNTA([date]), SUM([qty]), SUM([revenue]), AVERAGE([revenue])" })).toEqual([
      ["Category", "Count of Date", "Sum of Qty", "Sum of Revenue", "Average of Revenue"],
      ["Hardware", "7", "30", "8975", "1282.1428571429"],
      ["Services", "5", "9", "4950", "990"],
      ["Total", "12", "39", "13925", "1160.4166666667"],
    ]);
  });

  it("counts only the rows where its condition holds, sorted by a value", () => {
    expect(table({ rows: "product", values: "SUM([qty]), SUM([revenue])", where: '[@category] = "Hardware"', sort: "SUM([revenue]) desc", totals: "none" })).toEqual([
      ["Product", "Sum of Qty", "Sum of Revenue"],
      ["Laptop", "7", "8400"],
      ["Mouse", "23", "575"],
    ]);
    expect(table({ rows: "region", values: "SUM([revenue])", where: 'OR([@region] = "East", [@qty] > 5)', totals: "none" })).toEqual([
      ["Region", "Sum of Revenue"],
      ["East", "6125"],
      ["North", "200"],
      ["West", "250"],
    ]);
  });

  it("groups by several rows, a formula of a row among them, its header the column it reads", () => {
    const { columns, body } = pivot({ rows: 'category, TEXT([@date], "yyyy-mm")', values: "SUM([qty] * 1)", totals: "none" });
    expect(columns.map((c) => c.header)).toEqual(["Category", "Date", "SUM([qty] * 1)"]);
    expect(body.slice(0, 2)).toEqual([
      ["Hardware", "2026-01", "13"],
      ["Hardware", "2026-02", "8"],
    ]);
  });

  it("reads formula cells as they show, keeps a column's type in a value of its unit", () => {
    const priced = parseTable(`| Item | Price #euro |
|---|--:|
| a | 1<meta formulas.f='=1+1'> |
| a | 3 |`);
    const { columns, body } = pivotOf(priced, definition({ rows: "item", values: "SUM([price]), COUNTA([price])" }), { cells: CELLS });
    expect(columns.map((c) => c.header)).toEqual(["Item", "Sum of Price #euro", "Count of Price"]);
    // The formula's result as written (1), not calculated anew (2)
    expect(body[0]).toEqual(["a", "4", "2"]);
  });

  it("counts the rows a regular expression matches (REGEXTEST)", () => {
    expect(table({ rows: "product", values: "SUM([qty])", where: 'REGEXTEST([@product], "^(laptop|mouse)$", 1)', totals: "none" })).toEqual([
      ["Product", "Sum of Qty"],
      ["Laptop", "7"],
      ["Mouse", "23"],
    ]);
  });

  it("keeps a type's hashtag apart from the value's name, wherever the source's header had it", () => {
    const rated = parseTable("| Item | #stars Rating |\n|---|---|\n| a | 4 |\n| a | 2 |");
    expect(pivotOf(rated, definition({ rows: "item", values: "AVERAGE([rating])" }), { cells: CELLS }).columns.map((c) => c.header)).toEqual(["Item", "Average of Rating #stars"]);
  });

  it("shows a value as its share of the grand total, beside the value itself, as a percentage", () => {
    expect(table({ rows: "region", values: "SUM([revenue]), SHARE(SUM([revenue]))" })).toEqual([
      ["Region", "Sum of Revenue", "Sum of Revenue (% of total) #percent-1"],
      ["East", "6125", "0.4399"],
      ["North", "2300", "0.1652"],
      ["West", "5500", "0.395"],
      ["Total", "13925", "1"],
    ]);
  });

  it("shows a cross table's values as shares of their row's total or of their column's, a column of one value typed too", () => {
    expect(table({ rows: "region", columns: "category", values: 'SHARE(SUM([revenue]), "row")' })).toEqual([
      ["Region", "Hardware #percent-1", "Services #percent-1", "Total #percent-1"],
      ["East", "0.6082", "0.3918", "1"],
      ["North", "0.6087", "0.3913", "1"],
      ["West", "0.7", "0.3", "1"],
      ["Total", "0.6445", "0.3555", "1"],
    ]);
    expect(table({ rows: "region", columns: "category", values: 'SHARE(SUM([revenue]), "column")' }).slice(1)).toEqual([
      ["East", "0.415", "0.4848", "0.4399"],
      ["North", "0.156", "0.1818", "0.1652"],
      ["West", "0.429", "0.3333", "0.395"],
      ["Total", "1", "1", "1"],
    ]);
  });

  it("sorts by a share as by its value, says a share of nothing #DIV/0!", () => {
    expect(table({ rows: "region", values: "SHARE(SUM([revenue]))", sort: "SHARE(SUM([revenue])) desc", totals: "none" }).map((r) => r[0])).toEqual(["Region", "East", "West", "North"]);
    expect(table({ rows: "region", values: "SHARE(SUM([revenue] * 0))", totals: "none" })[1]).toEqual(["East", "#DIV/0!"]);
  });

  it("keeps a share's own id, apart from the value's", () => {
    expect(pivot({ rows: "region", values: "SUM([revenue]), SHARE(SUM([revenue]))" }).columns.map((c) => c.id)).toEqual(["row:region", "value:SUM([revenue])", "value:SHARE(SUM([revenue]))"]);
  });

  it("gives each column an id that stays as its data change", () => {
    expect(pivot({ rows: "region", columns: 'TEXT([@date], "mm")', values: "SUM([revenue])" }).columns.map((c) => c.id)).toEqual([
      "row:region",
      "column:01|SUM([revenue])",
      "column:02|SUM([revenue])",
      "column:03|SUM([revenue])",
      "total|SUM([revenue])",
    ]);
  });
});
