// What removed items leave behind (docs/silverware-database-files.md): the documents their values name besides them
// (a type's `leaves`: a value of files, its files), kept in the database's own folder for them (the store's
// `filesFolderOf`: those uploaded for it, not any document of the space a value links) and named by no item kept. What
// they are is the types'; the core asks the user whether they go too, and has them deleted by what its caller gives
// (the host's files), knowing no file itself.
import { typeOf } from "../domain/listing.ts";
import type { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item } from "../model/database.ts";

// How many of them a question names before "and N more"
const NAMED = 8;

/** The documents values of `items` name besides them (each once, in order) */
function named(database: Database, types: TypeRegistry, items: readonly Item[]): string[] {
  const all = items.flatMap((item) => database.properties.flatMap((property) => typeOf(types, property).leaves?.(item.values[property.key] ?? null, property.params) ?? []));
  return [...new Set(all)];
}

/** The documents the removed items alone name in `folder` (none: the database keeps no folder of them, nothing left) */
export function leftBehind(database: Database, types: TypeRegistry, removed: readonly Item[], all: readonly Item[], folder: string | undefined): string[] {
  if (folder === undefined) return [];
  const gone = new Set(removed.map((item) => item.key));
  const kept = new Set(named(database, types, all.filter((item) => !gone.has(item.key))));
  return named(database, types, removed).filter((path) => path.startsWith(`${folder}/`) && !kept.has(path));
}

/** Documents as a question names them: their names (no folders), the first few, then how many more */
export function namedFew(paths: readonly string[]): string {
  const names = paths.map((path) => path.slice(path.lastIndexOf("/") + 1));
  return names.slice(0, NAMED).join(", ") + (names.length > NAMED ? ` and ${(names.length - NAMED).toLocaleString("en-US")} more` : "");
}
