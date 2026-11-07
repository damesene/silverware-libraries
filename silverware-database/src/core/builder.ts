// A transaction made by a builder, as the page writer's changes are
// (shared/pages/changes.ts): one builder for a database's batch, mutating,
// fluent, `build()` giving frozen data (changes.ts) for the store.
//
//   const changes = databaseChanges("tasks")
//     .item(fix, (i) => i.set("status", "Done").rename("Fix the login"))
//     .create({ ref: "new", name: "Plan sprint", values: { status: "Todo" } })
//     .build();
//
// An item is given as read (an `Item`, never a bare key) and changed only
// where it is still at the revision read: a value toggled from a stale view is
// never written over another change. An item the batch makes is changed in its
// `createItem` alone: what is asked of it after is folded into that.
import type { Item, ItemKey, Property, Value } from "../model/database.ts";
import type { Changes, DatabaseChange } from "./changes.ts";

/** An item's changes as they are made, one chain */
export interface ItemChanges {
  /** A property's value (null: empty) */
  set(key: string, value: Value): ItemChanges;
  /** A property's value taken off the item (what a key renamed leaves behind) */
  unset(key: string): ItemChanges;
  rename(name: string): ItemChanges;
  /** Its place in the order by hand (domain/rank.ts) */
  rank(rank: string): ItemChanges;
  /** Its body made `body`, written only where it is still `was` (as the store's `body()` read it; none: it had none) */
  body(body: string, was?: string): ItemChanges;
  /** The item removed: nothing more is asked of it */
  remove(): ItemChanges;
}

/** An item the batch makes: `ref` names it in the report (made where not given) */
export type NewItem = {
  readonly ref?: string;
  readonly name: string;
  readonly values?: Readonly<Record<string, Value>>;
  readonly rank?: string;
  readonly body?: string;
};

type Made = { ref: string; name: string; values: Record<string, Value>; rank?: string; body?: string; removed: boolean };

export class DatabaseChangesBuilder {
  private created: string | undefined;
  private renamed: string | undefined;
  private properties: readonly Property[] | undefined;
  private databaseRead: string | undefined;
  // Items in the order first named: changes of an item kept, or one made
  private readonly items: ({ kind: "kept"; key: ItemKey; changes: DatabaseChange[] } | { kind: "made"; made: Made })[] = [];
  private readonly kept = new Map<ItemKey, DatabaseChange[]>();
  private readonly read: Record<string, string> = {};
  private refs = 0;
  private built = false;

  constructor(private readonly database: string) {}

  /** The database made by this batch, first of its changes (its schema by `schema`) */
  createDatabase(name: string): this {
    this.open();
    this.created = name;
    return this;
  }

  /** The database's name */
  rename(name: string): this {
    this.open();
    this.renamed = name;
    return this;
  }

  /** The properties as they are to be, in their order (named again: the last) */
  schema(properties: readonly Property[]): this {
    this.open();
    this.properties = properties;
    return this;
  }

  /** The database's record (name, schema) changed only where still at this revision, as read */
  expectDatabase(revision: string): this {
    this.open();
    this.databaseRead = revision;
    return this;
  }

  /** An item's changes, the item as read: written only where it is still at its revision */
  item(item: Item, make: (changes: ItemChanges) => unknown): this {
    this.open();
    const key = item.key;
    const before = this.read[key];
    if (before !== undefined && before !== item.revision) throw new Error(`item ${key} named at two revisions`);
    this.read[key] = item.revision;
    let changes = this.kept.get(key);
    if (!changes) {
      this.kept.set(key, (changes = []));
      this.items.push({ kind: "kept", key, changes });
    }
    const list = changes;
    const add = (change: DatabaseChange) => list.push(change);
    make(this.chain({
      set: (name, value) => add({ kind: "setValue", item: key, key: name, value }),
      unset: (name) => add({ kind: "setValue", item: key, key: name, value: undefined }),
      rename: (name) => add({ kind: "renameItem", item: key, name }),
      rank: (rank) => add({ kind: "setRank", item: key, rank }),
      body: (body, was) => add({ kind: "setBody", item: key, body, was }),
      remove: () => add({ kind: "removeItem", item: key }),
    }));
    return this;
  }

  /** An item made, and what `more` asks of it after, folded into it */
  create(item: NewItem, more?: (changes: ItemChanges) => unknown): this {
    this.open();
    const ref = item.ref ?? `new-${++this.refs}`;
    if (this.items.some((one) => one.kind === "made" && one.made.ref === ref)) throw new Error(`an item made twice under the ref "${ref}"`);
    const made: Made = { ref, name: item.name, values: { ...item.values }, removed: false, ...(item.rank === undefined ? {} : { rank: item.rank }), ...(item.body === undefined ? {} : { body: item.body }) };
    this.items.push({ kind: "made", made });
    const change = (apply: () => void) => {
      if (made.removed) throw new Error(`the item "${ref}" was removed in this batch`);
      apply();
    };
    more?.(this.chain({
      set: (key, value) => change(() => void (made.values[key] = value)),
      unset: (key) => change(() => void delete made.values[key]),
      rename: (name) => change(() => void (made.name = name)),
      rank: (rank) => change(() => void (made.rank = rank)),
      body: (body) => change(() => void (made.body = body)),
      remove: () => change(() => void (made.removed = true)),
    }));
    return this;
  }

  /** The batch as frozen data: the database's changes first, then the items' in the order first named; the builder is done */
  build(): Changes {
    this.open();
    this.built = true;
    const changes: DatabaseChange[] = [];
    if (this.created !== undefined) changes.push({ kind: "createDatabase", name: this.created });
    if (this.renamed !== undefined) changes.push({ kind: "renameDatabase", name: this.renamed });
    if (this.properties) changes.push({ kind: "setSchema", properties: Object.freeze([...this.properties]) });
    for (const one of this.items) {
      if (one.kind === "kept") changes.push(...one.changes);
      else if (!one.made.removed) {
        const { ref, name, values, rank, body } = one.made;
        changes.push({ kind: "createItem", ref, name, values: Object.freeze(values), ...(rank === undefined ? {} : { rank }), ...(body === undefined ? {} : { body }) });
      }
    }
    const items = Object.keys(this.read).length ? { items: Object.freeze({ ...this.read }) } : {};
    const expects = this.databaseRead !== undefined || items.items ? { expects: Object.freeze({ ...items, ...(this.databaseRead === undefined ? {} : { database: this.databaseRead }) }) } : {};
    return Object.freeze({ database: this.database, changes: Object.freeze(changes.map((change) => Object.freeze(change))), ...expects });
  }

  private open(): void {
    if (this.built) throw new Error("these changes were built already: make a new builder");
  }

  // The item's methods made a chain: each gives the item's changes back
  private chain(methods: { readonly [K in keyof ItemChanges]: (...args: Parameters<ItemChanges[K]>) => void }): ItemChanges {
    const chain = {} as Record<keyof ItemChanges, (...args: never[]) => ItemChanges>;
    for (const [name, method] of Object.entries(methods) as [keyof ItemChanges, (...args: never[]) => void][]) {
      chain[name] = (...args) => {
        this.open();
        method(...args);
        return chain as unknown as ItemChanges;
      };
    }
    return chain as unknown as ItemChanges;
  }
}

/** A builder of a database's batch of changes */
export function databaseChanges(database: string): DatabaseChangesBuilder {
  return new DatabaseChangesBuilder(database);
}
