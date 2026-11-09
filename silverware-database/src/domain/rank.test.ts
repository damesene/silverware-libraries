import { describe, expect, it } from "vitest";
import type { Item, ItemKey } from "../model/database.ts";
import { compareRanks, inRankOrder, isRank, placeAt } from "./rank.ts";

const item = (name: string, rank: string | undefined): Item => ({ key: name as ItemKey, name, values: {}, rank, revision: "1" });

/** The order once an item "new" is placed at `index`, the ranks given applied */
function orderAfter(items: readonly Item[], index: number): string[] {
  const ordered = inRankOrder(items);
  const { rank, others } = placeAt(ordered, index);
  const after = [...ordered.map((one) => ({ ...one, rank: others.get(one.key) ?? one.rank })), item("new", rank)];
  return inRankOrder(after).map((one) => one.name);
}

describe("the order by hand", () => {
  it("places an item between two, at either end, writing no other", () => {
    const items = [item("a", "a0"), item("b", "a1"), item("c", "a2")];
    for (const index of [0, 1, 2, 3]) {
      expect(placeAt(inRankOrder(items), index).others.size).toBe(0);
      const names = ["a", "b", "c"];
      names.splice(index, 0, "new");
      expect(orderAfter(items, index)).toEqual(names);
    }
    expect(placeAt([], 0).rank).toBe("a0");
  });

  it("goes on placing between two neighbours", () => {
    let items = [item("a", "a0"), item("b", "a1")];
    for (let i = 0; i < 50; i++) {
      const { rank, others } = placeAt(inRankOrder(items), 1);
      expect(others.size).toBe(0);
      items = [items[0]!, item(`n${i}`, rank), ...items.slice(1)];
      expect(inRankOrder(items)[1]!.name).toBe(`n${i}`);
    }
  });

  it("gives ranks to the items above that have none, or one of the same rank, keeping the order shown", () => {
    const unranked = [item("a", "a0"), item("b", "a1"), item("u", undefined), item("v", undefined)];
    expect(orderAfter(unranked, 3)).toEqual(["a", "b", "u", "new", "v"]);
    expect(orderAfter(unranked, 4)).toEqual(["a", "b", "u", "v", "new"]);
    expect([...placeAt(inRankOrder(unranked), 3).others.keys()]).toEqual(["u"]);
    const ties = [item("a", "a0"), item("b", "a0"), item("c", "a0"), item("d", "a1")];
    expect(orderAfter(ties, 1)).toEqual(["a", "new", "b", "c", "d"]);
    expect(orderAfter(ties, 2)).toEqual(["a", "b", "new", "c", "d"]);
    const typed = [item("a", "first"), item("b", "a0")];
    expect(orderAfter(typed, 1)).toEqual(["b", "new", "a"]);
  });

  it("orders items by rank, those without one (or one it cannot read) after, by name", () => {
    expect(isRank("first")).toBe(false);
    const items = [item("c", undefined), item("b", "a1"), item("d", "oops"), item("a", "a0"), item("e", undefined)];
    expect(inRankOrder(items).map((one) => one.name)).toEqual(["a", "b", "c", "d", "e"]);
    expect(compareRanks("a0", "a0")).toBe(0);
  });
});
