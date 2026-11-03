import { describe, expect, it } from "vitest";
import { readDefinition } from "./definition.ts";
import { definitionOf, fieldsOf, groupText, readGroup, readValue } from "./fields.ts";

const definition = (attributes: Record<string, string>) => {
  const all: Record<string, string> = { source: "orders", ...attributes };
  const read = readDefinition((key) => all[key]);
  if (!read || "problem" in read) throw new Error("no definition");
  return read;
};

describe("a pivot's fields", () => {
  it("make a group of a column, grouped by its dates, and read it back", () => {
    for (const grouping of ["", "year", "quarter", "yearMonth", "month", "day"] as const) expect(readGroup(groupText({ column: "date", grouping }))).toEqual({ column: "date", grouping });
    expect(groupText({ column: "region", grouping: "" })).toBe("region");
    expect(groupText({ column: "date", grouping: "yearMonth" })).toBe('TEXT([@date], "yyyy-mm")');
    // A formula the dialog makes none of: kept as it is
    expect(readGroup('IF([@qty] > 5, "big", "small")')).toEqual({ formula: 'IF([@qty] > 5, "big", "small")' });
  });

  it("make a value of a function of a column, a formula as it is", () => {
    expect(readValue("sum([Revenue])")).toEqual({ fn: "SUM", column: "Revenue" });
    expect(readValue("SUM([qty] * [price])")).toEqual({ formula: "SUM([qty] * [price])" });
  });

  it("read conditions all or any of which hold, and write them so (a text in quotes, a number not)", () => {
    const fields = fieldsOf(definition({ rows: "region", values: "SUM([revenue])", where: 'OR([@region] = "East", [@qty] > 5)' }));
    expect(fields.conditions).toEqual([
      { column: "region", op: "=", value: "East" },
      { column: "qty", op: ">", value: "5" },
    ]);
    expect(fields.any).toBe(true);
    expect(definitionOf({ ...fields, any: false }).where).toBe('AND([@region] = "East", [@qty] > 5)');
    expect(definitionOf({ ...fields, conditions: [{ column: "product", op: "=", value: 'say "hi"' }] }).where).toBe('[@product] = "say ""hi"""');
    // One the dialog cannot show as rows: kept as written
    const nested = 'AND([@qty] > 1, OR([@a] = "x", [@b] = "y"))';
    expect(definitionOf(fieldsOf(definition({ rows: "region", values: "SUM([revenue])", where: nested }))).where).toBe(nested);
  });

  it("make a condition of a regular expression (REGEXTEST) and read it back", () => {
    const fields = fieldsOf(definition({ rows: "region", values: "SUM([revenue])", where: 'AND(REGEXTEST([@code], "^EU-\\d+"), [@qty] > 1)' }));
    expect(fields.conditions[0]).toEqual({ column: "code", op: "matches", value: "^EU-\\d+" });
    expect(definitionOf(fields).where).toBe('AND(REGEXTEST([@code], "^EU-\\d+"), [@qty] > 1)');
  });

  it("leave a formula emptied out of their definition", () => {
    const fields = fieldsOf(definition({ rows: "region, x", values: "SUM([revenue])" }));
    const made = definitionOf({ ...fields, rows: [fields.rows[0]!, { formula: " " }], values: [{ formula: "" }] });
    expect(made.rows).toEqual(["region"]);
    expect(made.values).toEqual([]);
  });

  it("give back the definition they were read from", () => {
    const read = definition({ rows: 'region, TEXT([@date], "yyyy-mm")', columns: "YEAR([@date])", values: "SUM([revenue]), SUM([qty] * [price])", where: '[@category] = "Hardware"', sort: "SUM([revenue]) desc", totals: "rows" });
    expect(definitionOf(fieldsOf(read))).toEqual(read);
  });
});
