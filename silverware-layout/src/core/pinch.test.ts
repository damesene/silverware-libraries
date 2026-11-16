// Two fingers told apart by how they move: a tap, a pinch (the distance between them changed), a move of both together;
// the size a pinch gives.
import { describe, expect, it } from "vitest";
import { PINCH_PX, pinchedSize, TAP_MOVE_PX, TAP_MS, twoFingers, wasTap } from "./pinch.ts";

const start = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
] as const;

describe("two fingers on the page", () => {
  it("are undecided while they hardly move, a pinch once their distance changes, a pan once they move together", () => {
    expect(twoFingers(start, [{ x: 103, y: 101 }, { x: 198, y: 102 }])).toBe("undecided");
    expect(twoFingers(start, [{ x: 100, y: 100 }, { x: 200 + PINCH_PX + 1, y: 100 }])).toBe("pinch");
    expect(twoFingers(start, [{ x: 100 + PINCH_PX + 1, y: 100 }, { x: 200, y: 100 }])).toBe("pinch");
    expect(twoFingers(start, [{ x: 100, y: 100 + TAP_MOVE_PX + 5 }, { x: 200, y: 100 + TAP_MOVE_PX + 5 }])).toBe("pan");
  });

  it("a pinch of one finger moved alone, in small steps: undecided till the distance changed enough, never a pan", () => {
    const seen = [2, 4, 6, 8, 10, 12, 14].map((d) => twoFingers(start, [start[0], { x: 200 + d, y: 100 }]));
    expect(seen).toEqual(["undecided", "undecided", "undecided", "undecided", "undecided", "undecided", "pinch"]);
    // (A hand moved a little first, then spread: a pan, then a pinch)
    expect(twoFingers(start, [{ x: 100, y: 112 }, { x: 200, y: 112 }])).toBe("pan");
    expect(twoFingers(start, [{ x: 90, y: 112 }, { x: 210, y: 112 }])).toBe("pinch");
  });

  it("tapped where they were lifted soon and never more than undecided", () => {
    expect(wasTap("undecided", TAP_MS - 1)).toBe(true);
    expect(wasTap("undecided", TAP_MS + 1)).toBe(false);
    expect(wasTap("pinch", 50)).toBe(false);
    expect(wasTap("pan", 50)).toBe(false);
  });

  it("pinched: the size as the distance grows or shrinks, whole px, held within the limits", () => {
    const limits = { min: 5, max: 40 };
    expect(pinchedSize(16, start, [{ x: 50, y: 100 }, { x: 250, y: 100 }], limits)).toBe(32);
    expect(pinchedSize(16, start, [{ x: 125, y: 100 }, { x: 175, y: 100 }], limits)).toBe(8);
    expect(pinchedSize(30, start, [{ x: 0, y: 100 }, { x: 300, y: 100 }], limits)).toBe(40);
    expect(pinchedSize(16, start, start, limits)).toBe(16);
  });
});
