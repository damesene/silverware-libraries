import { describe, expect, it } from "vitest";
import type { Favorites } from "../core/favorites.ts";
import { addItem, moveItem, removeItem, sameRows, savedRows, stepOf, toggleShow } from "./favorites.ts";

const ROWS: Favorites = [[{ id: "actions.turnInto", show: "label" }], [{ id: "formats.bold" }, { type: "separator" }, { id: "formats.link" }]];

describe("The favourites as the settings edit them", () => {
  it("moves an item within its row and into another, its place counted without it", () => {
    expect(moveItem(ROWS, { row: 1, index: 0 }, { row: 1, index: 2 })[1]).toEqual([{ type: "separator" }, { id: "formats.link" }, { id: "formats.bold" }]);
    expect(moveItem(ROWS, { row: 1, index: 2 }, { row: 0, index: 0 })).toEqual([
      [{ id: "formats.link" }, { id: "actions.turnInto", show: "label" }],
      [{ id: "formats.bold" }, { type: "separator" }],
    ]);
    // Past a row's end: at its end
    expect(moveItem(ROWS, { row: 0, index: 0 }, { row: 1, index: 9 })[1]!.at(-1)).toEqual({ id: "actions.turnInto", show: "label" });
    // The value given is not changed
    expect(ROWS[1]).toHaveLength(3);
  });

  it("steps with Alt+arrows: within the row, into the row above or below, nowhere past the ends", () => {
    expect(stepOf(ROWS, { row: 1, index: 1 }, "ArrowLeft")).toEqual({ row: 1, index: 0 });
    expect(stepOf(ROWS, { row: 1, index: 0 }, "ArrowLeft")).toBeUndefined();
    expect(stepOf(ROWS, { row: 1, index: 2 }, "ArrowRight")).toBeUndefined();
    expect(stepOf(ROWS, { row: 1, index: 2 }, "ArrowUp")).toEqual({ row: 0, index: 1 });
    expect(stepOf(ROWS, { row: 0, index: 0 }, "ArrowUp")).toBeUndefined();
    expect(stepOf(ROWS, { row: 0, index: 0 }, "ArrowDown")).toEqual({ row: 1, index: 0 });
  });

  it("adds, removes, shows an action as its icon or with its label; saved without empty rows", () => {
    const added = addItem(ROWS, 0, { id: "formats.code" });
    expect(added[0]).toEqual([{ id: "actions.turnInto", show: "label" }, { id: "formats.code" }]);
    expect(toggleShow(added, { row: 0, index: 0 })[0]![0]).toEqual({ id: "actions.turnInto" });
    expect(toggleShow(added, { row: 0, index: 1 })[0]![1]).toEqual({ id: "formats.code", show: "label" });
    // A separator has no label
    expect(toggleShow(ROWS, { row: 1, index: 1 })).toEqual(ROWS);
    const emptied = removeItem(ROWS, { row: 0, index: 0 });
    expect(emptied[0]).toEqual([]);
    expect(savedRows([...emptied, []])).toEqual([ROWS[1]]);
    expect(sameRows(ROWS, savedRows(ROWS))).toBe(true);
    expect(sameRows(ROWS, emptied)).toBe(false);
  });
});
