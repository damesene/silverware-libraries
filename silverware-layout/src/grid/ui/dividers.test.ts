// Where a grid's dividers' knobs stand: the middle of the part of the grid in view, held within the grid.
import { describe, expect, it } from "vitest";
import { knobAt } from "./dividers.ts";

const VIEW = { top: 50, bottom: 850 };

describe("a divider's knob", () => {
  it("stands at the middle of a grid wholly in view", () => {
    expect(knobAt({ top: 100, bottom: 400 }, VIEW)).toBe(150);
  });

  it("rides in the part of a tall grid in view, as it is scrolled", () => {
    // (Its top scrolled under the top bar: the middle of what is seen of it)
    expect(knobAt({ top: -1000, bottom: 2000 }, VIEW)).toBe(1450);
    // (Its end coming into view: the middle of that end)
    expect(knobAt({ top: -1500, bottom: 450 }, VIEW)).toBe(1750);
  });

  it("is held within the grid near its edges, and at its middle where none of it is in view or it is short", () => {
    expect(knobAt({ top: 830, bottom: 2000 }, VIEW)).toBe(12);
    expect(knobAt({ top: -2000, bottom: -100 }, VIEW)).toBe(950);
    expect(knobAt({ top: 100, bottom: 140 }, VIEW)).toBe(20);
  });
});
