// A view's items in groups by a property (Group by in ⋯), as the place draws
// a view once per group: pure, the items given as the view lists them
// (filtered, sorted), each group keeping their order.
//
// A property with options (a select, a multi-select): a group per option in
// their order, empty ones too (an item can be added there), then one per value
// kept that is none of them. A multi-select's item is in the group of each of
// its values. A checkbox: Checked, then Unchecked (an item without the
// property reads unticked). Any other type (text, a number, a date, a URL, a
// type of the user's): a group per value, in the order sorting gives them.
// Items without a value: a group of their own, first, only where there are any.
import { compareForSort } from "../../../shared/compare.ts";
import { isEmpty, type Item, type Property, type Value } from "../model/database.ts";
import { optionsOf } from "./types/options.ts";
import type { PropertyType } from "./types/type.ts";

/** A group: its key (kept to remember it folded), its title, the value an item added in it gets (none: the group of none), its items */
export type ItemGroup = {
  readonly key: string;
  readonly label: string;
  readonly value: Value | undefined;
  /** An option of the property's, or a value of its type; false: a value kept that is none of its options */
  readonly known: boolean;
  readonly items: readonly Item[];
};

const NONE_KEY = "none";

/** The groups of `items` by `property` of type `type` */
export function groupItems(items: readonly Item[], property: Property, type: PropertyType): ItemGroup[] {
  const none: Item[] = [];
  const groups = new Map<string, { label: string; value: Value; known: boolean; items: Item[]; sort: string }>();
  const add = (key: string, made: () => { label: string; value: Value; known: boolean; sort: string }, item: Item | undefined) => {
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { ...made(), items: [] }));
    if (item) group.items.push(item);
  };
  const keyOf = (value: Value) => `value:${JSON.stringify(value)}`;
  if (type.name === "checkbox") {
    add(keyOf(true), () => ({ label: "Checked", value: true, known: true, sort: "" }), undefined);
    add(keyOf(false), () => ({ label: "Unchecked", value: false, known: true, sort: "" }), undefined);
    for (const item of items) {
      const ticked = item.values[property.key] === true;
      add(keyOf(ticked), () => ({ label: ticked ? "Checked" : "Unchecked", value: ticked, known: true, sort: "" }), item);
    }
    return [...groups].map(([key, group]) => ({ key, label: group.label, value: group.value, known: group.known, items: group.items }));
  }
  const options = optionsOf(property.params);
  const list = type.name === "multi-select";
  // An item added in a group gets its value as the type keeps it: a multi-select's a list of it
  const valueOf = (one: string): Value => (list ? [one] : one);
  for (const option of options) add(keyOf(option), () => ({ label: option, value: valueOf(option), known: true, sort: "" }), undefined);
  for (const item of items) {
    const value = item.values[property.key];
    if (value === undefined || isEmpty(value)) {
      none.push(item);
      continue;
    }
    // A list (a multi-select's): the item in each of its values' groups, once
    const parts: readonly Value[] = Array.isArray(value) ? [...new Set(value)] : [value];
    for (const part of parts) {
      const text = typeof part === "string" ? part : type.text(part, property.params);
      const known = !options.length || options.includes(text);
      const label = known ? type.text(part, property.params) : `${text} (none of its options)`;
      const sort = type.sortKey ? type.sortKey(part, property.params) : type.text(part, property.params);
      add(keyOf(part), () => ({ label, value: Array.isArray(value) ? [String(part)] : part, known, sort }), item);
    }
  }
  const made = [...groups].map(([key, group]) => ({ key, label: group.label, value: group.value as Value | undefined, known: group.known, items: group.items as readonly Item[], sort: group.sort }));
  // Options first in their order, values that are none of them after; without options, every value by its sort
  const ordered = options.length ? [...made.filter((one) => one.known), ...made.filter((one) => !one.known)] : made.sort((a, b) => compareForSort(a.sort, b.sort, "asc"));
  const result: ItemGroup[] = ordered.map(({ sort: _sort, ...group }) => group);
  return none.length ? [{ key: NONE_KEY, label: `No ${property.label}`, value: undefined, known: true, items: none }, ...result] : result;
}
