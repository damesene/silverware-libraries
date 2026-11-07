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
// anything may have been written between the two. What a transaction comes
// to is transaction.ts', the same for every store.
import type { Changes } from "../core/changes.ts";
import type { DatabaseStore, FormatStatus, MigrationScope, Planned, SkipCause, Skipped, StoreCapabilities, Target, TransactionPlan, TransactionReport } from "../core/store.ts";
import type { Database, DatabaseSummary, Item, ItemKey, Revised, Value } from "../model/database.ts";
import { draftTransaction, type ItemState, type RecordState, type StoreRules, type StoreState, takenNames, withoutClashes } from "./transaction.ts";

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

type KeptDatabase = {
  record: RecordState;
  recordRevision: number;
  // Which making of the database of this id it is: one removed and made again is another, which no part planned for the first touches
  readonly incarnation: number;
  readonly items: Map<ItemKey, ItemState>;
  readonly itemRevisions: Map<ItemKey, number>;
};

// What a planned part writes: its database (and which making of it: none where this plan makes it), the revision it expects (none: it is made), the state it leaves
type RecordStep = { readonly kind: "record"; readonly database: string; readonly expects: number | undefined; readonly after: RecordState | undefined };
type ItemStep = {
  readonly kind: "item";
  readonly database: string;
  readonly incarnation: number | undefined;
  readonly item: ItemKey | undefined;
  readonly ref?: string;
  readonly expects: number | undefined;
  readonly after: ItemState | undefined;
  // Planned against the record's part of the same plan: written only with it
  readonly withRecord: boolean;
  // The record's revision the transaction was made from (`expects.database`)
  readonly record?: number;
};
type Step = RecordStep | ItemStep;

// What a written part was and became, for its undo
type Written = { readonly step: Step; readonly before: RecordState | ItemState | undefined; readonly revision: number; readonly key?: ItemKey; readonly incarnation?: number };

// An item an undo gives back: where, what it leaves, whether its name changes
type Back = { readonly target: Target; readonly key: ItemKey; readonly count: number; readonly after: ItemState | undefined; readonly named: boolean };

const CHANGED_READ = "changed since it was read: left alone";
const CHANGED_WRITTEN = "changed since it was written: left as it is";
const ANOTHER_DATABASE = "its database was removed and made again since: left alone";

const asNumber = (revision: string | undefined) => (revision === undefined ? undefined : Number(revision));

export class MemoryStore implements DatabaseStore {
  readonly capabilities: StoreCapabilities = { renameFollowsLinks: false, itemBody: true };
  private readonly kept = new Map<string, KeptDatabase>();
  private readonly listeners = new Set<(change: { readonly database: string }) => void>();
  private readonly steps = new WeakMap<Planned, Step>();
  private readonly written = new WeakMap<Planned, Written>();
  // Parts applied once: a plan applied again writes none of them anew (an item made twice)
  private readonly applied = new WeakSet<Planned>();
  private readonly rules: StoreRules = {
    latestFormat: MEMORY_FORMAT,
    validatePropertyKey: () => this.validatePropertyKey(),
    validateItemName: (name) => this.validateItemName(name),
    nameKey: (name) => name,
  };
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

  async body(id: string, item: ItemKey): Promise<string | undefined> {
    return this.kept.get(id)?.items.get(item)?.body;
  }

  async plan(changes: Changes): Promise<TransactionPlan> {
    const { database: id } = changes;
    const kept = this.kept.get(id);
    const draft = draftTransaction(this.state(kept), changes, this.rules);
    const planned: Planned[] = [];
    if (draft.record) this.add(planned, { database: id }, draft.record.count, { kind: "record", database: id, expects: asNumber(draft.record.expects), after: draft.record.after });
    for (const item of draft.items) {
      this.add(planned, item.target, item.count, {
        kind: "item",
        database: id,
        incarnation: kept?.incarnation,
        item: item.key,
        ...(item.ref === undefined ? {} : { ref: item.ref }),
        expects: asNumber(item.expects),
        after: item.after,
        withRecord: !!draft.record,
        ...(draft.recordRead === undefined ? {} : { record: Number(draft.recordRead) }),
      });
    }
    return { database: id, planned, skipped: draft.skipped };
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
      } else madeNow = this.newDatabase(step.after, revision).incarnation;
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
    const now = this.kept.get(plan.database)?.items ?? new Map<ItemKey, ItemState>();
    const parts = ready.map((one) => ({ ...one, part: { key: one.step.item, ref: one.step.ref, after: one.step.after } }));
    for (const { one, step } of withoutClashes(now, parts, this.rules, ({ one: left }, reason) => skip(left, "refused", reason))) {
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
    const back: Back[] = [];
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
      const before = was.before as ItemState | undefined;
      if (!before) goes.add(key);
      back.push({ target: { item: key }, key, count: one.changes, after: before, named: !!before && before.name !== (was.step.after as ItemState | undefined)?.name });
    }
    // A name given back that another item took since: refused, as a rename would be
    const names = takenNames(kept?.items.values() ?? [], back, this.rules);
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
        expects: kept?.itemRevisions.get(item.key),
        after: item.after,
        withRecord: remade,
      });
    }
    const planned = [...items];
    if (record) {
      const { one, was } = record;
      const before = was.before as RecordState | undefined;
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

  /** What the store has of a database, as transaction.ts reads it (revisions as text) */
  private state(kept: KeptDatabase | undefined): StoreState {
    if (!kept) return undefined;
    const items = new Map([...kept.items].map(([key, item]) => [key, { item, revision: String(kept.itemRevisions.get(key)) }]));
    return { record: kept.record, recordRevision: String(kept.recordRevision), items };
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

  private newDatabase(record: RecordState, revision = ++this.revision): KeptDatabase {
    const kept: KeptDatabase = { record, recordRevision: revision, incarnation: ++this.incarnations, items: new Map(), itemRevisions: new Map() };
    this.kept.set(record.database.id, kept);
    return kept;
  }

  private newKey(): ItemKey {
    return `item-${++this.made}` as ItemKey;
  }
}
