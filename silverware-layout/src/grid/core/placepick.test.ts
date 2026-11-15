// Where a point over a grid puts what is moved into it: new cells by the half of the nearest cell it is in (only near
// its edge where it may go into the cell), into a cell where its blocks meet nearest it.
import { describe, expect, it } from "vitest";
import { CELL_END, distanceTo, type GridShape, NEAR_PX, pickAt, samePick } from "./placepick.ts";

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

// Two cells side by side, 200 px each, 20 px apart; the first has two blocks (offsets 0 and 10)
const sideBySide: GridShape = {
  box: box(0, 0, 420, 100),
  cells: [
    { box: box(0, 0, 200, 100), blocks: [{ offset: 0, box: box(0, 0, 200, 20) }, { offset: 10, box: box(0, 40, 200, 60) }] },
    { box: box(220, 0, 420, 100), blocks: [] },
  ],
  sideBySide: true,
  columnGap: 20,
  rowGap: 10,
};

describe("a place picked in a grid", () => {
  it("new cells alone: before or after the nearest cell by its half, its line in the gap", () => {
    expect(pickAt(sideBySide, 50, 50, false)).toEqual({ place: { kind: "cells", at: 0 }, mark: { kind: "between", vertical: true, at: 0, from: 0, to: 100 } });
    expect(pickAt(sideBySide, 150, 50, false)).toEqual({ place: { kind: "cells", at: 1 }, mark: { kind: "between", vertical: true, at: 210, from: 0, to: 100 } });
    // (In the gap: the nearest cell's)
    expect(pickAt(sideBySide, 215, 50, false).place).toEqual({ kind: "cells", at: 1 });
    expect(pickAt(sideBySide, 400, 50, false).mark).toMatchObject({ at: 420 });
  });

  it("into a cell too: new cells near its edge alone, else where its blocks meet nearest", () => {
    expect(pickAt(sideBySide, 10, 50, true).place).toEqual({ kind: "cells", at: 0 });
    expect(pickAt(sideBySide, 190, 50, true).place).toEqual({ kind: "cells", at: 1 });
    expect(pickAt(sideBySide, 100, 5, true)).toEqual({ place: { kind: "cell", cell: 0, at: 0 }, mark: { kind: "inside", cell: 0, at: 0, from: 0, to: 200 } });
    expect(pickAt(sideBySide, 100, 32, true).place).toEqual({ kind: "cell", cell: 0, at: 10 });
    expect(pickAt(sideBySide, 100, 90, true).place).toEqual({ kind: "cell", cell: 0, at: CELL_END });
    // (An empty cell: its end, the line at its middle)
    expect(pickAt(sideBySide, 320, 10, true)).toMatchObject({ place: { kind: "cell", cell: 1, at: CELL_END }, mark: { at: 50 } });
  });

  it("cells one under another: above or below, a line across", () => {
    const stacked: GridShape = { ...sideBySide, box: box(0, 0, 200, 210), cells: [{ box: box(0, 0, 200, 100), blocks: [] }, { box: box(0, 110, 200, 210), blocks: [] }], sideBySide: false };
    expect(pickAt(stacked, 100, 80, false)).toEqual({ place: { kind: "cells", at: 1 }, mark: { kind: "between", vertical: false, at: 105, from: 0, to: 200 } });
    expect(pickAt(stacked, 100, 150, true).place).toEqual({ kind: "cell", cell: 1, at: CELL_END });
  });

  it("is near a grid within a few pixels; the same place twice for a tap's confirmation", () => {
    expect(distanceTo(sideBySide.box, 430, 50)).toBeLessThanOrEqual(NEAR_PX);
    expect(distanceTo(sideBySide.box, 460, 50)).toBeGreaterThan(NEAR_PX);
    expect(samePick(pickAt(sideBySide, 40, 50, false), pickAt(sideBySide, 60, 70, false))).toBe(true);
    expect(samePick(pickAt(sideBySide, 40, 50, false), pickAt(sideBySide, 160, 50, false))).toBe(false);
  });
});
