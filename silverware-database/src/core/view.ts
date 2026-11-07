// What a view is and what it gets: the API a view is written against, the
// built-in ones (views/builtin/, step 5) and the user's alike
// (docs/silverware-database.md, *The core*). Views import only types from
// here: no view leans on the core's insides, and a custom view outside the
// bundle uses the same.
import type { Filter, SortKey } from "../domain/listing.ts";
import type { PropertyType } from "../domain/types/type.ts";
import type { Database, Item, Property, Value } from "../model/database.ts";
import type { ItemDraft, Place, Result } from "./core.ts";

export type { Filter, SortKey } from "../domain/listing.ts";
export type { ItemDraft, Place, Refused, Result, Written } from "./core.ts";
export { isRefused } from "./core.ts";

/** A setting of a view, the same everywhere it shows (`silverware.database.views.<view>.<key>`), shown in the settings dialog */
export type ViewSetting = {
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  readonly control: "switch" | "number" | "text" | "choice";
  // A choice's values, in their order
  readonly choices?: readonly string[];
  readonly default: unknown;
};

/** A view drawn: told when its data changed, and when it goes; a view giving back nothing (or no `update`) is drawn anew on every change */
export type ViewInstance = {
  /** The data changed (an item edited here or elsewhere): `host` has it now; none: the view is drawn anew */
  update?(): void;
  /** The view goes (another picked, the place gone): what it listens to stops */
  destroy?(): void;
};

/** A view: drawn into a place's element from what its host gives */
export type ViewDefinition = {
  /** Its name, as a place's state and its settings name it: lower case, no spaces */
  readonly name: string;
  readonly label: string;
  /** Its icon in the switcher: the plugin's own markup (an SVG) or a character, never text of a page */
  readonly icon: string;
  readonly settings?: readonly ViewSetting[];
  render(host: ViewHost, element: HTMLElement): ViewInstance | void;
};

/** The view's filter and sort, kept in its own meta (`<view>.filter`, `<view>.sort`); setting one draws the view anew */
export type ViewListing = {
  readonly filter: Filter;
  readonly sort: readonly SortKey[];
  /** A property's condition (empty or undefined: none) */
  setFilter(key: string, condition: string | undefined): Promise<void>;
  setSort(sort: readonly SortKey[]): Promise<void>;
  /** Why a condition does not read, undefined where it does */
  validateCondition(condition: string): string | undefined;
};

/** What a view gets: its database's data as it asks for it, the core's writes for that database, its own meta and settings */
export type ViewHost = {
  readonly document: Document;
  readonly database: Database;
  /** The items as the view shows them: filtered and sorted by its listing, else in the order by hand */
  readonly items: readonly Item[];
  /** How many items the database has, the filtered out too */
  readonly total: number;
  readonly listing: ViewListing;
  /** A property's type (the text type for one not defined now): how a value shows, sorts, reads from text typed */
  type(property: Property): PropertyType;
  /** An item's value as it shows: the name for `name` */
  text(item: Item, key: string): string;
  /** The core's writes, for this database (`items` may be several, the others one); each says why where refused (`isRefused`), the user told already */
  update(item: Item, key: string, value: Value | undefined): Promise<Result>;
  create(draft?: ItemDraft, place?: Place): Promise<Result>;
  rename(item: Item, name: string): Promise<Result>;
  remove(items: readonly Item[]): Promise<Result>;
  move(item: Item, place: Place): Promise<Result>;
  /** The database's last change put back where still as written (undefined: nothing to undo) */
  undo(): Promise<Result | undefined>;
  /** The item opened where the store says it can be (its page), else nothing; a failure is said to the user */
  open(item: Item): Promise<void>;
  /** The view's own data in its place, by its key (the core prefixes it with the view's name); undefined where none */
  getMeta(key: string): unknown;
  /** Values written together (undefined: the key goes); may draw the place anew: write at the end of what the user does */
  setMeta(values: Readonly<Record<string, unknown>>): Promise<void>;
  /** One of the view's settings (declared in its `settings`), its default where not set */
  setting(key: string): unknown;
};
