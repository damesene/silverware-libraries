import { describe, expect, it } from "vitest";
import { TableRegister } from "../core/tables.ts";
import { storeContract, table } from "./contract.ts";
import { MemoryStore } from "./memory.ts";

storeContract("tables in memory", (documents) => {
  const store = new MemoryStore(new TableRegister(), documents);
  return { store, replace: (document, tables) => store.replace(document, tables) };
});

describe("the memory store", () => {
  it("keeps a table read again the same object, a table left by a transaction too", async () => {
    const store = new MemoryStore(new TableRegister(), { Shop: [table(["A"], ["1"]), table(["B"], ["2"])] });
    const [first, second] = (await store.tables("Shop"))!;
    await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: first!.key, expects: first!.revision, model: table(["A"], ["9"]) }] }));
    expect((await store.tables("Shop"))![1]).toBe(second);
  });
});
