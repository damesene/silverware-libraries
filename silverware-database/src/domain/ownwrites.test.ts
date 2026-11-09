import { describe, expect, it } from "vitest";
import type { Item, ItemKey } from "../model/database.ts";
import { ItemWrites, sameBeside } from "./ownwrites.ts";

const KEY = "a" as ItemKey;
const item = (revision: string, values: Record<string, string> = {}, name = "Untitled"): Item => ({ key: KEY, name, values, revision }) as Item;

describe("an item's own writes", () => {
  it("compares two readings of an item in all but the part written", () => {
    expect(sameBeside(item("1", { status: "Todo" }), item("2", { status: "Done" }), { key: "status" })).toBe(true);
    expect(sameBeside(item("1", { status: "Todo" }), item("2", { status: "Done", owner: "Ada" }), { key: "status" })).toBe(false);
    expect(sameBeside(item("1"), item("2", {}, "Plan"), "name")).toBe(true);
    expect(sameBeside(item("1"), item("2", {}, "Plan"), { key: "status" })).toBe(false);
  });

  it("writes one after another, each on the item as those before it from the same drawing left it", async () => {
    let stored = item("1");
    const writes = new ItemWrites(async () => stored);
    const drawn = stored;
    const bases: string[] = [];
    let finishRename!: () => void;
    const renaming = writes.write(drawn, "name", async (base) => {
      bases.push(base.revision);
      await new Promise<void>((resolve) => (finishRename = resolve));
      stored = item("2", {}, "Plan");
      return {};
    });
    const setting = writes.write(drawn, { key: "status" }, async (base) => {
      bases.push(base.revision);
      stored = item("3", { status: "Done" }, "Plan");
      return {};
    });
    await Promise.resolve();
    expect(bases).toEqual(["1"]);
    finishRename();
    await Promise.all([renaming, setting]);
    expect(bases).toEqual(["1", "2"]);
    // A drawing of the item as it is now writes on itself
    expect(writes.base(stored)).toBe(stored);
  });

  it("leaves a later write on the item as drawn where it changed elsewhere besides, or the write was refused", async () => {
    let stored = item("1");
    const writes = new ItemWrites(async () => stored);
    const drawn = stored;
    await writes.write(drawn, "name", async () => {
      // (Its name written, and a value changed elsewhere meanwhile)
      stored = item("2", { owner: "Ada" }, "Plan");
      return {};
    });
    expect(writes.base(drawn)).toBe(drawn);
    await writes.write(drawn, "name", async () => ({ problem: "refused" }));
    expect(writes.base(drawn)).toBe(drawn);
  });
});
