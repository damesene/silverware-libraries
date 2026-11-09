// What of a place's state names a property by its key, so a key changed can
// be followed there: the place's own (`<view>.filter`'s keys, `<view>.sort`'s,
// `<view>.groupBy`, `<view>.colorBy`, `<view>.hiddenProperties`, `<view>.shownProperties`) and what a view declares of its own meta
// (`ViewDefinition.propertyMeta`: the calendar's `dateBy`). Pure: the state as
// read, whoever keeps it (a block in a page, the memory).
import { NAMING_KEYS, NAMING_LIST_KEYS } from "./statekeys.ts";


const isMap = (value: unknown): value is Readonly<Record<string, unknown>> => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * A place's state with the property's key `from` written `to` wherever it
 * names it: only the entries that change, as a place writes them (`<view>.<key>`:
 * value); undefined where it names `from` nowhere. `metaOf(view)`: the view's own
 * meta keys holding a property's key
 */
export function placeStateRenamed(state: ReadonlyMap<string, unknown>, from: string, to: string, metaOf: (view: string) => readonly string[]): Record<string, unknown> | undefined {
  const changed: Record<string, unknown> = {};
  for (const [name, value] of state) {
    // (The view's name before the last dot: a key has none, a view's name may)
    const dot = name.lastIndexOf(".");
    if (dot <= 0) continue;
    const view = name.slice(0, dot);
    const key = name.slice(dot + 1);
    // (A filter or sort naming the new key already left as it is: one of its conditions would be lost, or named twice)
    if (key === "filter" && isMap(value) && Object.hasOwn(value, from) && !Object.hasOwn(value, to)) {
      // (Its conditions in their order, the one renamed in its place)
      changed[name] = Object.fromEntries(Object.entries(value).map(([one, condition]) => [one === from ? to : one, condition]));
    } else if (NAMING_LIST_KEYS.has(key) && Array.isArray(value) && value.includes(from)) {
      // (The new key there already: the old one taken off, not named twice)
      changed[name] = value.includes(to) ? value.filter((one) => one !== from) : value.map((one) => (one === from ? to : one));
    } else if (key === "sort" && Array.isArray(value) && value.some((one) => isMap(one) && one.key === from) && !value.some((one) => isMap(one) && one.key === to)) {
      changed[name] = value.map((one) => (isMap(one) && one.key === from ? { ...one, key: to } : one));
    } else if ((NAMING_KEYS.has(key) || metaOf(view).includes(key)) && value === from) {
      changed[name] = to;
    }
  }
  return Object.keys(changed).length ? changed : undefined;
}
