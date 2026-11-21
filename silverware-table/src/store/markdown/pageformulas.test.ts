import { afterEach, describe, expect, it } from "vitest";
import { TableRegister } from "../../core/tables.ts";
import { luaCallPlaces } from "../../host/lua.ts";
import { serializeTable } from "../../markdown.ts";
import { defineFormulaPlaces, formulaPlacesIn, pageFormulaPlace, pageFormulasIn } from "./pageformulas.ts";
import { MarkdownStore } from "./store.ts";

// A page with formulas in Space Lua calls: one in a table's cell's text, two outside tables
const PAGE = `Total: \${te("=SUM(prices![price])")}\n\n| Name | Price |\n|---|---|\n| Pear | \${te("=prices!B1")} |\n\nFirst: \${te('=prices!B1')}\n`;

describe("page formulas: the formulas written in a page's text, not as formula cells", () => {
  afterEach(() => defineFormulaPlaces(undefined));

  it("are where the binding's finder says, a table cell's text too, in the order of the text; none without a finder", () => {
    expect(pageFormulasIn("Shop", PAGE)).toEqual([]);
    defineFormulaPlaces(luaCallPlaces("te"));
    expect(pageFormulasIn("Shop", PAGE).map((f) => f.text)).toEqual(["=SUM(prices![price])", "=prices!B1", "=prices!B1"]);
    expect(formulaPlacesIn(PAGE).map((p) => PAGE.slice(p.from, p.to))).toEqual(["=SUM(prices![price])", "=prices!B1", "=prices!B1"]);
  });

  it("are found again by their keys where they are now, refused where changed since, or of another page", () => {
    defineFormulaPlaces(luaCallPlaces("te"));
    const [total, , first] = pageFormulasIn("Shop", PAGE);
    // Text written before it: the formula found where it is now
    const now = `A line.\n${PAGE}`;
    const place = pageFormulaPlace("Shop", now, { key: first!.key, text: "=costs!B1" });
    expect("from" in place && now.slice(place.from, place.to)).toBe("=prices!B1");
    // Changed since it was read
    const changed = PAGE.replace("=SUM(prices![price])", "=SUM(prices![cost])");
    expect(pageFormulaPlace("Shop", changed, { key: total!.key, text: "=SUM(costs![cost])" })).toEqual({ problem: "it changed since it was read" });
    expect(pageFormulaPlace("Other", PAGE, { key: total!.key, text: "=1" })).toEqual({ problem: "it is not this page's" });
  });

  it("refuses a text its place cannot hold: a quote of its string literal, a line break, an escape", () => {
    defineFormulaPlaces(luaCallPlaces("te"));
    const [total, , first] = pageFormulasIn("Shop", PAGE);
    expect(pageFormulaPlace("Shop", PAGE, { key: total!.key, text: '=IF(A1="x", 1, 2)' })).toHaveProperty("problem");
    expect(pageFormulaPlace("Shop", PAGE, { key: total!.key, text: "=IF(A1='x', 1, 2)" })).toHaveProperty("from");
    expect(pageFormulaPlace("Shop", PAGE, { key: first!.key, text: "=IF(A1='x', 1, 2)" })).toHaveProperty("problem");
    expect(pageFormulaPlace("Shop", PAGE, { key: first!.key, text: "=A1\n" })).toHaveProperty("problem");
    expect(pageFormulaPlace("Shop", PAGE, { key: first!.key, text: "=A1\\" })).toHaveProperty("problem");
  });

  it("are the markdown store's, a page's read as its tables are; null for a page not there", async () => {
    defineFormulaPlaces(luaCallPlaces("te"));
    const platform = {
      editor: { documentName: () => "Shop", text: () => PAGE, replace: () => undefined },
      space: { read: () => Promise.reject(new Error("no page")), write: () => undefined, list: () => [] },
    };
    const store = new MarkdownStore(() => platform, new TableRegister(), async () => serializeTable);
    expect((await store.pageFormulas("Shop"))!.map((f) => f.text)).toEqual(["=SUM(prices![price])", "=prices!B1", "=prices!B1"]);
    expect(await store.pageFormulas("Missing")).toBeNull();
  });
});
