// How a place keeps a view's state in its block (`<view>.<key>`): the keys and
// the form of their values, in one place for whoever writes or follows them
// (the place's host, Apply to all views, a key changed followed into the
// places). The core's alone: no view knows it.
import type { GroupArrangement } from "../domain/grouping.ts";
import type { Property } from "../model/database.ts";
import type { ViewDefinition } from "./view.ts";

/** The keys of a view's state the place keeps (prefixed with the view's name in the block) */
export const STATE_KEYS = {
  filter: "filter",
  sort: "sort",
  groupBy: "groupBy",
  groupOrder: "groupOrder",
  groupHidden: "groupHidden",
  groupHideEmpty: "groupHideEmpty",
  colorBy: "colorBy",
  hiddenProperties: "hiddenProperties",
  shownProperties: "shownProperties",
} as const;

/** The keys whose value is a property's key, and those whose value is a list of them (followed as a key changes) */
export const NAMING_KEYS: ReadonlySet<string> = new Set([STATE_KEYS.groupBy, STATE_KEYS.colorBy]);
export const NAMING_LIST_KEYS: ReadonlySet<string> = new Set([STATE_KEYS.hiddenProperties, STATE_KEYS.shownProperties]);

/** A list as kept: none where it is empty (the key taken off) */
export const keptList = (list: readonly string[]): readonly string[] | undefined => (list.length ? [...list] : undefined);

/** Whether a view hides its properties until shown (it keeps those shown, `shownProperties`; else those hidden) */
export const hidesByDefault = (view: ViewDefinition) => typeof view.properties === "object" && view.properties !== null && view.properties.hiddenByDefault === true;

/** The entries keeping which properties `view` shows (`shown`: their keys), as it keeps them */
export function propertyEntries(view: ViewDefinition, shown: readonly string[], schema: readonly Property[]): Record<string, unknown> {
  if (hidesByDefault(view)) return { [STATE_KEYS.shownProperties]: keptList(schema.filter((one) => shown.includes(one.key)).map((one) => one.key)) };
  const on = new Set(shown);
  return { [STATE_KEYS.hiddenProperties]: keptList(schema.filter((one) => !on.has(one.key)).map((one) => one.key)) };
}

/** The entries keeping how a view's groups are arranged */
export function arrangementEntries(arrangement: GroupArrangement): Record<string, unknown> {
  return { [STATE_KEYS.groupOrder]: keptList(arrangement.order), [STATE_KEYS.groupHidden]: keptList(arrangement.hidden), [STATE_KEYS.groupHideEmpty]: arrangement.hideEmpty || undefined };
}

/**
 * The entries keeping what a view is grouped by (undefined: none). With an
 * arrangement, the groups arranged so (none grouped: none kept); without one,
 * the order and hiding of before let go (they were of another property's
 * groups), empty groups' hiding kept
 */
export function groupEntries(key: string | undefined, arrangement?: GroupArrangement): Record<string, unknown> {
  if (!arrangement) return { [STATE_KEYS.groupBy]: key, [STATE_KEYS.groupOrder]: undefined, [STATE_KEYS.groupHidden]: undefined };
  return { [STATE_KEYS.groupBy]: key, ...arrangementEntries(key === undefined ? { order: [], hidden: [], hideEmpty: false } : arrangement) };
}
