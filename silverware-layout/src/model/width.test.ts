import { describe, expect, it } from "vitest";
import { cssWidth, readTextWidth, readWidth, sameWidth, storedWidth, validateTextWidth } from "./width.ts";

describe("A width", () => {
  it("read from what a page or a setting holds: a number is pixels, text a number with px or %", () => {
    expect(readWidth(1100)).toEqual({ amount: 1100, unit: "px" });
    expect(readWidth("1100")).toEqual({ amount: 1100, unit: "px" });
    expect(readWidth("1100px")).toEqual({ amount: 1100, unit: "px" });
    expect(readWidth(" 90 % ")).toEqual({ amount: 90, unit: "%" });
    expect(readWidth("97.5%")).toEqual({ amount: 97.5, unit: "%" });
  });

  it("none from anything else", () => {
    for (const value of [undefined, null, "", "wide", "90em", "-5px", Number.NaN, true, {}, [1100]]) expect(readWidth(value), String(value)).toBeUndefined();
  });

  it("a text's within its limits, else why not", () => {
    expect(validateTextWidth({ amount: 1100, unit: "px" })).toBeUndefined();
    expect(validateTextWidth({ amount: 100, unit: "%" })).toBeUndefined();
    expect(validateTextWidth({ amount: 120, unit: "px" })).toBe("A text's width is 300 to 10000 px");
    expect(validateTextWidth({ amount: 120, unit: "%" })).toBe("A text's width is 20 to 100 %");
  });

  it("given to CSS, and kept in a frontmatter as a number of pixels or a text of percent", () => {
    expect(cssWidth({ amount: 1100, unit: "px" })).toBe("1100px");
    expect(cssWidth({ amount: 90, unit: "%" })).toBe("90%");
    expect(storedWidth({ amount: 1100, unit: "px" })).toBe(1100);
    expect(storedWidth({ amount: 90, unit: "%" })).toBe("90%");
  });

  it("a text's width typed by hand read only within its limits: 0, 5 or 5 % would collapse the text", () => {
    expect(readTextWidth(1100)).toEqual({ amount: 1100, unit: "px" });
    expect(readTextWidth("90%")).toEqual({ amount: 90, unit: "%" });
    expect([0, 5, -100, "5%", "200%", 20000].map(readTextWidth)).toEqual(Array(6).fill(undefined));
  });

  it("compared by amount and unit", () => {
    expect(sameWidth(undefined, undefined)).toBe(true);
    expect(sameWidth({ amount: 90, unit: "%" }, { amount: 90, unit: "%" })).toBe(true);
    expect(sameWidth({ amount: 90, unit: "%" }, { amount: 90, unit: "px" })).toBe(false);
    expect(sameWidth({ amount: 90, unit: "%" }, undefined)).toBe(false);
  });
});
