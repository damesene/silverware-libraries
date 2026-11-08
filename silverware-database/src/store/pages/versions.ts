// How a database is kept in pages, by version (docs/silverware-database.md,
// *The pages store*, *Decided* 26): each version reads its root page and its
// items from what the index gives of them, and writes them through the page
// writer's builder. The store reads every version it knows and writes only
// the latest; a database of an older version is migrated first, one of a
// newer version read (by the latest reader, as best it can) and never written.
import type { PageBuilder } from "../../../../shared/pages/changes.ts";
import type { YamlMap } from "../../../../shared/pages/yamltree.ts";
import type { IndexedObject } from "../../../../shared/platform.ts";
import type { Property, Value } from "../../model/database.ts";
import type { ItemState, RecordState } from "../transaction.ts";

/** A root page as a version reads it: its record, or why it cannot be read (the database then not shown) */
export type RootRead = { readonly record: RecordState } | { readonly problem: string };

/** An item's page as a version reads it (its key given by the store) */
export type ItemRead = Omit<ItemState, "key">;

export type PagesVersion = {
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

/**
 * The version a root page is kept in, its `_database.version` (none written:
 * 1, what exists before versions; `format`, its name until 2026-11-07, holds
 * only 1, so it reads the same)
 */
export function versionOf(object: IndexedObject): number {
  const version = systemOf(object).version;
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
const PROPERTY_FIELDS = new Set(["type", "label", "readonly", "hidden", "required", "system"]);

/** A property as the root page keeps it under its key: its type, label, flags, a system property's kind, its params beside them */
export function schemaEntry(property: Property): YamlMap {
  // (A param named as a field of its own, which the core refuses, left out: it would take the field's place as read)
  const params = Object.fromEntries(Object.entries(property.params as YamlMap).filter(([name]) => !PROPERTY_FIELDS.has(name)));
  return {
    type: property.type,
    label: property.label,
    ...(property.readonly ? { readonly: true } : {}),
    ...(property.hidden ? { hidden: true } : {}),
    ...(property.required ? { required: true } : {}),
    ...(property.system ? { system: property.system } : {}),
    ...params,
  };
}

/** Version 1: the schema under `_database.properties` by key, each property's params beside its type and label */
export const VERSION_1: PagesVersion = {
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
      // (A system property is read only, whatever is written)
      const system = typeof raw.system === "string" && raw.system ? raw.system : undefined;
      properties.push({
        key,
        label: typeof raw.label === "string" ? raw.label : key,
        type: typeof raw.type === "string" ? raw.type : "text",
        params,
        readonly: raw.readonly === true || system !== undefined,
        ...(raw.hidden === true ? { hidden: true } : {}),
        ...(raw.required === true ? { required: true } : {}),
        ...(system ? { system } : {}),
      });
    }
    const name = typeof system.name === "string" && system.name ? system.name : system.id;
    return { record: { database: { id: system.id, name, properties }, version } };
  },
  readItem(object, name, record) {
    const values: Record<string, Value> = {};
    // (A system property's values are none of the page's: its key in a page is the user's own, left as it is)
    for (const { key, system } of record.database.properties) {
      if (system !== undefined) continue;
      const value = modelValue(object[key]);
      if (value !== undefined) values[key] = value;
    }
    // Its other keys, kept apart (none of the database's own: its data, the page's name and tags, a key starting `_`, another
    // tool's data by its own rule; the index's own keys the store leaves out)
    const schema = new Set(record.database.properties.map((one) => one.key));
    const loose: Record<string, Value> = {};
    for (const [key, raw] of Object.entries(object)) {
      if (schema.has(key) || key.startsWith("_") || key.startsWith("$") || key === "name" || key === "tags") continue;
      const value = modelValue(raw);
      if (value !== undefined) loose[key] = value;
    }
    const rank = systemOf(object).rank;
    return { name, values, rank: typeof rank === "string" ? rank : undefined, ...(Object.keys(loose).length ? { loose } : {}) };
  },
  writeRoot(page, before, after) {
    if (!before) page.tags.add(ROOT_TAG).properties.set([SYSTEM_KEY, "id"], after.database.id);
    if (before?.database.name !== after.database.name) page.properties.set([SYSTEM_KEY, "name"], after.database.name);
    // Its version written with each write of the root page, and `format`, the name it had, taken off (none there: nothing)
    page.properties.set([SYSTEM_KEY, "version"], after.version);
    page.properties.remove([SYSTEM_KEY, "format"]);
    const schema = (record: RecordState | undefined) => (record ? JSON.stringify(record.database.properties) : undefined);
    if (schema(before) !== schema(after)) {
      const map = Object.fromEntries(after.database.properties.map((one) => [one.key, schemaEntry(one)]));
      page.properties.set([SYSTEM_KEY, "properties"], map);
    }
  },
  writeItem(page, before, after) {
    if (!before) page.tags.add(ITEM_TAG);
    for (const [key, value] of Object.entries(after.values)) if (JSON.stringify(before?.values[key]) !== JSON.stringify(value)) page.properties.set(key, value);
    for (const key of Object.keys(before?.values ?? {})) if (!(key in after.values)) page.properties.remove(key);
    // (A key the schema has none of, taken off)
    for (const key of Object.keys(before?.loose ?? {})) if (!(key in (after.loose ?? {}))) page.properties.remove(key);
    if (after.rank !== before?.rank) {
      if (after.rank === undefined) page.properties.remove([SYSTEM_KEY, "rank"]);
      else page.properties.set([SYSTEM_KEY, "rank"], after.rank);
    }
    // (The body as read with it: the writer leaves a page whose body changed since)
    if (after.body !== undefined && after.body !== before?.body) page.body(after.body, before?.body);
  },
};

/** The versions the store knows, the latest last */
export const VERSIONS: readonly PagesVersion[] = [VERSION_1];
