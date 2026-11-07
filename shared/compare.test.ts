import { describe, expect, it } from "vitest";
import { compareForSort, compareValues } from "./compare.ts";

describe("sorting", () => {
  it("sorts numbers numerically", () => {
    expect(compareValues("-2,5", "1")).toBeLessThan(0);
    expect(compareValues("1 000", "999")).toBeGreaterThan(0);
    expect(compareValues("15 %", "9 %")).toBeGreaterThan(0);
    expect(compareValues("105 €", "12,99 €")).toBeGreaterThan(0);
    expect(compareValues("$5", "$40")).toBeLessThan(0);
    expect(compareValues("3 kg", "20kg")).toBeLessThan(0);
  });
});

describe("sorted order", () => {
  it("puts empty values last in both directions", () => {
    const sorted = (direction: "asc" | "desc") => ["b", "", "a", " ", "c"].sort((a, b) => compareForSort(a, b, direction));
    expect(sorted("asc").slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(sorted("desc").slice(0, 3)).toEqual(["c", "b", "a"]);
    expect(sorted("desc").slice(3).every((value) => value.trim() === "")).toBe(true);
  });
});
