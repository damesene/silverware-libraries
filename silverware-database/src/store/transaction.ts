// What a transaction comes to, whatever the store: its changes checked and
// folded into what each part (the database's record, each item) is to become,
// or why a part is left. Every store plans by it, so they all refuse the same
// (contract.ts checks it); how a part is then written is the store's own (a
// map in memory, a page through the page writer). Pure, on the state a store
// read.
import { type Database, type Item, type ItemKey, NAME_KEY, type Property, validatePropertyKey, type Value } from "../model/database.ts";
import type { Changes, DatabaseChange } from "../core/changes.ts";
import type { SkipCause, Skipped, Target } from "../core/store.ts";

/** An item as a store keeps it, its revision apart */
export type ItemState = Omit<Item, "revision">;

/** A database's own record: its name, schema and the version of the form it is kept in */
export type RecordState = { readonly database: Database; readonly version: number };

/** What a store has of a database as a transaction is planned (none: no database of that id) */
export type StoreState =
  | {
      readonly record: RecordState;
      readonly recordRevision: string;
      readonly items: ReadonlyMap<ItemKey, { readonly item: ItemState; readonly revision: string }>;
    }
  | undefined;

/** What one store refuses beside the model's rules, and how it tells names apart */
export type StoreRules = {
  readonly latestFormat: number;
  validatePropertyKey(key: string): string | undefined;
  validateItemName(name: string): string | undefined;
  /** What two names are compared by (a page's name: whatever its case, as a disk may ignore it) */
  nameKey(name: string): string;
};

/** An item's part: where it lands, what it leaves (undefined: removed), how many things change, whether its name does */
export type ItemDraft = {
  readonly target: Target;
  readonly key: ItemKey | undefined;
  readonly ref?: string;
  readonly count: number;
  readonly before: ItemState | undefined;
  readonly after: ItemState | undefined;
  readonly named: boolean;
  // The revision it is to be at as written (none: made by this transaction)
  readonly expects: string | undefined;
};

/** The database's own part: the record it leaves, how many changes, the revision it is to be at (none: made) */
export type RecordDraft = { readonly after: RecordState; readonly count: number; readonly expects: string | undefined };

export type TransactionDraft = {
  readonly record?: RecordDraft;
  readonly items: readonly ItemDraft[];
  readonly skipped: readonly Skipped[];
  // The record's revision the transaction was made from, where it changes none of it (its items written only while it still is)
  readonly recordRead?: string;
};

const CHANGED_READ = "changed since it was read: left alone";

/** Why a database's format is not written (older: migrate it first; newer: read only) */
export function formatReason(version: number, latest: number): string {
  return version < latest ? `kept in an older format (version ${version}): migrate it first` : `kept in a newer format (version ${version}) than this store writes: read only`;
}

/** A transaction's changes checked against what the store has: each part's draft, or why it is left */
export function draftTransaction(state: StoreState, changes: Changes, rules: StoreRules): TransactionDraft {
  const all = (cause: SkipCause, reason: string): TransactionDraft => ({ items: [], skipped: targetsOf(changes).map((target) => ({ target, cause, reason })) });
  const refused = validateTransaction(state, changes, rules);
  if (refused) return all(refused.cause, refused.reason);
  const record = draftRecord(state, changes, rules);
  if ("skipped" in record) return all(record.skipped.cause, `its database's changes were left: ${record.skipped.reason}`);
  const keys = new Set(record.record.database.properties.map((property) => property.key));
  const drafts: ItemDraft[] = [];
  const skipped: Skipped[] = [];
  for (const group of itemGroups(changes)) {
    const result = draftItem(group, state, keys, changes, rules);
    if (result && "cause" in result) skipped.push(result);
    else if (result) drafts.push(result);
  }
  const names = takenNames(state ? [...state.items.values()].map(({ item }) => item) : [], drafts, rules);
  const items: ItemDraft[] = [];
  for (const draft of drafts) {
    if (draft.named && draft.after && names.get(rules.nameKey(draft.after.name))! > 1) skipped.push({ target: draft.target, cause: "refused", reason: `an item named "${draft.after.name}" exists already` });
    else items.push(draft);
  }
  const recordRead = !record.draft && changes.expects?.database !== undefined ? changes.expects.database : undefined;
  return { ...(record.draft ? { record: record.draft } : {}), items, skipped, ...(recordRead === undefined ? {} : { recordRead }) };
}

/** Why a whole transaction cannot be planned (none of it), undefined where it can */
function validateTransaction(state: StoreState, changes: Changes, rules: StoreRules): { readonly cause: SkipCause; readonly reason: string } | undefined {
  const creates = changes.changes.findIndex((change) => change.kind === "createDatabase");
  if (creates > 0 || changes.changes.filter((change) => change.kind === "createDatabase").length > 1) return { cause: "refused", reason: "a database is made by a transaction's first change, once" };
  const refs = changes.changes.flatMap((change) => (change.kind === "createItem" ? [change.ref] : []));
  if (new Set(refs).size !== refs.length) return { cause: "refused", reason: "an item made twice under one ref" };
  if (creates === 0 && state) return { cause: "refused", reason: `a database "${changes.database}" exists already` };
  if (creates < 0 && !state) return { cause: "missing", reason: `no database "${changes.database}"` };
  if (state && state.record.version !== rules.latestFormat) return { cause: "format", reason: formatReason(state.record.version, rules.latestFormat) };
  if (state && changes.expects?.database !== undefined && changes.expects.database !== state.recordRevision) return { cause: "changed", reason: `its database ${CHANGED_READ}` };
  return undefined;
}

/** The database's record as the transaction leaves it, and its draft where it changes it; or why its changes are left */
function draftRecord(state: StoreState, changes: Changes, rules: StoreRules): { readonly record: RecordState; readonly draft?: RecordDraft } | { readonly skipped: Skipped } {
  const list = changes.changes.filter((change) => change.kind === "createDatabase" || change.kind === "renameDatabase" || change.kind === "setSchema");
  let record = state?.record;
  for (const change of list) {
    if (change.kind === "createDatabase") record = { database: { id: changes.database, name: change.name, properties: [] }, version: rules.latestFormat };
    else if (change.kind === "renameDatabase") record = { ...record!, database: { ...record!.database, name: change.name } };
    else record = { ...record!, database: { ...record!.database, properties: change.properties } };
  }
  if (!list.length) return { record: record! };
  const problem = record!.database.name.trim() === "" ? "a database needs a name" : validateSchema(record!.database.properties, rules);
  if (problem) return { skipped: { target: { database: changes.database }, cause: "refused", reason: problem } };
  return { record: record!, draft: { after: record!, count: list.length, expects: state?.recordRevision } };
}

/** Why a schema cannot be kept: a key the model or the store refuses, a key twice; undefined where it can */
function validateSchema(properties: readonly Property[], rules: StoreRules): string | undefined {
  const seen = new Set<string>();
  for (const { key } of properties) {
    const problem = validatePropertyKey(key) ?? rules.validatePropertyKey(key);
    if (problem) return problem;
    if (seen.has(key)) return `the key "${key}" twice`;
    seen.add(key);
  }
  return undefined;
}

/** An item's changes in a transaction: an item kept (by its key) or one made (its `createItem`), the changes in their order */
type ItemGroup = { readonly target: Target; readonly key?: ItemKey; readonly created?: Extract<DatabaseChange, { kind: "createItem" }>; readonly changes: readonly DatabaseChange[] };

/** A transaction's item changes by item, in the order each is first changed */
function itemGroups(changes: Changes): ItemGroup[] {
  const byItem = new Map<ItemKey, { target: Target; key: ItemKey; changes: DatabaseChange[] }>();
  const groups: ItemGroup[] = [];
  for (const change of changes.changes) {
    if (change.kind === "createItem") groups.push({ target: { ref: change.ref }, created: change, changes: [] });
    else if ("item" in change) {
      let group = byItem.get(change.item);
      if (!group) {
        group = { target: { item: change.item }, key: change.item, changes: [] };
        byItem.set(change.item, group);
        groups.push(group);
      }
      group.changes.push(change);
    }
  }
  return groups;
}

/** One item's changes applied in turn: what they leave, how many changed; nothing where none does; or why they are left */
function draftItem(group: ItemGroup, state: StoreState, keys: ReadonlySet<string>, changes: Changes, rules: StoreRules): ItemDraft | Skipped | undefined {
  const { target, key, created } = group;
  const skip = (cause: SkipCause, reason: string): Skipped => ({ target, cause, reason });
  const kept = key === undefined ? undefined : state?.items.get(key);
  const before = kept?.item;
  let item: ItemState | undefined = created
    ? { key: "" as ItemKey, name: created.name, values: created.values, rank: created.rank, ...(created.body === undefined ? {} : { body: created.body }) }
    : before;
  if (!item) return skip("missing", "no such item");
  const expected = key && changes.expects?.items?.[key];
  if (expected !== undefined && expected !== kept!.revision) return skip("changed", CHANGED_READ);
  let count = created ? 1 : 0;
  let named = !!created;
  if (created) {
    const problem = rules.validateItemName(created.name) ?? Object.keys(created.values).map((one) => validateValueKey(one, keys, true)).find(Boolean);
    if (problem) return skip("refused", problem);
  }
  for (const change of group.changes) {
    if (!item) return skip("refused", "a change after the item is removed in the same transaction");
    const problem = change.kind === "setValue" ? validateValueKey(change.key, keys, change.value !== undefined) : change.kind === "renameItem" ? rules.validateItemName(change.name) : undefined;
    if (problem) return skip("refused", problem);
    // A body written over only as it was read: a text changed since (by hand) is never lost
    if (change.kind === "setBody" && !created && (before?.body ?? undefined) !== change.was) return skip("changed", "its body changed since it was read: left alone");
    const next = changedItem(item, change);
    if (next === item) continue;
    if (change.kind === "renameItem") named = true;
    item = next;
    count++;
  }
  if (!count) return undefined;
  return { target, key, ...(created ? { ref: created.ref } : {}), count, before, after: item, named, expects: kept?.revision };
}

/** Two values the same (lists by their items) */
function same(a: Value | undefined, b: Value | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((one, i) => one === b[i]);
  return a === b;
}

/** An item as one change leaves it (the same object where nothing changes; undefined: removed) */
function changedItem(item: ItemState, change: DatabaseChange): ItemState | undefined {
  switch (change.kind) {
    case "setValue": {
      if (same(item.values[change.key], change.value)) return item;
      const values = { ...item.values };
      if (change.value === undefined) delete values[change.key];
      else values[change.key] = change.value;
      return { ...item, values };
    }
    case "renameItem":
      return change.name === item.name ? item : { ...item, name: change.name };
    case "setRank":
      return change.rank === item.rank ? item : { ...item, rank: change.rank };
    case "setBody":
      return change.body === item.body ? item : { ...item, body: change.body };
    case "removeItem":
      return undefined;
    default:
      return item;
  }
}

/**
 * Why a value cannot be set by its key: the name is the item's own, a key the
 * schema lacks no property. A value taken off (`set` false) may go from any
 * key: what a key renamed leaves behind.
 */
function validateValueKey(key: string, keys: ReadonlySet<string>, set: boolean): string | undefined {
  if (key === NAME_KEY) return "an item's name is set by renaming it";
  return !set || keys.has(key) ? undefined : `no property "${key}"`;
}

/** How many items take each name (by the store's `nameKey`) once these parts are written, the others as `items` have them */
export function takenNames(items: Iterable<ItemState>, parts: readonly Pick<ItemDraft, "key" | "ref" | "after">[], rules: Pick<StoreRules, "nameKey">): Map<string, number> {
  const after = new Map<string, string | undefined>();
  for (const item of items) after.set(`item:${item.key}`, item.name);
  for (const part of parts) after.set(part.key ? `item:${part.key}` : `ref:${part.ref}`, part.after?.name);
  const names = new Map<string, number>();
  for (const name of after.values()) if (name !== undefined) names.set(rules.nameKey(name), (names.get(rules.nameKey(name)) ?? 0) + 1);
  return names;
}

/**
 * The parts that may be written without two items of one name, against the
 * items as the store has them now (another transaction may have taken a name
 * since this one was planned): a part that would take a name another keeps is
 * left, until none is (one left keeps its name, which another may have taken)
 */
export function withoutClashes<T extends { readonly part: Pick<ItemDraft, "key" | "ref" | "after"> }>(
  now: ReadonlyMap<ItemKey, ItemState>,
  ready: readonly T[],
  rules: Pick<StoreRules, "nameKey">,
  skip: (one: T, reason: string) => void,
): T[] {
  let left = [...ready];
  for (;;) {
    const names = takenNames(now.values(), left.map((one) => one.part), rules);
    const clashing = left.filter(({ part }) => part.after && names.get(rules.nameKey(part.after.name))! > 1 && (part.key === undefined || rules.nameKey(now.get(part.key)?.name ?? "") !== rules.nameKey(part.after.name)));
    if (!clashing.length) return left;
    for (const one of clashing) skip(one, `an item named "${one.part.after!.name}" exists already`);
    left = left.filter((one) => !clashing.includes(one));
  }
}

/** Every part a transaction is about, in the order first named (what is left where all of it is) */
export function targetsOf(changes: Changes): Target[] {
  const seen = new Set<string>();
  const out: Target[] = [];
  for (const change of changes.changes) {
    const target: Target = "item" in change ? { item: change.item } : change.kind === "createItem" ? { ref: change.ref } : { database: changes.database };
    const id = JSON.stringify(target);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(target);
  }
  return out;
}
