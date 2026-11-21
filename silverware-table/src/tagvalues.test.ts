import { describe, expect, it } from "vitest";
import { tagValue, withTagValue } from "./tagvalues.ts";

describe("an attribute of cells' hidden tags", () => {
  it("is read by its name, the last tag with it counting", () => {
    expect(tagValue("6 <meta formulas.f='=3*2'> <meta core.n='pear'>", "core.n")).toBe("pear");
    expect(tagValue("6 <meta formulas.f='=1'> <meta formulas.f='=3*2'>", "formulas.f")).toBe("=3*2");
    expect(tagValue("plain", "formulas.f")).toBeUndefined();
  });

  it("is set in the tag that has it, else in a tag of its own; removed, a tag left empty goes", () => {
    expect(withTagValue("6 <meta formulas.f='=3*2'>", "formulas.f", "=4")).toBe("6 <meta formulas.f='=4'>");
    expect(withTagValue("Pear <meta core.n='pear'>", "formulas.f", "=1")).toBe("Pear <meta core.n='pear'> <meta formulas.f='=1'>");
    expect(withTagValue("6 <meta formulas.f='=3*2'> <meta core.n='pear'>", "formulas.f", undefined)).toBe("6 <meta core.n='pear'>");
    // Another's attributes in that tag as written: their case, one without a value, quotes
    expect(withTagValue(`6 <meta formulas.f='=A1' data-Note="x" hidden>`, "formulas.f", "=A2")).toBe(`6 <meta formulas.f='=A2' data-Note="x" hidden>`);
    expect(withTagValue(`6 <meta data-Note="a formulas.f='no'" formulas.f='=A1'>`, "formulas.f", undefined)).toBe(`6 <meta data-Note="a formulas.f='no'">`);
  });
});
