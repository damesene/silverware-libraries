// A view's items as it asks for them: filtered by a condition per property
// (Silverware Table's filter syntax, shared/filter.ts: `!=Done`, `>3`,
// `/regex/`), all of them to hold, as the table's filter row is one field per
// column; sorted by properties in turn (shared/compare.ts: numbers by value,
// empty values last), else in the order by hand. Pure: the core keeps the
// conditions and the keys in the view's meta and hands them here.
import { compareForSort, type SortDirection } from "../../../shared/compare.ts";
import { filterMatcher, parseFilter } from "../../../shared/filter.ts";
import { type Database, type Item, NAME_KEY, type Property } from "../model/database.ts";
import { inRankOrder } from "./rank.ts";
import { systemType } from "./system.ts";
import type { TypeRegistry } from "./types/registry.ts";
import { keptText, type PropertyType } from "./types/type.ts";

/** A view's conditions by property key (the name's too: `name`); an empty condition none */
export type Filter = Readonly<Record<string, string>>;

/** A property sorted by, and which way; several in turn */
export type SortKey = { readonly key: string; readonly direction: SortDirection };

/** Why a condition does not read (an unclosed regular expression), undefined where it does */
export function validateCondition(condition: string): string | undefined {
  return parseFilter(condition).error;
}

/** A property's type for its params (a select of several options its own), the text type for one not defined now (its values shown as kept) */
export function typeOf(types: TypeRegistry, property: Property): PropertyType {
  // (A system property's its kind's: domain/system.ts)
  const own = property.system === undefined ? undefined : systemType(property.system);
  return types.of(own ?? property.type, property.params) ?? types.named("text")!;
}

/** An item's value of a property as text, as it shows: the name for `name`, nothing for a property it lacks */
export function textOf(item: Item, key: string, database: Database, types: TypeRegistry): string {
  if (key === NAME_KEY) return item.name;
  const property = database.properties.find((one) => one.key === key);
  const value = item.values[key];
  if (value === undefined) return "";
  return property ? typeOf(types, property).text(value, property.params) : keptText(value);
}

/** What sorting compares of an item's value: its type's sort key where it has one (a select by its options' order), else its text */
function sortTextOf(item: Item, key: string, database: Database, types: TypeRegistry): string {
  const property = database.properties.find((one) => one.key === key);
  const value = item.values[key];
  if (key !== NAME_KEY && property && value !== undefined) {
    const type = typeOf(types, property);
    if (type.sortKey) return type.sortKey(value, property.params);
  }
  return textOf(item, key, database, types);
}

/**
 * The items a view shows: those every condition holds for (a condition that
 * does not read, or of a property the database has not, filters nothing),
 * sorted by `sort` in turn, ties and no sort in the order by hand
 */
export function listItems(items: readonly Item[], database: Database, types: TypeRegistry, view: { readonly filter?: Filter; readonly sort?: readonly SortKey[] }): Item[] {
  const keys = new Set([NAME_KEY, ...database.properties.map((one) => one.key)]);
  const matchers = Object.entries(view.filter ?? {}).flatMap(([key, condition]) => {
    const match = keys.has(key) && condition.trim() ? filterMatcher(condition) : undefined;
    return match ? [{ key, match }] : [];
  });
  const kept = items.filter((item) => matchers.every(({ key, match }) => match(textOf(item, key, database, types))));
  const ordered = inRankOrder(kept);
  const sort = (view.sort ?? []).filter((one) => keys.has(one.key));
  if (!sort.length) return ordered;
  const place = new Map(ordered.map((item, at) => [item.key, at]));
  return ordered.sort((a, b) => {
    for (const { key, direction } of sort) {
      const order = compareForSort(sortTextOf(a, key, database, types), sortTextOf(b, key, database, types), direction);
      if (order) return order;
    }
    return place.get(a.key)! - place.get(b.key)!;
  });
}
