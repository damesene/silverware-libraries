// What a view drawn in groups shows of each group, whoever draws the groups:
// the place for any view (core/groups.ts: the view drawn once per group) or a
// view drawing them itself (the table: one table, a part of it per group). A
// group's head (folded or not, its title, how many items), the groups folded
// (kept in the view's meta, `<view>.folded`), an item added in a group with the
// group's value.
import { el } from "../../../shared/elements.ts";
import type { ViewHost } from "../core/view.ts";
import type { ItemGroup } from "../domain/grouping.ts";
import type { Property } from "../model/database.ts";
import { VIEW_ICONS } from "./icons.ts";

// The view's own meta key of the groups folded
const FOLDED_KEY = "folded";

/** The keys of the groups folded, as kept */
export function foldedOf(host: Pick<ViewHost, "getMeta">): ReadonlySet<string> {
  const kept = host.getMeta(FOLDED_KEY);
  return new Set(Array.isArray(kept) ? kept.filter((one): one is string => typeof one === "string") : []);
}

/** A group folded or opened: kept in the view's meta, the view drawn anew (done once it is) */
export async function setFolded(host: Pick<ViewHost, "getMeta" | "setMeta" | "refresh">, key: string, folded: boolean): Promise<void> {
  const now = new Set(foldedOf(host));
  if (folded) now.add(key);
  else now.delete(key);
  await host.setMeta({ [FOLDED_KEY]: now.size ? [...now] : undefined });
  await host.refresh();
}

/** A group's head: a button folding or opening it, its title (marked where its value is none of the property's options) and how many items it has */
export function groupHead(doc: Document, group: ItemGroup, open: boolean, toggle: () => void): HTMLElement {
  return el(
    doc,
    "button",
    { class: "swd-group-head", attrs: { "aria-expanded": String(open), "data-group": group.key }, run: toggle },
    el(doc, "span", { class: `swd-group-chevron${open ? " swd-group-open" : ""}`, html: VIEW_ICONS.chevron }),
    el(doc, "span", { class: `swd-group-label${group.known ? "" : " swd-invalid"}`, text: group.label }),
    el(doc, "span", { class: "swd-group-count", text: String(group.items.length) }),
  );
}

/** An item added in a group: with the group's value (none for the group of none, nor for a property not changed by hand, a system one's) */
export function createInGroup(host: Pick<ViewHost, "create">, property: Property, group: ItemGroup | undefined, draft: Parameters<ViewHost["create"]>[0] = {}, place?: Parameters<ViewHost["create"]>[1]) {
  const value = group?.value;
  return host.create(value === undefined || property.readonly ? draft : { ...draft, values: { [property.key]: value, ...draft?.values } }, place);
}
