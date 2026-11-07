// A view drawn once per group (Group by in ⋯, as Notion does: a table per
// group, a list per group): the place's own, so any view gets it, the user's
// too, knowing nothing of groups. Each group a section: its head (folded or
// not, its title, how many items), then the view drawn into it with a host
// whose items are the group's, an item added there getting the group's value.
// The data changed: each view told (`update`) where the groups are the same,
// else every section drawn anew, but not while a field of one has the focus
// (a cell being typed in: what is typed would go), until it leaves them. A
// group folded is kept in the view's meta (`<view>.folded`), drawn as its head
// alone. A view failing in one group says so there, the others drawn.
import { el } from "../../../shared/elements.ts";
import { groupItems, type ItemGroup } from "../domain/grouping.ts";
import type { Property } from "../model/database.ts";
import { ICONS } from "./icons.ts";
import type { ViewDefinition, ViewHost, ViewInstance } from "./view.ts";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The view's own meta key of the groups folded */
export const FOLDED_KEY = "folded";

/** The keys of the groups folded, as kept */
function foldedOf(host: ViewHost): ReadonlySet<string> {
  const kept = host.getMeta(FOLDED_KEY);
  return new Set(Array.isArray(kept) ? kept.filter((one): one is string => typeof one === "string") : []);
}

/** A host for one group: its items those of the group as grouped now, an item added in it with the group's value */
function groupHost(host: ViewHost, property: Property, key: string, groups: () => readonly ItemGroup[]): ViewHost {
  const group = () => groups().find((one) => one.key === key);
  const grouped: ViewHost = Object.create(host);
  Object.defineProperty(grouped, "items", { get: () => group()?.items ?? [] });
  // (Its own count: a view saying how many of all it shows, as filtered, says it of its group)
  Object.defineProperty(grouped, "total", { get: () => group()?.items.length ?? 0 });
  grouped.create = (draft = {}, place) => {
    const value = group()?.value;
    return host.create(value === undefined ? draft : { ...draft, values: { [property.key]: value, ...draft.values } }, place);
  };
  return grouped;
}

/** `view` drawn into `element` once per group of `host`'s items by `property` */
export function drawGrouped(view: ViewDefinition, host: ViewHost, element: HTMLElement, property: Property): ViewInstance {
  const doc = host.document;
  let groups: readonly ItemGroup[] = [];
  let shapeOf = "";
  let children: (ViewInstance | void)[] = [];
  const regroup = () => groupItems(host.items, host.database.properties.find((one) => one.key === property.key) ?? property, host.type(property));
  // What decides the sections: the groups there are, in order, and which are folded
  const shape = (all: readonly ItemGroup[], folded: ReadonlySet<string>) => JSON.stringify(all.map((one) => [one.key, one.label, folded.has(one.key)]));
  const destroy = () => {
    for (const child of children) {
      try {
        child?.destroy?.();
      } catch {
        // (A view failing as it goes takes no other group down)
      }
    }
    children = [];
  };
  const fold = (key: string, folded: boolean) => {
    const now = new Set(foldedOf(host));
    if (folded) now.add(key);
    else now.delete(key);
    void host.setMeta({ [FOLDED_KEY]: now.size ? [...now] : undefined }).then(() => host.refresh());
  };
  const draw = () => {
    destroy();
    const folded = foldedOf(host);
    groups = regroup();
    shapeOf = shape(groups, folded);
    element.replaceChildren(
      ...groups.map((group) => {
        const open = !folded.has(group.key);
        const head = el(
          doc,
          "button",
          { class: "swd-group-head", attrs: { "aria-expanded": String(open), "data-group": group.key }, run: () => fold(group.key, open) },
          el(doc, "span", { class: `swd-group-chevron${open ? " swd-group-open" : ""}`, html: ICONS.chevron }),
          el(doc, "span", { class: `swd-group-label${group.known ? "" : " swd-invalid"}`, text: group.label }),
          el(doc, "span", { class: "swd-group-count", text: String(group.items.length) }),
        );
        const body = el(doc, "div", "swd-group-body");
        const section = el(doc, "section", { class: "swd-group", attrs: { "aria-label": `${property.label}: ${group.label}` } }, head, ...(open ? [body] : []));
        if (open) {
          try {
            children.push(view.render(groupHost(host, property, group.key, () => groups), body));
          } catch (error) {
            body.replaceChildren(el(doc, "p", { class: "swd-place-note", text: `The view "${view.label}" failed: ${message(error)}` }));
          }
        }
        return section;
      }),
    );
  };
  // A field of a group's view has the focus (a cell being typed in): the sections drawn anew once it leaves them
  let held = false;
  const typing = () => {
    const active = doc.activeElement;
    return !!active && element.contains(active) && active.matches("input, textarea, select, [contenteditable='true']");
  };
  element.addEventListener("focusout", (event) => {
    if (!held || element.contains(event.relatedTarget as Node | null)) return;
    held = false;
    // (After the field's own change is handled: its value saved first)
    setTimeout(() => {
      if (element.isConnected && shape(regroup(), foldedOf(host)) !== shapeOf) draw();
    });
  });
  draw();
  return {
    update() {
      const next = regroup();
      // The same groups: each view told, reading its group as it is now; else drawn anew (a group come or gone, folded),
      // but not under a field being typed in: its views told meanwhile, with what their groups have now
      const changed = shape(next, foldedOf(host)) !== shapeOf || children.some((child) => !child?.update);
      if (changed && !typing()) return draw();
      if (changed) held = true;
      groups = next;
      for (const child of children) {
        try {
          child?.update?.();
        } catch {
          // (A view failing to update takes no other group down: drawn anew with the next change)
          shapeOf = "";
        }
      }
      for (const count of element.querySelectorAll<HTMLElement>(":scope > .swd-group > .swd-group-head .swd-group-count")) {
        const key = count.closest<HTMLElement>(".swd-group-head")?.dataset.group;
        count.textContent = String(groups.find((one) => one.key === key)?.items.length ?? 0);
      }
    },
    destroy,
  };
}
