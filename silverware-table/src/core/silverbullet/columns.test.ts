import { describe, expect, it } from "vitest";
import { shrunkWidths } from "./columns.ts";

describe("shrunkWidths", () => {
  it("shares the width in proportion where no column would go under its floor", () => {
    expect(shrunkWidths([100, 300], [40, 40], 200)).toEqual([50, 150]);
    expect(shrunkWidths([100, 300], [40, 40], 800)).toEqual([200, 600]);
  });

  it("holds a column at its floor, the others sharing the rest", () => {
    expect(shrunkWidths([100, 100, 200], [80, 40, 40], 200)).toEqual([80, 40, 80]);
  });

  it("gives the floors alone where they are wider together than the width", () => {
    expect(shrunkWidths([100, 100], [80, 80], 100)).toEqual([80, 80]);
  });
});
