import { describe, expect, it } from "vitest";
import { type Favorites, hasAction, slotItemOf } from "../core/favorites.ts";
import { addItem, moveItem, pinOrdered, placeItem, moveRow, removeItem, removeRow, sameRows, savedRows, setLook, setOwn, setSlot, setPin, setSlotField, setSlotOwn, stepOf } from "./favorites.ts";

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

  it("orders each row of Touch's own as the docked toolbar shows its line: pinned left, the others, pinned right", () => {
    const rows: Favorites = [
      [{ id: "formats.bold" }, { id: "actions.more", pin: "right" }, { id: "actions.turnInto", show: "label", pin: "left" }, { id: "formats.italic" }],
      [{ id: "formats.link", pin: "right" }, { type: "separator" }],
    ];
    expect(pinOrdered(rows)).toEqual([
      [{ id: "actions.turnInto", show: "label", pin: "left" }, { id: "formats.bold" }, { id: "formats.italic" }, { id: "actions.more", pin: "right" }],
      [{ type: "separator" }, { id: "formats.link", pin: "right" }],
    ]);
  });

  it("places an item into a zone of a row, pinned so or not, at its place there; a separator into no pinned zone", () => {
    const rows: Favorites = pinOrdered([
      [{ id: "actions.turnInto", pin: "left" }, { id: "formats.bold" }, { id: "formats.italic" }, { id: "actions.more", pin: "right" }],
      [{ id: "formats.link" }, { type: "separator" }, { id: "formats.code" }],
    ]);
    // Bold pinned left, after Turn into
    expect(placeItem(rows, { row: 0, index: 1 }, { row: 0, zone: "left", index: 5 })).toEqual({
      rows: [[{ id: "actions.turnInto", pin: "left" }, { id: "formats.bold", pin: "left" }, { id: "formats.italic" }, { id: "actions.more", pin: "right" }], rows[1]],
      at: { row: 0, index: 1 },
    });
    // … unpinned into the second row's middle, first
    expect(placeItem(rows, { row: 0, index: 3 }, { row: 1, zone: undefined, index: 0 })).toEqual({
      rows: [rows[0]!.slice(0, 3), [{ id: "actions.more" }, ...rows[1]!]],
      at: { row: 1, index: 0 },
    });
    // Link pinned right in the first row: before …
    expect(placeItem(rows, { row: 1, index: 0 }, { row: 0, zone: "right", index: 0 }).rows[0]).toEqual([...rows[0]!.slice(0, 3), { id: "formats.link", pin: "right" }, { id: "actions.more", pin: "right" }]);
    // A separator is not pinned
    expect(placeItem(rows, { row: 1, index: 1 }, { row: 0, zone: "left", index: 0 })).toEqual({ rows, at: { row: 1, index: 1 } });
  });

  it("pins an item at an end of its row or unpins it, and says where it is then", () => {
    const rows: Favorites = [[{ id: "actions.turnInto", pin: "left" }, { id: "formats.bold" }, { id: "formats.italic" }, { id: "actions.more", pin: "right" }]];
    expect(setPin(rows, { row: 0, index: 2 }, "left")).toEqual({ rows: [[{ id: "actions.turnInto", pin: "left" }, { id: "formats.italic", pin: "left" }, { id: "formats.bold" }, { id: "actions.more", pin: "right" }]], at: { row: 0, index: 1 } });
    expect(setPin(rows, { row: 0, index: 1 }, "right")).toEqual({ rows: [[{ id: "actions.turnInto", pin: "left" }, { id: "formats.italic" }, { id: "formats.bold", pin: "right" }, { id: "actions.more", pin: "right" }]], at: { row: 0, index: 2 } });
    expect(setPin(rows, { row: 0, index: 0 }, undefined)).toEqual({ rows: [[{ id: "actions.turnInto" }, { id: "formats.bold" }, { id: "formats.italic" }, { id: "actions.more", pin: "right" }]], at: { row: 0, index: 0 } });
  });

  it("gives an item its own icon and label (an action's, a kind's whose items have them), an empty one none; nothing to a separator", () => {
    const at = { row: 1, index: 0 };
    const own = setOwn(setOwn(ROWS, at, "icon", " ★ "), at, "label", "Tučně");
    expect(own[1]![0]).toEqual({ id: "formats.bold", icon: "★", label: "Tučně" });
    expect(setOwn(own, at, "icon", undefined)[1]![0]).toEqual({ id: "formats.bold", label: "Tučně" });
    expect(setOwn(own, at, "label", "  ")[1]![0]).toEqual({ id: "formats.bold", icon: "★" });
    expect(setOwn(ROWS, { row: 1, index: 1 }, "label", "x")).toEqual(ROWS);
    // An icon: its first 3 characters, an emoji of several code points one
    expect(setOwn(ROWS, at, "icon", "abcd")[1]![0]).toEqual({ id: "formats.bold", icon: "abc" });
    expect(setOwn(ROWS, at, "icon", "👍🏽👨‍👩‍👧🇨🇿x")[1]![0]).toEqual({ id: "formats.bold", icon: "👍🏽👨‍👩‍👧🇨🇿" });
  });

  it("gives a kind's slot its action's own icon and label ({ id, icon, label }), its id alone again once none is left", () => {
    const rows: Favorites = [[{ type: "gesture", tap: "formats.bold", up: "formats.italic" }]];
    const at = { row: 0, index: 0 };
    const own = setSlotOwn(setSlotOwn(rows, at, "tap", "icon", "★★★★"), at, "tap", "label", "Tučně");
    expect(own[0]![0]).toEqual({ type: "gesture", tap: { id: "formats.bold", icon: "★★★", label: "Tučně" }, up: "formats.italic" });
    const back = setSlotOwn(setSlotOwn(own, at, "tap", "icon", undefined), at, "tap", "label", " ");
    expect(back[0]![0]).toEqual(rows[0]![0]);
    // Another action picked: its own look gone with the one before
    expect(setSlot(own, at, "tap", "formats.code")[0]![0]).toEqual({ type: "gesture", tap: "formats.code", up: "formats.italic" });
    // No action in the slot: nothing to give a look
    expect(setSlotOwn(rows, at, "down", "label", "x")).toEqual(rows);
  });

  it("puts an item of a kind in a slot (a snippet), its fields set there: an icon its first characters, a label trimmed, empty ones gone", () => {
    const rows: Favorites = [[{ type: "gesture", tap: "formats.bold" }]];
    const at = { row: 0, index: 0 };
    const snippet = setSlot(rows, at, "up", { type: "snippet" });
    const filled = setSlotField(setSlotField(setSlotField(snippet, at, "up", "text", "%%{s}%%"), at, "up", "icon", "💬💬💬💬"), at, "up", "label", " Comment ");
    expect(filled[0]![0]).toEqual({ type: "gesture", tap: "formats.bold", up: { type: "snippet", text: "%%{s}%%", icon: "💬💬💬", label: "Comment" } });
    expect(setSlotField(filled, at, "up", "label", " ")[0]![0]).toEqual({ type: "gesture", tap: "formats.bold", up: { type: "snippet", text: "%%{s}%%", icon: "💬💬💬" } });
    // A slot holding an action's id: no item's fields to set
    expect(setSlotField(rows, at, "tap", "text", "x")).toEqual(rows);
    // Only an item of a kind is one: not an action's id, its own look, a separator
    expect(slotItemOf({ type: "snippet" })).toEqual({ type: "snippet" });
    expect(slotItemOf("formats.bold")).toBeUndefined();
    expect(slotItemOf({ id: "formats.bold", icon: "★" })).toBeUndefined();
    expect(slotItemOf({ type: "separator" })).toBeUndefined();
  });
});
