// What one write writes of an item, and two readings of an item compared by
// it: the rule by which a write from an item as a view showed it goes on the
// item as it is now (core.ts `onItem`), and by which the item's panel tells
// whether the item as it is now is what it shows (its own writes). A write is
// of a part of an item (a value, its name, its look); the store writes that
// part alone, so where the part is still as shown, nothing the view did not
// show is written over, whatever else of the item changed meanwhile. Only the
// item's own values count: those the system gives (Modified, Page, Order, Task
// progress: domain/system.ts) change with every write and as other items
// move, and are no part a write rests on.
import type { Database, Item } from "../model/database.ts";
import { sameLook } from "./look.ts";

/** A value's text the same whatever the order of its maps' keys (what a revision is made of, the pages store's) */
export function stableText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableText).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableText((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}

/**
 * What a write writes of an item, or what it rests on: values by their keys (`allValues`: every value of its own, as a
 * removal loses them), its name, its look. None named: nothing of it (its body, which keeps its own check)
 */
export type ItemPart = { readonly values?: readonly string[]; readonly allValues?: boolean; readonly name?: boolean; readonly look?: boolean };

const sameValue = (one: Item, other: Item, key: string) => stableText(one.values[key] ?? null) === stableText(other.values[key] ?? null);

// The keys of a database's system properties, made once per reading of its schema (compared item by item)
const systemKeys = new WeakMap<Database, ReadonlySet<string>>();

/** The keys of the two readings' own values (not those the system gives) */
function ownKeys(one: Item, other: Item, database: Database): string[] {
  let system = systemKeys.get(database);
  if (!system) systemKeys.set(database, (system = new Set(database.properties.filter((property) => property.system).map((property) => property.key))));
  return [...new Set([...Object.keys(one.values), ...Object.keys(other.values)])].filter((key) => !system.has(key));
}

/** Whether two readings of an item of `database` are alike in `part` (a look taken off and none alike) */
export function samePart(one: Item, other: Item, part: ItemPart, database: Database): boolean {
  if (part.name && one.name !== other.name) return false;
  if (part.look && !sameLook(one.look, other.look)) return false;
  return (part.allValues ? ownKeys(one, other, database) : (part.values ?? [])).every((key) => sameValue(one, other, key));
}
