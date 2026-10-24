import { describe, expect, it } from "vitest";
import { luaCallPlaces } from "./lua.ts";

describe("luaCallPlaces: the formulas given to Space Lua calls in a page's text", () => {
  const places = (text: string, ...names: string[]) => luaCallPlaces(...names)(text).map((p) => text.slice(p.from, p.to));

  it("finds the formula of each call of the names, in quotes or apostrophes", () => {
    const text = `Total: \${silverware.table.evaluate("=SUM(beans![price])")} and \${te('=IF(beans!A1="x", 1, 2)')} and \${te( "beans!vat" )}`;
    expect(places(text, "silverware.table.evaluate", "te")).toEqual(["=SUM(beans![price])", '=IF(beans!A1="x", 1, 2)', "beans!vat"]);
  });

  it("finds no call of a longer name, of a name not given, or of none", () => {
    expect(places('${paste("=SUM(A1)")} ${x.te("=A1")} ${te2("=A1")}', "te")).toEqual([]);
    expect(places('${te("=A1")}')).toEqual([]);
    expect(places('${te("=A1")}', "not a name", "")).toEqual([]);
  });

  it("leaves out a literal with an escape or a line break: its text is not the formula", () => {
    expect(places('${te("=IF(A1=\\"x\\", 1)")} ${te("=A1\n")} ${te("=B1")}', "te")).toEqual(["=B1"]);
  });
});
