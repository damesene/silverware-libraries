// What a database is, wherever it is kept: databases, their properties and
// their items, as data in memory. No page, folder, frontmatter or block here:
// how a database is kept is a store's (core/store.ts), and only the store reads
// that form back (docs/silverware-database.md, *Layers*, *The model*).

declare const itemKeyBrand: unique symbol;

/**
 * Which item is which: a store makes it and reads it, the core, the views and
 * the modules only hold it, compare it and hand it back. An item renamed or
 * changed through the core keeps its key; one renamed outside it (a page
 * renamed by hand) may come back under another (the pages store: an item gone
 * and another come, docs/silverware-database.md, probe 5), and a key holds for
 * the store's session, not across sessions. A text inside, so it can be kept
 * and compared, but never made or read outside a store: the brand keeps a
 * plain text from passing for one.
 */
export type ItemKey = string & { readonly [itemKeyBrand]: "ItemKey" };

/**
 * A property's value: a text (a date as ISO text), a number, a logical value,
 * a list of texts; null where empty. Relations (later) bring a kind of their
 * own that tells their items' keys from texts, not a list of keys here, which
 * would read as a list of texts.
 */
export type Value = string | number | boolean | null | readonly string[];

/** A property's own settings, its type's to read (a select's options); an object, so a type can grow without a new field here */
export type Params = Readonly<Record<string, unknown>>;

/** A property of a database: its key the identity (what items keep), its label what is shown */
export type Property = {
  readonly key: string;
  readonly label: string;
  // A property type's name (domain/types/)
  readonly type: string;
  readonly params: Params;
  // No view offers to change it, and the core refuses to; it may still change outside the database
  readonly readonly: boolean;
  // Not shown by the views (a table's column, a card's line); its values kept, filtered and sorted by, shown in the peek
  readonly hidden?: boolean;
  // Every item is to have a value: one without shows as missing; the core takes none off (optional where not said)
  readonly required?: boolean;
};

/** A database: its id (a slug, not changed by renaming it), its name as shown, its properties in their order */
export type Database = {
  readonly id: string;
  readonly name: string;
  readonly properties: readonly Property[];
};

/** A database as listed: its id and name */
export type DatabaseSummary = { readonly id: string; readonly name: string };

/**
 * An item: its key, its name (the built-in property every database has, the
 * first column of a table), its values by property key (a key it lacks: the
 * property empty; a value that does not read as its type is kept as read),
 * its place in the order by hand (`rank`, compared as is; none: after the
 * ranked ones, by name), its body where the store keeps one (content in the
 * markdown language), its revision (changes whenever the item does: a change
 * made from it can ask to be written only where it still is so), when it was
 * last changed where the store knows (ISO text)
 */
export type Item = {
  readonly key: ItemKey;
  readonly name: string;
  readonly values: Readonly<Record<string, Value>>;
  readonly rank: string | undefined;
  readonly body?: string;
  readonly revision: string;
  readonly modified?: string;
};

/** What a store gives with how it was when read: a revision that changes whenever it does (what tells a view to draw anew) */
export type Revised<T> = { readonly value: T; readonly revision: string };

// A property's key as Space Lua reads it bare in a query: lower case ASCII letters, digits and `_`, starting with a letter
const KEY_RE = /^[a-z][a-z0-9_]*$/;

/** The built-in property every database has, whatever its schema says */
export const NAME_KEY = "name";

/** Why a property's key cannot be one (a store may refuse more: its own `validatePropertyKey`), undefined where it can */
export function validatePropertyKey(key: string): string | undefined {
  if (!KEY_RE.test(key)) return `"${key}" is no property key: lower case letters, digits and _, starting with a letter (due_date)`;
  if (key === NAME_KEY) return `"${NAME_KEY}" is the item's name, which every database has`;
  return undefined;
}

/** Whether something is a value as the model keeps one (a text, a finite number, a logical value, null, a list of texts): what a type's answer is checked by */
export function isValue(value: unknown): value is Value {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value)) return false;
  // (Every place, holes too: `every` skips a hole)
  for (let at = 0; at < value.length; at++) if (typeof value[at] !== "string") return false;
  return true;
}

/** Whether a value is empty: none, an empty text, an empty list */
export function isEmpty(value: Value | undefined): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
