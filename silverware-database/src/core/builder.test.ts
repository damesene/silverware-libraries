import { describe, expect, it } from "vitest";
import type { Item, ItemKey } from "../model/database.ts";
import { databaseChanges } from "./builder.ts";

const fix = "item-1" as ItemKey;
const read: Item = { key: fix, name: "Fix login", values: {}, rank: "a0", revision: "7" };

describe("the changes builder", () => {
  it("makes a database's changes first, then each item's in the order first named", () => {
    const changes = databaseChanges("tasks")
      .item(read, (i) => i.set("status", "Done"))
      .create({ ref: "new", name: "Plan sprint" })
      .schema([])
      .rename("My tasks")
      .item(read, (i) => i.rename("Fix the login"))
      .build();
    expect(changes.changes.map((one) => one.kind)).toEqual(["renameDatabase", "setSchema", "setValue", "renameItem", "createItem"]);
  });

  it("asks for an item to be at the revision read, and for the database's record where asked", () => {
    const changes = databaseChanges("tasks").item(read, (i) => i.unset("due")).expectDatabase("3").build();
    expect(changes.expects).toEqual({ items: { [fix]: "7" }, database: "3" });
    expect(changes.changes).toEqual([{ kind: "setValue", item: fix, key: "due", value: undefined }]);
    expect(databaseChanges("tasks").create({ name: "A" }).build().expects).toBeUndefined();
    expect(() => databaseChanges("tasks").item(read, () => {}).item({ ...read, revision: "8" }, () => {})).toThrow();
  });

  it("folds what is asked of an item it makes into its createItem, an item made and removed nothing", () => {
    const changes = databaseChanges("tasks")
      .create({ name: "Draft", values: { status: "Todo", due: "2026-12-01" } }, (i) => i.rename("Plan").set("status", "Doing").unset("due").rank("a5").body("Notes"))
      .create({ name: "Gone" }, (i) => i.remove())
      .build();
    expect(changes.changes).toEqual([{ kind: "createItem", ref: "new-1", name: "Plan", values: { status: "Doing" }, rank: "a5", body: "Notes" }]);
    expect(() => databaseChanges("tasks").create({ name: "A" }, (i) => i.remove().set("x", 1))).toThrow();
    expect(() => databaseChanges("tasks").create({ ref: "x", name: "A" }).create({ ref: "x", name: "B" })).toThrow();
  });

  it("gives frozen data and is done once built", () => {
    const builder = databaseChanges("tasks").createDatabase("Tasks").create({ name: "A", values: { tags: ["x"] } });
    const changes = builder.build();
    expect(Object.isFrozen(changes) && Object.isFrozen(changes.changes) && Object.isFrozen(changes.changes[0])).toBe(true);
    expect(changes.changes[0]).toEqual({ kind: "createDatabase", name: "Tasks" });
    expect(() => builder.rename("x")).toThrow();
  });
});
