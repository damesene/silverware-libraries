import { describe, expect, it } from "vitest";
import { colorsOf, optionColor, validateOptions } from "./options.ts";

describe("options' colors", () => {
  it("are the one given an option, else its place's, none for a value of no option", () => {
    const params = { options: ["Todo", "Doing", "Done"], colors: { Done: "red" } };
    expect(["Todo", "Doing", "Done", "Later"].map((one) => optionColor(params, one))).toEqual([0, 1, 5, undefined]);
    expect(optionColor({ options: Array.from({ length: 10 }, (_, at) => `o${at}`) }, "o9")).toBe(1);
    // (An option or a value named as an object's own member: no color of Object's, its place's)
    expect(optionColor({ options: ["constructor", "toString"] }, "toString")).toBe(1);
    expect(optionColor({ options: ["a"] }, "valueOf")).toBeUndefined();
  });

  it("are read leniently and checked strictly: a color no name of the palette's", () => {
    expect(colorsOf({ colors: { A: "red", B: "teal", C: 3 } })).toEqual({ A: "red" });
    expect(colorsOf({ colors: ["red"] })).toEqual({});
    expect(validateOptions({ options: ["A"], colors: { A: "teal" } })).toContain('"teal" is no color');
    expect(validateOptions({ options: ["A"], colors: "red" })).toContain("no map");
    expect(validateOptions({ options: ["A"], colors: { A: "green" } })).toBeUndefined();
  });

  it("may be the user's own, #rrggbb, whatever its case", () => {
    expect(validateOptions({ options: ["A"], colors: { A: "#3A7BD5" } })).toBeUndefined();
    expect(validateOptions({ options: ["A"], colors: { A: "#3a7" } })).toContain("#rrggbb");
    expect(optionColor({ options: ["A"], colors: { A: "#3A7BD5" } }, "A")).toBe("#3a7bd5");
  });
});
