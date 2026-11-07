import { describe, expect, it } from "vitest";
import type { Item, ItemKey, Property, Value } from "../model/database.ts";
import { groupItems } from "./grouping.ts";
import { TypeRegistry } from "./types/registry.ts";

const types = new TypeRegistry();
const item = (name: string, values: Record<string, Value>): Item => ({ key: name as ItemKey, revision: "1", name, values, rank: undefined });
const property = (type: string, params: Record<string, unknown> = {}): Property => ({ key: "p", label: "P", type, params, readonly: false });
const groups = (items: readonly Item[], one: Property) => groupItems(items, one, types.named(one.type)!).map((group) => [group.label, group.value, group.items.map((each) => each.name)]);

describe("grouping a view's items", () => {
  it("groups a select by its options in their order, empty ones too, then values that are none of them, none first", () => {
    const status = property("select", { options: ["Todo", "Doing", "Done"] });
    expect(groups([item("a", { p: "Done" }), item("b", {}), item("c", { p: "Odd" }), item("d", { p: "Todo" }), item("e", { p: "Done" })], status)).toEqual([
      ["No P", undefined, ["b"]],
      ["Todo", "Todo", ["d"]],
      ["Doing", "Doing", []],
      ["Done", "Done", ["a", "e"]],
      ["Odd (none of its options)", "Odd", ["c"]],
    ]);
  });

  it("puts a multi-select's item in each of its values' groups, an item added there getting a list of it", () => {
    const tags = property("multi-select", { options: ["x", "y"] });
    expect(groups([item("a", { p: ["y", "x"] }), item("b", { p: ["x"] })], tags)).toEqual([
      ["x", ["x"], ["a", "b"]],
      ["y", ["y"], ["a"]],
    ]);
  });

  it("groups a checkbox as Checked and Unchecked, an item without it unticked", () => {
    expect(groups([item("a", { p: true }), item("b", {}), item("c", { p: false })], property("checkbox"))).toEqual([
      ["Checked", true, ["a"]],
      ["Unchecked", false, ["b", "c"]],
    ]);
  });

  it("groups any other type by its values in the order sorting gives them, keeping the items' order in each", () => {
    expect(groups([item("a", { p: 10 }), item("b", { p: 2 }), item("c", { p: 10 })], property("number"))).toEqual([
      ["2", 2, ["b"]],
      ["10", 10, ["a", "c"]],
    ]);
    expect(groups([item("a", { p: "2026-12-01" }), item("b", { p: "2026-11-20" }), item("c", {})], property("date")).map(([label]) => label)).toEqual(["No P", "2026-11-20", "2026-12-01"]);
  });
});
