import { describe, expect, it } from "vitest";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import { writeYamlEntry } from "../../../../shared/pages/yamltree.ts";
import type { Changes } from "../../core/changes.ts";
import type { Database, ItemKey } from "../../model/database.ts";
import { type ContractSeed, storeContract } from "../contract.ts";
import { VERSION_1, type PagesVersion } from "./versions.ts";
import { PagesStore } from "./store.ts";
import { DatabaseCore } from "../../core/core.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import { memoryPages } from "./testing.ts";

// An older form, read as version 1 is: what a migration brings to the latest
const VERSION_0: PagesVersion = { ...VERSION_1, version: 0 };

/** A database's pages as the store writes them, its root at `db-<id>` */
function seedPages(seeds: readonly ContractSeed[]): Record<string, string> {
  const pages: Record<string, string> = {};
  for (const { database, items, version: kept } of seeds) {
    const version = kept === "older" ? 0 : kept === "newer" ? 2 : 1;
    const properties = Object.fromEntries(database.properties.map((one) => [one.key, { type: one.type, label: one.label, ...(one.readonly ? { readonly: true } : {}), ...(one.system ? { system: one.system } : {}), ...(one.params as Record<string, never>) }]));
    pages[`db-${database.id}`] = `---\ntags: [db-root]\n${writeYamlEntry("_database", { id: database.id, name: database.name, version, properties })}---\n`;
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
  const store = new PagesStore(memory.platform, { versions: [VERSION_0, VERSION_1] });
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
      "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    due: { type: date, label: Due, readonly: true }\n---\n",
    );
    expect(memory.pages.get("db-tasks/Fix login")).toBe('---\ntags: [db]\nstatus: Todo\ndue: "2026-11-10"\n_database:\n  rank: a0\n---\nSteps');
    expect(store.documentOf(made.created.get("a")!)).toBe("db-tasks/Fix login");
  });

  it("reads a root page's version under format, its name before, as the same, and writes it as version", async () => {
    const { memory, store } = harness(SEED);
    const old = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  format: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n---\n";
    memory.writeOutside("db-tasks", old);
    expect(await store.version("tasks")).toEqual({ version: 1, latest: 1 });
    const report = await store.apply(await store.plan(changes("tasks", { kind: "renameDatabase", name: "Jobs" })));
    expect(report.skipped).toEqual([]);
    // (The old name taken off, the version under its name after the others, as a key added is)
    expect(memory.pages.get("db-tasks")).toBe(old.replace("name: Tasks", "name: Jobs").replace("  format: 1\n", "").replace("---\n---", "---\n").replace("[Todo, Done] }\n", "[Todo, Done] }\n  version: 1\n"));
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

  it("refuses keys the index gives every page, and names a page cannot have: its own rules (no subpage), then the space's", () => {
    const { store, memory } = harness([]);
    for (const key of ["name", "tags", "created"]) expect(store.validatePropertyKey(key), key).toBeDefined();
    expect(store.validatePropertyKey("status")).toBeUndefined();
    for (const name of ["a/b", " padded", ""]) expect(store.validateItemName(name), name).toBeDefined();
    expect(store.validateItemName("x|y")).toBeUndefined();
    // The space's own rules asked
    (memory.platform.space as { validateName?: (name: string) => string | undefined }).validateName = (name) => (name.includes("|") ? "no |" : undefined);
    expect(store.validateItemName("x|y")).toBe("no |");
    expect(store.validateItemName("Fix login (2)")).toBeUndefined();
  });

  it("keeps a property's name shown with its values in the root page, read back so", async () => {
    const { memory, store } = harness(SEED);
    const read = (await store.database("tasks"))!;
    await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: read.value.properties.map((one) => (one.key === "status" ? { ...one, showName: true } : one)) })));
    expect(memory.pages.get("db-tasks")).toContain("status: { type: select, label: Status, showName: true, options: [Todo, Done] }");
    expect((await store.database("tasks"))!.value.properties[0]!.showName).toBe(true);
  });

  it("keeps a property's icon in the root page; one typed by hand that is none kept as written through a change of the schema", async () => {
    const { memory, store } = harness(SEED);
    const read = (await store.database("tasks"))!;
    await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: read.value.properties.map((one) => (one.key === "status" ? { ...one, icon: "🚦" } : one)) })));
    expect(memory.pages.get("db-tasks")).toContain('status: { type: select, label: Status, icon: "🚦", options: [Todo, Done] }');
    expect((await store.database("tasks"))!.value.properties[0]!.icon).toBe("🚦");
    // A word by hand: read as written (the views show the type's), kept as another property's label changes
    const page = memory.pages.get("db-tasks")!.replace('icon: "🚦"', "icon: traffic light");
    memory.writeOutside("db-tasks", page);
    const now = (await store.database("tasks"))!;
    await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: now.value.properties.map((one) => (one.key === "due" ? { ...one, label: "Due date" } : one)) })));
    expect(memory.pages.get("db-tasks")).toContain("icon: traffic light");
    // Not a text: kept as written too, read as none
    memory.writeOutside("db-tasks", memory.pages.get("db-tasks")!.replace("icon: traffic light", "icon: 5"));
    const after = (await store.database("tasks"))!;
    expect(after.value.properties.find((one) => one.key === "status")!.icon).toBeUndefined();
    await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: after.value.properties.map((one) => (one.key === "due" ? { ...one, label: "When" } : one)) })));
    expect(memory.pages.get("db-tasks")).toContain("icon: 5");
  });

  it("writes references as a list of wiki links in quotes, read back as written", async () => {
    const { memory, store } = harness(SEED);
    const [item] = (await store.items("tasks")).value;
    // (Whatever the property's type: the store writes values, the type says what they are)
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: item!.key, key: "status", value: ["[[Projects/Alpha]]", "[[People/Ada|Ada]]"] })));
    expect(memory.pages.get("db-tasks/Fix login")).toContain('status: ["[[Projects/Alpha]]", "[[People/Ada|Ada]]"]');
    expect((await store.items("tasks")).value[0]!.values.status).toEqual(["[[Projects/Alpha]]", "[[People/Ada|Ada]]"]);
  });

  it("keeps an item's look beside its rank, each part written only where it changed; one that reads as none left as written", async () => {
    const { memory, store } = harness(SEED);
    const item = () => store.items("tasks").then((read) => read.value[0]!);
    await store.apply(await store.plan(changes("tasks", { kind: "setLook", item: (await item()).key, look: { icon: "🚀", color: "blue" } })));
    expect(memory.pages.get("db-tasks/Fix login")).toBe('---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n  icon: "🚀"\n  color: blue\n---\n');
    expect((await item()).look).toEqual({ icon: "🚀", color: "blue" });
    await store.apply(await store.plan(changes("tasks", { kind: "setLook", item: (await item()).key, look: { color: "blue" } })));
    expect(memory.pages.get("db-tasks/Fix login")).toBe("---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n  color: blue\n---\n");
    // Typed by hand: an icon of two words and a color of no palette read as none, never written over by a change of the other
    memory.writeOutside("db-tasks/Fix login", "---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n  icon: a rocket\n  color: navy\n---\n");
    expect((await item()).look).toBeUndefined();
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: (await item()).key, key: "status", value: "Done" })));
    expect(memory.pages.get("db-tasks/Fix login")).toBe("---\ntags: [db]\nstatus: Done\n_database:\n  rank: a0\n  icon: a rocket\n  color: navy\n---\n");
    // Its color set (the peek's way: the look as read, the icon none): the icon typed by hand kept
    await store.apply(await store.plan(changes("tasks", { kind: "setLook", item: (await item()).key, look: { color: "green" } })));
    expect(memory.pages.get("db-tasks/Fix login")).toBe("---\ntags: [db]\nstatus: Done\n_database:\n  rank: a0\n  icon: a rocket\n  color: green\n---\n");
    // An icon picked over it, then undone: the text typed by hand back
    const picked = await store.apply(await store.plan(changes("tasks", { kind: "setLook", item: (await item()).key, look: { icon: "🚀", color: "green" } })));
    expect((await item()).look).toEqual({ icon: "🚀", color: "green" });
    await store.apply(await store.planUndo(picked));
    expect(memory.pages.get("db-tasks/Fix login")).toBe("---\ntags: [db]\nstatus: Done\n_database:\n  rank: a0\n  icon: a rocket\n  color: green\n---\n");
    // What is no look refused by the store too
    expect((await store.plan(changes("tasks", { kind: "setLook", item: (await item()).key, look: { icon: "two words" } }))).skipped.map((one) => one.cause)).toEqual(["refused"]);
  });

  it("leaves a value the model cannot hold as it is, writing only what changes", async () => {
    const { memory, store } = harness(SEED);
    memory.writeOutside("db-tasks/Fix login", "---\ntags: [db]\nstatus: { nested: 1 }\ndue: 2026-11-10\n_database:\n  rank: a0\n---\n");
    const [item] = (await store.items("tasks")).value;
    expect(item!.values.status).toBe('{"nested":1}');
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: item!.key, key: "due", value: "2026-12-01" })));
    expect(memory.pages.get("db-tasks/Fix login")).toBe('---\ntags: [db]\nstatus: { nested: 1 }\ndue: "2026-12-01"\n_database:\n  rank: a0\n---\n');
  });

  it("tells its progress page by page as it writes them, one after another", async () => {
    const seed: ContractSeed[] = [{ database: TASKS, items: ["A", "B", "C"].map((name, at) => ({ name, values: { status: "Todo" }, rank: `a${at}` })) }];
    const { memory, store } = harness(seed);
    const items = (await store.items("tasks")).value;
    const plan = await store.plan(changes("tasks", { kind: "renameDatabase", name: "Jobs" }, ...items.map((item) => ({ kind: "setValue" as const, item: item.key, key: "status", value: "Done" }))));
    const told: [number, number, number][] = [];
    // (With each told: how many items' pages hold Done by then)
    const done = () => [...memory.pages.values()].filter((text) => text.includes("status: Done")).length;
    await store.apply(plan, (at, of) => void told.push([at, of, done()]));
    // (The database's own page first, then the items', the last told again once all is done)
    expect(told).toEqual([[1, 4, 0], [2, 4, 1], [3, 4, 2], [4, 4, 3], [4, 4, 3]]);
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
    const { store } = harness([{ ...SEED[0]!, version: "older" }]);
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

  it("shows a page it wrote as the index has it once the index, started on it after the write, tells of it whole: changed by hand right after, the hand's (no wait)", async () => {
    const { memory, store } = harness(SEED, { lagging: true });
    const [fix] = (await store.items("tasks")).value;
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: fix!.key, key: "status", value: "Done" })));
    const status = async () => (await store.items("tasks")).value[0]!.values.status;
    expect(await status()).toBe("Done");
    // Changed by hand before the index took the store's write up: the index has the hand's once it is whole
    memory.writeOutside("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Done", "status: Todo"));
    expect(await status()).toBe("Done");
    memory.catchUp();
    expect(await status()).toBe("Todo");
  });

  it("keeps each of two writes of a page at once to its own hold: one refused puts back what it held only where its hold is still the one", async () => {
    const { memory, store } = harness(SEED, { lagging: true });
    const [fix] = (await store.items("tasks")).value;
    const status = async () => (await store.items("tasks")).value[0]!.values.status;
    // Two writes of the same page planned against it as read: the first written, the second refused (changed since it was read)
    const first = await store.plan(changes("tasks", { kind: "setValue", item: fix!.key, key: "status", value: "Done" }));
    const second = await store.plan(changes("tasks", { kind: "setValue", item: fix!.key, key: "estimate", value: "3" }));
    await Promise.all([store.apply(first), store.apply(second)]);
    expect(await status()).toBe("Done");
    memory.catchUp();
    expect(await status()).toBe("Done");
  });

  it("keeps the keys a page has outside the schema apart, gives them as asked, takes one off its page, leaves the index's own and `_` keys", async () => {
    const { memory, store } = harness(SEED);
    const fix = (await store.items("tasks")).value[0]!;
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Todo", ["status: Todo", "note: keep me", "_tool: x"].join(String.fromCharCode(10))));
    // (Not an item's value: the views see none of it)
    expect((await store.items("tasks")).value[0]!.values).toEqual({ status: "Todo" });
    expect(await store.looseValues("tasks")).toEqual([{ key: "note", values: [{ item: fix.key, value: "keep me" }] }]);
    const read = (await store.items("tasks")).value[0]!;
    await store.apply(await store.plan({ ...changes("tasks", { kind: "setValue", item: read.key, key: "note", value: undefined }), expects: { items: { [read.key]: read.revision } } }));
    expect(memory.pages.get("db-tasks/Fix login")).not.toContain("note:");
    expect(memory.pages.get("db-tasks/Fix login")).toContain("_tool: x");
    expect(await store.looseValues("tasks")).toEqual([]);
  });

  it("shows a key or a value taken off as gone while the index still has the page as it was", async () => {
    const { memory, store } = harness([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo", due: "2026-11-10" }, rank: "a0" }] }], { lagging: true });
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Todo", ["status: Todo", "note: old"].join(String.fromCharCode(10))));
    memory.catchUp();
    const read = (await store.items("tasks")).value[0]!;
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: read.key, key: "note", value: undefined }, { kind: "setValue", item: read.key, key: "due", value: undefined })));
    // (The index not caught up: the page as the store wrote it)
    expect(await store.looseValues("tasks")).toEqual([]);
    expect((await store.items("tasks")).value[0]!.values.due).toBeUndefined();
    memory.catchUp();
    expect(await store.looseValues("tasks")).toEqual([]);
  });

  it("keeps a key typed in a page outside the schema from a property's key changed onto it, or a property named so", async () => {
    const withOld: Database = { ...TASKS, properties: [...TASKS.properties, { key: "old", label: "Old", type: "text", params: {}, readonly: false }] };
    const { memory, store } = harness([{ database: withOld, items: [{ name: "Fix login", values: { status: "Todo", old: "was" }, rank: "a0" }] }]);
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Todo", ["status: Todo", "note: typed by hand"].join(String.fromCharCode(10))));
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: () => true });
    expect(await core.rekeyProperty("tasks", "old", "note")).toHaveProperty("problem");
    expect(memory.pages.get("db-tasks/Fix login")).toContain("note: typed by hand");
    // A property named Note: a key of its own, the hand's left alone
    expect(await core.addProperty("tasks", { label: "Note", type: "text" })).not.toHaveProperty("problem");
    expect((await store.database("tasks"))!.value.properties.at(-1)!.key).toBe("note_2");
    // Added by its key (the screen's Add): takes it, its value shown
    expect(await core.addProperty("tasks", { label: "Note", type: "text", key: "note" })).not.toHaveProperty("problem");
    expect((await store.items("tasks")).value[0]!.values.note).toBe("typed by hand");
  });

  it("lets a page it wrote go once the index has it, its keys outside the schema a map and a list of numbers", async () => {
    const { memory, store } = harness(SEED);
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Todo", ["status: Todo", "meta: { a: 1 }", "nums: [1, 2]"].join(String.fromCharCode(10))));
    const read = (await store.items("tasks")).value[0]!;
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: read.key, key: "status", value: "Done" })));
    // Changed by hand right after: shown once the index has it (the store's hold let go as caught up)
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Done", "status: Todo"));
    expect((await store.items("tasks")).value[0]!.values.status).toBe("Todo");
  });

  it("refuses to take a key off a page changed by hand since it was read, the key's value too", async () => {
    const { memory, store } = harness(SEED);
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("status: Todo", ["status: Todo", "note: first"].join(String.fromCharCode(10))));
    const read = (await store.items("tasks")).value[0]!;
    await memory.platform.space.write("db-tasks/Fix login", memory.pages.get("db-tasks/Fix login")!.replace("note: first", "note: second"));
    const report = await store.apply(await store.plan({ ...changes("tasks", { kind: "setValue", item: read.key, key: "note", value: undefined }), expects: { items: { [read.key]: read.revision } } }));
    expect(report.written).toHaveLength(0);
    expect(memory.pages.get("db-tasks/Fix login")).toContain("note: second");
  });

  it("removes a property and its values whole or not at all: the database changed since the proposal, no item's page written", async () => {
    const { memory, store } = harness([{ database: { ...TASKS, properties: [...TASKS.properties, { key: "note", label: "Note", type: "text", params: {}, readonly: false }] }, items: [{ name: "Fix login", values: { status: "Todo", note: "keep me" }, rank: "a0" }] }]);
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: () => true });
    const proposal = await core.removeProperty("tasks", "note", { values: true });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(await core.renameDatabase("tasks", "Jobs")).not.toHaveProperty("problem");
    await core.apply(proposal);
    expect(memory.pages.get("db-tasks")).toContain("note:");
    expect(memory.pages.get("db-tasks/Fix login")).toContain("note: keep me");
  });

  it("shows what it wrote where the index tells of the page before a query has it, as SilverBullet's does", async () => {
    const { memory, store } = harness(SEED, { lagging: true, toldEarly: true });
    const told: string[] = [];
    store.onChanged((change) => told.push(change.database));
    const [item] = (await store.items("tasks")).value;
    await store.apply(await store.plan(changes("tasks", { kind: "createItem", ref: "n", name: "New", values: {} }, { kind: "removeItem", item: item!.key })));
    // (Told early: its readers not told yet, the index not having it)
    expect(told).toEqual([]);
    const names = async () => (await store.items("tasks")).value.map((one) => one.name);
    expect(await names()).toEqual(["New"]);
    memory.catchUp();
    expect(told.length).toBeGreaterThan(0);
    expect(await names()).toEqual(["New"]);
  });
});
describe("the pages store's system properties", () => {
  const SYSTEM: Database = {
    ...TASKS,
    properties: [
      ...TASKS.properties,
      { key: "created_at", label: "Created", type: "datetime", params: {}, readonly: true, system: "createdAt" },
      { key: "modified_at", label: "Modified", type: "datetime", params: {}, readonly: true, system: "modifiedAt" },
      { key: "order", label: "Order", type: "number", params: {}, readonly: true, system: "order" },
      { key: "page", label: "Page", type: "text", params: {}, readonly: true, system: "page" },
      { key: "page_tags", label: "Tags", type: "multi-select", params: {}, readonly: true, system: "tags" },
    ],
  };
  // B before A in the pages, A first in the order by hand; B's page has a tag of its own and an `order` typed by hand
  const seed = (): ContractSeed[] => [{ database: SYSTEM, items: [{ name: "B", values: { status: "Todo", order: 99 } as never, rank: "a1" }, { name: "A", values: {}, rank: "a0" }] }];
  // (Its tag given by hand, as a user adds one to the page)
  const tagged = async (made: ReturnType<typeof harness>) => {
    const text = made.memory.pages.get("db-tasks/B")!;
    await made.memory.platform.space.write("db-tasks/B", text.replace("tags: [db]", "tags: [db, work]"));
    made.memory.catchUp();
    return made;
  };
  const valuesOf = async (store: PagesStore) => Object.fromEntries((await store.items("tasks")).value.map((one) => [one.name, one.values]));

  it("gives their values from the index (its dates, the page, its tags but the database's) and the order by hand, their kind read from the root page", async () => {
    const { store } = await tagged(harness(seed()));
    expect((await store.database("tasks"))!.value.properties.find((one) => one.key === "order")).toMatchObject({ system: "order", readonly: true, type: "number" });
    const values = await valuesOf(store);
    expect(values.B).toMatchObject({ status: "Todo", order: 2, page: "db-tasks/B", page_tags: ["work"] });
    expect(values.A).toMatchObject({ order: 1, page: "db-tasks/A", page_tags: [] });
    expect(values.B!.created_at).toMatch(/^2026-11-01T09:00:\d\d\.000$/);
    // (Its page written once more since, for its tag: modified later than made)
    expect(String(values.B!.modified_at) > String(values.B!.created_at)).toBe(true);
    expect(values.A!.modified_at).toBe(values.A!.created_at);
  });

  it("writes none of them into a page: a change of another value keeps them out, the date of the change the page's own", async () => {
    const { memory, store } = await tagged(harness(seed()));
    const before = await valuesOf(store);
    const b = (await store.items("tasks")).value.find((one) => one.name === "B")!;
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: b.key, key: "status", value: "Done" }, { kind: "setRank", item: b.key, rank: "a2" })));
    const text = memory.pages.get("db-tasks/B")!;
    expect(text).not.toMatch(/created_at|modified_at|page_tags|^page:/m);
    // (The order typed by hand in the page stays as it was: it is no value of the database's)
    expect(text).toContain("order: 99");
    const after = await valuesOf(store);
    expect(after.B).toMatchObject({ status: "Done", created_at: before.B!.created_at });
    expect(after.B!.modified_at! > before.B!.modified_at!).toBe(true);
  });

  it("counts the tasks of each item's page from the index for Task progress, its share done", async () => {
    const withTasks: Database = { ...TASKS, properties: [...TASKS.properties, { key: "task_progress", label: "Task progress", type: "progress", params: {}, readonly: true, system: "taskProgress" }] };
    const { store } = harness([{ database: withTasks, items: [{ name: "A", values: {}, rank: "a0", body: ["- [x] one", "- [ ] two", "- [x] three", ""].join(String.fromCharCode(10)) }, { name: "B", values: {}, rank: "a1", body: "No tasks" }] }]);
    expect((await store.items("tasks")).value.map((one) => [one.name, one.values.task_progress])).toEqual([
      ["A", 0.6667],
      ["B", undefined],
    ]);
  });

  it("counts the tasks once until a page of the database is indexed, a task ticked by hand then counted anew", async () => {
    const withTasks: Database = { ...TASKS, properties: [...TASKS.properties, { key: "task_progress", label: "Task progress", type: "progress", params: {}, readonly: true, system: "taskProgress" }] };
    const { memory, store } = harness([{ database: withTasks, items: [{ name: "A", values: {}, rank: "a0", body: ["- [x] one", "- [ ] two", ""].join(String.fromCharCode(10)) }] }]);
    const tasks = memory.platform.index.tasks!;
    let asked = 0;
    (memory.platform.index as { tasks: typeof tasks }).tasks = (documents) => (asked++, tasks(documents));
    await store.items("tasks");
    await store.items("tasks");
    expect(asked).toBe(1);
    await memory.platform.space.write("db-tasks/A", memory.pages.get("db-tasks/A")!.replace("- [ ] two", "- [x] two"));
    expect((await store.items("tasks")).value[0]!.values.task_progress).toBe(1);
    expect(asked).toBe(2);
  });

  it("lets a change written whole be applied right after a write, the dates the index gives moving meanwhile", async () => {
    const { memory, store } = await tagged(harness(seed(), { lagging: true }));
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: () => true });
    const b = (await store.items("tasks")).value.find((one) => one.name === "B")!;
    expect(await core.update("tasks", b, "status", "Done")).not.toHaveProperty("problem");
    const proposal = await core.rekeyProperty("tasks", "status", "state");
    if ("problem" in proposal) throw new Error(proposal.problem);
    // (The index has the page now: its modified date SilverBullet's, not the store's)
    memory.catchUp();
    expect(await core.apply(proposal)).not.toHaveProperty("problem");
    expect(memory.pages.get("db-tasks/B")).toContain("state: Done");
  });

  it("shows a page it wrote, before the index has it, made when it was and written now", async () => {
    const { memory, store } = await tagged(harness(seed(), { lagging: true }));
    const before = await valuesOf(store);
    const b = (await store.items("tasks")).value.find((one) => one.name === "B")!;
    await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: b.key, key: "status", value: "Done" })));
    const held = await valuesOf(store);
    expect(held.B).toMatchObject({ status: "Done", created_at: before.B!.created_at, page_tags: ["work"] });
    expect(String(held.B!.modified_at) > String(before.B!.modified_at)).toBe(true);
    memory.catchUp();
    // The index caught up: its own date of writing, not the store's (the test index has a clock of its own)
    const indexed = memory.platform.index.documentDates!((await memory.platform.index.objects("db")).find((one) => one.name === "db-tasks/B")!);
    expect((await valuesOf(store)).B).toMatchObject({ status: "Done", created_at: before.B!.created_at, modified_at: indexed.modified });
    expect(indexed.modified).not.toBe(held.B!.modified_at);
  });
});
