// Where a grid's dividers' grips stand: the middle of the part of the grid in view, held within the grid.
import { describe, expect, it } from "vitest";
import { gripAt } from "./dividers.ts";

const VIEW = { top: 50, bottom: 850 };

describe("a divider's grip", () => {
  it("stands at the middle of a grid wholly in view", () => {
    expect(gripAt({ top: 100, bottom: 400 }, VIEW)).toBe(150);
  });

  it("rides in the part of a tall grid in view, as it is scrolled", () => {
    // (Its top scrolled under the top bar: the middle of what is seen of it)
    expect(gripAt({ top: -1000, bottom: 2000 }, VIEW)).toBe(1450);
    // (Its end coming into view: the middle of that end)
    expect(gripAt({ top: -1500, bottom: 450 }, VIEW)).toBe(1750);
  });

  it("is held within the grid near its edges, and at its middle where none of it is in view or it is short", () => {
    expect(gripAt({ top: 830, bottom: 2000 }, VIEW)).toBe(26);
    expect(gripAt({ top: -2000, bottom: -100 }, VIEW)).toBe(950);
    expect(gripAt({ top: 100, bottom: 140 }, VIEW)).toBe(20);
  });
});
