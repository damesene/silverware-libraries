import { describe, expect, it } from "vitest";
import type { Database, Item, ItemKey } from "../model/database.ts";
import { samePart, stableText } from "./itempart.ts";

const item = (values: Item["values"], more: Partial<Item> = {}): Item => ({ key: "a" as ItemKey, name: "Fix login", values, revision: "1", ...more }) as Item;
// A database with a value the system gives (Modified): no part a write rests on
const DATABASE = { id: "tasks", name: "Tasks", properties: [{ key: "modified_at", label: "Modified", type: "datetime", params: {}, readonly: true, system: "modifiedAt" }] } as unknown as Database;

describe("an item's parts", () => {
  it("writes a value's text the same whatever the order of its maps' keys", () => {
    expect(stableText({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableText({ a: [{ c: 3, d: 2 }], b: 1 }));
  });

  it("compares two readings by a part: values by key, the name, the look (none and taken off alike), every own value", () => {
    const one = item({ status: "Todo", estimate: 3, modified_at: "2026-11-09 10:00" });
    expect(samePart(one, item({ status: "Todo", estimate: 5 }), { values: ["status"] }, DATABASE)).toBe(true);
    expect(samePart(one, item({ status: "Done", estimate: 3 }), { values: ["status"] }, DATABASE)).toBe(false);
    expect(samePart(one, item({ status: "Todo", estimate: 3 }, { name: "Plan" }), { name: true }, DATABASE)).toBe(false);
    expect(samePart(item({}, { look: {} }), item({}), { look: true }, DATABASE)).toBe(true);
    expect(samePart(one, item({ status: "Todo" }), { allValues: true }, DATABASE)).toBe(false);
    // Every own value alike, the system's changed with the write (Modified): alike
    expect(samePart(one, item({ status: "Todo", estimate: 3, modified_at: "2026-11-09 10:05" }), { allValues: true }, DATABASE)).toBe(true);
    // Nothing of it: alike whatever changed (the body's own check)
    expect(samePart(one, item({}, { name: "Plan" }), {}, DATABASE)).toBe(true);
  });
});
