// How a database is kept in pages, by version (docs/silverware-database.md,
// *The pages store*, *Decided* 26): each version reads its root page and its
// items from what the index gives of them, and writes them through the page
// writer's builder. The store reads every version it knows and writes only
// the latest; a database of an older version is migrated first, one of a
// newer version read (by the latest reader, as best it can) and never written.
import type { PageBuilder } from "../../../../shared/pages/changes.ts";
import type { IndexedObject } from "../../../../shared/platform.ts";
import type { Property, Value } from "../../model/database.ts";
import type { ItemState, RecordState } from "../transaction.ts";

/** A root page as a format reads it: its record, or why it cannot be read (the database then not shown) */
export type RootRead = { readonly record: RecordState } | { readonly problem: string };

/** An item's page as a format reads it (its key given by the store) */
export type ItemRead = Omit<ItemState, "key">;

export type PagesFormat = {
  readonly version: number;
  /** The root page's record, from its index object */
  readRoot(object: IndexedObject, version: number): RootRead;
  /** An item, from its page's index object and its name in the database's folder */
  readItem(object: IndexedObject, name: string, record: RecordState): ItemRead;
  /** The root page made (`before` none) or changed to `after`, in this version's form */
  writeRoot(page: PageBuilder, before: RecordState | undefined, after: RecordState): void;
  /** An item's page made (`before` none) or changed to `after` (its name is the store's: a rename) */
  writeItem(page: PageBuilder, before: ItemState | undefined, after: ItemState): void;
};

/** The tags pages of a database have: the root page's, an item's */
export const ROOT_TAG = "db-root";
export const ITEM_TAG = "db";
/** The key a database's own data is under in its pages (*Decided* 16) */
export const SYSTEM_KEY = "_database";

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The system's data of a page (its `_database`), none where it has none */
export function systemOf(object: IndexedObject): Readonly<Record<string, unknown>> {
  const system = object[SYSTEM_KEY];
  return isObject(system) ? system : {};
}

/** The version a root page is kept in (none written: 1, what exists before versions) */
export function versionOf(object: IndexedObject): number {
  const version = systemOf(object).format;
  return typeof version === "number" && Number.isInteger(version) ? version : 1;
}

/**
 * A value as the index gives it, as the model holds it: a scalar as it is, a
 * list of scalars as texts; what the model cannot hold (a map, a list of
 * maps) as its JSON text, shown as kept and never written back unless the
 * user changes it (each value is written by its own key)
 */
export function modelValue(value: unknown): Value | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value) && value.every((one) => one === null || ["string", "number", "boolean"].includes(typeof one))) return value.map((one) => String(one));
  return JSON.stringify(value);
}

// A property's settings in the root page beside its params: what the model has as fields
const PROPERTY_FIELDS = new Set(["type", "label", "readonly"]);

/** Version 1: the schema under `_database.properties` by key, each property's params beside its type and label */
export const FORMAT_1: PagesFormat = {
  version: 1,
  readRoot(object, version) {
    const system = systemOf(object);
    if (typeof system.id !== "string" || !system.id) return { problem: "its _database has no id" };
    const properties: Property[] = [];
    const schema = system.properties ?? {};
    if (!isObject(schema)) return { problem: "its _database.properties are no map" };
    for (const [key, raw] of Object.entries(schema)) {
      if (!isObject(raw)) return { problem: `its property ${key} is no map` };
      const params = Object.fromEntries(Object.entries(raw).filter(([field]) => !PROPERTY_FIELDS.has(field)));
      properties.push({ key, label: typeof raw.label === "string" ? raw.label : key, type: typeof raw.type === "string" ? raw.type : "text", params, readonly: raw.readonly === true });
    }
    const name = typeof system.name === "string" && system.name ? system.name : system.id;
    return { record: { database: { id: system.id, name, properties }, version } };
  },
  readItem(object, name, record) {
    const values: Record<string, Value> = {};
    for (const { key } of record.database.properties) {
      const value = modelValue(object[key]);
      if (value !== undefined) values[key] = value;
    }
    const rank = systemOf(object).rank;
    return { name, values, rank: typeof rank === "string" ? rank : undefined };
  },
  writeRoot(page, before, after) {
    if (!before) page.tags.add(ROOT_TAG).properties.set([SYSTEM_KEY, "id"], after.database.id);
    if (before?.database.name !== after.database.name) page.properties.set([SYSTEM_KEY, "name"], after.database.name);
    if (before?.version !== after.version) page.properties.set([SYSTEM_KEY, "format"], after.version);
    const schema = (record: RecordState | undefined) => (record ? JSON.stringify(record.database.properties) : undefined);
    if (schema(before) !== schema(after)) {
      const map = Object.fromEntries(
        after.database.properties.map((one) => [one.key, { type: one.type, label: one.label, ...(one.readonly ? { readonly: true } : {}), ...(one.params as Record<string, never>) }]),
      );
      page.properties.set([SYSTEM_KEY, "properties"], map);
    }
  },
  writeItem(page, before, after) {
    if (!before) page.tags.add(ITEM_TAG);
    for (const [key, value] of Object.entries(after.values)) if (JSON.stringify(before?.values[key]) !== JSON.stringify(value)) page.properties.set(key, value);
    for (const key of Object.keys(before?.values ?? {})) if (!(key in after.values)) page.properties.remove(key);
    if (after.rank !== before?.rank) {
      if (after.rank === undefined) page.properties.remove([SYSTEM_KEY, "rank"]);
      else page.properties.set([SYSTEM_KEY, "rank"], after.rank);
    }
    // (The body as read with it: the writer leaves a page whose body changed since)
    if (after.body !== undefined && after.body !== before?.body) page.body(after.body, before?.body);
  },
};

/** The formats the store knows, the latest last */
export const FORMATS: readonly PagesFormat[] = [FORMAT_1];
