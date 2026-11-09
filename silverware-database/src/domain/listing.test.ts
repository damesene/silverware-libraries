import { describe, expect, it } from "vitest";
import type { Database, Item, ItemKey } from "../model/database.ts";
import { listItems, textOf, validateCondition } from "./listing.ts";
import { TypeRegistry } from "./types/registry.ts";

const types = new TypeRegistry();
const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Doing", "Done"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
    { key: "odd", label: "Odd", type: "no-such-type", params: {}, readonly: false },
  ],
};
const item = (name: string, values: Item["values"], rank?: string): Item => ({ key: name as ItemKey, name, values, rank, revision: "1" });
const ITEMS = [item("Fix login", { status: "Done", estimate: 3 }, "a0"), item("Write docs", { status: "Todo", estimate: 10 }, "a1"), item("Plan", { status: "Doing" }, "a2")];
const names = (items: readonly Item[]) => items.map((one) => one.name);

describe("a view's items", () => {
  it("come in the order by hand where nothing is asked", () => {
    expect(names(listItems([...ITEMS].reverse(), TASKS, types, {}))).toEqual(["Fix login", "Write docs", "Plan"]);
  });

  it("are filtered by a condition per property, all to hold, the name's too", () => {
    expect(names(listItems(ITEMS, TASKS, types, { filter: { status: "!=Done" } }))).toEqual(["Write docs", "Plan"]);
    expect(names(listItems(ITEMS, TASKS, types, { filter: { status: "!=Done", estimate: ">5" } }))).toEqual(["Write docs"]);
    expect(names(listItems(ITEMS, TASKS, types, { filter: { name: "doc" } }))).toEqual(["Write docs"]);
  });

  it("are filtered by nothing a condition cannot say: of a property gone, empty, or one that does not read", () => {
    expect(validateCondition("/unclosed(/")).toBeDefined();
    expect(names(listItems(ITEMS, TASKS, types, { filter: { gone: "x", status: " ", estimate: "/unclosed(/" } }))).toHaveLength(3);
  });

  it("are sorted by properties in turn, a select by its options' order, numbers by value, empty last", () => {
    expect(names(listItems(ITEMS, TASKS, types, { sort: [{ key: "status", direction: "asc" }] }))).toEqual(["Write docs", "Plan", "Fix login"]);
    expect(names(listItems(ITEMS, TASKS, types, { sort: [{ key: "estimate", direction: "desc" }] }))).toEqual(["Write docs", "Fix login", "Plan"]);
    expect(names(listItems(ITEMS, TASKS, types, { sort: [{ key: "gone", direction: "asc" }] }))).toEqual(["Fix login", "Write docs", "Plan"]);
  });

  it("show a value of a type not defined now as kept", () => {
    expect(textOf(item("x", { odd: 7 }), "odd", TASKS, types)).toBe("7");
    expect(textOf(item("x", {}), "status", TASKS, types)).toBe("");
  });
});
