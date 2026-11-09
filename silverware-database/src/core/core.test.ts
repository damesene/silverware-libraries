import { describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import { inRankOrder } from "../domain/rank.ts";
import type { Database } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { type CoreInterface, DatabaseCore, type ItemConflict, type Proposal } from "./core.ts";

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

describe("the schema edited as a whole (editSchema)", () => {
  it("plans every change of a draft as one transaction: names, flags, order, a property added, options renamed, a key changed, a type read, one removed with its values; undone as one", async () => {
    const { core, store, items } = setup();
    const read = (await store.database("tasks"))!;
    const was = read.value.properties;
    const proposal = await core.editSchema("tasks", {
      revision: read.revision,
      properties: [
        // (Moved first: its type read from the text, its key changed, its name and flags)
        { from: "estimate", key: "effort", label: "Effort", type: "number", params: {}, required: true, showName: true, icon: "⏱" },
        { from: "status", label: "State", type: "select", params: { options: ["Open", "Done"] }, renames: { Todo: "Open" } },
        { label: "Owner", type: "text" },
      ],
      removedValues: ["created"],
    });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.label).toBe("Change the properties of Tasks");
    expect(proposal.renamed).toEqual([{ from: "Todo", to: "Open", items: 1 }]);
    // ("a lot" no number: kept as it is, listed)
    expect(proposal.unreadable).toHaveLength(1);
    expect(proposal.whole).toBeDefined();
    await core.apply(proposal);
    expect((await store.database("tasks"))!.value.properties).toEqual([
      { key: "effort", label: "Effort", type: "number", params: {}, readonly: false, required: true, showName: true, icon: "⏱" },
      { key: "status", label: "State", type: "select", params: { options: ["Open", "Done"] }, readonly: false },
      { key: "owner", label: "Owner", type: "text", params: {}, readonly: false },
    ]);
    expect((await items()).map((one) => [one.name, one.values])).toEqual([
      ["Fix login", { status: "Open", effort: 3 }],
      ["Write docs", { status: "Done", effort: "a lot" }],
    ]);
    // One Undo puts it all back
    await core.undo("tasks");
    expect((await store.database("tasks"))!.value.properties).toEqual(was);
    expect((await items()).map((one) => one.values)).toEqual([
      { status: "Todo", estimate: "3" },
      { status: "Done", estimate: "a lot" },
    ]);
  });

  it("keeps a removed property's values where not asked, a system property's own, and changes only its name and flags", async () => {
    const { core, store, items } = setup();
    expect(await core.addProperty("tasks", { label: "", type: "text", system: "order" })).not.toHaveProperty("problem");
    const proposal = await core.editSchema("tasks", {
      revision: (await store.database("tasks"))!.revision,
      properties: [
        { from: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] } },
        { from: "created", label: "Created", type: "date", readonly: true },
        // (A system property's type, key or lock asked otherwise: kept its kind's)
        { from: "order", key: "rank", label: "Rank", type: "text", readonly: false, showName: true },
      ],
    });
    if ("problem" in proposal) throw new Error(proposal.problem);
    // (The schema alone: no item written)
    expect(proposal.plan.planned.filter((one) => "item" in one.target)).toHaveLength(0);
    await core.apply(proposal);
    expect((await store.database("tasks"))!.value.properties.at(-1)).toEqual({ key: "order", label: "Rank", type: "number", params: {}, readonly: true, system: "order", showName: true });
    expect((await items()).map((one) => one.values.estimate)).toEqual(["3", "a lot"]);
  });

  it("refuses two properties of one key, and says when nothing changes", async () => {
    const { core, store } = setup();
    const { value, revision } = (await store.database("tasks"))!;
    const same = value.properties.map((one) => ({ from: one.key, label: one.label, type: one.type, params: one.params, readonly: one.readonly }));
    expect(await core.editSchema("tasks", { revision, properties: same })).toMatchObject({ cause: "unchanged" });
    expect(await core.editSchema("tasks", { revision, properties: [...same.slice(0, 2), { ...same[2]!, key: "status" }] })).toMatchObject({ cause: "invalid" });
  });

  it("leaves an edit made of a database changed since, its conflict given back (offered by the core unless the caller shows it): each document's lines, written over it by force, once", async () => {
    const { core, store, told } = setup();
    const { value, revision } = (await store.database("tasks"))!;
    const was = value.properties;
    const edit = { revision, showsConflict: true, properties: was.map((one) => ({ from: one.key, label: one.key === "estimate" ? "Effort" : one.label, type: one.type, params: one.params, readonly: one.readonly })) };
    // Elsewhere meanwhile: Status renamed
    await core.renameProperty("tasks", "status", "State");
    const said = told.length;
    const left = await core.editSchema("tasks", edit);
    if (!("problem" in left) || !left.conflict) throw new Error("not left with a conflict");
    expect([left.cause, told.length]).toEqual(["left", said]);
    // Its preview: the database's own document (the store in memory: no lines to show, a document planned)
    const preview = await left.conflict.preview();
    expect([preview.problem, preview.documents.length]).toEqual([undefined, 1]);
    // Written over it: the draft's labels, State back to Status
    expect(await left.conflict.force()).not.toHaveProperty("problem");
    expect((await store.database("tasks"))!.value.properties.map((one) => one.label)).toEqual(["Status", "Effort", "Created"]);
    expect(left.conflict.written()).toBe(true);
    expect(await left.conflict.force()).toMatchObject({ cause: "unchanged" });
  });
});

describe("the core", () => {
  it("adds a system property of a kind once, its type and key the kind's, read only; its values shown, never written, nor its type, key or settings changed", async () => {
    const { core, store, told, named, items } = setup();
    expect(await core.addProperty("tasks", { label: "", type: "text", system: "order" })).not.toHaveProperty("problem");
    expect(await core.addProperty("tasks", { label: "Made", type: "text", system: "createdAt" })).not.toHaveProperty("problem");
    const properties = (await store.database("tasks"))!.value.properties;
    expect(properties.slice(-2)).toEqual([
      { key: "order", label: "Order", type: "number", params: {}, readonly: true, system: "order" },
      { key: "created_at", label: "Made", type: "datetime", params: {}, readonly: true, system: "createdAt" },
    ]);
    // One of a kind; no kind of that name
    expect(await core.addProperty("tasks", { label: "Again", type: "number", system: "order" })).toHaveProperty("problem");
    expect(told.at(-1)).toContain("Order is there already");
    expect(await core.addProperty("tasks", { label: "X", type: "text", system: "nothing" })).toHaveProperty("problem");
    // Its values: the store's (the order by hand)
    expect((await items()).map((one) => [one.name, one.values.order])).toEqual([
      ["Fix login", 1],
      ["Write docs", 2],
    ]);
    const fix = await named("Fix login");
    // Never written: by an edit, a new item, a move to a column of it
    expect(await core.update("tasks", fix, "order", 5)).toHaveProperty("problem");
    expect(await core.create("tasks", { name: "New", values: { order: 9 } })).toHaveProperty("problem");
    expect(await core.move("tasks", fix, { values: { created_at: "2026-01-01T00:00" } })).toHaveProperty("problem");
    // Nor its type, key, settings, flags
    expect(await core.retypeProperty("tasks", "order", "text")).toHaveProperty("problem");
    expect(await core.rekeyProperty("tasks", "order", "place")).toHaveProperty("problem");
    expect(await core.setPropertyParams("tasks", "order", { x: 1 }, {})).toHaveProperty("problem");
    expect(await core.setPropertyRequired("tasks", "order", true)).toHaveProperty("problem");
    expect(await core.setPropertyReadonly("tasks", "order", false)).toHaveProperty("problem");
    expect(told.at(-1)).toContain("Order is given by the system");
    // Its name and its place: as any property's
    expect(await core.renameProperty("tasks", "order", "Rank")).not.toHaveProperty("problem");
    // Removed, its values asked off the items too: none of them written (they are no item's)
    const proposal = await core.removeProperty("tasks", "order", { values: true });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.plan.planned.filter((one) => "item" in one.target)).toHaveLength(0);
    expect(proposal.label).toBe("Remove property Rank");
  });

  it("removes a property and its values whole or not at all: the database changed since the proposal, no item's value taken off", async () => {
    const { core, store, named } = setup();
    const proposal = await core.removeProperty("tasks", "estimate", { values: true });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(await core.renameDatabase("tasks", "Jobs")).not.toHaveProperty("problem");
    await core.apply(proposal);
    expect((await store.database("tasks"))!.value.properties.map((one) => one.key)).toContain("estimate");
    expect((await named("Fix login")).values.estimate).toBe("3");
  });

  it("lists the keys items keep outside the schema with a guessed type, adds one back by its key, takes one off the items whole", async () => {
    const { core, store, named } = setup(true, [
      { name: "Old one", values: { status: "Done", due: "2026-11-01", legacy: "x" }, rank: "a2" },
      { name: "Older", values: { due: "2026-12-01" }, rank: "a3" },
    ]);
    const listed = await core.looseProperties("tasks");
    if (!Array.isArray(listed)) throw new Error("refused");
    expect(listed.map(({ key, items, samples, type }) => [key, items, samples, type])).toEqual([
      ["due", 2, ["2026-11-01", "2026-12-01"], "date"],
      ["legacy", 1, ["x"], "text"],
    ]);
    // Added by its key: its values shown again
    expect(await core.addProperty("tasks", { label: "Due", type: "date", key: "due" })).not.toHaveProperty("problem");
    expect((await named("Older")).values.due).toBe("2026-12-01");
    // A property of the database: not as a loose key
    expect(await core.removeLooseProperty("tasks", "due")).toHaveProperty("problem");
    // Taken off the items keeping it, whole: an item changed since the proposal, nothing written
    const proposal = await core.removeLooseProperty("tasks", "legacy");
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.whole).toBeDefined();
    expect(await core.update("tasks", await named("Fix login"), "status", "Done")).not.toHaveProperty("problem");
    await core.apply(proposal);
    expect((await named("Old one")).values.legacy).toBe("x");
    const again = await core.removeLooseProperty("tasks", "legacy");
    if ("problem" in again) throw new Error(again.problem);
    await core.apply(again);
    expect((await named("Old one")).values.legacy).toBeUndefined();
    expect((await store.looseValues("tasks")).map((one) => one.key)).toEqual([]);
  });

  it("refuses a property's setting named as one of its own fields (a setting `system` would make it a system property)", async () => {
    const { core, store } = setup();
    expect(await core.addProperty("tasks", { label: "Unit", type: "text", params: { system: "metric" } })).toHaveProperty("problem");
    expect(await core.setPropertyParams("tasks", "estimate", { readonly: true }, {})).toHaveProperty("problem");
    expect(await core.retypeProperty("tasks", "estimate", "text", { label: "x" })).toHaveProperty("problem");
    expect((await store.database("tasks"))!.value.properties.map((one) => one.key)).toEqual(["status", "estimate", "created"]);
  });

  it("makes a property required: a value of it never emptied, said; an item still added without one", async () => {
    const { core, store, told, named } = setup();
    expect(await core.setPropertyRequired("tasks", "status", true)).not.toHaveProperty("problem");
    expect((await store.database("tasks"))!.value.properties[0]!.required).toBe(true);
    expect(await core.update("tasks", await named("Fix login"), "status", undefined)).toHaveProperty("problem");
    expect(await core.update("tasks", await named("Fix login"), "status", "")).toHaveProperty("problem");
    expect(told.at(-1)).toContain("Status is required");
    expect((await named("Fix login")).values.status).toBe("Todo");
    // Nor by a move to the column of none
    expect(await core.move("tasks", await named("Fix login"), { values: { status: undefined } })).toHaveProperty("problem");
    expect((await named("Fix login")).values.status).toBe("Todo");
    expect(await core.update("tasks", await named("Fix login"), "status", "Done")).not.toHaveProperty("problem");
    expect(await core.create("tasks", { name: "No status yet" })).not.toHaveProperty("problem");
    await core.setPropertyRequired("tasks", "status", false);
    expect((await store.database("tasks"))!.value.properties[0]!.required).toBeUndefined();
  });

  it("shows a property's name with its values and leaves it out again, the schema alone", async () => {
    const { core, store } = setup();
    const status = async () => (await store.database("tasks"))!.value.properties[0]!;
    expect(await core.setPropertyShowName("tasks", "status", true)).not.toHaveProperty("problem");
    expect((await status()).showName).toBe(true);
    expect(await core.setPropertyShowName("tasks", "status", true)).toMatchObject({ cause: "unchanged" });
    await core.setPropertyShowName("tasks", "status", false);
    expect((await status()).showName).toBeUndefined();
  });

  it("sets a property's params at once where no value reads otherwise, refused where one would", async () => {
    const { core, store, told, named } = setup();
    const status = async () => (await store.database("tasks"))!.value.properties[0]!.params;
    const was = await status();
    expect(await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, was)).not.toHaveProperty("problem");
    const now = await status();
    expect(now).toEqual({ options: ["Todo", "Done"], colors: { Done: "green" } });
    // The same in another order of its keys: nothing written, nothing to undo
    expect(await core.setPropertyParams("tasks", "status", { colors: { Done: "green" }, options: ["Todo", "Done"] }, now)).toMatchObject({ cause: "unchanged" });
    // Changed meanwhile (an option added elsewhere): what was read is no longer so, refused, the option kept
    expect(await core.setPropertyParams("tasks", "status", { ...was, colors: { Todo: "red" } }, was)).toHaveProperty("problem");
    expect(await status()).toEqual(now);
    // An option taken away: "Done" would read otherwise
    expect(await core.setPropertyParams("tasks", "status", { options: ["Todo"] }, now)).toHaveProperty("problem");
    expect(await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "teal" } }, now)).toHaveProperty("problem");
    expect(told.at(-1)).toContain('"teal" is no color');
    expect((await named("Write docs")).values.status).toBe("Done");
    // Undone as any change
    await core.undo("tasks");
    expect(await status()).toEqual({ options: ["Todo", "Done"] });
  });

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

  it("never writes over a change made since the item was read: a stale view's value of a part changed since is left, and said", async () => {
    const { core, told, named } = setup();
    const stale = await named("Fix login");
    await core.update("tasks", stale, "status", "Doing");
    const result = await core.update("tasks", stale, "status", "Done");
    expect(result).toMatchObject({ cause: "left" });
    expect((await named("Fix login")).values).toEqual({ status: "Doing", estimate: "3" });
    expect(told).toHaveLength(1);
  });

  it("moves and writes a body from an item as shown before its own rename, the rename waited for; a removal refused where what it loses changed", async () => {
    const { core, store, told, named, items } = setup();
    const stale = await named("Fix login");
    const docs = await named("Write docs");
    // A move from the drawing before the rename, while the rename is written: after it, on the item renamed, before Write docs' neighbour
    const renaming = core.rename("tasks", stale, "Fix the login");
    const moving = core.move("tasks", stale, { after: docs, values: { status: "Done" } });
    const body = core.setBody("tasks", stale, "Steps", undefined);
    expect([await renaming, await moving, await body].filter((one) => "problem" in one)).toEqual([]);
    expect(inRankOrder(await items()).map((one) => one.name)).toEqual(["Write docs", "Fix the login"]);
    expect((await named("Fix the login")).values.status).toBe("Done");
    expect(await store.body("tasks", stale.key)).toBe("Steps");
    // What a removal loses (its name, a value) changed since it was shown: not removed, said
    expect(await core.remove("tasks", [stale])).toMatchObject({ cause: "left" });
    const shown = await named("Fix the login");
    store.changeOutside("tasks", stale.key, { values: { estimate: "8" } });
    expect(await core.remove("tasks", [shown])).toMatchObject({ cause: "left" });
    expect(told).toHaveLength(2);
    // Its body and its place changed since (neither what it loses as shown): removed
    expect(await core.remove("tasks", [await named("Fix the login")])).not.toHaveProperty("problem");
    expect((await items()).map((one) => one.name)).toEqual(["Write docs"]);
  });

  it("hands on a write left as its part changed since it was shown: what changed, and written over by force, anew refused where it changed again", async () => {
    const { store, named } = setup();
    const conflicts: ItemConflict[] = [];
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: () => true, conflict: (one) => void conflicts.push(one) });
    const stale = await named("Fix login");
    store.changeOutside("tasks", stale.key, { values: { status: "Done" } });
    expect(await core.update("tasks", stale, "estimate", "5")).not.toHaveProperty("problem");
    expect(await core.update("tasks", stale, "status", "Todo")).toMatchObject({ cause: "left" });
    expect(conflicts).toHaveLength(1);
    const [conflict] = conflicts;
    expect(conflict!.problem).toBe('"Fix login" changed since it was shown: left as it is');
    // (The memory store keeps no text: no lines to show)
    expect(await conflict!.preview()).toEqual({ documents: [{ document: "", runs: [] }] });
    // Changed again since the conflict was shown: its preview says so (nothing told), its force refused anew, its own conflict
    store.changeOutside("tasks", stale.key, { values: { status: "Doing" } });
    expect(await conflict!.preview()).toEqual({ documents: [], problem: "It changed again since: Write mine shows the conflict as it is now." });
    expect(conflicts).toHaveLength(1);
    expect(await conflict!.force()).toMatchObject({ cause: "left" });
    expect(conflicts).toHaveLength(2);
    // Written over as the second shows it, once: pressed again, nothing more
    expect(await conflicts[1]!.force()).not.toHaveProperty("problem");
    expect((await named("Fix login")).values).toEqual({ status: "Todo", estimate: "5" });
    expect([conflicts[1]!.written(), await conflicts[1]!.force()]).toEqual([true, { problem: "Written already", cause: "unchanged" }]);
    expect(conflicts).toHaveLength(2);
  });

  it("removes the items of a removal still as shown, leaves one changed since, and says so", async () => {
    const { core, store, told, items } = setup();
    const [fix, docs] = await items();
    store.changeOutside("tasks", docs!.key, { values: { estimate: "a little" } });
    expect(await core.remove("tasks", [fix!, docs!])).not.toHaveProperty("problem");
    expect((await items()).map((one) => one.name)).toEqual(["Write docs"]);
    expect(told).toEqual(['"Write docs" changed since it was shown: left as it is']);
  });

  it("leaves the values the system gives out of what a write rests on: a removal after its body was written, the order and Modified changed", async () => {
    const { core, named, items } = setup();
    await core.addProperty("tasks", { label: "Order", type: "number", system: "order" });
    await core.addProperty("tasks", { label: "Modified", type: "datetime", system: "modifiedAt" });
    const stale = await named("Fix login");
    await core.setBody("tasks", stale, "Steps", undefined);
    // Another moved ahead of it: its order number changed too
    await core.move("tasks", await named("Write docs"), { before: stale });
    expect(await core.remove("tasks", [stale])).not.toHaveProperty("problem");
    expect((await items()).map((one) => one.name)).toEqual(["Write docs"]);
  });

  it("writes a stale view's value where only other parts changed since, on the item as it is now, nothing written over", async () => {
    const { core, store, told, named } = setup();
    const stale = await named("Fix login");
    // Renamed by the view itself as a value is picked at once from the item as shown before, and a value changed elsewhere
    const renaming = core.rename("tasks", stale, "Fix the login");
    const setting = core.update("tasks", stale, "status", "Done");
    expect(await renaming).not.toHaveProperty("problem");
    expect(await setting).not.toHaveProperty("problem");
    store.changeOutside("tasks", stale.key, { values: { estimate: "5" } });
    expect(await core.setLook("tasks", stale, { icon: "🚀" })).not.toHaveProperty("problem");
    const now = await named("Fix the login");
    expect([now.values, now.look]).toEqual([{ status: "Done", estimate: "5" }, { icon: "🚀" }]);
    expect(told).toHaveLength(0);
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

  it("sets an item's look, refusing what is no icon or color, one step of Undo", async () => {
    const { core, named, told } = setup();
    expect(await core.setLook("tasks", await named("Fix login"), { icon: "two words" })).toHaveProperty("problem");
    expect(await core.setLook("tasks", await named("Fix login"), { color: "navy" })).toHaveProperty("problem");
    expect((await named("Fix login")).look).toBeUndefined();
    expect(await core.setLook("tasks", await named("Fix login"), { icon: "🚀", color: "green" })).not.toHaveProperty("problem");
    expect((await named("Fix login")).look).toEqual({ icon: "🚀", color: "green" });
    expect(await core.setLook("tasks", await named("Fix login"), { icon: "🚀" })).not.toHaveProperty("problem");
    expect((await named("Fix login")).look).toEqual({ icon: "🚀" });
    await core.undo("tasks");
    expect((await named("Fix login")).look).toEqual({ icon: "🚀", color: "green" });
    expect(told).toEqual(["An icon is one character (an emoji)", '"navy" is no color']);
  });

  it("gives a property an icon of its own, refusing what is no icon, taken off again, one step of Undo each", async () => {
    const { core, store, told } = setup();
    const icon = async () => (await store.database("tasks"))!.value.properties.find((one) => one.key === "status")!.icon;
    expect(await core.setPropertyIcon("tasks", "status", "two words")).toHaveProperty("problem");
    expect(await core.setPropertyIcon("tasks", "status", "🚦")).not.toHaveProperty("problem");
    expect(await icon()).toBe("🚦");
    expect(await core.setPropertyIcon("tasks", "status", undefined)).not.toHaveProperty("problem");
    expect(await icon()).toBeUndefined();
    await core.undo("tasks");
    expect(await icon()).toBe("🚦");
    expect(told).toEqual(["An icon is one character (an emoji)"]);
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

  it("changes a date to a date and time and back writing nothing, a time kept; to a time only the time", async () => {
    const { core, named } = setup(true, [
      { name: "Meet", values: { estimate: "2026-11-08T14:30" }, rank: "a2" },
      { name: "Due", values: { estimate: "2026-11-10" }, rank: "a3" },
    ]);
    await applied(core, await core.retypeProperty("tasks", "estimate", "date"));
    const asDate = await core.retypeProperty("tasks", "estimate", "datetime");
    // (Every value read by both: the schema alone written, no item)
    expect("plan" in asDate && asDate.plan.planned).toHaveLength(1);
    await applied(core, asDate);
    await applied(core, await core.retypeProperty("tasks", "estimate", "date"));
    expect([(await named("Meet")).values.estimate, (await named("Due")).values.estimate]).toEqual(["2026-11-08T14:30", "2026-11-10"]);
    await applied(core, await core.retypeProperty("tasks", "estimate", "time"));
    expect([(await named("Meet")).values.estimate, (await named("Due")).values.estimate]).toEqual(["14:30", "2026-11-10"]);
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

  it("places an item after one without a rank, ranking those above it in the order shown, and adds one at the very end", async () => {
    const { core, items, named } = setup(true, [{ name: "Loose", values: {}, rank: undefined }, { name: "Odd", values: {}, rank: undefined }]);
    const loose = await named("Loose");
    const placed = await core.create("tasks", { name: "After loose" }, { after: loose });
    expect("problem" in placed ? [] : placed.report.written).toHaveLength(2);
    // Added at the very end, the last as shown: the item without a rank above it ranked where it is, in the same write
    const last = await core.create("tasks", { name: "Last" });
    expect("problem" in last ? [] : last.report.written).toHaveLength(2);
    expect(inRankOrder(await items()).map((one) => one.name)).toEqual(["Fix login", "Write docs", "Loose", "After loose", "Odd", "Last"]);
    await core.move("tasks", await named("Last"), { before: await named("Fix login") });
    expect(inRankOrder(await items()).map((one) => one.name)[0]).toBe("Last");
    expect(await core.move("tasks", await named("Last"), { after: { ...loose, key: "gone" as typeof loose.key } })).toMatchObject({ cause: "invalid" });
  });
  it("writes no more than a few items without a rank for one added, and none for a card moved without a neighbour", async () => {
    const many = Array.from({ length: 30 }, (_, at) => ({ name: `Imported ${at}`, values: {}, rank: undefined }));
    const { core, named } = setup(true, many);
    const added = await core.create("tasks", { name: "New" });
    expect("problem" in added ? [] : added.report.written).toHaveLength(1);
    const moved = await core.move("tasks", await named("Fix login"), { values: { status: "Done" } });
    expect("problem" in moved ? [] : moved.report.written).toHaveLength(1);
    expect((await named("Fix login")).values.status).toBe("Done");
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
    // (A value the move sets, changed elsewhere since it was shown)
    store.changeOutside("tasks", stale.key, { values: { status: "Doing" } });
    expect(await core.move("tasks", stale, { after: await named("Loose"), values: { status: "Done" } })).toMatchObject({ cause: "left" });
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

describe("renaming options", () => {
  const BOARD: Database = {
    id: "board",
    name: "Board",
    properties: [
      { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Doing", "Done"], colors: { Todo: "red" } }, readonly: false },
      { key: "tags", label: "Tags", type: "multi-select", params: { options: ["a", "b", "c"] }, readonly: false },
    ],
  };
  function board() {
    const store = new MemoryStore([
      {
        database: BOARD,
        items: [
          { name: "One", values: { status: "Todo", tags: ["c", "a", "b"] }, rank: "a0" },
          { name: "Two", values: { status: "Done", tags: ["b"] }, rank: "a1" },
          { name: "Three", values: { status: "Todo" }, rank: "a2" },
          { name: "Four", values: { status: "Stray", tags: ["a", "x"] }, rank: "a3" },
        ],
      },
    ]);
    const told: string[] = [];
    const asked: string[] = [];
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: (message) => void told.push(message), ask: (message) => (asked.push(message), true) });
    const named = async (name: string) => (await store.items("board")).value.find((one) => one.name === name)!;
    const params = async (key: string) => (await store.database("board"))!.value.properties.find((one) => one.key === key)!.params;
    return { store, core, told, asked, named, params };
  }

  it("renames a select's values with its option in one proposal, said by option, undone in one step", async () => {
    const { core, named, params } = board();
    const proposal = await core.retypeProperty("board", "status", "select", { options: ["To do", "Doing", "Done"], colors: { "To do": "red" } }, { Todo: "To do" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.renamed).toEqual([{ from: "Todo", to: "To do", items: 2 }]);
    expect(proposal.whole).toBeDefined();
    // (Nothing written before Apply)
    expect((await named("One")).values.status).toBe("Todo");
    await core.apply(proposal);
    expect([(await named("One")).values.status, (await named("Two")).values.status, (await named("Three")).values.status]).toEqual(["To do", "Done", "To do"]);
    // A value none of the options was none before and stays so
    expect((await named("Four")).values.status).toBe("Stray");
    expect((await params("status")).options).toEqual(["To do", "Doing", "Done"]);
    await core.undo("board");
    expect([(await named("One")).values.status, (await named("Three")).values.status]).toEqual(["Todo", "Todo"]);
    expect(await params("status")).toEqual(BOARD.properties[0]!.params);
    expect(await core.undo("board")).toBeUndefined();
  });

  it("renames one value of a multi-select's list, its order kept", async () => {
    const { core, named } = board();
    await applied(core, await core.retypeProperty("board", "tags", "multi-select", { options: ["alpha", "b", "c"] }, { a: "alpha" }));
    expect((await named("One")).values.tags).toEqual(["c", "alpha", "b"]);
    expect((await named("Two")).values.tags).toEqual(["b"]);
    expect((await named("Four")).values.tags).toEqual(["alpha", "x"]);
  });

  it("swaps two options' names and their values at once, losing none", async () => {
    const { core, named } = board();
    const proposal = await core.retypeProperty("board", "status", "select", { options: ["Done", "Doing", "Todo"] }, { Todo: "Done", Done: "Todo" });
    expect("renamed" in proposal && proposal.renamed).toEqual([
      { from: "Todo", to: "Done", items: 2 },
      { from: "Done", to: "Todo", items: 1 },
    ]);
    await applied(core, proposal);
    expect([(await named("One")).values.status, (await named("Two")).values.status, (await named("Three")).values.status]).toEqual(["Done", "Todo", "Done"]);
    await applied(core, await core.retypeProperty("board", "tags", "multi-select", { options: ["b", "a", "c"] }, { a: "b", b: "a" }));
    expect((await named("One")).values.tags).toEqual(["c", "b", "a"]);
    expect((await named("Two")).values.tags).toEqual(["a"]);
  });

  it("leaves an option taken away in the items, shown invalid, never emptied", async () => {
    const { core, named } = board();
    const proposal = await core.retypeProperty("board", "tags", "multi-select", { options: ["alpha", "c"] }, { a: "alpha" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    // (One: renamed, its "b" none of the options now; Two: "b" alone, kept; Four: renamed, its "x" none before either)
    expect(proposal.unreadable).toEqual([(await named("One")).key, (await named("Two")).key, (await named("Four")).key]);
    await core.apply(proposal);
    expect((await named("One")).values.tags).toEqual(["c", "alpha", "b"]);
    expect((await named("Two")).values.tags).toEqual(["b"]);
  });

  it("refuses renames that would put two options into one, or name what is no option", async () => {
    const { core, told, named } = board();
    // Onto an option kept as it is
    expect(await core.retypeProperty("board", "status", "select", { options: ["Doing", "Done"] }, { Todo: "Done" })).toMatchObject({ cause: "invalid" });
    // Two onto one
    expect(await core.retypeProperty("board", "status", "select", { options: ["New", "Done"] }, { Todo: "New", Doing: "New" })).toMatchObject({ cause: "invalid" });
    // From what is no option, to what is none of the new ones, with a change of type
    expect(await core.retypeProperty("board", "status", "select", { options: ["Todo", "Doing", "Done", "S"] }, { Stray: "S" })).toMatchObject({ cause: "invalid" });
    expect(await core.retypeProperty("board", "status", "select", { options: ["Todo", "Doing", "Done"] }, { Todo: "Later" })).toMatchObject({ cause: "invalid" });
    expect(await core.retypeProperty("board", "status", "multi-select", { options: ["To do", "Doing", "Done"] }, { Todo: "To do" })).toMatchObject({ cause: "invalid" });
    expect(told).toHaveLength(5);
    expect((await named("One")).values.status).toBe("Todo");
  });

  it("refuses a rename onto a value items hold that is none of the options, a select's or a list's", async () => {
    const { core, named } = board();
    // ("x" and "Stray" are no options: "a" renamed "x", Four would hold "x" twice; "Todo" renamed "Stray", told from it no more)
    expect(await core.retypeProperty("board", "tags", "multi-select", { options: ["x", "b", "c"] }, { a: "x" })).toMatchObject({ cause: "invalid" });
    expect(await core.retypeProperty("board", "status", "select", { options: ["Stray", "Doing", "Done"] }, { Todo: "Stray" })).toMatchObject({ cause: "invalid" });
    expect((await named("Four")).values.tags).toEqual(["a", "x"]);
    expect((await named("One")).values.status).toBe("Todo");
  });

  it("keeps a value typed by hand that is none of the options as it is: read by the new names it would take a swapped one", async () => {
    const { core, store, named } = board();
    store.changeOutside("board", (await named("Two")).key, { values: { tags: "a, c", status: " Todo" } });
    const proposal = await core.retypeProperty("board", "tags", "multi-select", { options: ["b", "a", "c"] }, { a: "b", b: "a" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.unreadable).toContain((await named("Two")).key);
    await core.apply(proposal);
    expect((await named("Two")).values.tags).toBe("a, c");
    await applied(core, await core.retypeProperty("board", "status", "select", { options: ["Done", "Doing", "Todo"] }, { Todo: "Done", Done: "Todo" }));
    expect((await named("Two")).values.status).toBe(" Todo");
    expect((await named("One")).values.status).toBe("Done");
  });

  it("writes nothing of a swap no item held where one was given an old name between the proposal and Apply", async () => {
    const { core, store, named, params } = board();
    store.changeOutside("board", (await named("One")).key, { values: { status: "Stray" } });
    store.changeOutside("board", (await named("Three")).key, { values: { status: "Stray" } });
    const proposal = await core.retypeProperty("board", "status", "select", { options: ["Doing", "Todo", "Done"] }, { Todo: "Doing", Doing: "Todo" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.renamed).toEqual([
      { from: "Todo", to: "Doing", items: 0 },
      { from: "Doing", to: "Todo", items: 0 },
    ]);
    store.changeOutside("board", (await named("One")).key, { values: { status: "Todo" } });
    expect(await core.apply(proposal)).toMatchObject({ cause: "left" });
    expect((await params("status")).options).toEqual(["Todo", "Doing", "Done"]);
    expect((await named("One")).values.status).toBe("Todo");
  });

  it("takes renames of names alike as none: a change of type as before", async () => {
    const { core, named } = board();
    const proposal = await core.retypeProperty("board", "status", "text", undefined, { Todo: "Todo" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.renamed).toBeUndefined();
    expect(proposal.label).toBe("Change the type of Status to Text");
    await core.apply(proposal);
    expect((await named("One")).values.status).toBe("Todo");
  });

  it("swaps the values of two options swapped and moved back to their places, the params alike", async () => {
    const { core, named } = board();
    const proposal = await core.retypeProperty("board", "tags", "multi-select", { options: ["a", "b", "c"] }, { a: "b", b: "a" });
    expect(proposal).not.toHaveProperty("problem");
    await applied(core, proposal);
    expect((await named("One")).values.tags).toEqual(["c", "b", "a"]);
  });

  it("asks before an undo of many pages, tells how far it is, and undoes one at a time", async () => {
    const many = Array.from({ length: 200 }, (_, at) => ({ name: `Item ${at}`, values: { status: "Todo" }, rank: `b${at}` }));
    const store = new MemoryStore([{ database: TASKS, items: many }]);
    // (As a store of pages: each item a document of its own)
    Object.defineProperty(store, "capabilities", { value: { ...store.capabilities, itemDocument: true } });
    let answer = false;
    let meanwhile = async () => {};
    const asked: string[] = [];
    // (The items' pages: what the core says of them, in the platform's word)
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: async (message) => (asked.push(message), await meanwhile(), answer) }, { one: "page", many: "pages" });
    const status = async () => (await store.items("tasks")).value.filter((one) => one.values.status === "To do").length;
    const proposal = await core.retypeProperty("tasks", "status", "select", { options: ["To do", "Done"] }, { Todo: "To do" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    expect(proposal.documents).toEqual({ count: 201, many: true });
    await core.apply(proposal);
    expect(await status()).toBe(200);
    // Declined: nothing undone, still to undo
    expect(await core.undo("tasks")).toMatchObject({ cause: "declined" });
    expect(asked.at(-1)).toContain("It writes 201 pages, one after another: it takes a while; keep this window open");
    expect(await status()).toBe(200);
    // A change recorded while the user is asked: the one asked about is no longer the last, nothing undone
    answer = true;
    meanwhile = async () => void (await core.update("tasks", (await store.items("tasks")).value[0]!, "estimate", "9"));
    expect(await core.undo("tasks")).toMatchObject({ cause: "invalid" });
    expect(await status()).toBe(200);
    meanwhile = async () => {};
    // (The change made meanwhile undone: a page, nothing asked)
    await core.undo("tasks");
    const told: number[][] = [];
    const [first, second] = await Promise.all([core.undo("tasks", (done, of) => void told.push([done, of])), core.undo("tasks")]);
    expect(first).not.toHaveProperty("problem");
    expect(second).toMatchObject({ cause: "invalid" });
    // (The item changed meanwhile since the rename is left as it is: the rest undone)
    expect(told.at(-1)).toEqual([200, 200]);
    expect(await status()).toBe(1);
  });

  it("undoes nothing while a change is applied, nor applies one while an undo is written, and undoes no change but the last one asked about", async () => {
    const { core, store, named } = board();
    await core.update("board", await named("Two"), "status", "Doing");
    const proposal = await core.retypeProperty("board", "status", "select", { options: ["To do", "Doing", "Done"] }, { Todo: "To do" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    // The store's write held: an Undo meanwhile would undo the change before (Two's), alongside
    let letGo = () => {};
    const held = new Promise<void>((resolve) => (letGo = resolve));
    const apply = store.apply.bind(store);
    store.apply = async (plan, progress) => (await held, apply(plan, progress));
    const applying = core.apply(proposal);
    expect(await core.undo("board")).toMatchObject({ cause: "invalid" });
    letGo();
    expect(await applying).not.toHaveProperty("problem");
    expect((await named("Two")).values.status).toBe("Doing");
    expect((await named("One")).values.status).toBe("To do");
  });

  it("asks nothing before an undo of a few pages, nor where items are no pages", async () => {
    const { core, named, asked } = board();
    await applied(core, await core.retypeProperty("board", "status", "select", { options: ["To do", "Doing", "Done"] }, { Todo: "To do" }));
    await core.undo("board");
    expect((await named("One")).values.status).toBe("Todo");
    expect(asked).toEqual([]);
  });

  it("tells how far Apply's writing is", async () => {
    const { core } = board();
    const proposal = await core.retypeProperty("board", "status", "select", { options: ["To do", "Doing", "Done"] }, { Todo: "To do" });
    if ("problem" in proposal) throw new Error(proposal.problem);
    const told: number[][] = [];
    await core.apply(proposal, (done, of) => void told.push([done, of]));
    expect(told.at(-1)).toEqual([3, 3]);
  });

  it("writes nothing where an item changed between the proposal and Apply", async () => {
    const { core, store, named, params } = board();
    const proposal = await core.retypeProperty("board", "status", "select", { options: ["To do", "Doing", "Done"] }, { Todo: "To do" });
    // An item renamed by hand meanwhile to the old name, and another one changed
    store.changeOutside("board", (await named("Two")).key, { values: { status: "Todo" } });
    expect(await applied(core, proposal)).toMatchObject({ cause: "left" });
    expect((await params("status")).options).toEqual(["Todo", "Doing", "Done"]);
    expect([(await named("One")).values.status, (await named("Two")).values.status]).toEqual(["Todo", "Todo"]);
    expect(await core.undo("board")).toBeUndefined();
  });
});
