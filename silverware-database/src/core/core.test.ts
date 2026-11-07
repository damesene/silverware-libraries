import { describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import { inRankOrder } from "../domain/rank.ts";
import type { Database } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { type CoreInterface, DatabaseCore, type Proposal } from "./core.ts";

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "text", params: {}, readonly: false },
    { key: "created", label: "Created", type: "date", params: {}, readonly: true },
  ],
};

function setup(answer = true, more: readonly { name: string; values: Record<string, string>; rank: string | undefined }[] = []) {
  const store = new MemoryStore([
    {
      database: TASKS,
      items: [
        { name: "Fix login", values: { status: "Todo", estimate: "3" }, rank: "a0" },
        { name: "Write docs", values: { status: "Done", estimate: "a lot" }, rank: "a1" },
        ...more,
      ],
    },
  ]);
  const told: string[] = [];
  const asked: string[] = [];
  const ui: CoreInterface = { notify: (message) => void told.push(message), ask: (message) => (asked.push(message), answer) };
  const core = new DatabaseCore(store, new TypeRegistry(), ui);
  const items = async () => (await store.items("tasks")).value;
  const named = async (name: string) => (await items()).find((one) => one.name === name)!;
  return { store, core, told, asked, items, named };
}

const applied = async (core: DatabaseCore, proposal: Proposal | { problem: string }) => {
  if ("problem" in proposal) throw new Error(proposal.problem);
  return core.apply(proposal);
};

describe("the core", () => {
  it("writes only values: an object, NaN or a list of numbers a view gives is refused, said, nothing written", async () => {
    const { core, told, named } = setup();
    const item = await named("Fix login");
    for (const wrong of [{}, Number.NaN, [1, 2], new Date()]) expect(await core.update("tasks", item, "estimate", wrong as never)).toHaveProperty("problem");
    expect(await core.create("tasks", { name: "New", values: { estimate: Number.POSITIVE_INFINITY as never } })).toHaveProperty("problem");
    expect(await core.move("tasks", item, { values: { status: {} as never } })).toHaveProperty("problem");
    expect((await named("Fix login")).values.estimate).toBe("3");
    expect(told.every((one) => one.includes("not a value"))).toBe(true);
  });

  it("sets a value, refusing the name, a property it lacks and one read only, said to the user", async () => {
    const { core, told, named } = setup();
    expect(await core.update("tasks", await named("Fix login"), "status", "Done")).not.toHaveProperty("problem");
    expect((await named("Fix login")).values.status).toBe("Done");
    for (const key of ["name", "nope", "created"]) expect(await core.update("tasks", await named("Fix login"), key, "x")).toHaveProperty("problem");
    expect(told).toHaveLength(3);
  });

  it("never writes over a change made since the item was read: a stale view's value is left, and said", async () => {
    const { core, told, named } = setup();
    const stale = await named("Fix login");
    await core.update("tasks", stale, "estimate", "5");
    const result = await core.update("tasks", stale, "status", "Done");
    expect(result).toMatchObject({ cause: "left" });
    expect((await named("Fix login")).values).toEqual({ status: "Todo", estimate: "5" });
    expect(told).toHaveLength(1);
  });

  it("adds an item at the end of the order, named Untitled where it has no name, a free one", async () => {
    const { core, items } = setup();
    const first = await core.create("tasks");
    const second = await core.create("tasks", { values: { status: "Todo" } });
    expect("key" in first && first.key && "key" in second && second.key).toBeTruthy();
    expect(inRankOrder(await items()).map((one) => one.name)).toEqual(["Fix login", "Write docs", "Untitled", "Untitled 2"]);
    expect(await core.create("tasks", { name: "Fix login" })).toHaveProperty("problem");
  });

  it("moves an item between its neighbours, writing no other, and sets values where it goes", async () => {
    const { core, items, named } = setup();
    await core.create("tasks", { name: "Plan" });
    const [fix, docs, plan] = [await named("Fix login"), await named("Write docs"), await named("Plan")];
    await core.move("tasks", plan, { after: fix, before: docs, values: { status: "Done" } });
    expect(inRankOrder(await items()).map((one) => one.name)).toEqual(["Fix login", "Plan", "Write docs"]);
    expect((await named("Fix login")).revision).toBe(fix.revision);
    expect((await named("Plan")).values.status).toBe("Done");
  });

  it("renames an item, refusing an empty or taken name", async () => {
    const { core, named } = setup();
    await core.rename("tasks", await named("Fix login"), "  Fix the login ");
    expect(await named("Fix the login")).toBeDefined();
    expect(await core.rename("tasks", await named("Fix the login"), "Write docs")).toHaveProperty("problem");
    expect(await core.rename("tasks", await named("Fix the login"), " ")).toHaveProperty("problem");
  });

  it("removes items only once the user says yes, and Undo brings them back", async () => {
    const no = setup(false);
    const kept = await no.core.remove("tasks", [await no.named("Fix login")]);
    expect(kept).toEqual({ problem: "Not removed", cause: "declined" });
    expect(no.told).toEqual([]);
    expect(await no.items()).toHaveLength(2);
    const { core, asked, items, named } = setup();
    await core.remove("tasks", [await named("Fix login"), await named("Write docs")]);
    expect(asked).toEqual(["Remove 2 items? Undo brings them back."]);
    expect(await items()).toEqual([]);
    await core.undo();
    expect((await items()).map((one) => [one.name, one.values])).toEqual([
      ["Fix login", { status: "Todo", estimate: "3" }],
      ["Write docs", { status: "Done", estimate: "a lot" }],
    ]);
    expect(await core.undo()).toBeUndefined();
  });

  it("undoes the last transaction, leaving what changed since, and says so", async () => {
    const { store, core, told, named } = setup();
    await core.update("tasks", await named("Fix login"), "status", "Done");
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { estimate: "8" } });
    expect(await core.undo()).toMatchObject({ cause: "left" });
    expect((await named("Fix login")).values).toEqual({ status: "Done", estimate: "8" });
    expect(told).toEqual([expect.stringMatching(/^Undo: Set Status of Fix login: nothing was written/)]);
  });

  it("makes a database, its id from its name and free, its keys from labels", async () => {
    const { core, store } = setup();
    const made = await core.createDatabase("Tasks", [{ label: "Due date", type: "date" }, { label: "3D model", type: "text" }, { label: "Due date", type: "date" }]);
    expect("id" in made && made.id).toBe("tasks-2");
    expect((await store.database("tasks-2"))!.value.properties.map((one) => one.key)).toEqual(["due_date", "p_3d_model", "due_date_2"]);
    expect((await core.createDatabase("Čtení knih"))).toHaveProperty("id", "cteni-knih");
    expect(await core.createDatabase("x", [{ label: "Status", type: "nope" }])).toHaveProperty("problem");
  });

  it("adds, renames and refuses properties, the schema written only where still as read", async () => {
    const { core, store } = setup();
    await core.addProperty("tasks", { label: "Due", type: "date" });
    await core.renameProperty("tasks", "due", "Due date");
    const schema = (await store.database("tasks"))!.value.properties;
    expect(schema.at(-1)).toEqual({ key: "due", label: "Due date", type: "date", params: {}, readonly: false });
    expect(await core.addProperty("tasks", { label: "X", type: "text", key: "status" })).toHaveProperty("problem");
    expect(await core.addProperty("tasks", { label: "X", type: "select", params: { options: "a" } })).toHaveProperty("problem");
  });

  it("changes a property's key with every item's value, as one proposal, undone whole", async () => {
    const { core, store, named } = setup();
    const proposal = await core.rekeyProperty("tasks", "estimate", "effort");
    expect("plan" in proposal && proposal.plan.planned.map((one) => one.target)).toHaveLength(3);
    expect((await named("Fix login")).values.estimate).toBe("3");
    await applied(core, proposal);
    expect((await named("Fix login")).values).toEqual({ status: "Todo", effort: "3" });
    expect((await store.database("tasks"))!.value.properties[1]!.key).toBe("effort");
    await core.undo();
    expect((await named("Fix login")).values).toEqual({ status: "Todo", estimate: "3" });
    expect((await store.database("tasks"))!.value).toEqual(TASKS);
  });

  it("changes a property's type, reading values where it can and keeping the others as they are", async () => {
    const { core, named } = setup();
    const proposal = await core.retypeProperty("tasks", "estimate", "number");
    expect("unreadable" in proposal && proposal.unreadable).toEqual([(await named("Write docs")).key]);
    await applied(core, proposal);
    expect((await named("Fix login")).values.estimate).toBe(3);
    expect((await named("Write docs")).values.estimate).toBe("a lot");
  });

  it("removes a property keeping its values, unless asked to take them too", async () => {
    const { core, store, named } = setup();
    await applied(core, await core.removeProperty("tasks", "estimate", { values: false }));
    expect((await store.database("tasks"))!.value.properties.map((one) => one.key)).toEqual(["status", "created"]);
    expect((await named("Fix login")).values.estimate).toBe("3");
    await core.undo();
    await applied(core, await core.removeProperty("tasks", "estimate", { values: true }));
    expect((await named("Fix login")).values.estimate).toBeUndefined();
    await core.undo();
    expect((await named("Fix login")).values.estimate).toBe("3");
  });

  it("leaves a proposal planned against a schema changed since", async () => {
    const { core, told } = setup();
    const proposal = await core.rekeyProperty("tasks", "estimate", "effort");
    await core.renameProperty("tasks", "status", "State");
    expect(await applied(core, proposal)).toMatchObject({ cause: "left" });
    expect(told).toHaveLength(1);
  });


  it("takes over no key items still keep values under, and makes no key from a label onto one", async () => {
    const { core, store, named } = setup();
    await applied(core, await core.removeProperty("tasks", "estimate", { values: false }));
    expect(await core.rekeyProperty("tasks", "status", "estimate")).toMatchObject({ cause: "invalid" });
    expect((await named("Fix login")).values.estimate).toBe("3");
    await core.addProperty("tasks", { label: "Estimate", type: "text" });
    expect((await store.database("tasks"))!.value.properties.at(-1)!.key).toBe("estimate_2");
    // Given the key, the property takes its values back
    await core.addProperty("tasks", { label: "Estimate again", type: "text", key: "estimate" });
    expect((await named("Fix login")).values.estimate).toBe("3");
  });

  it("keeps a property's params where its type changes without new ones, the new type taking them", async () => {
    const { core, store, named } = setup();
    await applied(core, await core.retypeProperty("tasks", "status", "multi-select"));
    expect((await store.database("tasks"))!.value.properties[0]!.params).toEqual({ options: ["Todo", "Done"] });
    expect((await named("Fix login")).values.status).toEqual(["Todo"]);
    await applied(core, await core.retypeProperty("tasks", "status", "text"));
    expect((await store.database("tasks"))!.value.properties[0]!.params).toEqual({ options: ["Todo", "Done"] });
  });

  it("places an item after one without a rank, ranking those above it in the order shown, and adds one after the ranked alone", async () => {
    const { core, items, named } = setup(true, [{ name: "Loose", values: {}, rank: undefined }, { name: "Odd", values: {}, rank: undefined }]);
    const loose = await named("Loose");
    const placed = await core.create("tasks", { name: "After loose" }, { after: loose });
    expect("problem" in placed ? [] : placed.report.written).toHaveLength(2);
    // Added at the end of the ranked items: the item without a rank stays after it, not written
    const last = await core.create("tasks", { name: "Last" });
    expect("problem" in last ? [] : last.report.written).toHaveLength(1);
    expect(inRankOrder(await items()).map((one) => one.name)).toEqual(["Fix login", "Write docs", "Loose", "After loose", "Last", "Odd"]);
    await core.move("tasks", await named("Last"), { before: await named("Fix login") });
    expect(inRankOrder(await items()).map((one) => one.name)[0]).toBe("Last");
    expect(await core.move("tasks", await named("Last"), { after: { ...loose, key: "gone" as typeof loose.key } })).toMatchObject({ cause: "invalid" });
  });
  it("goes on undoing past a transaction that cannot be undone, and undoes one database's alone", async () => {
    const { store, core, named } = setup();
    await core.update("tasks", await named("Fix login"), "status", "Done");
    await core.update("tasks", await named("Write docs"), "status", "Todo");
    store.changeOutside("tasks", (await named("Write docs")).key, { values: { estimate: "9" } });
    expect(await core.undo()).toMatchObject({ cause: "left" });
    await core.undo();
    expect((await named("Fix login")).values.status).toBe("Todo");
    const made = await core.createDatabase("Ideas");
    await core.update("tasks", await named("Fix login"), "status", "Done");
    await core.undo("id" in made ? made.id : "");
    expect((await store.databases()).map((one) => one.id)).toEqual(["tasks"]);
    expect((await named("Fix login")).values.status).toBe("Done");
  });

  it("writes nothing and says nothing where nothing changes", async () => {
    const { core, told, named } = setup();
    expect(await core.rename("tasks", await named("Fix login"), "Fix login")).toMatchObject({ cause: "unchanged" });
    expect(await core.renameDatabase("tasks", "Tasks")).toMatchObject({ cause: "unchanged" });
    expect(await core.renameProperty("tasks", "status", "Status")).toMatchObject({ cause: "unchanged" });
    expect(told).toEqual([]);
  });

  it("writes a key change whole or not at all: refused where the items changed since it was proposed", async () => {
    const { core, store, named } = setup();
    const proposal = await core.rekeyProperty("tasks", "status", "state");
    await core.create("tasks", { name: "New", values: { status: "Todo" } });
    expect(await applied(core, proposal)).toMatchObject({ cause: "left" });
    expect((await store.database("tasks"))!.value.properties[0]!.key).toBe("status");
    expect((await named("New")).values.status).toBe("Todo");
  });

  it("writes nothing of a move whose item changed since it was read, its neighbours' ranks put back", async () => {
    const { core, store, items, named } = setup(true, [{ name: "Loose", values: {}, rank: undefined }]);
    const stale = await named("Fix login");
    store.changeOutside("tasks", stale.key, { values: { estimate: "4" } });
    expect(await core.move("tasks", stale, { after: await named("Loose") })).toMatchObject({ cause: "left" });
    expect((await named("Loose")).rank).toBeUndefined();
    expect(inRankOrder(await items()).map((one) => one.name)).toEqual(["Fix login", "Write docs", "Loose"]);
    expect(await core.undo()).toBeUndefined();
  });

  it("says nothing changed where nothing does, and an item beside itself stays", async () => {
    const { core, told, named } = setup();
    expect(await core.update("tasks", await named("Fix login"), "nothing_there", undefined)).toMatchObject({ cause: "invalid" });
    expect(await core.update("tasks", await named("Fix login"), "status", "Todo")).toMatchObject({ cause: "unchanged" });
    expect(await core.move("tasks", await named("Fix login"), { before: await named("Write docs") })).toMatchObject({ cause: "unchanged" });
    expect(await core.move("tasks", await named("Fix login"), { after: await named("Fix login") })).toMatchObject({ cause: "unchanged" });
    expect(await core.retypeProperty("tasks", "status", "select")).toMatchObject({ cause: "unchanged" });
    expect(told).toHaveLength(1);
  });
});