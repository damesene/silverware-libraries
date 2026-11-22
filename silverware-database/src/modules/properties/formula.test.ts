import { describe, expect, it } from "vitest";
import type { Item, ItemKey } from "../../model/database.ts";
import { formulaExample, itemsOffered } from "./formula.ts";

const item = (name: string): Item => ({ key: `k-${name}` as ItemKey, name, values: {}, rank: undefined, revision: "1" });

describe("a formula's details", () => {
  it("offer the items to show its result for by name among thousands: those starting so first, then those holding it, ten at most", () => {
    const items = [item("Pear"), item("Apple pie"), ...Array.from({ length: 5000 }, (_, n) => item(`Item ${n}`)), item("Apple")];
    expect(itemsOffered(items, "")).toHaveLength(10);
    expect(itemsOffered(items, "APP")).toEqual(["k-Apple pie", "k-Apple"]);
    expect(itemsOffered(items, "pie")).toEqual(["k-Apple pie"]);
    expect(itemsOffered(items, "item 49")).toHaveLength(10);
  });

  it("show an example made of the database's own numbers, else of the item's name", () => {
    const number = (key: string) => ({ key, label: key, type: "number", params: {}, readonly: false });
    expect(formulaExample({ id: "d", name: "D", properties: [number("qty"), number("price")] }, "total")).toBe("=[@qty] * [@price]");
    expect(formulaExample({ id: "d", name: "D", properties: [] }, "total")).toBe("=UPPER([@name])");
  });
});
