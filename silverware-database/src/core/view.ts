// What a view is and what it gets: the API a view is written against, the
// built-in ones (views/builtin/, step 5) and the user's alike
// (docs/silverware-database.md, *The core*). Views import only types from
// here: no view leans on the core's insides, and a custom view outside the
// bundle uses the same.
import type { DocumentsHost } from "./documents.ts";
import type { MentionsHost } from "./mentions.ts";
import type { GroupArrangement, ItemGroup } from "../domain/grouping.ts";
import type { Filter, SortKey } from "../domain/listing.ts";
import type { PropertyType } from "../domain/types/type.ts";
import type { Database, Item, Property, Value } from "../model/database.ts";
import type { ItemDraft, Place, Result } from "./core.ts";
import type { PlaceMenuBuilder, PlaceMenuGroup } from "./placemenu.ts";
import type { WriteProgress } from "./store.ts";

export type { GroupArrangement, ItemGroup } from "../domain/grouping.ts";
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

/**
 * A view: drawn into a place's element from what its host gives. Where its
 * boxes are scrolled (a wide table's, a board's) the place keeps as the view
 * is drawn anew, by each box's place among the elements it draws: a view
 * draws the same shape again, nothing to declare.
 */
export type ViewDefinition = {
  /** Its name, as a place's state and its settings name it: lower case, no spaces */
  readonly name: string;
  readonly label: string;
  /** Its icon in the switcher: the plugin's own markup (an SVG) or a character, never text of a page */
  readonly icon: string;
  readonly settings?: readonly ViewSetting[];
  /**
   * How the view is grouped by a property (Group by in ⋯, which offers the
   * properties of `types`, every type where none are named, and None unless
   * `required`). By default the place draws the view once per group, each a
   * section of its own, the view knowing nothing of it; `draws: true` where the
   * view draws its groups itself (a board: its columns), reading them as
   * `host.grouping`; `required`: always grouped, where none is picked by the
   * first property of a type it `prefer`s (a board: a select), else the first;
   * false where the view is never grouped
   */
  readonly groupBy?: false | { readonly types?: readonly string[]; readonly required?: boolean; readonly draws?: boolean; readonly prefer?: readonly string[] };
  /** False where the view draws no item's color (`host.look.item`): no Color by in its ⋯ */
  readonly colors?: false;
  /**
   * False where the view shows no property beside the name
   * (`host.look.shownProperties`): no Visible properties in its ⋯.
   * `hiddenByDefault`: every property hidden until the user shows it (the
   * view keeps those shown, `<view>.shownProperties`, so a property added
   * stays hidden there: a calendar's, a timeline's small room)
   */
  readonly properties?: false | { readonly hiddenByDefault?: boolean };
  /** Its own meta's keys whose value is a property's key (the calendar's `dateBy`): followed as the property's key changes */
  readonly propertyMeta?: readonly string[];
  /**
   * The view's own entries in its place's menu (⋯), asked as it opens: given
   * the menu's builder (core/placemenu.ts), groups in its slots (`view`: how
   * the view shows its items) or in sections of their own
   */
  menu?(host: ViewHost, menu: PlaceMenuBuilder): readonly PlaceMenuGroup[];
  /**
   * Draws the view into `element`. Where its boxes were scrolled is kept by
   * the place and put back as it is drawn anew; a box marked
   * `data-own-scroll` is left to the view, which keeps its scroll its own way
   */
  render(host: ViewHost, element: HTMLElement): ViewInstance | void;
};

/** The view's filter, sort and grouping, kept in its own meta (`<view>.filter`, `<view>.sort`, `<view>.groupBy`); setting one draws the view anew */
export type ViewListing = {
  readonly filter: Filter;
  readonly sort: readonly SortKey[];
  /** The key of the property picked to group by (Group by in ⋯), as kept: undefined where none */
  readonly group: string | undefined;
  /** The property to group by (undefined: none); the groups' arrangement goes with the property it was for */
  setGroup(key: string | undefined): Promise<void>;
  /** How the groups are arranged (Group in ⋯): their order by hand, those hidden, empty ones hidden (`<view>.groupOrder`, `groupHidden`, `groupHideEmpty`) */
  readonly groupArrangement: GroupArrangement;
  /** Part of the arrangement changed, the rest kept */
  setGroupArrangement(change: Partial<GroupArrangement>): Promise<void>;
  /** A property's condition (empty or undefined: none) */
  setFilter(key: string, condition: string | undefined): Promise<void>;
  setSort(sort: readonly SortKey[]): Promise<void>;
  /** Why a condition does not read, undefined where it does */
  validateCondition(condition: string): string | undefined;
};

/** How an item is drawn: its icon and its color, whoever draws it (a view, a module: core/look.ts) */
export type ItemLooks = {
  /** An item's icon drawn, its size the CSS of where it goes (1em: as the text around it); none where it has none */
  icon(item: Item): HTMLElement | undefined;
  /** An icon of the user's (a property's own: an emoji, `lucide:house`) drawn in a span of `className`, as an item's is */
  ownIcon(value: string, className: string): HTMLElement;
  /** An item's color put on the element drawing it (a card, a row, a bar: its CSS says how it shows), taken off where it has none */
  item(item: Item, element: HTMLElement): void;
};

/**
 * How the view shows its items, kept in its own meta: which properties
 * (Visible properties in ⋯: `<view>.hiddenProperties`), their colors (Color by in ⋯:
 * `<view>.colorBy`), and each item's icon and color drawn so
 */
export type ViewLook = ItemLooks & {
  /** The database's properties the view shows, in the schema's order (the name always shown, not among them) */
  readonly shownProperties: readonly Property[];
  /** The keys of those it hides, as kept */
  readonly hiddenProperties: readonly string[];
  /** Those it hides (an empty list: every one shown); the place drawn anew */
  setHiddenProperties(keys: readonly string[]): Promise<void>;
  /** The key of the property the view colors its items by (a property of options, each its color), as kept: undefined where none */
  readonly colorBy: string | undefined;
  /** The property to color the items by (undefined: none: each its own color alone); the place drawn anew */
  setColorBy(key: string | undefined): Promise<void>;
};

/** What a view gets: its database's data as it asks for it, the core's writes for that database, its own meta and settings */
export type ViewHost = DocumentsHost & MentionsHost & {
  readonly document: Document;
  readonly database: Database;
  /** The items as the view shows them: filtered and sorted by its listing, else in the order by hand */
  readonly items: readonly Item[];
  /** How many items the database has, the filtered out too */
  readonly total: number;
  /**
   * How the view is grouped (where it draws its groups itself: a board's
   * columns): the property and its groups of `items` as shown (arranged, those
   * hidden left out), each with the value an item put there gets; undefined
   * where it is not grouped
   */
  readonly grouping: { readonly property: Property; readonly groups: readonly ItemGroup[] } | undefined;
  readonly listing: ViewListing;
  readonly look: ViewLook;
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
  undo(progress?: WriteProgress): Promise<Result | undefined>;
  /** The item opened: in a module's own way where one takes it (the peek), else where the store says it can be (its page); a failure is said to the user */
  open(item: Item): Promise<void>;
  /** The view's own data in its place, by its key (the core prefixes it with the view's name); undefined where none */
  getMeta(key: string): unknown;
  /** Values written together (undefined: the key goes); may draw the place anew: write at the end of what the user does */
  setMeta(values: Readonly<Record<string, unknown>>): Promise<void>;
  /** One of the view's settings (declared in its `settings`), its default where not set */
  setting(key: string): unknown;
  /** The view told anew (`update`) with the data as they are, after a change of its own meta (`setMeta` draws nothing) */
  refresh(): Promise<void>;
  /** A message to the user (a value typed that was not written, and why) */
  notify(message: string): void;
};
