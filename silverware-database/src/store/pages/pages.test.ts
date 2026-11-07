import { describe, expect, it } from "vitest";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import { writeYamlEntry } from "../../../../shared/pages/yamltree.ts";
import type { Changes } from "../../core/changes.ts";
import type { Database, ItemKey } from "../../model/database.ts";
import { type ContractSeed, storeContract } from "../contract.ts";
import { FORMAT_1, type PagesFormat } from "./format.ts";
import { PagesStore } from "./store.ts";
import { memoryPages } from "./testing.ts";

// An older form, read as version 1 is: what a migration brings to the latest
const FORMAT_0: PagesFormat = { ...FORMAT_1, version: 0 };

/** A database's pages as the store writes them, its root at `db-<id>` */
function seedPages(seeds: readonly ContractSeed[]): Record<string, string> {
  const pages: Record<string, string> = {};
  for (const { database, items, format } of seeds) {
    const version = format === "older" ? 0 : format === "newer" ? 2 : 1;
    const properties = Object.fromEntries(database.properties.map((one) => [one.key, { type: one.type, label: one.label, ...(one.readonly ? { readonly: true } : {}), ...(one.params as Record<string, never>) }]));
    pages[`db-${database.id}`] = `---\ntags: [db-root]\n${writeYamlEntry("_database", { id: database.id, name: database.name, format: version, properties })}---\n`;
    for (const item of items ?? []) {
      const values = Object.entries(item.values).map(([key, value]) => writeYamlEntry(key, value as never)).join("");
      const rank = item.rank === undefined ? "" : writeYamlEntry("_database", { rank: item.rank });
      pages[`db-${database.id}/${item.name}`] = `---\ntags: [db]\n${values}${rank}---\n${item.body ?? ""}`;
    }
  }
  return pages;
}

function harness(seeds: readonly ContractSeed[], options: { readonly lagging?: boolean; readonly toldEarly?: boolean } = {}) {
  const memory = memoryPages(seedPages(seeds), options);
  const store = new PagesStore(memory.platform, { formats: [FORMAT_0, FORMAT_1] });
  // Another hand on the pages: a writer of its own, as a page edited by hand
  const hand = pageWriter(memory.platform);
  const changeOutside = async (database: string, item: ItemKey, change: { values?: Record<string, unknown>; name?: string; removed?: true }) => {
    const page = store.documentOf(item)!;
    if (change.removed) return memory.removeOutside(page);
    if (change.values) await hand.write(pageChanges().page(page, (p) => { for (const [key, value] of Object.entries(change.values!)) p.properties.set(key, value as never); }).build());
    if (change.name) await memory.platform.space.rename!(page, `db-${database}/${change.name}`);
  };
  return { memory, store, changeOutside };
}

storeContract("pages store", (seeds) => harness(seeds));

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "due", label: "Due", type: "date", params: {}, readonly: true },
  ],
};
const SEED: readonly ContractSeed[] = [{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo" }, rank: "a0" }] }];
const changes = (database: string, ...list: Changes["changes"]): Changes => ({ database, changes: list });

describe("the pages store", () => {
  it("keeps a database as its root page and an item a page of its folder, in the page's own form", async () => {
    const { memory, store } = harness([]);
    const made = await store.apply(
      await store.plan(changes("tasks", { kind: "createDatabase", name: "Tasks" }, { kind: "setSchema", properties: TASKS.properties }, { kind: "createItem", ref: "a", name: "Fix login", values: { status: "Todo", due: "2026-11-10" }, rank: "a0", body: "Steps" })),
    );
    expect(made.skipped).toEqual([]);
    expect(memory.pages.get("db-tasks")).toBe(
      "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  format: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    due: { type: date, label: Due, readonly: true }\n---\n",
    );
    expect(memory.pages.get("db-tasks/Fix login")).toBe('---\ntags: [db]\nstatus: Todo\ndue: "2026-11-10"\n_database:\n  rank: a0\n---\nSteps');
    expect(store.documentOf(made.created.get("a")!)).toBe("db-tasks/Fix login");
  });

  it("renames an item's page, its key kept, and refuses a name another page has in another case", async () => {
    const { memory, store } = harness(SEED);
    const [item] = (await store.items("tasks")).value;
    await store.apply(await store.plan(changes("tasks", { kind: "renameItem", item: item!.key, name: "Fix the login" })));
    expect([...memory.pages.keys()].sort()).toEqual(["db-tasks", "db-tasks/Fix the login"]);
    expect((await store.items("tasks")).value.map((one) => [one.key, one.name])).toEqual([[item!.key, "Fix the login"]]);
    const plan = await store.plan(changes("tasks", { kind: "createItem", ref: "x", name: "fix THE login", values: {} }));
    expect(plan.skipped.map((one) => one.cause)).toEqual(["refused"]);
  });

  it("shows what it wrote before the index has it, and takes the index's again once it does", async () => {
    const { memory, store } = harness(SEED, { lagging: true });
    const [item] = (await store.items("tasks")).value;
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: item!.key, key: "status", value: "Done" }, { kind: "createItem", ref: "n", name: "New", values: {} })));
    const shown = async () => (await store.items("tasks")).value.map((one) => [one.name, one.values.status ?? null, one.revision]);
    const before = await shown();
    expect(before.map(([name, status]) => [name, status])).toEqual([
      ["Fix login", "Done"],
      ["New", null],
    ]);
    memory.catchUp();
    // The index caught up: the same items, the same revisions (a change made from them still written)
    expect(await shown()).toEqual(before);
    const [fix] = (await store.items("tasks")).value;
    expect((await store.apply(await store.plan({ ...changes("tasks", { kind: "setValue", item: fix!.key, key: "status", value: "Todo" }), expects: { items: { [fix!.key]: fix!.revision } } }))).written).toHaveLength(1);
  });

  it("tells a change of a database's pages made outside it, and reads a page renamed outside as another item", async () => {
    const { memory, store } = harness(SEED);
    const told: string[] = [];
    store.onChanged((change) => told.push(change.database));
    const [item] = (await store.items("tasks")).value;
    memory.writeOutside("Elsewhere", "x");
    expect(told).toEqual([]);
    await memory.platform.space.rename!("db-tasks/Fix login", "db-tasks/Renamed by hand");
    expect(told).toEqual(["tasks", "tasks"]);
    const [again] = (await store.items("tasks")).value;
    expect(again!.name).toBe("Renamed by hand");
    expect(again!.key).not.toBe(item!.key);
  });

  it("refuses keys every page has, and names a page cannot have", () => {
    const { store } = harness([]);
    for (const key of ["name", "tags", "created", "aliases"]) expect(store.validatePropertyKey(key), key).toBeDefined();
    expect(store.validatePropertyKey("status")).toBeUndefined();
    for (const name of ["a/b", "x|y", "#tag", "[[x]]", ".hidden", "Fix v1.2", " padded"]) expect(store.validateItemName(name), name).toBeDefined();
    expect(store.validateItemName("Fix login (2)")).toBeUndefined();
  });

  it("leaves a value the model cannot hold as it is, writing only what changes", async () => {
    const { memory, store } = harness(SEED);
    memory.writeOutside("db-tasks/Fix login", "---\ntags: [db]\nstatus: { nested: 1 }\ndue: 2026-11-10\n_database:\n  rank: a0\n---\n");
    const [item] = (await store.items("tasks")).value;
    expect(item!.values.status).toBe('{"nested":1}');
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: item!.key, key: "due", value: "2026-12-01" })));
    expect(memory.pages.get("db-tasks/Fix login")).toBe('---\ntags: [db]\nstatus: { nested: 1 }\ndue: "2026-12-01"\n_database:\n  rank: a0\n---\n');
  });

  it("never writes a body over one changed by hand since it was read", async () => {
    const { memory, store } = harness([{ database: TASKS, items: [{ name: "A", values: {}, rank: "a0", body: "Body A" }] }]);
    const [item] = (await store.items("tasks")).value;
    const read = await store.body("tasks", item!.key);
    memory.writeOutside("db-tasks/A", memory.pages.get("db-tasks/A")!.replace("Body A", "Body A edited by hand"));
    const report = await store.apply(await store.plan(changes("tasks", { kind: "setBody", item: item!.key, body: `${read} and mine`, was: read })));
    expect(report.skipped.map((one) => one.cause)).toEqual(["changed"]);
    expect(memory.pages.get("db-tasks/A")).toContain("Body A edited by hand");
  });

  it("says a rename that changed the page's text wrote its name alone, and shows the page as it is", async () => {
    const { memory, store } = harness(SEED);
    const rename = memory.platform.space.rename!;
    memory.platform.space.rename = async (from, to) => {
      const done = await rename(from, to);
      memory.writeOutside(to, `${memory.pages.get(to)}[[${to}]]`);
      return done;
    };
    const [item] = (await store.items("tasks")).value;
    const report = await store.apply(await store.plan(changes("tasks", { kind: "renameItem", item: item!.key, name: "Renamed" }, { kind: "setValue", item: item!.key, key: "status", value: "Done" })));
    expect([report.written.length, report.skipped.map((one) => one.cause)]).toEqual([1, ["changed"]]);
    expect((await store.items("tasks")).value.map((one) => [one.name, one.values.status])).toEqual([["Renamed", "Todo"]]);
    await store.apply(await store.planUndo(report));
    expect([...memory.pages.keys()].sort()).toEqual(["db-tasks", "db-tasks/Fix login"]);
  });

  it("shows no page it removed or renamed while the index has not caught up", async () => {
    const { memory, store } = harness([{ database: TASKS, items: [{ name: "A", values: {}, rank: "a0" }, { name: "B", values: {}, rank: "a1" }] }], { lagging: true });
    const [a, b] = (await store.items("tasks")).value;
    await store.apply(await store.plan(changes("tasks", { kind: "removeItem", item: a!.key }, { kind: "renameItem", item: b!.key, name: "B2" })));
    const names = async () => (await store.items("tasks")).value.map((one) => one.name);
    expect(await names()).toEqual(["B2"]);
    expect(await names()).toEqual(["B2"]);
    memory.catchUp();
    expect(await names()).toEqual(["B2"]);
  });

  it("gives an item made anew under a removed one's name a key of its own, Undo the removed its own back", async () => {
    const { store } = harness(SEED);
    const [item] = (await store.items("tasks")).value;
    const removed = await store.apply(await store.plan(changes("tasks", { kind: "removeItem", item: item!.key })));
    const made = await store.apply(await store.plan(changes("tasks", { kind: "createItem", ref: "x", name: "Fix login", values: {} })));
    expect(made.created.get("x")).not.toBe(item!.key);
    await store.apply(await store.planUndo(made));
    await store.apply(await store.planUndo(removed));
    expect((await store.items("tasks")).value.map((one) => one.key)).toEqual([item!.key]);
  });

  it("migrates the databases of a page before any is read", async () => {
    const { store } = harness([{ ...SEED[0]!, format: "older" }]);
    expect(await store.planMigration({ document: "db-tasks" })).toHaveLength(1);
  });

  it("plans a page removed and its name made again in one transaction apart: the name still taken refused, nothing thrown", async () => {
    const { store, memory } = harness(SEED);
    const [item] = (await store.items("tasks")).value;
    const plan = await store.plan(changes("tasks", { kind: "removeItem", item: item!.key }, { kind: "createItem", ref: "x", name: "Fix login", values: {} }));
    expect([plan.planned.length, plan.skipped.map((one) => one.cause)]).toEqual([1, ["refused"]]);
    const renamed = await store.plan(changes("tasks", { kind: "renameItem", item: item!.key, name: "C" }, { kind: "createItem", ref: "y", name: "Fix login", values: {} }));
    expect(renamed.skipped.map((one) => one.cause)).toEqual(["refused"]);
    await store.apply(plan);
    expect([...memory.pages.keys()]).toEqual(["db-tasks"]);
  });

  it("never writes a body over a hand's edit made between the store's reads of the page", async () => {
    const { memory, store } = harness([{ database: TASKS, items: [{ name: "A", values: {}, rank: "a0", body: "Body" }] }]);
    const [item] = (await store.items("tasks")).value;
    const read = memory.platform.space.read;
    let reads = 0;
    memory.platform.space.read = async (name) => {
      const text = await read(name);
      if (name === "db-tasks/A" && ++reads === 1) memory.writeOutside(name, text.replace("Body", "Mine"));
      return text;
    };
    const report = await store.apply(await store.plan(changes("tasks", { kind: "setBody", item: item!.key, body: "New", was: "Body" })));
    expect(report.written).toEqual([]);
    expect(memory.pages.get("db-tasks/A")).toContain("Mine");
  });

  it("reads no body of a page gone outside the index has not caught up with, and throws nothing planning it", async () => {
    const { memory, store } = harness(SEED, { lagging: true });
    const [item] = (await store.items("tasks")).value;
    memory.removeOutside("db-tasks/Fix login");
    expect(await store.body("tasks", item!.key)).toBeUndefined();
    const plan = await store.plan(changes("tasks", { kind: "setBody", item: item!.key, body: "x", was: "" }));
    expect(plan.planned).toEqual([]);
  });

  it("gives an item made its key before it is written: a reader told meanwhile sees the key it keeps", async () => {
    const { store } = harness(SEED);
    const seen: string[] = [];
    store.onChanged(() => void store.items("tasks").then((items) => seen.push(...items.value.filter((one) => one.name === "New").map((one) => one.key))));
    const made = await store.apply(await store.plan(changes("tasks", { kind: "createItem", ref: "n", name: "New", values: {} })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set([made.created.get("n")]));
  });

  it("shows what it wrote where the index tells of the page before a query has it, as SilverBullet's does", async () => {
    const { memory, store } = harness(SEED, { lagging: true, toldEarly: true });
    const told: string[] = [];
    store.onChanged((change) => told.push(change.database));
    const [item] = (await store.items("tasks")).value;
    await store.apply(await store.plan(changes("tasks", { kind: "createItem", ref: "n", name: "New", values: {} }, { kind: "removeItem", item: item!.key })));
    expect(told.length).toBeGreaterThan(0);
    const names = async () => (await store.items("tasks")).value.map((one) => one.name);
    expect(await names()).toEqual(["New"]);
    memory.catchUp();
    expect(await names()).toEqual(["New"]);
  });
});