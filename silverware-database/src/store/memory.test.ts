import { MEMORY_FORMAT, MemoryStore } from "./memory.ts";
import { storeContract } from "./contract.ts";

storeContract("the memory store", (seeds) => {
  const version = (format: "older" | "newer" | undefined) => (format === "older" ? MEMORY_FORMAT - 1 : format === "newer" ? MEMORY_FORMAT + 1 : MEMORY_FORMAT);
  const store = new MemoryStore(seeds.map((seed) => ({ database: seed.database, items: seed.items, version: version(seed.format) })));
  return { store, changeOutside: (database, item, change) => store.changeOutside(database, item, change) };
});
