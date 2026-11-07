import { MEMORY_VERSION, MemoryStore } from "./memory.ts";
import { storeContract } from "./contract.ts";

storeContract("the memory store", (seeds) => {
  const version = (kept: "older" | "newer" | undefined) => (kept === "older" ? MEMORY_VERSION - 1 : kept === "newer" ? MEMORY_VERSION + 1 : MEMORY_VERSION);
  const store = new MemoryStore(seeds.map((seed) => ({ database: seed.database, items: seed.items, version: version(seed.version) })));
  return { store, changeOutside: (database, item, change) => store.changeOutside(database, item, change) };
});
