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
import { guessedType, optionsOfValues } from "../domain/loose.ts";
import { systemKind } from "../domain/system.ts";
import { sameLook, validateIcon, validateLook } from "../domain/look.ts";
import { DOCUMENT, type Noun } from "../domain/noun.ts";
import type { UserInterface } from "../../../shared/platform.ts";
import { inRankOrder, isRank, placeAt } from "../domain/rank.ts";
import type { TypeRegistry } from "../domain/types/registry.ts";
import { optionsOf } from "../domain/types/options.ts";
import { keptText } from "../domain/types/type.ts";
import { type Database, type Item, type ItemKey, type ItemLook, isEmpty, isValue, NAME_KEY, type Params, type Property, type Revised, validatePropertyKey, type Value } from "../model/database.ts";
import { databaseChanges, type DatabaseChangesBuilder } from "./builder.ts";
import type { Changes } from "./changes.ts";
import { TransactionHistory } from "./history.ts";
import { placeStateRenamed } from "./placestate.ts";
import type { DatabaseStore, LooseKey, PlaceChange, PlacesPlan, PlacesReport, PlaceStore, Skipped, Target, TransactionPlan, TransactionReport, WriteProgress } from "./store.ts";

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
  /** Where each item is a document of its own (a page): how many documents it writes, one after another, and whether that is many (it takes a while, not to be stopped) */
  readonly documents?: { readonly count: number; readonly many: boolean };
  /** Options renamed (`retypeProperty`'s `renames`): each with how many items' values it renames */
  readonly renamed?: readonly OptionRenamed[];
  // Written whole or not at all, proposed against the items at this revision: a key changed in part would leave items' values under the old key, out of every view
  readonly whole?: { readonly items: string };
  /** The places whose states change with it (a key changed: those naming it), written after the store's part */
  readonly places?: PlacesPlan;
};

/**
 * The places' states apart from the store (`PlaceStore`) and what of a
 * state names a property beside the place's own: each view's meta keys
 * holding a property's key (`ViewDefinition.propertyMeta`)
 */
export type CorePlaces = { readonly store: PlaceStore; readonly propertyMeta: (view: string) => readonly string[] };

/** A key items keep that the schema has none of, as the core shows it: how many items, a few of their values, the type they look like */
// `options`: its values as a select's options would be (a select or multi-select added of it takes them)
export type LooseProperty = { readonly key: string; readonly items: number; readonly samples: readonly string[]; readonly type: string; readonly options: readonly string[] };

/** An option renamed, and how many items hold it */
export type OptionRenamed = { readonly from: string; readonly to: string; readonly items: number };

/** An item as one is added: its name (none: a free *Untitled*), values, body */
export type ItemDraft = { readonly name?: string; readonly values?: Readonly<Record<string, Value>>; readonly body?: string };

/** A property as one is added: its key made from its label where not given (one given may take back values items kept under it) */
export type NewProperty = { readonly label: string; readonly type: string; readonly key?: string; readonly params?: Params; readonly readonly?: boolean; readonly system?: string };

/**
 * Where an item goes in the order by hand: right after `after`, else right
 * before `before` (items of the same database, as a view shows them, filtered
 * or not), else at the end (those without a rank, made outside the core, ranked
 * where they are first, so it is the last as shown; many of them: after the
 * ranked ones, writing none of them); with values set
 * there (a board column's; undefined: taken off, the column of none)
 */
export type Place = { readonly after?: Item; readonly before?: Item; readonly values?: Readonly<Record<string, Value | undefined>> };

const UNTITLED = "Untitled";

/** From how many documents (pages) a write says it takes a while, not to be stopped: a change shown first, an undo asked first */
const MANY_DOCUMENTS = 200;

/** How many documents a plan writes (each part one, where each item is a document), and whether that is many */
function manyDocuments(plan: TransactionPlan): { readonly count: number; readonly many: boolean } {
  return { count: plan.planned.length, many: plan.planned.length >= MANY_DOCUMENTS };
}

// How many items without a rank an item added at the end ranks in the same write, at most (more: it goes after the ranked ones)
const RANKED_AT_ONCE = 20;

/** Params alike whatever the order of their keys (a map's order is no change) */
function sameParams(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])])) : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** Names a property's settings cannot have: the property's own fields, as a store keeps them beside its settings */
const PROPERTY_FIELDS = new Set(["key", "type", "label", "readonly", "hidden", "required", "showName", "icon", "system"]);

/** Why a property's settings cannot be kept (one named as a field of the property's own), undefined where they can */
function validateParamNames(label: string, params: Params): string | undefined {
  const taken = Object.keys(params).find((name) => PROPERTY_FIELDS.has(name));
  return taken === undefined ? undefined : `${label}: a setting cannot be called "${taken}", the name of a property's own field`;
}

/** The items' own revisions (not what the system gives them, a date that moves): what a proposal written whole is checked against */
const itemsRevision = (items: readonly Item[]) => items.map((one) => `${one.key}:${one.revision}`).join(",");

/** What is refused for a system property's values, type, key and settings: the system gives them */
const systemProperty = (property: Property) => `${property.label} is given by the system: its values, type, key and settings are not changed`;

/** What is refused where a write is given something that is no value (a view's mistake: an object, NaN, a list of numbers) */
const notValue = (label: string) => `${label}: not a value (a text, a number, true or false, a list of texts): not written`;

export class DatabaseCore {
  readonly history: TransactionHistory;
  // A proposal or an undo being written (`apply`, `undo`): one at a time, as either may write thousands of pages
  private writing = false;

  constructor(
    private readonly store: DatabaseStore,
    private readonly types: TypeRegistry,
    private readonly ui: CoreInterface,
    /** What the place the items are kept in calls its documents, for what is said to the user */
    readonly noun: Noun = DOCUMENT,
    /** The places' states kept apart (none: a key changed follows in the store alone) */
    private readonly places?: CorePlaces,
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
    if (property.required && (value === undefined || isEmpty(value)) && !isEmpty(item.values[key])) return this.refuse(`${property.label} is required: not emptied`);
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

  /**
   * How an item looks (its icon, its color), the whole of it: what `look`
   * leaves out the item has no more (`{}`: none); refused where it is none
   * (domain/look.ts)
   */
  async setLook(database: string, item: Item, look: ItemLook): Promise<Result> {
    const problem = validateLook(look);
    if (problem) return this.refuse(problem);
    if (sameLook(look, item.look)) return unchanged("The look is the same");
    const what = look.icon === item.look?.icon ? "color" : look.color === item.look?.color ? "icon" : "look";
    return this.write(databaseChanges(database).item(item, (i) => i.look(look)).build(), `Change the ${what} of ${item.name}`, { item: item.key });
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
      // (A card moved to the column of none: a required value is not taken off by it)
      if (property.required && (value === undefined || isEmpty(value)) && !isEmpty(item.values[key])) return this.refuse(`${property.label} is required: not emptied`);
    }
    // No neighbour named (a card dropped in an empty column, on a board sorted): its values alone, its place by hand kept
    const placing = place.after || place.before ? placed(read.items.value, item, place) : undefined;
    if (typeof placing === "string") return this.refuse(placing);
    const changes = databaseChanges(database).item(item, (i) => {
      if (placing) i.rank(placing.rank);
      for (const [key, value] of Object.entries(place.values ?? {})) {
        if (value === undefined) i.unset(key);
        else i.set(key, value);
      }
    });
    if (placing) rankOthers(changes, read.items.value, placing.others);
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
    // (The keys the store keeps apart taken too: a property named so takes no values typed by hand, unless asked by its key)
    const made = this.newProperty(property, read.database.value.properties, read.items.value, (await this.store.looseValues(database)).map((one) => one.key));
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
    if (property.system !== undefined) return this.refuse(systemProperty(property));
    if (property.readonly === readonly) return unchanged("It is so already");
    return this.writeSchema(read, read.value.properties.map((one) => (one.key === key ? { ...one, readonly } : one)), `${readonly ? "Lock" : "Unlock"} property ${property.label}`);
  }

  /** A property required (every item is to have a value: one without shows as missing, none is taken off) or optional: the schema alone */
  async setPropertyRequired(database: string, key: string, required: boolean): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = read.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (property.system !== undefined) return this.refuse(systemProperty(property));
    if ((property.required ?? false) === required) return unchanged("It is so already");
    return this.writeSchema(
      read,
      read.value.properties.map((one) => {
        if (one.key !== key) return one;
        const { required: _was, ...rest } = one;
        return required ? { ...rest, required: true } : rest;
      }),
      `Make property ${property.label} ${required ? "required" : "optional"}`,
    );
  }

  /** A property hidden in the views (its values kept, filtered and sorted by, shown in the peek) or shown: the schema alone */
  async setPropertyHidden(database: string, key: string, hidden: boolean): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = read.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if ((property.hidden ?? false) === hidden) return unchanged("It is so already");
    return this.writeSchema(
      read,
      read.value.properties.map((one) => {
        if (one.key !== key) return one;
        const { hidden: _was, ...rest } = one;
        return hidden ? { ...rest, hidden: true } : rest;
      }),
      `${hidden ? "Hide" : "Show"} property ${property.label}`,
    );
  }

  /** A property's name shown with its value where a value stands alone (a card's line, a list's row), or not: the schema alone */
  async setPropertyShowName(database: string, key: string, shown: boolean): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = read.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if ((property.showName ?? false) === shown) return unchanged("It is so already");
    return this.writeSchema(
      read,
      read.value.properties.map((one) => {
        if (one.key !== key) return one;
        const { showName: _was, ...rest } = one;
        return shown ? { ...rest, showName: true } : rest;
      }),
      `${shown ? "Show" : "Leave out"} the name of ${property.label} with its values`,
    );
  }

  /** A property's own icon (an emoji) where the views name it, or none (undefined: its type's again): the schema alone */
  async setPropertyIcon(database: string, key: string, icon: string | undefined): Promise<Result> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    const property = read.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (icon !== undefined) {
      const problem = validateIcon(icon);
      if (problem) return this.refuse(problem);
    }
    if (property.icon === icon) return unchanged("It is so already");
    return this.writeSchema(
      read,
      read.value.properties.map((one) => {
        if (one.key !== key) return one;
        const { icon: _was, ...rest } = one;
        return icon === undefined ? rest : { ...rest, icon };
      }),
      icon === undefined ? `Take the icon off ${property.label}` : `Give ${property.label} an icon`,
    );
  }

  /**
   * A property's params changed from `was` (the params the caller read and
   * changed) where no item's value reads otherwise for it (a select's colors):
   * the schema alone, written at once. Refused where the params are no longer
   * `was` (changed meanwhile: an option added elsewhere would be lost), and
   * where a value would read otherwise (an option an item has taken away): that
   * is a change of type (`retypeProperty`), shown first.
   */
  async setPropertyParams(database: string, key: string, params: Params, was: Params): Promise<Result> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (property.system !== undefined) return this.refuse(systemProperty(property));
    if (!sameParams(property.params, was)) return this.refuse(`${property.label}: its settings changed meanwhile: not written, shown as they are now`);
    if (sameParams(params, property.params)) return unchanged("The settings are the same");
    const type = this.types.named(property.type);
    if (!type) return this.refuse(`${property.label}: its type "${property.type}" is not defined now`);
    const problem = validateParamNames(property.label, params) ?? (type.validateParams?.(params) === undefined ? undefined : `${property.label}: ${type.validateParams(params)}`);
    if (problem) return this.refuse(problem);
    const reads = (value: Value, at: Params) => type.validate(value, at) === undefined;
    const changed = read.items.value.find((item) => {
      const value = item.values[key];
      return value !== undefined && !isEmpty(value) && reads(value, property.params) !== reads(value, params);
    });
    if (changed) return this.refuse(`${property.label}: "${changed.name}"'s value would read otherwise: change its options through its type`);
    return this.writeSchema(read.database, read.database.value.properties.map((one) => (one.key === key ? { ...one, params } : one)), `Change the settings of ${property.label}`);
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
  async rekeyProperty(database: string, key: string, newKey: string, finding?: WriteProgress): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (property.system !== undefined) return this.refuse(systemProperty(property));
    if (newKey === key) return unchanged("The key is the same");
    const problem = this.validateKey(newKey, read.database.value.properties) ?? validateKeptValues(newKey, read.items.value, await this.store.looseValues(database));
    if (problem) return this.refuse(problem);
    const changes = databaseChanges(database).expectDatabase(read.database.revision).schema(read.database.value.properties.map((one) => (one.key === key ? { ...one, key: newKey } : one)));
    for (const item of read.items.value) {
      const value = item.values[key];
      if (value !== undefined) changes.item(item, (i) => i.set(newKey, value).unset(key));
    }
    const proposal = await this.propose(changes.build(), `Change the key of ${property.label} to ${newKey}`);
    // The places naming the key (a view's filter, sort, grouping, its own meta), found now: written with it, put back with its undo
    const renamed: PlaceChange = (state) => placeStateRenamed(state, key, newKey, this.places!.propertyMeta);
    const places = this.places && (await this.places.store.plan(database, renamed, finding));
    return { ...proposal, whole: { items: itemsRevision(read.items.value) }, ...(places?.documents.length ? { places } : {}) };
  }

  /**
   * A property's type changed, with its params (left out: those it has, where
   * the new type takes them, else none): a proposal. A value that does not
   * read as the new type is read from its text where it can be (text "3" as
   * a number), else kept as it is and listed as `unreadable`.
   *
   * `renames` (an option's old name to its new one, the type the same): the
   * items' values renamed with the options, as Notion does, all at once (two
   * options swapping names swap the values too; a list keeps its order), and
   * written whole or not at all. An option taken away is no rename: its values
   * stay, shown invalid. A rename that would put two options into one (or an
   * option and a value items hold) is refused.
   */
  async retypeProperty(database: string, key: string, type: string, params?: Params, renames?: Readonly<Record<string, string>>): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    if (property.system !== undefined) return this.refuse(systemProperty(property));
    const newType = this.types.named(type);
    if (!newType) return this.refuse(`No property type "${type}"`);
    const kept = params ?? (newType.validateParams?.(property.params) === undefined ? property.params : {});
    const problem = validateParamNames(property.label, kept) ?? (newType.validateParams?.(kept) === undefined ? undefined : `${property.label}: ${newType.validateParams(kept)}`);
    if (problem) return this.refuse(problem);
    const checked = renames && Object.keys(renames).length ? validateRenames(property, type, kept, renames, read.items.value) : undefined;
    if (typeof checked === "string") return this.refuse(`${property.label}: ${checked}`);
    // (Only names alike: no rename)
    const renaming = checked?.size ? checked : undefined;
    // (Options swapped and moved back to their places: the params alike, the values still to swap)
    if (type === property.type && !renaming && JSON.stringify(kept) === JSON.stringify(property.params)) return unchanged("The type is the same");
    const changes = databaseChanges(database).expectDatabase(read.database.revision).schema(read.database.value.properties.map((one) => (one.key === key ? { ...one, type, params: kept } : one)));
    const unreadable: ItemKey[] = [];
    const counts = new Map<string, number>();
    for (const item of read.items.value) {
      const value = item.values[key];
      if (value === undefined || isEmpty(value)) continue;
      if (renaming) {
        const renamed = renamedValue(value, renaming);
        if (renamed) {
          changes.item(item, (i) => i.set(key, renamed.value));
          for (const from of renamed.from) counts.set(from, (counts.get(from) ?? 0) + 1);
          // (Renamed, a part of it still none of the options: one taken away, kept as it was)
          if (newType.validate(renamed.value, kept) !== undefined) unreadable.push(item.key);
          continue;
        }
      }
      if (newType.validate(value, kept) === undefined) continue;
      // (Options renamed: a value that is none of them as it is, text typed by hand, is kept: read again by the new names, it
      // could take an option renamed for the one it meant, a swap's)
      if (renaming) {
        unreadable.push(item.key);
        continue;
      }
      const parsed = newType.parse(keptText(value), kept, value);
      if ("value" in parsed && newType.validate(parsed.value, kept) === undefined) changes.item(item, (i) => i.set(key, parsed.value));
      else unreadable.push(item.key);
    }
    const label = renaming ? `Change the options of ${property.label}` : `Change the type of ${property.label} to ${newType.label}`;
    const proposal: Proposal = { ...(await this.propose(changes.build(), label)), unreadable };
    if (!renaming) return proposal;
    const renamed = [...renaming].map(([from, to]) => ({ from, to, items: counts.get(from) ?? 0 }));
    // (Written whole against the items as read, whether or not one holds a renamed option now: an item given an old name
    // meanwhile would take the meaning of another, a swap's; checked against them too, a value held that is no option)
    return { ...proposal, renamed, whole: { items: itemsRevision(read.items.value) } };
  }

  /**
   * The keys items keep that the schema has none of (read as asked: every
   * item's page looked through), each with how many items keep it, a few of
   * their values as text, the type they look like (a property added with that
   * key takes their values back: `addProperty` with `key`)
   */
  async looseProperties(database: string): Promise<readonly LooseProperty[] | Refused> {
    const read = await this.store.database(database);
    if (!read) return this.refuse(`No database "${database}"`);
    return (await this.store.looseValues(database)).map(({ key, values }) => ({
      key,
      items: values.length,
      samples: [...new Set(values.map(({ value }) => keptText(value)).filter(Boolean))].slice(0, 3),
      type: guessedType(values.map(({ value }) => value)),
      options: optionsOfValues(values.map(({ value }) => value)),
    }));
  }

  /** A key the schema has none of taken off every item keeping it: a proposal, written whole or not at all */
  async removeLooseProperty(database: string, key: string): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    if (read.database.value.properties.some((one) => one.key === key)) return this.refuse(`"${key}" is a property of the database: remove it as one`);
    const keeping = new Set((await this.store.looseValues(database)).find((one) => one.key === key)?.values.map(({ item }) => item) ?? []);
    if (!keeping.size) return unchanged(`No item keeps "${key}"`);
    const changes = databaseChanges(database).expectDatabase(read.database.revision);
    for (const item of read.items.value) if (keeping.has(item.key)) changes.item(item, (i) => i.unset(key));
    return { ...(await this.propose(changes.build(), `Take "${key}" off the items`)), whole: { items: itemsRevision(read.items.value) } };
  }

  /** A property removed from the schema (its values stay in the items unless `values`, then taken off them too): a proposal */
  async removeProperty(database: string, key: string, options: { readonly values: boolean }): Promise<Proposal | Refused> {
    const read = await this.read(database);
    if ("problem" in read) return read;
    const property = read.database.value.properties.find((one) => one.key === key);
    if (!property) return this.refuse(`No property "${key}"`);
    const changes = databaseChanges(database).expectDatabase(read.database.revision).schema(read.database.value.properties.filter((one) => one.key !== key));
    // (A system property's values are none of the items': nothing taken off them, whatever is asked)
    const values = options.values && property.system === undefined;
    if (values) for (const item of read.items.value) if (item.values[key] !== undefined) changes.item(item, (i) => i.unset(key));
    return this.propose(changes.build(), `Remove property ${property.label}${values ? " and its values" : ""}`);
  }

  // Proposals and Undo

  /**
   * A proposal the user agreed to, written where each part is still as planned
   * (one to be written whole: all of it, else none), kept for Undo; `progress`
   * told as its parts are written (many items: as many documents of a store of pages)
   */
  async apply(proposal: Proposal, progress?: WriteProgress): Promise<Result> {
    if (this.writing) return this.refuse(`${proposal.label}: another change is being written: apply it once that is done`);
    this.writing = true;
    try {
      return await this.applyNow(proposal, progress);
    } finally {
      this.writing = false;
    }
  }

  private async applyNow(proposal: Proposal, progress?: WriteProgress): Promise<Result> {
    if (proposal.whole && itemsRevision((await this.store.items(proposal.plan.database)).value) !== proposal.whole.items) {
      const problem = `${proposal.label}: its items changed since it was proposed: nothing was written, propose it again`;
      this.ui.notify(problem, { type: "error" });
      return { problem, cause: "left" };
    }
    const report = await this.store.apply(proposal.plan, progress);
    // The places changed with it, once the store's part stands (written whole where it is to be: else none of it does)
    const stands = !proposal.whole || !report.skipped.length;
    const store = this.places?.store;
    const places = stands && store ? proposal.places : undefined;
    // What the places' write wrote, put back by the transaction's undo after the store's (exactly that: a place changed since left)
    let wrote: PlacesReport | undefined;
    const undoAlso =
      places && store
        ? async () => {
            if (wrote) this.said(`Undo: ${proposal.label}`, await store.undo(wrote));
          }
        : undefined;
    const result = await this.settle(proposal.label, report, proposal.whole ? () => true : undefined, undoAlso);
    if (places && store && !("problem" in result)) {
      try {
        wrote = await store.apply(places);
        this.said(proposal.label, wrote);
      } catch (error) {
        // (The items written stand: the views not, said)
        this.ui.notify(`${proposal.label}: its views could not be updated (${error instanceof Error ? error.message : String(error)}): change their settings by hand`, { type: "error" });
      }
    }
    return result;
  }

  /** What of the places' change was left (a place changed since it was read), said */
  private said(label: string, report: PlacesReport): void {
    if (!report.skipped.length) return;
    const where = report.skipped.map((one) => `${one.document} (${one.reason})`).join("; ");
    this.ui.notify(`${label}: ${report.skipped.length === 1 ? "a view was" : `${report.skipped.length} views were`} left as ${report.skipped.length === 1 ? "it was" : "they were"}: ${where}`, { type: "error" });
  }

  /**
   * The last transaction (of one database where named) put back where it is
   * still as written; undefined where nothing is to undo. One that cannot be
   * put back at all is said so and goes off the history. One of many pages
   * is asked first (MANY_DOCUMENTS); `progress` told as it is written.
   */
  async undo(database?: string, progress?: WriteProgress): Promise<Result | undefined> {
    // One at a time: an undo planned while another is written would be of the same transaction, half written by the
    // first; one planned while a change is applied, of the one before it (the change not recorded yet)
    if (this.writing) return this.refuse("A change is being written: undo once it is done");
    this.writing = true;
    try {
      const last = this.history.last(database);
      let plan = last && (await this.history.planUndo(last.report));
      if (!last || !plan) return undefined;
      // Many pages, one after another (an option renamed in thousands of items): said, and asked first
      if (this.store.capabilities.itemDocument && manyDocuments(plan).many) {
        if (!(await this.ui.ask(`Undo "${last.label}"? It writes ${plan.planned.length.toLocaleString("en-US")} ${this.noun.many}, one after another: it takes a while; keep this window open until it is done.`))) return { problem: "Not undone", cause: "declined" };
        // (Asked, the pages may have changed meanwhile, another client's, a change recorded since: the last one planned anew)
        if (this.history.last(database) !== last) return this.refuse(`Undo: "${last.label}" is no longer the last change: not undone, undo again`);
        plan = await this.history.planUndo(last.report);
        if (!plan) return undefined;
      }
      return this.outcome(`Undo: ${last.label}`, await this.history.applyUndo(plan, progress));
    } finally {
      this.writing = false;
    }
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
  private async settle(label: string, report: TransactionReport, needed?: (skipped: Skipped) => boolean, undoAlso?: () => Promise<void>): Promise<Result> {
    this.history.record(report, label, undoAlso);
    if (!needed || !report.skipped.some(needed)) return this.outcome(label, report);
    if (report.written.length) await this.history.undo(report);
    const reasons = [...new Set(report.skipped.map((one) => one.reason))].join("; ");
    const problem = `${label}: nothing was written: ${reasons}`;
    this.ui.notify(problem, { type: "error" });
    return { problem, cause: "left", report };
  }

  private async propose(changes: Changes, label: string): Promise<Proposal> {
    const plan = await this.store.plan(changes);
    return { label, plan, ...(this.store.capabilities.itemDocument ? { documents: manyDocuments(plan) } : {}) };
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
  private newProperty(property: NewProperty, properties: readonly Property[], items: readonly Item[], loose: readonly string[] = []): Property | string {
    const taken = new Set([...properties.map((one) => one.key), ...items.flatMap((item) => Object.keys(item.values)), ...loose]);
    // A system property: its type and key its kind's, read only, its label the kind's where none is given; one of a kind
    if (property.system !== undefined) {
      const kind = systemKind(property.system, this.noun);
      if (!kind) return `No system property "${property.system}"`;
      const there = properties.find((one) => one.system === kind.kind);
      if (there) return `${kind.label} is there already: ${there.label}`;
      const label = property.label.trim() || kind.label;
      const key = property.key ?? freeName(kind.key, taken, "_");
      const problem = this.validateKey(key, properties);
      if (problem) return problem;
      return { key, label, type: kind.type, params: {}, readonly: true, system: kind.kind };
    }
    const label = property.label.trim();
    if (!label) return "A property needs a label";
    const key = property.key ?? freeName(keyFrom(label), taken, "_");
    const problem = this.validateKey(key, properties);
    if (problem) return problem;
    const type = this.types.named(property.type);
    if (!type) return `No property type "${property.type}"`;
    const params = property.params ?? {};
    const paramsProblem = validateParamNames(label, params) ?? type.validateParams?.(params);
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
function validateKeptValues(key: string, items: readonly Item[], loose: readonly LooseKey[] = []): string | undefined {
  // (Values under it: among the items' values, or kept apart by the store, a key typed by hand)
  const holding = new Set([...items.filter((item) => item.values[key] !== undefined).map((item) => item.key), ...(loose.find((one) => one.key === key)?.values.map(({ item }) => item) ?? [])]);
  if (!holding.size) return undefined;
  const count = holding.size;
  return `${count === 1 ? "An item keeps" : `${count} items keep`} values under "${key}" (a property removed, or typed by hand): add it back, or remove those values first`;
}

/** The ranks of an item at `place` among `items` (the item itself left out, where it is one of them), or why the place is not there */
function placed(items: readonly Item[], item: Item | undefined, place: Place): ReturnType<typeof placeAt> | string {
  const ordered = inRankOrder(items.filter((one) => one.key !== item?.key));
  const at = (neighbour: Item) => ordered.findIndex((one) => one.key === neighbour.key);
  // By default the very end, after those without a rank too (made outside the core: they get ranks in their order, as `placeAt` gives
  // them, so the new item is the last as shown), where they are few; many (a database imported): after the ranked ones, as
  // one item added never writes a whole database
  const unranked = ordered.findIndex((one) => !isRank(one.rank));
  let index = unranked < 0 || ordered.length - unranked <= RANKED_AT_ONCE ? ordered.length : unranked;
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

/**
 * The renames of a property's options checked, as a map, or why they cannot be:
 * the type the same, each from one of its options as they are, each to one of
 * the options as they are to be, no two to one name, none onto an option kept
 * as it is (two options put into one, their values no longer told apart)
 */
function validateRenames(property: Property, type: string, params: Params, renames: Readonly<Record<string, string>>, items: readonly Item[]): ReadonlyMap<string, string> | string {
  const before = optionsOf(property.params);
  const after = optionsOf(params);
  const map = new Map<string, string>();
  for (const [from, to] of Object.entries(renames)) {
    if (typeof to !== "string") return `"${from}" is renamed to no text`;
    if (from === to) continue;
    if (!before.includes(from)) return `"${from}" is none of its options: not renamed`;
    if (!after.includes(to)) return `"${to}" is none of its new options: "${from}" not renamed to it`;
    map.set(from, to);
  }
  if (map.size && type !== property.type) return "options cannot be renamed with a change of type";
  const targets = [...map.values()];
  const twice = targets.find((one, at) => targets.indexOf(one) !== at);
  if (twice !== undefined) return `two options renamed to "${twice}": give each a name of its own`;
  const onto = [...map].find(([, to]) => before.includes(to) && !map.has(to));
  if (onto) return `"${onto[1]}" is one of its options as they are (kept, or taken away with its values kept in the items): renaming "${onto[0]}" to it would put the two into one`;
  // Nor onto a value items hold that is none of the options (typed by hand): the two would no longer be told apart
  const held = new Set(items.flatMap((item) => {
    const value = item.values[property.key];
    return typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  }));
  const stray = [...map].find(([, to]) => held.has(to) && !before.includes(to));
  if (stray) return `items hold "${stray[1]}", none of its options: renaming "${stray[0]}" to it would put the two into one`;
  return map;
}

/**
 * A value with its options renamed, all at once (a swap swaps), a list in its
 * order; undefined where it holds none renamed (the renames checked: one to
 * one, none onto a value held, so no list comes to hold one option twice)
 */
function renamedValue(value: Value, renames: ReadonlyMap<string, string>): { readonly value: Value; readonly from: readonly string[] } | undefined {
  if (typeof value === "string") {
    const to = renames.get(value);
    return to === undefined ? undefined : { value: to, from: [value] };
  }
  if (!Array.isArray(value)) return undefined;
  const from = value.filter((one) => renames.has(one));
  if (!from.length) return undefined;
  return { value: value.map((one) => renames.get(one) ?? one), from: [...new Set(from)] };
}
