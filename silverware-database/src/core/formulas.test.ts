// Formula properties through the core and the calculating store (docs/silverware-database-formulas.md, step 3)
import { describe, expect, it, vi } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item, Property } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { calculatingStore } from "./calculating.ts";
import { type CoreInterface, DatabaseCore, type Proposal } from "./core.ts";

const ORDERS: Database = {
  id: "orders",
  name: "Orders",
  properties: [
    { key: "qty", label: "Qty", type: "number", params: {}, readonly: false },
    { key: "price", label: "Price", type: "number", params: {}, readonly: false },
  ],
};

function setup(properties: readonly Property[] = ORDERS.properties) {
  const store = new MemoryStore([
    {
      database: { ...ORDERS, properties },
      items: [
        { name: "Pear", values: { qty: 3, price: 2 }, rank: "a0" },
        { name: "Fig", values: { qty: 4, price: 1 }, rank: "a1" },
      ],
    },
  ]);
  const ui: CoreInterface = { notify: () => undefined, ask: () => true };
  const core = new DatabaseCore(store, new TypeRegistry(), ui);
  const calculated = calculatingStore(store);
  const raw = async () => (await store.items("orders")).value;
  const valuesOf = async (key: string) => (await calculated.items("orders")).value.map((item) => item.values[key]);
  return { store, core, calculated, raw, valuesOf };
}

const applied = async (core: DatabaseCore, proposal: Proposal | { problem: string }) => {
  if ("problem" in proposal) throw new Error(proposal.problem);
  return core.apply(proposal);
};
const property = async (store: MemoryStore, key: string) => (await store.database("orders"))!.value.properties.find((one) => one.key === key)!;

describe("formula properties through the core", () => {
  it("adds one read only, its values calculated for those who read them, refused to anyone writing one", async () => {
    const { store, core, raw, valuesOf } = setup();
    expect(await core.addProperty("orders", { label: "Total", type: "formula", params: { formula: "=[@qty]*[@price]" } })).not.toHaveProperty("problem");
    expect((await property(store, "total")).readonly).toBe(true);
    expect(await valuesOf("total")).toEqual([6, 4]);
    // (The items themselves keep none)
    expect((await raw()).map((item) => item.values.total)).toEqual([undefined, undefined]);
    const pear = (await raw())[0]!;
    expect(await core.update("orders", pear, "total", 7)).toHaveProperty("problem");
    expect(await core.setPropertyReadonly("orders", "total", false)).toHaveProperty("problem");
  });

  it("refuses a formula that does not parse, or reads outside the database, saying why", async () => {
    const { core } = setup();
    expect(await core.addProperty("orders", { label: "Bad", type: "formula", params: { formula: "=SUM(" } })).toMatchObject({ problem: expect.stringMatching(/^Bad: its formula: /) });
    expect(await core.addProperty("orders", { label: "Outside", type: "formula", params: { formula: "=prices![price]" } })).toMatchObject({ problem: expect.stringMatching(/a database's formulas read only its own items for now/) });
  });

  it("writes nothing of a property's values turned into a formula and back: what items keep shows again, not locked", async () => {
    const { store, core, raw, valuesOf } = setup();
    await applied(core, await core.retypeProperty("orders", "price", "formula", { formula: "=[@qty]*10" }));
    expect((await property(store, "price")).readonly).toBe(true);
    expect(await valuesOf("price")).toEqual([30, 40]);
    // (What the items keep under its key is theirs, unseen while it is a formula, and shown again below)
    expect((await store.items("orders")).value.map((item: Item) => item.values.price)).toEqual([undefined, undefined]);
    await applied(core, await core.retypeProperty("orders", "price", "number", {}));
    expect((await property(store, "price")).readonly).toBe(false);
    expect((await raw()).map((item) => item.values.price)).toEqual([2, 1]);
  });

  it("refuses a formula's value whatever the store keeps of its read only", async () => {
    const { core, raw } = setup([...ORDERS.properties, { key: "total", label: "Total", type: "formula", params: { formula: "=1" }, readonly: false }]);
    expect(await core.update("orders", (await raw())[0]!, "total", 7)).toMatchObject({ problem: "Total is read only" });
  });

  it("converts nor moves no value of a property turned into a formula with another key in one edit, nor reads any as unreadable", async () => {
    const { store, core, raw } = setup([...ORDERS.properties, { key: "tags", label: "Tags", type: "select", params: { multiple: true, options: ["a", "b"] }, readonly: false }]);
    expect(await core.update("orders", (await raw())[0]!, "tags", ["a", "b"])).not.toHaveProperty("problem");
    const read = (await store.database("orders"))!;
    const edit = (await core.editSchema("orders", {
      revision: read.revision,
      properties: read.value.properties.map((one) =>
        one.key === "price" ? { from: "price", key: "cost", label: "Cost", type: "formula", params: { formula: "=[@qty]*2" } } : one.key === "tags" ? { from: "tags", label: "Tags", type: "formula", params: { formula: "=1" } } : { from: one.key, label: one.label, type: one.type, params: one.params },
      ),
    })) as Proposal;
    expect(edit.unreadable ?? []).toEqual([]);
    await applied(core, edit);
    // (What the items kept under the old key is theirs, left as it was; nothing written under the new one)
    expect((await raw()).map((item) => [item.values.price, item.values.cost])).toEqual([
      [2, undefined],
      [1, undefined],
    ]);
    // (The list kept under tags, unseen while it is a formula, shown again as another type)
    await applied(core, await core.retypeProperty("orders", "tags", "text"));
    expect((await raw())[0]!.values.tags).toEqual(["a", "b"]);
  });

  it("keeps no formula's params on a property turned into another type, nor another type's on a formula", async () => {
    const { store, core } = setup([...ORDERS.properties, { key: "kind", label: "Kind", type: "select", params: { options: ["a"] }, readonly: false }]);
    await applied(core, await core.retypeProperty("orders", "kind", "formula"));
    expect((await property(store, "kind")).params).toEqual({});
    expect(await core.setPropertyParams("orders", "kind", { formula: "=1", resultType: "number" }, {})).not.toHaveProperty("problem");
    expect((await property(store, "kind")).params).toEqual({ formula: "=1", resultType: "number" });
    await applied(core, await core.retypeProperty("orders", "kind", "number"));
    expect((await property(store, "kind")).params).toEqual({});
  });

  it("writes no value of a formula property whose key changes, nor takes any off as it is removed", async () => {
    const { store, core, valuesOf } = setup([...ORDERS.properties, { key: "total", label: "Total", type: "formula", params: { formula: "=[@qty]*[@price]" }, readonly: true }]);
    await applied(core, await core.rekeyProperty("orders", "total", "sum"));
    expect(await valuesOf("sum")).toEqual([6, 4]);
    expect((await store.items("orders")).value.every((item) => !("sum" in item.values) && !("total" in item.values))).toBe(true);
    await applied(core, await core.removeProperty("orders", "sum", { values: true }));
    expect((await store.database("orders"))!.value.properties.map((one) => one.key)).toEqual(["qty", "price"]);
  });
});

describe("the calculating store", () => {
  it("gives the errors among the values apart, and the same items again while nothing they read changed", async () => {
    const { core, calculated } = setup();
    expect(await core.addProperty("orders", { label: "Ratio", type: "formula", params: { formula: "=[@qty]/([@price]-2)" } })).not.toHaveProperty("problem");
    const first = await calculated.items("orders");
    expect(first.value.map((item) => item.values.ratio)).toEqual(["#DIV/0!", -4]);
    const problems = await calculated.formulaProblems("orders");
    expect(problems.get(first.value[0]!.key)).toEqual({ ratio: { code: "#DIV/0!", detail: expect.any(String) } });
    expect(await calculated.items("orders")).toBe(first);
  });

  it("calculates anew as the schema or the items change; a formula of the day at every reading", async () => {
    const { store, core, calculated } = setup([...ORDERS.properties, { key: "total", label: "Total", type: "formula", params: { formula: "=[@qty]*[@price]" }, readonly: true }]);
    const first = await calculated.items("orders");
    const pear = (await store.items("orders")).value[0]!;
    await core.update("orders", pear, "qty", 5);
    const second = await calculated.items("orders");
    expect(second).not.toBe(first);
    expect(second.value[0]!.values.total).toBe(10);
    await core.setPropertyParams("orders", "total", { formula: "=[@qty]+[@price]" }, (await property(store, "total")).params);
    const third = await calculated.items("orders");
    expect(third.value[0]!.values.total).toBe(7);
    expect(third.revision).not.toBe(second.revision);
    // A formula of the day: the same within its minute, calculated anew in the next
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-22T10:00:10Z"));
      await core.setPropertyParams("orders", "total", { formula: "=TODAY()" }, (await property(store, "total")).params);
      const today = await calculated.items("orders");
      expect(await calculated.items("orders")).toBe(today);
      vi.setSystemTime(new Date("2026-11-22T10:01:10Z"));
      expect(await calculated.items("orders")).not.toBe(today);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is the store in everything else", async () => {
    const { store, calculated } = setup();
    expect(await calculated.database("orders")).toEqual(await store.database("orders"));
    expect(calculated.capabilities).toBe(store.capabilities);
    expect(calculated.keepableName("Pear", ["Pear"])).toBe(store.keepableName("Pear", ["Pear"]));
  });
});

describe("a property's options by a formula", () => {
  // (A select whose options are the names of the items: =[name], each once)
  const PICK: Property = { key: "pick", label: "Pick", type: "select", params: { optionsFormula: "=[name]" }, readonly: false };

  it("are its formula's list in the schema the views read, never in the schema kept", async () => {
    const { store, calculated } = setup([...ORDERS.properties, PICK]);
    const shown = (await calculated.database("orders"))!;
    expect(shown.value.properties.find((one) => one.key === "pick")!.params.options).toEqual(["Pear", "Fig"]);
    expect((await property(store, "pick")).params.options).toBeUndefined();
    // (The same revision: an edit made of it is against the schema kept)
    expect(shown.revision).toBe((await store.database("orders"))!.revision);
    expect((await calculated.optionsProblems("orders")).size).toBe(0);
  });

  it("take any value as the core writes one (the list is the views'), a view marking one none of them", async () => {
    const { core, store, calculated } = setup([...ORDERS.properties, PICK]);
    const pear = (await store.items("orders")).value[0]!;
    expect(await core.update("orders", pear, "pick", "Kiwi")).not.toHaveProperty("problem");
    const types = new TypeRegistry();
    const shown = (await calculated.database("orders"))!.value.properties.find((one) => one.key === "pick")!;
    expect(types.of("select", shown.params)!.validate("Kiwi", shown.params)).toMatch(/none of its options/);
    expect(types.of("select", shown.params)!.validate("Fig", shown.params)).toBeUndefined();
  });

  it("say why where the formula gives none, the property then of no options", async () => {
    const { calculated } = setup([...ORDERS.properties, { ...PICK, params: { optionsFormula: "=SUM([qty])/0" } }]);
    const shown = (await calculated.database("orders"))!.value.properties.find((one) => one.key === "pick")!;
    expect(shown.params.options).toEqual([]);
    expect((await calculated.optionsProblems("orders")).get("pick")?.code).toBe("#DIV/0!");
  });

  it("are calculated anew as time goes where their formula reads it, a multi-select's none with a comma", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-22T10:00:00Z"));
      const { calculated } = setup([...ORDERS.properties, { ...PICK, params: { optionsFormula: "=TEXT(TODAY(), \"yyyy-mm-dd\")" } }]);
      const optionsOf = async () => (await calculated.database("orders"))!.value.properties.find((one) => one.key === "pick")!.params.options;
      expect(await optionsOf()).toEqual(["2026-11-22"]);
      vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
      expect(await optionsOf()).toEqual(["2026-11-23"]);
    } finally {
      vi.useRealTimers();
    }
    const several = setup([...ORDERS.properties, { ...PICK, params: { multiple: true, optionsFormula: '=VSTACK("Prague, CZ", "Brno")' } }]);
    expect((await several.calculated.database("orders"))!.value.properties.find((one) => one.key === "pick")!.params.options).toEqual(["Brno"]);
  });

  it("are refused where their formula does not read, or reads outside the database", async () => {
    const select = new TypeRegistry().named("select")!;
    expect(select.validateParams!({ optionsFormula: "=[name" })).toMatch(/^its options' formula/);
    expect(select.validateParams!({ optionsFormula: "=prices![name]" })).toMatch(/only its own items/);
    expect(select.validateParams!({ optionsFormula: "=UNIQUE([qty])" })).toBeUndefined();
  });
});
