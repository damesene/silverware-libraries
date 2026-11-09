// A view's items in groups by a property (Group by in ⋯), as the place draws
// a view once per group: pure, the items given as the view lists them
// (filtered, sorted), each group keeping their order.
//
// A property with options (a select, a multi-select): a group per option in
// their order, empty ones too (an item can be added there), then one per value
// kept that is none of them. A multi-select's item is in the group of each of
// its values. A checkbox: Checked, then Unchecked (an item without the
// property reads unticked). Any other type (text, a number, a date, a URL, a
// type of the user's): a group per value, or per the value the type groups
// it by (`groupValue`: a date's day, whatever its time), in the order sorting
// gives them.
// Items without a value: a group of their own, first, only where there are any.
import { compareForSort } from "../../../shared/compare.ts";
import { isEmpty, type Item, type Params, type Property, type Value } from "../model/database.ts";
import { optionsOf } from "./types/options.ts";
import { keptText, type PropertyType } from "./types/type.ts";

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
  // (A value turned by a press, true or not: Checked and Unchecked, an item without it unticked)
  if (type.editor === "toggle") {
    add(keyOf(true), () => ({ label: "Checked", value: true, known: true, sort: "" }), undefined);
    add(keyOf(false), () => ({ label: "Unchecked", value: false, known: true, sort: "" }), undefined);
    for (const item of items) {
      const ticked = item.values[property.key] === true;
      add(keyOf(ticked), () => ({ label: ticked ? "Checked" : "Unchecked", value: ticked, known: true, sort: "" }), item);
    }
    return [...groups].map(([key, group]) => ({ key, label: group.label, value: group.value, known: group.known, items: group.items }));
  }
  const options = optionsOf(property.params);
  // (Its values lists where the type picks several: a multi-select's, references, a type of the user's so)
  const list = type.lists === true;
  // An item added in a group gets its value as the type keeps it: a multi-select's a list of it
  const valueOf = (one: string): Value => (list ? [one] : one);
  // (An option as it shows: a person's @ada)
  const shownOption = (option: string) => type.optionShown?.(option) ?? option;
  for (const option of options) add(keyOf(option), () => ({ label: shownOption(option), value: valueOf(option), known: true, sort: "" }), undefined);
  // (Values of one group where the type says so: a date's day, whatever its time; else a group per value)
  const grouped = (part: Value): Value => (type.groupValue && type.validate(part, property.params) === undefined ? type.groupValue(part, property.params) : part);
  for (const item of items) {
    const value = item.values[property.key];
    if (value === undefined || isEmpty(value)) {
      none.push(item);
      continue;
    }
    // A list (a multi-select's): the item in each of its values' groups, once
    // (Each part by its group's value: a reference by the document it names, whatever text its link shows)
    const parts: readonly Value[] = [...new Map((Array.isArray(value) ? value : [value]).map((one) => grouped(one)).map((one) => [JSON.stringify(one), one])).values()];
    for (const part of parts) {
      const text = typeof part === "string" ? part : type.text(part, property.params);
      // (None of the options but taken by the type, a person's with Anyone: a group of its own, as valid as an option's)
      const known = !options.length || options.includes(text) || (typeof part === "string" && type.validate(valueOf(part), property.params) === undefined);
      const label = typeof part === "string" && type.optionShown ? (known ? shownOption(part) : `${shownOption(part)} (none of its options)`) : known ? type.text(part, property.params) : `${text} (none of its options)`;
      const sort = type.sortKey ? type.sortKey(part, property.params) : type.text(part, property.params);
      // (Its value by the property's type, whatever the item holds: a multi-select's a list of it, any other's the value alone)
      add(keyOf(part), () => ({ label, value: list ? [String(part)] : part, known, sort }), item);
    }
  }
  const made = [...groups].map(([key, group]) => ({ key, label: group.label, value: group.value as Value | undefined, known: group.known, items: group.items as readonly Item[], sort: group.sort }));
  // Options first in their order, values that are none of them after; without options, every value by its sort
  const ordered = options.length ? [...made.filter((one) => one.known), ...made.filter((one) => !one.known)] : made.sort((a, b) => compareForSort(a.sort, b.sort, "asc"));
  const result: ItemGroup[] = ordered.map(({ sort: _sort, ...group }) => group);
  return none.length ? [{ key: NONE_KEY, label: `No ${property.label}`, value: undefined, known: true, items: none }, ...result] : result;
}

/** How a view's groups are arranged, as kept in its meta: the order given them by hand, those hidden, empty ones hidden */
export type GroupArrangement = { readonly order: readonly string[]; readonly hidden: readonly string[]; readonly hideEmpty: boolean };

export const NO_ARRANGEMENT: GroupArrangement = { order: [], hidden: [], hideEmpty: false };

/**
 * The groups arranged: `ordered` every group, those given an order by hand
 * in it first, then the others as they come (a group new since: an option
 * added); `shown` those of them not hidden, nor empty where empty ones are
 */
export function arrangeGroups(groups: readonly ItemGroup[], arrangement: GroupArrangement): { readonly ordered: readonly ItemGroup[]; readonly shown: readonly ItemGroup[] } {
  const at = new Map(arrangement.order.map((key, index) => [key, index]));
  const known = groups.filter((group) => at.has(group.key)).sort((a, b) => at.get(a.key)! - at.get(b.key)!);
  const ordered = [...known, ...groups.filter((group) => !at.has(group.key))];
  const hidden = new Set(arrangement.hidden);
  return { ordered, shown: ordered.filter((group) => !hidden.has(group.key) && !(arrangement.hideEmpty && group.items.length === 0)) };
}

/** A group's one value (a multi-select's group holds a list of it) */
const partOf = (group: ItemGroup | undefined): Value | undefined => (Array.isArray(group?.value) ? group.value[0] : group?.value);

const same = (a: Value | undefined, b: Value | undefined) => JSON.stringify(a) === JSON.stringify(b);

/**
 * An item's value once it is moved from one group to another (a board's card
 * dragged to another column). A value alone (or none): the other group's (a
 * type grouping values that differ given: read over the item's own, so a date
 * keeps its time). A
 * list (a multi-select's, or a list kept under any property): the value of the
 * group it left replaced in its place by the other's (every copy of it gone,
 * so it is out of that group), its other values kept as they are, nothing of
 * them lost; the other's value there already, not twice; to the group of none,
 * that value alone taken off; none left: no value (undefined: taken off)
 */
export function movedValue(value: Value | undefined, from: ItemGroup | undefined, to: ItemGroup, type?: PropertyType, params: Params = {}): Value | undefined {
  if (!Array.isArray(value)) {
    // (A group of values that differ, the type's: its value read over the item's own, a date keeping its time)
    if (!type?.groupValue || value === undefined || to.value === undefined || isEmpty(value)) return to.value;
    const read = type.parse(keptText(to.value), params, value);
    // (Only where it lands in that group: else the group's value as it is)
    return "value" in read && type.validate(read.value, params) === undefined && same(type.groupValue(read.value, params), to.value) ? read.value : to.value;
  }
  const leaving = partOf(from);
  const coming = partOf(to);
  // (A part by its group's value where the type groups values that differ: `[[B|bee]]` is in the group of `[[B]]`)
  const key = (one: Value): Value => (type?.groupValue ? type.groupValue(one, params) : one);
  const isOf = (each: string, group: Value) => same(key(each), key(group)) || each === String(group);
  const has = (one: Value | undefined) => one !== undefined && value.some((each) => isOf(each, one));
  const kept: string[] = [];
  let placed = has(coming);
  for (const each of value) {
    if (leaving === undefined || !isOf(each, leaving)) kept.push(each);
    else if (!placed && coming !== undefined) {
      kept.push(String(coming));
      placed = true;
    }
  }
  if (!placed && coming !== undefined) kept.push(String(coming));
  return kept.length ? kept : undefined;
}
