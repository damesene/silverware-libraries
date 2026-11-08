// The contract every store passes (docs/silverware-database.md, *Layers*,
// contract tests): one suite, run against each store by its own test
// (memory.test.ts now, the pages store's in step 4), so that the core, the
// views and the modules, tested over the memory store, hold over any. What a
// part was left for is checked by its `cause`, not its words, which are the
// store's own.
import { describe, expect, it } from "vitest";
import type { Database, Item, ItemKey, Value } from "../model/database.ts";
import type { Changes, DatabaseChange } from "../core/changes.ts";
import type { DatabaseStore, TransactionPlan } from "../core/store.ts";

/** A database a store starts with: its record, its items (their keys the store's), kept in an older or a newer version than the store writes */
export type ContractSeed = {
  readonly database: Database;
  readonly items?: readonly Omit<Item, "key" | "revision">[];
  readonly version?: "older" | "newer";
};

/** What a test changes of an item outside the core (a page edited by hand): values set, a new name, the item gone */
export type ContractOutside = { readonly values?: Readonly<Record<string, Value>>; readonly name?: string; readonly removed?: true };

/** A store made for a test, and how to change one of its items outside the core */
export type ContractHarness = {
  readonly store: DatabaseStore;
  changeOutside(database: string, item: ItemKey, change: ContractOutside): Promise<void> | void;
};

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "due", label: "Due", type: "date", params: {}, readonly: false },
  ],
};

const SEED: readonly ContractSeed[] = [
  {
    database: TASKS,
    items: [
      { name: "Fix login", values: { status: "Todo" }, rank: "a0" },
      { name: "Write docs", values: { status: "Done", due: "2026-11-10" }, rank: "a1" },
    ],
  },
];

const changes = (database: string, ...list: DatabaseChange[]): Changes => ({ database, changes: list });
const causes = (plan: Pick<TransactionPlan, "skipped">) => plan.skipped.map((one) => one.cause);

export function storeContract(name: string, make: (seeds: readonly ContractSeed[]) => ContractHarness): void {
  describe(`${name}: the store contract`, () => {
    const keyOf = async (store: DatabaseStore, itemName: string) => (await store.items("tasks")).value.find((item) => item.name === itemName)!.key;
    const itemOf = async (store: DatabaseStore, key: ItemKey) => (await store.items("tasks")).value.find((item) => item.key === key);

    it("gives the values items keep under keys the schema has none of, and takes one off as any value", async () => {
      const { store } = make([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo", legacy: "kept" }, rank: "a0" }, { name: "Write docs", values: { status: "Done" }, rank: "a1" }] }]);
      const fix = await keyOf(store, "Fix login");
      expect(await store.looseValues("tasks")).toEqual([{ key: "legacy", values: [{ item: fix, value: "kept" }] }]);
      const read = (await itemOf(store, fix))!;
      const report = await store.apply(await store.plan({ database: "tasks", changes: [{ kind: "setValue", item: fix, key: "legacy", value: undefined }], expects: { items: { [fix]: read.revision } } }));
      expect(report.written).toHaveLength(1);
      expect(await store.looseValues("tasks")).toEqual([]);
      expect(await store.looseValues("none")).toEqual([]);
    });

    it("reads databases and their items, the keys the same at every read", async () => {
      const { store } = make(SEED);
      expect(await store.databases()).toEqual([{ id: "tasks", name: "Tasks" }]);
      expect((await store.database("tasks"))!.value).toEqual(TASKS);
      expect(await store.database("none")).toBeUndefined();
      const first = (await store.items("tasks")).value;
      expect(first.map((item) => [item.name, item.values, item.rank])).toEqual([
        ["Fix login", { status: "Todo" }, "a0"],
        ["Write docs", { status: "Done", due: "2026-11-10" }, "a1"],
      ]);
      expect((await store.items("tasks")).value.map((item) => [item.key, item.revision])).toEqual(first.map((item) => [item.key, item.revision]));
    });

    it("plans without writing, then applies, the revisions moved and the keys of items made reported", async () => {
      const { store } = make(SEED);
      const fix = await keyOf(store, "Fix login");
      const before = await store.items("tasks");
      const plan = await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "status", value: "Done" }, { kind: "createItem", ref: "new", name: "Plan sprint", values: { status: "Todo" }, rank: "a2" }));
      expect(plan.planned.map((one) => one.target)).toEqual([{ item: fix }, { ref: "new" }]);
      expect(plan.skipped).toEqual([]);
      expect((await store.items("tasks")).revision).toBe(before.revision);
      const report = await store.apply(plan);
      expect(report.written).toHaveLength(2);
      const made = report.created.get("new")!;
      expect((await itemOf(store, fix))!.values.status).toBe("Done");
      expect((await itemOf(store, fix))!.revision).not.toBe(before.value.find((item) => item.key === fix)!.revision);
      expect((await itemOf(store, made))!.name).toBe("Plan sprint");
      expect((await store.items("tasks")).revision).not.toBe(before.revision);
    });

    it("writes a plan once: applied again, all of it is left as changed", async () => {
      const { store } = make(SEED);
      const plan = await store.plan(changes("tasks", { kind: "setValue", item: await keyOf(store, "Fix login"), key: "status", value: "Done" }));
      await store.apply(plan);
      expect(causes(await store.apply(plan))).toEqual(["changed"]);
    });

    it("leaves an item changed since it was read, writing the others", async () => {
      const { store, changeOutside } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const plan = await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "due", value: "2026-12-01" }, { kind: "setValue", item: docs, key: "due", value: "2026-12-02" }));
      await changeOutside("tasks", fix, { values: { status: "Done" } });
      const report = await store.apply(plan);
      expect(report.written.map((one) => one.target)).toEqual([{ item: docs }]);
      expect(report.skipped.map((one) => [one.target, one.cause])).toEqual([[{ item: fix }, "changed"]]);
    });

    it("leaves an item at another revision than the one the changes were made from", async () => {
      const { store, changeOutside } = make(SEED);
      const fix = await keyOf(store, "Fix login");
      const read = (await itemOf(store, fix))!.revision;
      await changeOutside("tasks", fix, { values: { due: "2026-12-24" } });
      const plan = await store.plan({ ...changes("tasks", { kind: "setValue", item: fix, key: "status", value: "Done" }), expects: { items: { [fix]: read } } });
      expect(causes(plan)).toEqual(["changed"]);
    });

    it("leaves the database's changes, and its items' made against them, where its record is at another revision than read", async () => {
      const { store } = make(SEED);
      const fix = await keyOf(store, "Fix login");
      const read = (await store.database("tasks"))!.revision;
      const schema = [...TASKS.properties, { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false }];
      // Planned against the record as read, then the record changed by another transaction
      const plan = await store.plan(changes("tasks", { kind: "setSchema", properties: schema }, { kind: "setValue", item: fix, key: "estimate", value: 3 }));
      await store.apply(await store.plan(changes("tasks", { kind: "renameDatabase", name: "Other" })));
      const report = await store.apply(plan);
      expect(report.written).toEqual([]);
      expect(causes(report)).toEqual(["changed", "changed"]);
      expect((await itemOf(store, fix))!.values.estimate).toBeUndefined();
      // Named as read: refused at once
      expect(causes(await store.plan({ ...changes("tasks", { kind: "renameDatabase", name: "Again" }), expects: { database: read } }))).toEqual(["changed"]);
    });

    it("refuses an item's changes whole where one of them is refused, whatever follows it", async () => {
      const { store } = make(SEED);
      const fix = await keyOf(store, "Fix login");
      const plan = await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "nope", value: 1 }, { kind: "setValue", item: fix, key: "status", value: "Done" }));
      expect(causes(plan)).toEqual(["refused"]);
      expect(plan.planned).toEqual([]);
      // A change after the item is removed
      const removed = await store.plan(changes("tasks", { kind: "removeItem", item: fix }, { kind: "setValue", item: fix, key: "status", value: "Done" }));
      expect(causes(removed)).toEqual(["refused"]);
    });

    it("takes a value off from a key the schema no longer has: a key renamed", async () => {
      const { store } = make(SEED);
      const docs = await keyOf(store, "Write docs");
      const schema = TASKS.properties.map((property) => (property.key === "due" ? { ...property, key: "deadline" } : property));
      const report = await store.apply(
        await store.plan(changes("tasks", { kind: "setSchema", properties: schema }, { kind: "setValue", item: docs, key: "deadline", value: "2026-11-10" }, { kind: "setValue", item: docs, key: "due", value: undefined })),
      );
      expect(report.skipped).toEqual([]);
      expect((await itemOf(store, docs))!.values).toEqual({ status: "Done", deadline: "2026-11-10" });
    });

    it("loses no value by a schema without its property: the property back, its values show again", async () => {
      const { store } = make(SEED);
      const docs = await keyOf(store, "Write docs");
      const report = await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: TASKS.properties.filter((property) => property.key !== "due") })));
      expect(report.skipped).toEqual([]);
      // (Shown meanwhile or not, as the store keeps it: a page's keys the schema lacks are the page's own)
      expect((await itemOf(store, docs))!.values.status).toBe("Done");
      await store.apply(await store.planUndo(report));
      expect((await store.database("tasks"))!.value).toEqual(TASKS);
      expect((await itemOf(store, docs))!.values).toEqual({ status: "Done", due: "2026-11-10" });
    });

    it("refuses a schema of a key twice or one no store keeps, and a database without a name", async () => {
      const { store } = make(SEED);
      const twice = [...TASKS.properties, TASKS.properties[0]!];
      const bad = [{ ...TASKS.properties[0]!, key: "Due-Date" }];
      expect(causes(await store.plan(changes("tasks", { kind: "setSchema", properties: twice })))).toEqual(["refused"]);
      expect(causes(await store.plan(changes("tasks", { kind: "setSchema", properties: bad })))).toEqual(["refused"]);
      expect(causes(await store.plan(changes("tasks", { kind: "renameDatabase", name: " " })))).toEqual(["refused"]);
    });

    it("makes an item once, however often its plan is applied", async () => {
      const { store } = make(SEED);
      const plan = await store.plan(changes("tasks", { kind: "createItem", ref: "new", name: "Plan sprint", values: {}, rank: "a2" }));
      await store.apply(plan);
      const again = await store.apply(plan);
      expect(again.written).toEqual([]);
      expect(causes(again)).toEqual(["changed"]);
      expect((await store.items("tasks")).value.filter((item) => item.name === "Plan sprint")).toHaveLength(1);
    });

    it("keeps a database made and undone where an item came into it between the undo's plan and its apply", async () => {
      const { store, changeOutside } = make(SEED);
      const report = await store.apply(await store.plan(changes("ideas", { kind: "createDatabase", name: "Ideas" }, { kind: "createItem", ref: "one", name: "First", values: {} })));
      const undo = await store.planUndo(report);
      await store.apply(await store.plan(changes("ideas", { kind: "createItem", ref: "two", name: "Second", values: {} })));
      await store.apply(undo);
      expect((await store.items("ideas")).value.map((item) => item.name)).toEqual(["Second"]);
      // An item edited by hand meanwhile: it stays, its database too, and an undo of that undo loses nothing
      const again = await store.apply(await store.plan(changes("more", { kind: "createDatabase", name: "More" }, { kind: "createItem", ref: "x", name: "X", values: {} })));
      const late = await store.planUndo(again);
      await changeOutside("more", again.created.get("x")!, { name: "Edited by hand" });
      const undone = await store.apply(late);
      await store.apply(await store.planUndo(undone));
      expect((await store.items("more")).value.map((item) => item.name)).toEqual(["Edited by hand"]);
    });

    it("never gives two items one name, whatever was written between a plan and its apply", async () => {
      const { store } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const one = await store.plan(changes("tasks", { kind: "createItem", ref: "a", name: "Same", values: {} }));
      const other = await store.plan(changes("tasks", { kind: "createItem", ref: "b", name: "Same", values: {} }));
      await store.apply(one);
      expect(causes(await store.apply(other))).toEqual(["refused"]);
      const renameFix = await store.plan(changes("tasks", { kind: "renameItem", item: fix, name: "Z" }));
      const renameDocs = await store.plan(changes("tasks", { kind: "renameItem", item: docs, name: "Z" }));
      await store.apply(renameFix);
      expect(causes(await store.apply(renameDocs))).toEqual(["refused"]);
      // An undo planned before another item took the name back
      const undo = await store.planUndo(await store.apply(await store.plan(changes("tasks", { kind: "renameItem", item: docs, name: "Docs" }))));
      await store.apply(await store.plan(changes("tasks", { kind: "renameItem", item: fix, name: "Write docs" })));
      expect(causes(await store.apply(undo))).toEqual(["refused"]);
      const names = (await store.items("tasks")).value.map((item) => item.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("swaps two items' names in one transaction whole or not at all, and undoes it", async () => {
      const { store } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const swap = [{ kind: "renameItem", item: fix, name: "Write docs" }, { kind: "renameItem", item: docs, name: "Fix login" }] as const;
      const report = await store.apply(await store.plan(changes("tasks", ...swap)));
      const names = [(await itemOf(store, fix))!.name, (await itemOf(store, docs))!.name];
      // (A store of pages cannot rename two pages into each other's names: it refuses both, never one)
      if (report.written.length === 0) {
        expect(causes(report)).toEqual(["refused", "refused"]);
        expect(names).toEqual(["Fix login", "Write docs"]);
        return;
      }
      expect(report.skipped).toEqual([]);
      expect(names).toEqual(["Write docs", "Fix login"]);
      expect((await store.apply(await store.planUndo(report))).skipped).toEqual([]);
      expect((await itemOf(store, fix))!.name).toBe("Fix login");
    });

    it("renames options in the schema and the items' values in one transaction, swapped and in a list's order, undone whole", async () => {
      const { store } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const labels = { key: "labels", label: "Labels", type: "multi-select", params: { options: ["c", "a", "b"] }, readonly: false };
      await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: [...TASKS.properties, labels] }, { kind: "setValue", item: fix, key: "labels", value: ["c", "a", "b"] })));
      const items = (await store.items("tasks")).value;
      const revisions = Object.fromEntries(items.map((item) => [item.key, item.revision]));
      // Todo and Done swap names, "a" becomes "alpha": the values with them
      const schema = [{ ...TASKS.properties[0]!, params: { options: ["Done", "Todo"] } }, TASKS.properties[1]!, { ...labels, params: { options: ["c", "alpha", "b"] } }];
      const report = await store.apply(
        await store.plan({
          ...changes("tasks", { kind: "setSchema", properties: schema }, { kind: "setValue", item: fix, key: "status", value: "Done" }, { kind: "setValue", item: fix, key: "labels", value: ["c", "alpha", "b"] }, { kind: "setValue", item: docs, key: "status", value: "Todo" }),
          expects: { items: revisions, database: (await store.database("tasks"))!.revision },
        }),
      );
      expect(report.skipped).toEqual([]);
      expect((await itemOf(store, fix))!.values).toEqual({ status: "Done", labels: ["c", "alpha", "b"] });
      expect((await itemOf(store, docs))!.values).toEqual({ status: "Todo", due: "2026-11-10" });
      expect((await store.database("tasks"))!.value.properties).toEqual(schema);
      expect((await store.apply(await store.planUndo(report))).skipped).toEqual([]);
      expect((await itemOf(store, fix))!.values).toEqual({ status: "Todo", labels: ["c", "a", "b"] });
      expect((await itemOf(store, docs))!.values.status).toBe("Done");
      expect((await store.database("tasks"))!.value.properties[2]).toEqual(labels);
    });

    it("tells how far a plan's writing is, part by part, the last with all of them, left parts counted", async () => {
      const { store, changeOutside } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const plan = await store.plan(changes("tasks", { kind: "renameDatabase", name: "Jobs" }, { kind: "setValue", item: fix, key: "status", value: "Done" }, { kind: "setValue", item: docs, key: "status", value: "Todo" }));
      await changeOutside("tasks", docs, { values: { due: "2026-12-01" } });
      const told: [number, number][] = [];
      const report = await store.apply(plan, (done, of) => void told.push([done, of]));
      expect(report.skipped).toHaveLength(1);
      expect(told.at(-1)).toEqual([3, 3]);
      expect(told.every(([done, of], at) => of === 3 && done <= of && (at === 0 || done >= told[at - 1]![0]))).toBe(true);
      // A listener that throws stops nothing: every part written, reported
      const again = await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "due", value: "2026-12-24" }));
      const throwing = await store.apply(again, () => {
        throw new Error("a listener's mistake");
      });
      expect(throwing.written).toHaveLength(1);
      expect((await itemOf(store, fix))!.values.due).toBe("2026-12-24");
    });

    it("refuses one ref made twice in a transaction", async () => {
      const { store } = make(SEED);
      const plan = await store.plan(changes("tasks", { kind: "createItem", ref: "x", name: "C", values: {} }, { kind: "createItem", ref: "x", name: "D", values: {} }));
      expect(plan.planned).toEqual([]);
      expect(causes(plan)).toEqual(["refused"]);
    });

    it("writes nothing of a database's plan into another database, nor into one made again under its id", async () => {
      const { store } = make(SEED);
      await store.apply(await store.plan(changes("ideas", { kind: "createDatabase", name: "Ideas" })));
      const plan = await store.plan(changes("tasks", { kind: "createItem", ref: "x", name: "Task", values: { status: "Todo" } }));
      expect(causes(await store.apply({ ...plan, database: "ideas" }))).toEqual(["refused"]);
      expect((await store.items("ideas")).value).toEqual([]);
      // An old undo after its database was undone and made again
      const made = await store.apply(await store.plan(changes("more", { kind: "createDatabase", name: "More" }, { kind: "createItem", ref: "old", name: "Old", values: {} })));
      const removed = await store.apply(await store.plan(changes("more", { kind: "removeItem", item: made.created.get("old")! })));
      await store.apply(await store.planUndo(made));
      await store.apply(await store.plan(changes("more", { kind: "createDatabase", name: "Other" })));
      await store.apply(await store.planUndo(removed));
      expect((await store.items("more")).value).toEqual([]);
    });

    it("leaves an item's changes made from a record since changed, though the transaction changes only items", async () => {
      const { store } = make(SEED);
      const fix = await keyOf(store, "Fix login");
      const read = (await store.database("tasks"))!.revision;
      const plan = await store.plan({ ...changes("tasks", { kind: "setValue", item: fix, key: "due", value: "2026-12-01" }), expects: { database: read } });
      await store.apply(await store.plan(changes("tasks", { kind: "setSchema", properties: TASKS.properties.filter((property) => property.key !== "due") })));
      expect(causes(await store.apply(plan))).toEqual(["changed"]);
      expect((await itemOf(store, fix))!.values.due).toBeUndefined();
    });

    it("gives everything of an item back by an undo: a value taken off, and an item removed whole", async () => {
      const { store } = make(SEED);
      const docs = await keyOf(store, "Write docs");
      await store.apply(await store.plan(changes("tasks", { kind: "setBody", item: docs, body: "Notes", was: await store.body("tasks", docs) })));
      const whole = await itemOf(store, docs);
      const off = await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: docs, key: "due", value: undefined })));
      await store.apply(await store.planUndo(off));
      const removed = await store.apply(await store.plan(changes("tasks", { kind: "removeItem", item: docs })));
      await store.apply(await store.planUndo(removed));
      const back = (await itemOf(store, docs))!;
      expect([back.name, back.values, back.rank, await store.body("tasks", docs)]).toEqual([whole!.name, whole!.values, whole!.rank, "Notes"]);
    });

    it("migrates once, and undoes a migration", async () => {
      const { store } = make([{ ...SEED[0]!, version: "older" }]);
      const before = await store.version("tasks");
      const [migration] = await store.planMigration({ database: "tasks" });
      const report = await store.apply(migration!);
      expect(causes(await store.apply(migration!))).toEqual(["changed"]);
      await store.apply(await store.planUndo(report));
      expect(await store.version("tasks")).toEqual(before);
      expect((await store.items("tasks")).value).toHaveLength(2);
    });

    it("refuses to give a name back by an undo where another item took it since", async () => {
      const { store, changeOutside } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const report = await store.apply(await store.plan(changes("tasks", { kind: "renameItem", item: fix, name: "Fix the login" })));
      await changeOutside("tasks", docs, { name: "Fix login" });
      const undo = await store.planUndo(report);
      expect(undo.skipped.map((one) => [one.target, one.cause])).toEqual([[{ item: fix }, "refused"]]);
    });

    it("leaves an item gone outside it, and changes refused, saying why", async () => {
      const { store, changeOutside } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      await changeOutside("tasks", docs, { removed: true });
      const plan = await store.plan(
        changes("tasks", { kind: "removeItem", item: docs }, { kind: "setValue", item: fix, key: "nope", value: 1 }, { kind: "createItem", ref: "x", name: "", values: {} }),
      );
      expect(plan.planned).toEqual([]);
      expect(plan.skipped.map((one) => [one.target, one.cause])).toEqual([
        [{ item: docs }, "missing"],
        [{ item: fix }, "refused"],
        [{ ref: "x" }, "refused"],
      ]);
      expect(causes(await store.plan(changes("none", { kind: "renameDatabase", name: "x" })))).toEqual(["missing"]);
      expect(causes(await store.plan(changes("tasks", { kind: "createDatabase", name: "Tasks again" })))).toEqual(["refused"]);
    });

    it("undoes what it wrote, leaving what changed since, and redoes it by undoing the undo", async () => {
      const { store, changeOutside } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      const report = await store.apply(await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "status", value: "Done" }, { kind: "setValue", item: docs, key: "status", value: "Todo" })));
      await changeOutside("tasks", docs, { values: { due: "2027-01-01" } });
      const undo = await store.planUndo(report);
      expect(undo.skipped.map((one) => [one.target, one.cause])).toEqual([[{ item: docs }, "changed"]]);
      const undone = await store.apply(undo);
      expect(undone.undoes).toBe(report);
      expect((await itemOf(store, fix))!.values.status).toBe("Todo");
      expect((await itemOf(store, docs))!.values.status).toBe("Todo");
      await store.apply(await store.planUndo(undone));
      expect((await itemOf(store, fix))!.values.status).toBe("Done");
    });

    it("keeps an item's key and rank through a rename, refusing a name another item keeps after the transaction", async () => {
      const { store } = make(SEED);
      const [fix, docs] = [await keyOf(store, "Fix login"), await keyOf(store, "Write docs")];
      await store.apply(await store.plan(changes("tasks", { kind: "renameItem", item: fix, name: "Fix the login" })));
      expect([(await itemOf(store, fix))!.name, (await itemOf(store, fix))!.rank]).toEqual(["Fix the login", "a0"]);
      expect(causes(await store.plan(changes("tasks", { kind: "renameItem", item: fix, name: "Write docs" })))).toEqual(["refused"]);
      // A name freed in the same transaction, whatever the order
      const swap = await store.plan(changes("tasks", { kind: "renameItem", item: fix, name: "Write docs" }, { kind: "removeItem", item: docs }));
      expect(swap.skipped).toEqual([]);
    });

    it("sets ranks, bodies, the schema and the database's name, each undone", async () => {
      const { store } = make(SEED);
      const fix = await keyOf(store, "Fix login");
      const record = (await store.database("tasks"))!.revision;
      const schema = [...TASKS.properties, { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false }];
      const report = await store.apply(
        await store.plan(
          changes("tasks", { kind: "setRank", item: fix, rank: "a3" }, { kind: "setBody", item: fix, body: "Steps", was: await store.body("tasks", fix) }, { kind: "setSchema", properties: schema }, { kind: "renameDatabase", name: "My tasks" }),
        ),
      );
      expect(report.skipped).toEqual([]);
      expect([(await itemOf(store, fix))!.rank, await store.body("tasks", fix)]).toEqual(["a3", "Steps"]);
      expect((await store.database("tasks"))!.value).toEqual({ ...TASKS, name: "My tasks", properties: schema });
      expect((await store.database("tasks"))!.revision).not.toBe(record);
      await store.apply(await store.planUndo(report));
      expect((await store.database("tasks"))!.value).toEqual(TASKS);
      expect((await itemOf(store, fix))!.rank).toBe("a0");
    });

    it("brings an item removed back under its key by an undo", async () => {
      const { store } = make(SEED);
      const docs = await keyOf(store, "Write docs");
      const report = await store.apply(await store.plan(changes("tasks", { kind: "removeItem", item: docs })));
      expect((await store.items("tasks")).value.map((item) => item.name)).toEqual(["Fix login"]);
      await store.apply(await store.planUndo(report));
      expect([(await itemOf(store, docs))!.name, (await itemOf(store, docs))!.values.due]).toEqual(["Write docs", "2026-11-10"]);
    });

    it("tells a change made outside it", async () => {
      const { store, changeOutside } = make(SEED);
      const told: string[] = [];
      const stop = store.onChanged((change) => told.push(change.database));
      await changeOutside("tasks", await keyOf(store, "Fix login"), { values: { status: "Done" } });
      stop();
      await changeOutside("tasks", await keyOf(store, "Fix login"), { values: { status: "Todo" } });
      expect(told).toEqual(["tasks"]);
    });

    it("makes a database and its items in one transaction, undoes it whole, and keeps it where an item changed since", async () => {
      const { store, changeOutside } = make(SEED);
      const make_ = changes("ideas", { kind: "createDatabase", name: "Ideas" }, { kind: "setSchema", properties: TASKS.properties }, { kind: "createItem", ref: "one", name: "First idea", values: {} });
      const report = await store.apply(await store.plan(make_));
      expect(report.skipped).toEqual([]);
      expect((await store.items("ideas")).value.map((item) => item.name)).toEqual(["First idea"]);
      const undone = await store.apply(await store.planUndo(report));
      expect((await store.databases()).map((one) => one.id)).toEqual(["tasks"]);
      // Undone again: made anew, its item under the key it had
      await store.apply(await store.planUndo(undone));
      expect((await store.items("ideas")).value.map((item) => item.key)).toEqual([report.created.get("one")]);
      // An item changed since: it stays, and its database with it
      const again = await store.apply(await store.plan(changes("more", { kind: "createDatabase", name: "More" }, { kind: "createItem", ref: "x", name: "X", values: {} })));
      await changeOutside("more", again.created.get("x")!, { name: "Y" });
      const undo = await store.planUndo(again);
      // (An item renamed outside is changed to a store keeping its key, gone to one that reads it as another item: missing)
      expect(undo.planned).toEqual([]);
      for (const cause of causes(undo)) expect(["changed", "missing"]).toContain(cause);
      await store.apply(undo);
      expect((await store.items("more")).value.map((item) => item.name)).toEqual(["Y"]);
    });

    it("refuses a transaction making a database anywhere but at its start", async () => {
      const { store } = make(SEED);
      expect(causes(await store.plan(changes("tasks", { kind: "renameDatabase", name: "x" }, { kind: "createDatabase", name: "y" })))).toEqual(["refused"]);
    });

    it("writes nothing to a database kept in an older version, until it is migrated", async () => {
      const { store } = make([{ ...SEED[0]!, version: "older" }]);
      const status = await store.version("tasks");
      expect(status.version).toBeLessThan(status.latest);
      const fix = await keyOf(store, "Fix login");
      expect(causes(await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "status", value: "Done" })))).toEqual(["version"]);
      const migrations = await store.planMigration({ space: true });
      expect(migrations).toHaveLength(1);
      for (const plan of migrations) await store.apply(plan);
      expect(await store.version("tasks")).toEqual({ version: status.latest, latest: status.latest });
      expect(await store.planMigration({ database: "tasks" })).toEqual([]);
      expect((await store.plan(changes("tasks", { kind: "setValue", item: fix, key: "status", value: "Done" }))).planned).toHaveLength(1);
    });

    it("reads a database kept in a newer version, never writing nor migrating it", async () => {
      const { store } = make([{ ...SEED[0]!, version: "newer" }]);
      const status = await store.version("tasks");
      expect(status.version).toBeGreaterThan(status.latest);
      expect((await store.items("tasks")).value).toHaveLength(2);
      expect(causes(await store.plan(changes("tasks", { kind: "renameDatabase", name: "x" })))).toEqual(["version"]);
      expect(await store.planMigration({ space: true })).toEqual([]);
    });
  });
}
