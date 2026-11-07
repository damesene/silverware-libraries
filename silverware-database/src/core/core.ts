// The core's writing: every change of a database one call here, one
// transaction of the store, kept for Undo; never a view or a module writing
// anything itself (docs/silverware-database.md, *The core*). A change of one
// item is written at once; one over many items (a property's key or type
// changed, its values removed) is a proposal: planned, nothing written, for
// the caller to show and have the user agree to, then to `apply`. What is
// refused, or left by the store, is said to the user here, so no view has to.
//
// Nothing is lost by mistake (*Decided* 27): a change made from an item read
// is written only where the item is still so, removing items is asked first,
// a value that does not read as a property's new type is kept as read, a key
// that items still hold values under (a property removed) is not taken over,
// and every transaction is undone by `undo`.
import type { UserInterface } from "../../../shared/platform.ts";
import { inRankOrder, isRank, placeAt } from "../domain/rank.ts";
import type { TypeRegistry } from "../domain/types/registry.ts";
import { keptText } from "../domain/types/type.ts";
import { type Database, type Item, type ItemKey, isEmpty, isValue, NAME_KEY, type Params, type Property, type Revised, validatePropertyKey, type Value } from "../model/database.ts";
import { databaseChanges, type DatabaseChangesBuilder } from "./builder.ts";
import type { Changes } from "./changes.ts";
import { TransactionHistory } from "./history.ts";
import type { DatabaseStore, Skipped, Target, TransactionPlan, TransactionReport } from "./store.ts";

/** What the core asks of the user: told what was refused or left, asked before anything is removed */
export type CoreInterface = Pick<UserInterface, "notify"> & Required<Pick<UserInterface, "ask">>;

/** Something written (the report says what was left besides) */
export type Written = { readonly report: TransactionReport };

/**
 * Why nothing was written: `invalid` (the core refused it, said to the user),
 * `left` (the store left every part: changed since read, its report given,
 * said to the user), `declined` (the user said no), `unchanged` (nothing to
 * do: the same name); the last two said to no one
 */
export type RefusedCause = "invalid" | "left" | "declined" | "unchanged";

export type Refused = { readonly problem: string; readonly cause: RefusedCause; readonly report?: TransactionReport };

export type Result = Written | Refused;

/** Whether a call wrote nothing, and why (its `cause`) */
export function isRefused(result: Result): result is Refused {
  return "problem" in result;
}

/**
 * A change over many items, planned, nothing written: the caller shows it
 * and has the user agree, then gives it to `apply`. `unreadable`: items whose
 * values do not read as the property's new type, kept as they are (shown
 * invalid), never emptied.
 */
export type Proposal = {
  readonly label: string;
  readonly plan: TransactionPlan;
  readonly unreadable?: readonly ItemKey[];
  // Written whole or not at all, proposed against the items at this revision: a key changed in part would leave items' values under the old key, out of every view
  readonly whole?: { readonly items: string };
};

/** An item as one is added: its name (none: a free *Untitled*), values, body */
export type ItemDraft = { readonly name?: string; readonly values?: Readonly<Record<string, Value>>; readonly body?: string };

/** A property as one is added: its key made from its label where not given (one given may take back values items kept under it) */
export type NewProperty = { readonly label: string; readonly type: string; readonly key?: string; readonly params?: Params; readonly readonly?: boolean };

/**
 * Where an item goes in the order by hand: right after `after`, else right
 * before `before` (items of the same database, as a view shows them, filtered
 * or not), else after the ranked items (those without a rank, made outside the
 * core, stay after them: adding one never writes them all); with values set
 * there (a kanban column's; undefined: taken off, the column of none)
 */
export type Place = { readonly after?: Item; readonly before?: Item; readonly values?: Readonly<Record<string, Value | undefined>> };

const UNTITLED = "Untitled";

/** What is refused where a write is given something that is no value (a view's mistake: an object, NaN, a list of numbers) */
const notValue = (label: string) => `${label}: not a value (a text, a number, true or false, a list of texts): not written`;

export class DatabaseCore {
  readonly history: TransactionHistory;

  constructor(
    private readonly store: DatabaseStore,
    private readonly types: TypeRegistry,
    private readonly ui: CoreInterface,
  ) {
    this.history = new TransactionHistory(store);
  }

  // Items

  /** A property's value of an item as read (undefined: taken off the item) */
  async update(database: string, item: Item, key: string, value: Value | undefined): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = writable(read.value, key);
    if (typeof property === "string") return this.refuse(property);
    if (value !== undefined && !isValue(value)) return this.refuse(notValue(property.label));
    const changes = databaseChanges(database).item(item, (i) => (value === undefined ? i.unset(key) : i.set(key, value)));
    return this.write(changes.build(), `Set ${property.label} of ${item.name}`);
  }

  /** An item made, at `place` (by default the end of the order); its key given back */
  async create(database: string, draft: ItemDraft = {}, place: Place = {}): Promise<(Written & { readonly key: ItemKey | undefined }) | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    // (A value the place takes off is none of the item's: made without it)
    const values = Object.fromEntries(Object.entries({ ...draft.values, ...place.values }).filter((entry): entry is [string, Value] => entry[1] !== undefined));
    for (const [key, value] of Object.entries(values)) {
      const property = writable(read.database.value, key);
      if (typeof property === "string") return this.refuse(property);
      if (!isValue(value)) return this.refuse(notValue(property.label));
    }
    const names = new Set(read.items.value.map((one) => one.name));
    const name = draft.name?.trim() || freeName(UNTITLED, names);
    const problem = this.validateName(name, names);
    if (problem) return this.refuse(problem);
    const placing = placed(read.items.value, undefined, place);
    if (typeof placing === "string") return this.refuse(placing);
    const changes = databaseChanges(database).create({ ref: "item", name, values, rank: placing.rank, ...(draft.body === undefined ? {} : { body: draft.body }) });
    rankOthers(changes, read.items.value, placing.others);
    const result = await this.write(changes.build(), `Add ${name}`, { ref: "item" });
    return "problem" in result ? result : { ...result, key: result.report.created.get("item") };
  }

  /** An item's name (refused where empty, taken, or what the store cannot keep) */
  async rename(database: string, item: Item, name: string): Promise<Result> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const trimmed = name.trim();
    if (trimmed === item.name) return unchanged("The name is the same");
    const problem = this.validateName(trimmed, new Set(read.items.value.filter((one) => one.key !== item.key).map((one) => one.name)));
    if (problem) return this.refuse(problem);
    return this.write(databaseChanges(database).item(item, (i) => i.rename(trimmed)).build(), `Rename ${item.name} to ${trimmed}`);
  }

  /** An item's body (its content in the markdown language), written only where it is still `was` as read (`store.body`): a body changed since is left, never written over */
  async setBody(database: string, item: Item, body: string, was: string | undefined): Promise<Result> {
    if (!this.store.capabilities.itemBody) return this.refuse("This database keeps no body of an item");
    if (body === (was ?? "")) return unchanged("The body is the same");
    return this.write(databaseChanges(database).item(item, (i) => i.body(body, was)).build(), `Edit the body of ${item.name}`);
  }

  /** Items removed, the user asked first (an item changed since it was read is left) */
  async remove(database: string, items: readonly Item[]): Promise<Result> {
    if (!items.length) return unchanged("Nothing to remove");
    const what = items.length === 1 ? `"${items[0]!.name}"` : `${items.length} items`;
    if (!(await this.ui.ask(`Remove ${what}? Undo brings ${items.length === 1 ? "it" : "them"} back.`, { destructive: true }))) return { problem: "Not removed", cause: "declined" };
    const changes = databaseChanges(database);
    for (const item of items) changes.item(item, (i) => i.remove());
    return this.write(changes.build(), `Remove ${what}`);
  }

  /**
   * An item moved in the order by hand, with values set where it goes; only
   * it is written, but where its neighbours' ranks do not allow its place
   * (typed by hand, missing): those get ranks in the same transaction,
   * keeping the order shown
   */
  async move(database: string, item: Item, place: Place): Promise<Result> {
    if (place.after?.key === item.key || place.before?.key === item.key) return unchanged("An item stays beside itself");
    const read = await this.read(database);
    if ("problem" in read) return read;
    for (const [key, value] of Object.entries(place.values ?? {})) {
      const property = writable(read.database.value, key);
      if (typeof property === "string") return this.refuse(property);
      if (value !== undefined && !isValue(value)) return this.refuse(notValue(property.label));
    }
    const placing = placed(read.items.value, item, place);
    if (typeof placing === "string") return this.refuse(placing);
    const changes = databaseChanges(database).item(item, (i) => {
      i.rank(placing.rank);
      for (const [key, value] of Object.entries(place.values ?? {})) {
        if (value === undefined) i.unset(key);
        else i.set(key, value);
      }
    });
    rankOthers(changes, read.items.value, placing.others);
    return this.write(changes.build(), `Move ${item.name}`, { item: item.key });
  }

  // Databases

  /** A database made, its id from its name (unique among the store's), with its properties */
  async createDatabase(name: string, properties: readonly NewProperty[] = []): Promise<(Written & { readonly id: string }) | Refused> {
    const trimmed = name.trim();
    if (!trimmed) return this.refuse("A database needs a name");
    const id = freeName(slug(trimmed, "-") || "database", new Set((await this.store.databases()).map((one) => one.id)), "-");
    const schema: Property[] = [];
    for (const one of properties) {
      const property = this.newProperty(one, schema, []);
      if (typeof property === "string") return this.refuse(property);
      schema.push(property);
    }
    const result = await this.write(databaseChanges(id).createDatabase(trimmed).schema(schema).build(), `Add database ${trimmed}`);
    return "problem" in result ? result : { ...result, id };
  }

  async renameDatabase(database: string, name: string): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const trimmed = name.trim();
    if (!trimmed) return this.refuse("A database needs a name");
    if (trimmed === read.value.name) return unchanged("The name is the same");
    return this.write(databaseChanges(database).expectDatabase(read.revision).rename(trimmed).build(), `Rename database ${read.value.name} to ${trimmed}`);
  }

  // The schema

  /** A property added at the end, its key made from its label where not given */
  async addProperty(database: string, property: NewProperty): Promise<Result> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const made = this.newProperty(property, read.database.value.properties, read.items.value);
    if (typeof made === "string") return this.refuse(made);
    return this.writeSchema(read.database, [...read.database.value.properties, made], `Add property ${made.label}`);
  }

  /** A property's label (its key, which items keep, stays) */
  async renameProperty(database: string, key: string, label: string): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = read.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    const trimmed = label.trim();
    if (!trimmed) return this.refuse("A property needs a label");
    if (trimmed === property.label) return unchanged("The label is the same");
    return this.writeSchema(read, read.value.properties.map((one) => (one.key === key ? { ...one, label: trimmed } : one)), `Rename property ${property.label} to ${trimmed}`);
  }

  /** A property read only (no view offers to change it, the core refuses to) or not: the schema alone */
  async setPropertyReadonly(database: string, key: string, readonly: boolean): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = read.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (property.readonly === readonly) return unchanged("It is so already");
    return this.writeSchema(read, read.value.properties.map((one) => (one.key === key ? { ...one, readonly } : one)), `${readonly ? "Lock" : "Unlock"} property ${property.label}`);
  }

  /** A property moved to `index` among the properties (its order as views show them): the schema alone */
  async moveProperty(database: string, key: string, index: number): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const properties = [...read.value.properties];
    const at = properties.findIndex((one) => one.key === key);
    if (at < 0) return this.refuse(`No property "${key}"`);
    const to = Math.max(0, Math.min(properties.length - 1, index));
    if (to === at) return unchanged("It is there already");
    const [moved] = properties.splice(at, 1);
    properties.splice(to, 0, moved!);
    return this.writeSchema(read, properties, `Move property ${moved!.label}`);
  }

  /** A property's key changed, every item's value moved to it: a proposal; refused where items still keep values under the new key */
  async rekeyProperty(database: string, key: string, newKey: string): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (newKey === key) return unchanged("The key is the same");
    const problem = this.validateKey(newKey, read.database.value.properties) ?? validateKeptValues(newKey, read.items.value);
    if (problem) return this.refuse(problem);
    const changes = databaseChanges(database).expectDatabase(read.database.revision).schema(read.database.value.properties.map((one) => (one.key === key ? { ...one, key: newKey } : one)));
    for (const item of read.items.value) {
      const value = item.values[key];
      if (value !== undefined) changes.item(item, (i) => i.set(newKey, value).unset(key));
    }
    return { ...(await this.propose(changes.build(), `Change the key of ${property.label} to ${newKey}`)), whole: { items: read.items.revision } };
  }

  /**
   * A property's type changed, with its params (left out: those it has, where
   * the new type takes them, else none): a proposal. A value that does not
   * read as the new type is read from its text where it can be (text "3" as
   * a number), else kept as it is and listed as `unreadable`.
   */
  async retypeProperty(database: string, key: string, type: string, params?: Params): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    const newType = this.types.named(type);
    if (!newType) return this.refuse(`No property type "${type}"`);
    const kept = params ?? (newType.validateParams?.(property.params) === undefined ? property.params : {});
    const problem = newType.validateParams?.(kept);
    if (problem) return this.refuse(`${property.label}: ${problem}`);
    if (type === property.type && JSON.stringify(kept) === JSON.stringify(property.params)) return unchanged("The type is the same");
    const changes = databaseChanges(database).expectDatabase(read.database.revision).schema(read.database.value.properties.map((one) => (one.key === key ? { ...one, type, params: kept } : one)));
    const unreadable: ItemKey[] = [];
    for (const item of read.items.value) {
      const value = item.values[key];
      if (value === undefined || isEmpty(value) || newType.validate(value, kept) === undefined) continue;
      const parsed = newType.parse(keptText(value), kept);
      if ("value" in parsed && newType.validate(parsed.value, kept) === undefined) changes.item(item, (i) => i.set(key, parsed.value));
      else unreadable.push(item.key);
    }
    return { ...(await this.propose(changes.build(), `Change the type of ${property.label} to ${newType.label}`)), unreadable };
  }

  /** A property removed from the schema (its values stay in the items unless `values`, then taken off them too): a proposal */
  async removeProperty(database: string, key: string, options: { readonly values: boolean }): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    const changes = databaseChanges(database).expectDatabase(read.database.revision).schema(read.database.value.properties.filter((one) => one.key !== key));
    if (options.values) for (const item of read.items.value) if (item.values[key] !== undefined) changes.item(item, (i) => i.unset(key));
    return this.propose(changes.build(), `Remove property ${property.label}${options.values ? " and its values" : ""}`);
  }

  // Proposals and Undo

  /** A proposal the user agreed to, written where each part is still as planned (one to be written whole: all of it, else none), kept for Undo */
  async apply(proposal: Proposal): Promise<Result> {
    if (proposal.whole && (await this.store.items(proposal.plan.database)).revision !== proposal.whole.items) {
      const problem = `${proposal.label}: its items changed since it was proposed: nothing was written, propose it again`;
      this.ui.notify(problem, { type: "error" });
      return { problem, cause: "left" };
    }
    return this.settle(proposal.label, await this.store.apply(proposal.plan), proposal.whole ? () => true : undefined);
  }

  /**
   * The last transaction (of one database where named) put back where it is
   * still as written; undefined where nothing is to undo. One that cannot be
   * put back at all is said so and goes off the history.
   */
  async undo(database?: string): Promise<Result | undefined> {
    const last = this.history.last(database);
    if (!last) return undefined;
    const report = await this.history.undo(last.report);
    return report && this.outcome(`Undo: ${last.label}`, report);
  }

  /** Changes written at once; `needed`: a part without which none of it stands (the item moved, the item made) */
  private async write(changes: Changes, label: string, needed?: Target): Promise<Result> {
    const { plan } = await this.propose(changes, label);
    return this.settle(label, await this.store.apply(plan), needed && ((one) => JSON.stringify(one.target) === JSON.stringify(needed)));
  }

  /**
   * A report kept for Undo and said; where a part it could not do without was
   * left (`needed`), what it wrote besides (neighbours ranked) is put back at
   * once, and nothing of it stands
   */
  private async settle(label: string, report: TransactionReport, needed?: (skipped: Skipped) => boolean): Promise<Result> {
    this.history.record(report, label);
    if (!needed || !report.skipped.some(needed)) return this.outcome(label, report);
    if (report.written.length) await this.history.undo(report);
    const reasons = [...new Set(report.skipped.map((one) => one.reason))].join("; ");
    const problem = `${label}: nothing was written: ${reasons}`;
    this.ui.notify(problem, { type: "error" });
    return { problem, cause: "left", report };
  }

  private async propose(changes: Changes, label: string): Promise<Proposal> {
    return { label, plan: await this.store.plan(changes) };
  }

  private writeSchema(read: Revised<Database>, properties: readonly Property[], label: string): Promise<Result> {
    return this.write(databaseChanges(read.value.id).expectDatabase(read.revision).schema(properties).build(), label);
  }

  private async read(database: string): Promise<{ readonly database: Revised<Database>; readonly items: Revised<readonly Item[]> } | Refused> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    return { database: read, items: await this.store.items(database) };
  }

  /** A property as added to `properties`, or why it cannot be; a key made from its label is one no item keeps a value under */
  private newProperty(property: NewProperty, properties: readonly Property[], items: readonly Item[]): Property | string {
    const label = property.label.trim();
    if (!label) return "A property needs a label";
    const taken = new Set([...properties.map((one) => one.key), ...items.flatMap((item) => Object.keys(item.values))]);
    const key = property.key ?? freeName(keyFrom(label), taken, "_");
    const problem = this.validateKey(key, properties);
    if (problem) return problem;
    const type = this.types.named(property.type);
    if (!type) return `No property type "${property.type}"`;
    const params = property.params ?? {};
    const paramsProblem = type.validateParams?.(params);
    if (paramsProblem) return `${label}: ${paramsProblem}`;
    return { key, label, type: property.type, params, readonly: property.readonly ?? false };
  }

  private validateKey(key: string, properties: readonly Property[]): string | undefined {
    const problem = validatePropertyKey(key) ?? this.store.validatePropertyKey(key);
    if (problem) return problem;
    return properties.some((one) => one.key === key) ? `A property's key is "${key}" already` : undefined;
  }

  private validateName(name: string, taken: ReadonlySet<string>): string | undefined {
    if (!name) return "An item needs a name";
    const problem = this.store.validateItemName(name);
    if (problem) return problem;
    return taken.has(name) ? `An item named "${name}" exists already` : undefined;
  }

  /** What a report comes to: written (what was left said once), left whole, or nothing to do */
  private outcome(label: string, report: TransactionReport): Result {
    if (!report.written.length && !report.skipped.length) return unchanged("Nothing changed");
    if (report.skipped.length) {
      const reasons = [...new Set(report.skipped.map((one: Skipped) => one.reason))].join("; ");
      const what = !report.written.length ? "nothing was written" : report.skipped.length === 1 ? "one part was not written" : `${report.skipped.length} parts were not written`;
      this.ui.notify(`${label}: ${what}: ${reasons}`, { type: "error" });
    }
    return report.written.length ? { report } : { problem: `${label}: nothing was written`, cause: "left", report };
  }

  private refuse(problem: string): Refused {
    this.ui.notify(problem, { type: "error" });
    return { problem, cause: "invalid" };
  }
}

function unchanged(problem: string): Refused {
  return { problem, cause: "unchanged" };
}

/** A property that may be written, or why not: the name has its own call, a property read only is the core's to refuse */
function writable(database: Database, key: string): Property | string {
  if (key === NAME_KEY) return "An item's name is changed by renaming it";
  const property = database.properties.find((one) => one.key === key);
  if (!property) return `No property "${key}"`;
  return property.readonly ? `${property.label} is read only` : property;
}

/** Why a key cannot take a property's values: items keep values under it (a property removed, its values kept), which would be written over */
function validateKeptValues(key: string, items: readonly Item[]): string | undefined {
  const holding = items.filter((item) => item.values[key] !== undefined);
  if (!holding.length) return undefined;
  return `${holding.length === 1 ? "An item keeps" : `${holding.length} items keep`} values under "${key}" (a property removed): add it back, or remove those values first`;
}

/** The ranks of an item at `place` among `items` (the item itself left out, where it is one of them), or why the place is not there */
function placed(items: readonly Item[], item: Item | undefined, place: Place): ReturnType<typeof placeAt> | string {
  const ordered = inRankOrder(items.filter((one) => one.key !== item?.key));
  const at = (neighbour: Item) => ordered.findIndex((one) => one.key === neighbour.key);
  // The end of the ranked items: those without a rank stay after, unwritten
  let index = ordered.findIndex((one) => !isRank(one.rank));
  if (index < 0) index = ordered.length;
  if (place.after) index = at(place.after) + 1;
  else if (place.before) index = at(place.before);
  if (index < 0 || (place.after && index === 0)) return "The item it was placed beside is gone";
  return placeAt(ordered, index);
}

/** The ranks other items need for a place: each item as read now, written only where still so */
function rankOthers(changes: DatabaseChangesBuilder, items: readonly Item[], others: ReadonlyMap<ItemKey, string>): void {
  for (const item of items) {
    const rank = others.get(item.key);
    if (rank !== undefined) changes.item(item, (i) => i.rank(rank));
  }
}

/** A text made a slug: ASCII letters and digits, lower case, the rest one separator */
function slug(text: string, separator: string): string {
  const parts = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return parts.join(separator);
}

/** A property's key from its label: `Due date` → `due_date`, starting with a letter */
function keyFrom(label: string): string {
  const key = slug(label, "_");
  if (!key) return "property";
  return /^[a-z]/.test(key) ? key : `p_${key}`;
}

/** A name none of `taken` is: the name, else with 2, 3… after it */
function freeName(name: string, taken: ReadonlySet<string>, separator = " "): string {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) if (!taken.has(`${name}${separator}${n}`)) return `${name}${separator}${n}`;
}
