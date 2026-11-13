// Which of a page's embeds a widget drawn is: the run of the text the widgets drawn are, the editor drawing only the
// part of the page in view.
import { describe, expect, it } from "vitest";
import { placeAmong, type Placed, sameTarget } from "./locate.ts";

const placed = (...pairs: readonly (readonly [string, number])[]): Placed[] => pairs.map(([target, at]) => ({ target, at }));

describe("placeAmong", () => {
  it("finds a widget by the run of the text the widgets drawn are", () => {
    const text = placed(["a", 0.1], ["b", 0.3], ["a", 0.6], ["c", 0.9]);
    // All drawn: each its own
    expect(placeAmong(placed(["a", 0.1], ["b", 0.3], ["a", 0.6], ["c", 0.9]), 2, text)).toBe(2);
    // The top scrolled away: the second "a" is the third embed, not the first
    expect(placeAmong(placed(["a", 0.6], ["c", 0.9]), 0, text)).toBe(2);
    expect(placeAmong(placed(["b", 0.3], ["a", 0.6]), 1, text)).toBe(2);
  });

  it("takes the nearest place where several runs fit (the same file twice, one drawn)", () => {
    const text = placed(["a", 0.05], ["a", 0.95]);
    expect(placeAmong(placed(["a", 0.9]), 0, text)).toBe(1);
    expect(placeAmong(placed(["a", 0.1]), 0, text)).toBe(0);
  });

  it("falls back to the nearest of its target where the run is broken, and to none where the text has none", () => {
    const text = placed(["a", 0.1], ["b", 0.5], ["a", 0.8]);
    // ("x" drawn is in no run: the "a" after it found by its place alone)
    expect(placeAmong(placed(["x", 0.4], ["a", 0.75]), 1, text)).toBe(2);
    expect(placeAmong(placed(["z", 0.5]), 0, text)).toBeUndefined();
    expect(placeAmong([], 0, text)).toBeUndefined();
  });

  it("compares targets as written alike", () => {
    expect(sameTarget("/Pics/My%20Cat.png#x")).toBe("pics/my cat.png");
    expect(sameTarget("https://cdn.example/pkg@1.2.0/A.png")).toBe("https://cdn.example/pkg@1.2.0/a.png");
  });
});
