import { describe, expect, it } from "vitest";
import type { Item, ItemKey, Property, Value } from "../model/database.ts";
import { arrangeGroups, groupItems, movedValue } from "./grouping.ts";
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

  it("arranges groups in the order given them by hand, new ones after, those hidden and empty ones left out of what shows", () => {
    const status = property("select", { options: ["Todo", "Doing", "Done"] });
    const made = groupItems([item("a", { p: "Done" }), item("b", { p: "Todo" })], status, types.named("select")!);
    const keys = (list: readonly { key: string }[]) => list.map((one) => one.key);
    const arranged = arrangeGroups(made, { order: ['value:"Done"', 'value:"Todo"', "gone"], hidden: ['value:"Todo"'], hideEmpty: true });
    expect(keys(arranged.ordered)).toEqual(['value:"Done"', 'value:"Todo"', 'value:"Doing"']);
    expect(keys(arranged.shown)).toEqual(['value:"Done"']);
  });

  it("moves a value between groups: another group's value, a list's one value replaced in its place, the rest kept", () => {
    const tags = property("multi-select", { options: ["x", "y", "z"] });
    const [x, y, z] = groupItems([], tags, types.named("multi-select")!);
    expect(movedValue(["z", "x", "y"], x, z!)).toEqual(["z", "y"]);
    expect(movedValue(["x", "y"], x, z!)).toEqual(["z", "y"]);
    // From the group of none (no value yet) or to it
    const none = { key: "none", label: "No P", value: undefined, known: true, items: [] };
    expect(movedValue(undefined, none, y!)).toEqual(["y"]);
    expect(movedValue(["x"], x, none)).toBeUndefined();
    expect(movedValue(["x", "y"], x, none)).toEqual(["y"]);
    // A value of one: the other group's
    const status = property("select", { options: ["Todo", "Done"] });
    const [todo, done] = groupItems([], status, types.named("select")!);
    expect(movedValue("Todo", todo, done!)).toBe("Done");
    expect(movedValue(3, undefined, { key: "value:4", label: "4", value: 4, known: true, items: [] })).toBe(4);
  });

  it("gives a multi-select's group a list whatever form its first item holds, so a card moved there keeps its other values", () => {
    const tags = property("multi-select", { options: ["a", "b"] });
    // A value none of its options, written alone by hand on one page, first
    const made = groupItems([item("one", { p: "legacy" }), item("two", { p: ["a", "b"] })], tags, types.named("multi-select")!);
    const legacy = made.find((one) => one.label.startsWith("legacy"))!;
    const a = made.find((one) => one.label === "a")!;
    expect(legacy.value).toEqual(["legacy"]);
    expect(movedValue(["a", "b"], a, legacy)).toEqual(["legacy", "b"]);
    // Out of it: that value replaced, not added to
    expect(movedValue(["legacy", "b"], legacy, a)).toEqual(["a", "b"]);
  });

  it("moves a list kept under any property within it, every copy of the value left gone, nothing else", () => {
    const text = property("text");
    const made = groupItems([item("one", { p: "foo" }), item("two", { p: ["x", "y", "x"] })], text, types.named("text")!);
    const foo = made.find((one) => one.label === "foo")!;
    const x = made.find((one) => one.label === "x")!;
    expect(foo.value).toBe("foo");
    expect(movedValue(["x", "y", "x"], x, foo)).toEqual(["foo", "y"]);
    // A value alone to a group made by a list's value: the value alone
    expect(movedValue("foo", foo, x)).toBe("x");
  });
});
