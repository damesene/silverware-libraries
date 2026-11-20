import { describe, expect, it } from "vitest";
import { cellTags, withoutTags } from "./tags.ts";

describe("hidden tags in cells", () => {
  const cell = `37,5 <meta formulas.f='=[@qty]*2'> <meta core.n='pear' core.cn='first'>`;

  it("reads a cell's tags and its text without them", () => {
    expect(cellTags(cell)).toEqual([`<meta formulas.f='=[@qty]*2'>`, `<meta core.n='pear' core.cn='first'>`]);
    expect(withoutTags(cell)).toBe("37,5");
    expect(withoutTags("plain")).toBe("plain");
  });

  it("ends a tag at its first >, as SilverBullet does, so a value's > is written &gt;", () => {
    expect(cellTags(`big <meta formulas.f='=IF(A1&gt;5, "big", "")'>`)).toEqual([`<meta formulas.f='=IF(A1&gt;5, "big", "")'>`]);
    // A > typed by hand into a value: SilverBullet shows the rest as text, Silverware Table takes it as text too
    expect(withoutTags(`x <meta note='a > b'>`)).toBe(`x b'>`);
  });

  it("still finds a tag typed by hand with a lone quote", () => {
    expect(withoutTags(`x <meta note="oops>`)).toBe("x");
  });

});
