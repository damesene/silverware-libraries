import { describe, expect, it } from "vitest";
import type { Database, Item, ItemKey, Value } from "../model/database.ts";
import { DOCUMENT } from "./noun.ts";
import { localStamp, systemKind, systemProperties, tasksIn, withSystemValues } from "./system.ts";

const item = (name: string, rank: string | undefined, values: Record<string, Value> = {}): Item => ({ key: name as ItemKey, revision: "1", name, values, rank });
const property = (key: string, system: string, type: string) => ({ key, label: key, type, params: {}, readonly: true, system });
const DATABASE: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo"] }, readonly: false },
    property("created_at", "createdAt", "datetime"),
    property("modified_at", "modifiedAt", "datetime"),
    property("order", "order", "number"),
    property("page", "page", "text"),
    property("page_tags", "tags", "multi-select"),
  ],
};

describe("system properties", () => {
  it("are five kinds, each its type and key, found by name", () => {
    expect(systemProperties(DOCUMENT).map((one) => [one.kind, one.type, one.key])).toEqual([
      ["createdAt", "datetime", "created_at"],
      ["modifiedAt", "datetime", "modified_at"],
      ["order", "number", "order"],
      ["page", "text", "page"],
      ["tags", "multi-select", "page_tags"],
      ["taskProgress", "progress", "task_progress"],
    ]);
    expect(systemKind("order", DOCUMENT)?.label).toBe("Order");
    // (Said in the word of the place the items are kept in: a document, a page)
    expect([systemKind("page", DOCUMENT)?.label, systemKind("page", DOCUMENT)?.hint]).toEqual(["Document", "The item's document"]);
    expect([systemKind("page", { one: "page", many: "pages" })?.label, systemKind("createdAt", { one: "page", many: "pages" })?.hint]).toEqual(["Page", "When the item's page was made"]);
    expect(systemKind("nothing", DOCUMENT)).toBeUndefined();
  });

  it("give each item its values from what the store knows of it, the order counted over every item in the order by hand", () => {
    const items = [item("b", "a2", { status: "Todo" }), item("a", "a1"), item("c", undefined)];
    const facts = { b: { created: "2026-11-01T10:00:00.000", modified: "2026-11-08T09:30:00.000", page: "Tasks/b", tags: ["work"] }, a: { page: "Tasks/a", tags: [] } } as Record<string, object>;
    const made = withSystemValues(items, DATABASE, (one) => facts[one.name] ?? {});
    expect(made.map((one) => one.values)).toEqual([
      { status: "Todo", created_at: "2026-11-01T10:00:00.000", modified_at: "2026-11-08T09:30:00.000", order: 2, page: "Tasks/b", page_tags: ["work"] },
      { order: 1, page: "Tasks/a", page_tags: [] },
      // (Without a rank: after the ranked ones; nothing known of its page: no dates, no page)
      { order: 3 },
    ]);
  });

  it("keep no value an item holds under a system property's key: what the store knows, or none", () => {
    const made = withSystemValues([item("a", "a1", { order: 99, page: "typed by hand" })], DATABASE, () => ({}));
    expect(made[0]!.values).toEqual({ order: 1 });
  });

  it("leave the items as they are where the database has none", () => {
    const plain: Database = { ...DATABASE, properties: DATABASE.properties.slice(0, 1) };
    const items = [item("a", "a1", { status: "Todo" })];
    expect(withSystemValues(items, plain, () => ({ created: "2026-11-01T10:00:00.000" }))[0]).toBe(items[0]);
  });

  it("give the share of a page's tasks done, none where it has no task; count a text's tasks as SilverBullet's index does", () => {
    const withTasks: Database = { ...DATABASE, properties: [property("task_progress", "taskProgress", "progress")] };
    const facts: Record<string, object> = { a: { tasks: { done: 2, total: 3 } }, b: { tasks: { done: 0, total: 0 } } };
    expect(withSystemValues([item("a", "a0"), item("b", "a1"), item("c", "a2")], withTasks, (one) => facts[one.name] ?? {}).map((one) => one.values)).toEqual([{ task_progress: 0.6667 }, {}, {}]);
    expect(tasksIn(["- [x] done", "- [ ] open", "  * [X] nested, done", "1. [ ] numbered", "[x] no list item", "- [-] another state"].join(String.fromCharCode(10)))).toEqual({ done: 2, total: 5 });
    // Not in fenced code, nor without a space after the state; in a quote, of a state of several letters, yes
    const more = ["```", "- [ ] code", "```", "- [ ]no space", "> - [x] quoted", "- [IN PROGRESS] long"];
    expect(tasksIn(more.join(String.fromCharCode(10)))).toEqual({ done: 1, total: 2 });
  });

  it("write a moment as SilverBullet's index does, in local time to the millisecond", () => {
    expect(localStamp(new Date(2026, 10, 8, 9, 5, 7, 42))).toBe("2026-11-08T09:05:07.042");
  });
});
