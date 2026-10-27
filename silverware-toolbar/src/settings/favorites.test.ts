import { describe, expect, it } from "vitest";
import { type Favorites, hasAction } from "../core/favorites.ts";
import { addItem, joinPins, moveItem, moveRow, removeItem, removeRow, sameRows, savedRows, setLook, setSlot, splitPins, stepOf } from "./favorites.ts";

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

  it("moves a row up or down, its place counted without it; past the ends nowhere", () => {
    expect(moveRow(ROWS, 1, 0)).toEqual([ROWS[1], ROWS[0]]);
    expect(moveRow(ROWS, 0, 1)).toEqual([ROWS[1], ROWS[0]]);
    expect(moveRow(ROWS, 0, 2)).toEqual(ROWS);
  });

  it("adds, removes, shows an action as its icon or with its label; saved without empty rows", () => {
    const added = addItem(ROWS, 0, { id: "formats.code" });
    expect(added[0]).toEqual([{ id: "actions.turnInto", show: "label" }, { id: "formats.code" }]);
    expect(setLook(added, { row: 0, index: 0 }, "icon", undefined)[0]![0]).toEqual({ id: "actions.turnInto" });
    expect(setLook(added, { row: 0, index: 1 }, "label", undefined)[0]![1]).toEqual({ id: "formats.code", show: "label" });
    expect(setLook(added, { row: 0, index: 1 }, "label", 9)[0]![1]).toEqual({ id: "formats.code", show: "label", width: 9 });
    // Shown as its icon: no width; a separator has no label
    expect(setLook([[{ id: "formats.code", show: "label", width: 9 }]], { row: 0, index: 0 }, "icon", 9)[0]![0]).toEqual({ id: "formats.code" });
    expect(setLook(ROWS, { row: 1, index: 1 }, "label", undefined)).toEqual(ROWS);
    const emptied = removeItem(ROWS, { row: 0, index: 0 });
    expect(emptied[0]).toEqual([]);
    expect(savedRows([...emptied, []])).toEqual([ROWS[1]]);
    expect(sameRows(ROWS, savedRows(ROWS))).toBe(true);
    expect(sameRows(ROWS, emptied)).toBe(false);
    expect(removeRow(ROWS, 0)).toEqual([ROWS[1]]);
  });

  it("finds an action in an action's item or any slot of a kind given, not of a kind none gives", () => {
    const kinds = [{ type: "gesture", slots: [{ key: "tap" }, { key: "up" }] }];
    expect(hasAction([[{ id: "actions.more" }]], "actions.more", kinds)).toBe(true);
    expect(hasAction([[{ type: "gesture", tap: "formats.bold", up: "actions.more" }]], "actions.more", kinds)).toBe(true);
    expect(hasAction([[{ type: "other", tap: "actions.more" }]], "actions.more", kinds)).toBe(false);
    expect(hasAction(ROWS, "actions.more", kinds)).toBe(false);
  });

  it("fills a kind's item's slots and shows it the other way, its other fields kept", () => {
    const rows = addItem(ROWS, 1, { type: "gesture" });
    const filled = setSlot(setSlot(rows, { row: 1, index: 3 }, "tap", "formats.bold"), { row: 1, index: 3 }, "up", "formats.italic");
    expect(filled[1]![3]).toEqual({ type: "gesture", tap: "formats.bold", up: "formats.italic" });
    const labeled = setLook(filled, { row: 1, index: 3 }, "label", undefined);
    expect(labeled[1]![3]).toEqual({ type: "gesture", tap: "formats.bold", up: "formats.italic", show: "label" });
    expect(setLook(labeled, { row: 1, index: 3 }, "icon", undefined)[1]![3]).toEqual(filled[1]![3]);
    // None in a slot: its field gone
    expect(setSlot(filled, { row: 1, index: 3 }, "up", undefined)[1]![3]).toEqual({ type: "gesture", tap: "formats.bold" });
    // An action's item has no slots
    expect(setSlot(ROWS, { row: 1, index: 0 }, "tap", "x")).toEqual(ROWS);
  });

  it("lays Touch's pinned items out in two lists before the rows, and writes them back pinned at the ends, wherever they were", () => {
    const rows: Favorites = [
      [{ id: "formats.bold" }, { id: "actions.turnInto", show: "label", pin: "left" }],
      [{ id: "actions.more", pin: "right" }, { id: "formats.link" }],
    ];
    const layout = splitPins(rows);
    expect(layout).toEqual([[{ id: "actions.turnInto", show: "label", pin: "left" }], [{ id: "actions.more", pin: "right" }], [{ id: "formats.bold" }], [{ id: "formats.link" }]]);
    expect(joinPins(layout)).toEqual([
      [{ id: "actions.turnInto", show: "label", pin: "left" }, { id: "formats.bold" }],
      [{ id: "formats.link" }, { id: "actions.more", pin: "right" }],
    ]);
    // An item moved out of a list: no longer pinned; into one: pinned; a separator there is not
    const moved = moveItem(moveItem(layout, { row: 0, index: 0 }, { row: 2, index: 1 }), { row: 3, index: 0 }, { row: 0, index: 0 });
    expect(joinPins(moved)).toEqual([[{ id: "formats.link", pin: "left" }, { id: "formats.bold" }, { id: "actions.turnInto", show: "label" }], [{ id: "actions.more", pin: "right" }]]);
    expect(joinPins([[{ type: "separator" }], [], [{ id: "formats.bold" }]])).toEqual([[{ id: "formats.bold" }]]);
    // A row of pinned items alone is not shown as an empty row; an empty row being edited is
    expect(splitPins([[{ id: "actions.turnInto", pin: "left" }], [{ id: "formats.bold" }], []])).toEqual([[{ id: "actions.turnInto", pin: "left" }], [], [{ id: "formats.bold" }], []]);
  });
});
