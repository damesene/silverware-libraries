// A store of databases in memory: the core's, the views' and the modules'
// tests and the playground run over it, as over any store (it passes the same
// contract as the pages store, contract.ts). A "document" here is an item, or
// a database's own record (its name, schema and format), each with its
// revision: a transaction writes each where it is still as read, as pages
// are written. Changes made outside the core (`changeOutside`) are what a page
// edited by hand is to the pages store.
//
// Nothing is lost by mistake (docs/silverware-database.md, decision 27): what
// a plan checks (names, a database removed only empty, the database a part is
// of) is checked again as it is applied, against the store as it is then, as
// anything may have been written between the two.
import { type Database, type DatabaseSummary, type Item, type ItemKey, NAME_KEY, type Property, type Revised, validatePropertyKey, type Value } from "../model/database.ts";
import type { Changes, DatabaseChange } from "../core/changes.ts";
import type { DatabaseStore, FormatStatus, MigrationScope, Planned, SkipCause, Skipped, StoreCapabilities, Target, TransactionPlan, TransactionReport } from "../core/store.ts";

/** The version of the form this store writes (a store in memory has one; a database seeded older or newer stands for one kept so) */
export const MEMORY_FORMAT = 1;

/** A database to start with: its record, its items (keys and revisions made by the store), the version it is kept in */
export type MemorySeed = {
  readonly database: Database;
  readonly items?: readonly Omit<Item, "key" | "revision">[];
  readonly version?: number;
};

/** What a store in memory changes outside the core, as a page edited by hand: values set, a new name, the item gone */
export type OutsideChange = { readonly values?: Readonly<Record<string, Value>>; readonly name?: string; readonly removed?: true };

// A database's own record, one document: its name, schema and format
type DatabaseRecord = { readonly database: Database; readonly version: number };

// An item as kept (its revision kept apart)
type Kept = Omit<Item, "revision">;

type KeptDatabase = {
  record: DatabaseRecord;
  recordRevision: number;
  // Which making of the database of this id it is: one removed and made again is another, which no part planned for the first touches
  readonly incarnation: number;
  readonly items: Map<ItemKey, Kept>;
  readonly itemRevisions: Map<ItemKey, number>;
};

// What a planned part writes: its database (and which making of it: none where this plan makes it), the revision it expects (none: it is made), the state it leaves
type RecordStep = { readonly kind: "record"; readonly database: string; readonly expects: number | undefined; readonly after: DatabaseRecord | undefined };
type ItemStep = {
  readonly kind: "item";
  readonly database: string;
  readonly incarnation: number | undefined;
  readonly item: ItemKey | undefined;
  readonly ref?: string;
  readonly expects: number | undefined;
  readonly after: Kept | undefined;
  // Planned against the record's part of the same plan: written only with it
  readonly withRecord: boolean;
  // The record's revision the transaction was made from (`expects.database`)
  readonly record?: number;
};
type Step = RecordStep | ItemStep;

// What a written part was and became, for its undo
type Written = { readonly step: Step; readonly before: DatabaseRecord | Kept | undefined; readonly revision: number; readonly key?: ItemKey; readonly incarnation?: number };

// An item's changes as planned: where they land and what they leave, before the names are checked together
type ItemPlan = { readonly target: Target; readonly key: ItemKey | undefined; readonly ref?: string; readonly count: number; readonly after: Kept | undefined; readonly named: boolean };

const CHANGED_READ = "changed since it was read: left alone";
const CHANGED_WRITTEN = "changed since it was written: left as it is";
const ANOTHER_DATABASE = "its database was removed and made again since: left alone";

/** Two values the same (lists by their items) */
function same(a: Value | undefined, b: Value | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((one, i) => one === b[i]);
  return a === b;
}

export class MemoryStore implements DatabaseStore {
  readonly capabilities: StoreCapabilities = { renameFollowsLinks: false, itemBody: true };
  private readonly kept = new Map<string, KeptDatabase>();
  private readonly listeners = new Set<(change: { readonly database: string }) => void>();
  private readonly steps = new WeakMap<Planned, Step>();
  private readonly written = new WeakMap<Planned, Written>();
  // Parts applied once: a plan applied again writes none of them anew (an item made twice)
  private readonly applied = new WeakSet<Planned>();
  private made = 0;
  private revision = 0;
  private incarnations = 0;

  constructor(seeds: readonly MemorySeed[] = []) {
    for (const seed of seeds) {
      const kept = this.newDatabase({ database: seed.database, version: seed.version ?? MEMORY_FORMAT });
      for (const item of seed.items ?? []) {
        const key = this.newKey();
        kept.items.set(key, { ...item, key });
        kept.itemRevisions.set(key, ++this.revision);
      }
    }
  }

  async databases(): Promise<readonly DatabaseSummary[]> {
    return [...this.kept.values()].map(({ record }) => ({ id: record.database.id, name: record.database.name }));
  }

  async database(id: string): Promise<Revised<Database> | undefined> {
    const kept = this.kept.get(id);
    return kept && { value: kept.record.database, revision: String(kept.recordRevision) };
  }

  async items(id: string): Promise<Revised<readonly Item[]>> {
    const kept = this.kept.get(id);
    if (!kept) return { value: [], revision: "0" };
    let latest = 0;
    for (const revision of kept.itemRevisions.values()) latest = Math.max(latest, revision);
    const items = [...kept.items.values()].map((item) => ({ ...item, revision: String(kept.itemRevisions.get(item.key)) }));
    return { value: items, revision: String(latest) };
  }

  async plan(changes: Changes): Promise<TransactionPlan> {
    const { database: id } = changes;
    const kept = this.kept.get(id);
    const all = (cause: SkipCause, reason: string): TransactionPlan => ({ database: id, planned: [], skipped: targetsOf(changes).map((target) => ({ target, cause, reason })) });
    const refused = this.validateTransaction(changes, kept);
    if (refused) return all(refused.cause, refused.reason);
    const planned: Planned[] = [];
    const skipped: Skipped[] = [];
    // The database's own record first: the schema its items' values are checked against
    const record = this.planRecord(changes, kept);
    if ("skipped" in record) return all(record.skipped.cause, `its database's changes were left: ${record.skipped.reason}`);
    if (record.step) this.add(planned, { database: id }, record.count, record.step);
    const keys = new Set(record.record.database.properties.map((property) => property.key));
    const items: ItemPlan[] = [];
    for (const group of itemGroups(changes)) {
      const result = this.planItem(group, kept, keys, changes);
      if (result && "cause" in result) skipped.push(result);
      else if (result) items.push(result);
    }
    const names = takenNames(kept, items);
    // Read against the record as read: written only while it still is (where this transaction does not change it, its own part tells)
    const recordRead = !record.step && changes.expects?.database !== undefined ? Number(changes.expects.database) : undefined;
    for (const item of items) {
      if (item.named && item.after && names.get(item.after.name)! > 1) {
        skipped.push({ target: item.target, cause: "refused", reason: `an item named "${item.after.name}" exists already` });
        continue;
      }
      this.add(planned, item.target, item.count, {
        kind: "item",
        database: id,
        incarnation: kept?.incarnation,
        item: item.key,
        ...(item.ref === undefined ? {} : { ref: item.ref }),
        expects: item.key && kept!.itemRevisions.get(item.key),
        after: item.after,
        withRecord: !!record.step,
        ...(recordRead === undefined ? {} : { record: recordRead }),
      });
    }
    return { database: id, planned, skipped };
  }

  async apply(plan: TransactionPlan): Promise<TransactionReport> {
    const written: Planned[] = [];
    const skipped: Skipped[] = [...plan.skipped];
    const created = new Map<string, ItemKey>();
    const changed = plan.undoes ? CHANGED_WRITTEN : CHANGED_READ;
    const skip = (one: Planned, cause: SkipCause, reason: string) => skipped.push({ target: one.target, cause, reason });
    // A record's part making the database comes before its items, one removing it after them (as plan and planUndo order them)
    const leading: { one: Planned; step: RecordStep }[] = [];
    const items: { one: Planned; step: ItemStep }[] = [];
    const trailing: { one: Planned; step: RecordStep }[] = [];
    for (const one of plan.planned) {
      const step = this.steps.get(one);
      if (!step || step.database !== plan.database) skip(one, "refused", "not planned by this store for this database: left alone");
      else if (this.applied.has(one)) skip(one, "changed", "written already: left alone");
      else if (step.kind === "item") items.push({ one, step });
      else (items.length ? trailing : leading).push({ one, step });
    }
    let recordLeft = false;
    let madeNow: number | undefined;
    const writeRecord = ({ one, step }: { one: Planned; step: RecordStep }) => {
      const kept = this.kept.get(plan.database);
      if (kept?.recordRevision !== step.expects) {
        recordLeft = true;
        return skip(one, "changed", changed);
      }
      // A database goes only with nothing of it left: an item made or changed since keeps it
      if (!step.after && kept && kept.items.size > 0) {
        recordLeft = true;
        return skip(one, "changed", "its items changed since: left as it is");
      }
      const before = kept?.record;
      const revision = ++this.revision;
      if (!step.after) this.kept.delete(plan.database);
      else if (kept) {
        kept.record = step.after;
        kept.recordRevision = revision;
      } else {
        const made = this.newDatabase(step.after, revision);
        madeNow = made.incarnation;
      }
      this.keep(written, one, { step, before, revision });
    };
    leading.forEach(writeRecord);
    // The items that may be written, then those of them whose names would clash with an item's as the store is now
    const ready = items.filter(({ one, step }) => {
      const kept = this.kept.get(plan.database);
      if (step.withRecord && recordLeft) skip(one, "changed", `its database ${changed}`);
      else if (!kept) skip(one, "missing", `no database "${plan.database}"`);
      else if ((step.incarnation ?? madeNow) !== kept.incarnation) skip(one, "missing", ANOTHER_DATABASE);
      else if (step.record !== undefined && kept.recordRevision !== step.record) skip(one, "changed", `its database ${changed}`);
      else if (step.item !== undefined && kept.itemRevisions.get(step.item) !== step.expects) skip(one, "changed", changed);
      else return true;
      return false;
    });
    for (const { one, step } of this.withoutClashes(plan.database, ready, skip)) {
      const kept = this.kept.get(plan.database)!;
      // An item made gets its key now (or, made again by an undo, the key it had)
      const key = step.item ?? this.newKey();
      const before = kept.items.get(key);
      const revision = ++this.revision;
      if (step.after) kept.items.set(key, { ...step.after, key });
      else kept.items.delete(key);
      kept.itemRevisions.set(key, revision);
      if (step.ref !== undefined) created.set(step.ref, key);
      this.keep(written, one, { step, before, revision, key, incarnation: kept.incarnation });
    }
    trailing.forEach(writeRecord);
    return { database: plan.database, written, skipped, created, ...(plan.undoes ? { undoes: plan.undoes } : {}) };
  }

  async planUndo(report: TransactionReport): Promise<TransactionPlan> {
    const items: Planned[] = [];
    const skipped: Skipped[] = [];
    const kept = this.kept.get(report.database);
    let record: { readonly one: Planned; readonly was: Written } | undefined;
    for (const one of report.written) {
      const was = this.written.get(one);
      if (was?.step.kind === "record" && was.step.database === report.database) record = { one, was };
    }
    // The database made again by this undo (it was taken away): its items go into that making
    const remade = !kept && !!record && record.was.before !== undefined;
    // The items this undo takes away (made by the transaction undone), and those it gives a state back
    const goes = new Set<ItemKey>();
    const back: ItemPlan[] = [];
    for (const one of report.written) {
      const was = this.written.get(one);
      if (!was || was.step.database !== report.database) {
        skipped.push({ target: one.target, cause: "refused", reason: "not written by this store: left as it is" });
        continue;
      }
      if (was.step.kind === "record") continue;
      const key = was.key!;
      if (kept ? kept.incarnation !== was.incarnation : !remade) {
        skipped.push({ target: { item: key }, cause: "missing", reason: ANOTHER_DATABASE });
        continue;
      }
      // As written: an item taken away still gone (its database maybe with it), any other at the revision it was left at
      const asWritten = was.step.after === undefined ? !kept?.items.has(key) : kept?.itemRevisions.get(key) === was.revision;
      if (!asWritten) {
        skipped.push({ target: { item: key }, cause: "changed", reason: CHANGED_WRITTEN });
        continue;
      }
      const before = was.before as Kept | undefined;
      if (!before) goes.add(key);
      back.push({ target: { item: key }, key, count: one.changes, after: before, named: !!before && before.name !== (was.step.after as Kept | undefined)?.name });
    }
    // A name given back that another item took since: refused, as a rename would be
    const names = takenNames(kept, back);
    for (const item of back) {
      if (item.named && item.after && names.get(item.after.name)! > 1) {
        skipped.push({ target: item.target, cause: "refused", reason: `an item named "${item.after.name}" exists already` });
        continue;
      }
      this.add(items, item.target, item.count, {
        kind: "item",
        database: report.database,
        incarnation: kept?.incarnation,
        item: item.key,
        expects: kept?.itemRevisions.get(item.key!),
        after: item.after,
        withRecord: remade,
      });
    }
    const planned = [...items];
    if (record) {
      const { one, was } = record;
      const before = was.before as DatabaseRecord | undefined;
      // The record as written (one the transaction took away: none now)
      const asWritten = was.step.after === undefined ? kept === undefined : kept?.recordRevision === was.revision;
      // A database taken away again only with nothing of it left once the items go back (an item changed since stays, and so does it)
      const leftBehind = before === undefined && [...(kept?.items.keys() ?? [])].some((key) => !goes.has(key));
      if (!asWritten) skipped.push({ target: one.target, cause: "changed", reason: CHANGED_WRITTEN });
      else if (leftBehind) skipped.push({ target: one.target, cause: "changed", reason: "its items changed since: left as it is" });
      else {
        const undo: Planned = { target: one.target, changes: one.changes };
        this.steps.set(undo, { kind: "record", database: report.database, expects: kept?.recordRevision, after: before });
        // A database made again goes before its items, one taken away after them
        if (before) planned.unshift(undo);
        else planned.push(undo);
      }
    }
    return { database: report.database, planned, skipped, undoes: report };
  }

  async format(id: string): Promise<FormatStatus> {
    return { version: this.kept.get(id)?.record.version ?? MEMORY_FORMAT, latest: MEMORY_FORMAT };
  }

  async planMigration(scope: MigrationScope): Promise<readonly TransactionPlan[]> {
    // (No documents here but the databases' own: a document's scope holds none)
    const ids = "database" in scope ? [scope.database] : "space" in scope ? [...this.kept.keys()] : [];
    return ids.flatMap((id) => {
      const kept = this.kept.get(id);
      if (!kept || kept.record.version >= MEMORY_FORMAT) return [];
      const planned: Planned[] = [];
      this.add(planned, { database: id }, 1, { kind: "record", database: id, expects: kept.recordRevision, after: { ...kept.record, version: MEMORY_FORMAT } });
      return [{ database: id, planned, skipped: [] }];
    });
  }

  onChanged(listener: (change: { readonly database: string }) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  validatePropertyKey(): string | undefined {
    return undefined;
  }

  validateItemName(name: string): string | undefined {
    return name.trim() === "" ? "an item needs a name" : undefined;
  }

  documentOf(): string | undefined {
    return undefined;
  }

  /** An item changed outside the core (what a page edited by hand is to the pages store): written at once, told to the listeners */
  changeOutside(database: string, item: ItemKey, change: OutsideChange): void {
    const kept = this.kept.get(database);
    const now = kept?.items.get(item);
    if (!kept || !now) throw new Error(`no item ${item} in ${database}`);
    if (change.removed) kept.items.delete(item);
    else kept.items.set(item, { ...now, name: change.name ?? now.name, values: { ...now.values, ...change.values } });
    kept.itemRevisions.set(item, ++this.revision);
    for (const listener of this.listeners) listener({ database });
  }

  /** Why a whole transaction cannot be planned (none of it), undefined where it can */
  private validateTransaction(changes: Changes, kept: KeptDatabase | undefined): { readonly cause: SkipCause; readonly reason: string } | undefined {
    const creates = changes.changes.findIndex((change) => change.kind === "createDatabase");
    if (creates > 0 || changes.changes.filter((change) => change.kind === "createDatabase").length > 1) return { cause: "refused", reason: "a database is made by a transaction's first change, once" };
    const refs = changes.changes.flatMap((change) => (change.kind === "createItem" ? [change.ref] : []));
    if (new Set(refs).size !== refs.length) return { cause: "refused", reason: "an item made twice under one ref" };
    if (creates === 0 && kept) return { cause: "refused", reason: `a database "${changes.database}" exists already` };
    if (creates < 0 && !kept) return { cause: "missing", reason: `no database "${changes.database}"` };
    if (kept && kept.record.version !== MEMORY_FORMAT) return { cause: "format", reason: this.formatReason(kept.record.version) };
    if (kept && changes.expects?.database !== undefined && changes.expects.database !== String(kept.recordRevision)) return { cause: "changed", reason: `its database ${CHANGED_READ}` };
    return undefined;
  }

  /** The database's record as the transaction leaves it, and its step where it changes it; or why its changes are left */
  private planRecord(changes: Changes, kept: KeptDatabase | undefined): { readonly record: DatabaseRecord; readonly step?: RecordStep; readonly count: number } | { readonly skipped: Skipped } {
    const list = changes.changes.filter((change) => change.kind === "createDatabase" || change.kind === "renameDatabase" || change.kind === "setSchema");
    let record = kept?.record;
    for (const change of list) {
      if (change.kind === "createDatabase") record = { database: { id: changes.database, name: change.name, properties: [] }, version: MEMORY_FORMAT };
      else if (change.kind === "renameDatabase") record = { ...record!, database: { ...record!.database, name: change.name } };
      else record = { ...record!, database: { ...record!.database, properties: change.properties } };
    }
    if (!list.length) return { record: record!, count: 0 };
    const problem = record!.database.name.trim() === "" ? "a database needs a name" : this.validateSchema(record!.database.properties);
    if (problem) return { skipped: { target: { database: changes.database }, cause: "refused", reason: problem } };
    return { record: record!, step: { kind: "record", database: changes.database, expects: kept?.recordRevision, after: record }, count: list.length };
  }

  /** Why a schema cannot be kept: a key the model or this store refuses, a key twice; undefined where it can */
  private validateSchema(properties: readonly Property[]): string | undefined {
    const seen = new Set<string>();
    for (const { key } of properties) {
      const problem = validatePropertyKey(key) ?? this.validatePropertyKey();
      if (problem) return problem;
      if (seen.has(key)) return `the key "${key}" twice`;
      seen.add(key);
    }
    return undefined;
  }

  /** One item's changes applied in turn: what they leave, how many changed; nothing where none does; or why they are left */
  private planItem(group: ItemGroup, kept: KeptDatabase | undefined, keys: ReadonlySet<string>, changes: Changes): ItemPlan | Skipped | undefined {
    const { target, key, created } = group;
    const skip = (cause: SkipCause, reason: string): Skipped => ({ target, cause, reason });
    let item: Kept | undefined = created ? { key: "" as ItemKey, name: created.name, values: created.values, rank: created.rank, ...(created.body === undefined ? {} : { body: created.body }) } : kept?.items.get(key!);
    if (!item) return skip("missing", "no such item");
    const expected = key && changes.expects?.items?.[key];
    if (expected !== undefined && expected !== String(kept!.itemRevisions.get(key!))) return skip("changed", CHANGED_READ);
    let count = created ? 1 : 0;
    let named = !!created;
    if (created) {
      const problem = this.validateItemName(created.name) ?? Object.keys(created.values).map((one) => validateValueKey(one, keys, true)).find(Boolean);
      if (problem) return skip("refused", problem);
    }
    for (const change of group.changes) {
      if (!item) return skip("refused", "a change after the item is removed in the same transaction");
      const problem = change.kind === "setValue" ? validateValueKey(change.key, keys, change.value !== undefined) : change.kind === "renameItem" ? this.validateItemName(change.name) : undefined;
      if (problem) return skip("refused", problem);
      const next = changedItem(item, change);
      if (next === item) continue;
      if (change.kind === "renameItem") named = true;
      item = next;
      count++;
    }
    return count ? { target, key, ...(created ? { ref: created.ref } : {}), count, after: item, named } : undefined;
  }

  /**
   * The items that may be written without two items of one name, against the
   * store as it is now (another transaction may have taken a name since this
   * one was planned): an item that would take a name another keeps is left,
   * until none is (one left keeps its name, which another may have taken).
   */
  private withoutClashes(database: string, ready: { one: Planned; step: ItemStep }[], skip: (one: Planned, cause: SkipCause, reason: string) => void): { one: Planned; step: ItemStep }[] {
    const kept = this.kept.get(database);
    let left = ready;
    for (;;) {
      const names = takenNames(
        kept,
        left.map(({ step }) => ({ target: { database }, key: step.item, ...(step.ref === undefined ? {} : { ref: step.ref }), count: 0, after: step.after, named: false })),
      );
      const clashing = left.filter(({ step }) => step.after && names.get(step.after.name)! > 1 && (step.item === undefined || kept?.items.get(step.item)?.name !== step.after.name));
      if (!clashing.length) return left;
      for (const { one, step } of clashing) skip(one, "refused", `an item named "${step.after!.name}" exists already`);
      left = left.filter((one) => !clashing.includes(one));
    }
  }

  private add(planned: Planned[], target: Target, changes: number, step: Step): void {
    const one: Planned = { target, changes };
    this.steps.set(one, step);
    planned.push(one);
  }

  private keep(written: Planned[], one: Planned, was: Written): void {
    this.written.set(one, was);
    this.applied.add(one);
    written.push(one);
  }

  private newDatabase(record: DatabaseRecord, revision = ++this.revision): KeptDatabase {
    const kept: KeptDatabase = { record, recordRevision: revision, incarnation: ++this.incarnations, items: new Map(), itemRevisions: new Map() };
    this.kept.set(record.database.id, kept);
    return kept;
  }

  private newKey(): ItemKey {
    return `item-${++this.made}` as ItemKey;
  }

  private formatReason(version: number): string {
    return version < MEMORY_FORMAT ? `kept in an older format (version ${version}): migrate it first` : `kept in a newer format (version ${version}) than this store writes: read only`;
  }
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

/** An item as one change leaves it (the same object where nothing changes; undefined: removed) */
function changedItem(item: Kept, change: DatabaseChange): Kept | undefined {
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

/** How many items take each name once these item plans are written (the others' as kept) */
function takenNames(kept: KeptDatabase | undefined, items: readonly Pick<ItemPlan, "key" | "ref" | "after">[]): Map<string, number> {
  const after = new Map<string, string | undefined>([...(kept?.items ?? [])].map(([key, item]) => [`item:${key}`, item.name]));
  for (const item of items) after.set(item.key ? `item:${item.key}` : `ref:${item.ref}`, item.after?.name);
  const names = new Map<string, number>();
  for (const name of after.values()) if (name !== undefined) names.set(name, (names.get(name) ?? 0) + 1);
  return names;
}

/** Every part a transaction is about, in the order first named (what is left where all of it is) */
function targetsOf(changes: Changes): Target[] {
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
