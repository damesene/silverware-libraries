// What ⋯ offers where a view is grouped (the place's own, any view's): the
// Group submenu, as Notion has it: the property grouped by (a submenu of its
// own), Hide empty groups, and the groups as a list, each with its grip
// (dragged to its place, Alt+↑ ↓) and its eye (shown or hidden), in the order
// and with the hiding the view keeps (`listing.groupArrangement`). The list is
// an element of the menu's: its changes are written at once and drawn in it,
// the menu staying open.
import { reorder } from "../../../shared/drag.ts";
import { el, pressed } from "../../../shared/elements.ts";
import type { MenuEntry } from "../../../shared/menu.ts";
import { arrangeGroups, groupItems, type ItemGroup } from "../domain/grouping.ts";
import type { Property } from "../model/database.ts";
import { ICONS } from "./icons.ts";
import type { PlaceMenuBuilder } from "./placemenu.ts";
import type { ViewDefinition, ViewHost } from "./view.ts";

// A grip: six dots
const GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></svg>';

/** The properties a view may be grouped by (those of the types it groups by; every one where it names none) */
export function groupable(view: ViewDefinition, host: ViewHost): readonly Property[] {
  const groupBy = view.groupBy;
  if (groupBy === false) return [];
  return host.database.properties.filter((one) => !groupBy?.types || groupBy.types.includes(host.type(one).name));
}

/**
 * The property a view is grouped by: the one picked, of a type it groups by;
 * none picked, where it always is grouped (a board), the first of the types it
 * prefers (a select), else the first it may be grouped by
 */
export function groupedBy(view: ViewDefinition, host: ViewHost): Property | undefined {
  const groupBy = view.groupBy;
  if (groupBy === false) return undefined;
  const eligible = groupable(view, host);
  const picked = eligible.find((one) => one.key === host.listing.group);
  if (picked || !groupBy?.required) return picked;
  // (Not one hidden in the views, where another can)
  const shown = eligible.filter((one) => !one.hidden);
  return [...shown, ...eligible].find((one) => groupBy.prefer?.includes(host.type(one).name)) ?? shown[0] ?? eligible[0];
}

/** The groups of a view's items by `property`, arranged as the view keeps them: every one in order, and those shown */
export function arrangedGroups(host: ViewHost, property: Property): { readonly ordered: readonly ItemGroup[]; readonly shown: readonly ItemGroup[] } {
  return arrangeGroups(groupItems(host.items, property, host.type(property)), host.listing.groupArrangement);
}

/** What had the focus in the groups' list as it changed something: a group's grip or eye, Hide empty groups, Hide all */
export type GroupFocus = { readonly part: "grip" | "eye" | "switch" | "all"; readonly group?: string };

/** The focus put back in the groups' list (the menu opened again on a place drawn anew) */
export function focusGroupList(menu: HTMLElement, focus: GroupFocus): void {
  const row = focus.group === undefined ? undefined : [...menu.querySelectorAll<HTMLElement>(".swd-group-row")].find((one) => one.dataset.group === focus.group);
  const target = focus.part === "switch" ? menu.querySelector<HTMLElement>(".swd-group-switch") : focus.part === "all" ? menu.querySelector<HTMLElement>(".swd-group-all") : row?.querySelector<HTMLElement>(focus.part === "eye" ? ".swd-group-eye" : ".swd-group-grip");
  target?.focus({ preventScroll: true });
}

/**
 * The Group submenu's entry of ⋯ (none where the view is never grouped);
 * `changing` told before the groups' list writes a change (the place may be
 * drawn anew by it, the menu with it: opened again so)
 */
export function groupEntry(view: ViewDefinition, host: ViewHost, menu: PlaceMenuBuilder, changing?: (focus: GroupFocus) => void): MenuEntry | undefined {
  const groupBy = view.groupBy;
  if (groupBy === false) return undefined;
  const { listing } = host;
  const eligible = groupable(view, host);
  const by = groupedBy(view, host);
  const none = eligible.length ? {} : { disabled: "No property of a type this view groups by" };
  const option = (key: string | undefined, label: string) => menu.item({ label, checked: by?.key === key, run: () => void listing.setGroup(key) });
  const pick = () =>
    menu.submenu({ label: "Group by", value: { text: by?.label ?? "None" }, ...none }, () => [...(groupBy?.required ? [] : [option(undefined, "None")]), ...eligible.map((property) => option(property.key, property.label))]);
  return menu.submenu({ label: "Group", icon: ICONS.group, value: { text: by?.label ?? "None" }, ...none }, () => (by ? [pick(), menu.separator(), { kind: "element", element: groupList(host, by, changing) }] : [pick()]));
}

/**
 * The groups as a list in the menu, after Hide empty groups (a switch): each
 * its grip, its name, how many items, its eye; Hide all or Show all. Written
 * at once and drawn anew in place, the menu staying open
 */
function groupList(host: ViewHost, by: Property, changing?: (focus: GroupFocus) => void): HTMLElement {
  const doc = host.document;
  const box = el(doc, "div", { class: "swd-group-list" });
  const set = (change: Parameters<ViewHost["listing"]["setGroupArrangement"]>[0], focus: GroupFocus) => {
    changing?.(focus);
    return host.listing.setGroupArrangement(change).then(() => {
      draw();
      focusGroupList(box, focus);
    });
  };
  function draw(): void {
    const { ordered } = arrangedGroups(host, by);
    const arrangement = host.listing.groupArrangement;
    const hidden = new Set(arrangement.hidden);
    // (Each change read against the arrangement as it is when it is made: one written meanwhile, a click before the list was drawn anew, kept)
    const now = () => ({ keys: arrangedGroups(host, by).ordered.map((group) => group.key), hidden: host.listing.groupArrangement.hidden });
    const move = (key: string, step: number) => {
      const order = [...now().keys];
      const from = order.indexOf(key);
      const to = from + step;
      if (from < 0 || to < 0 || to >= order.length || step === 0) return void draw();
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved!);
      // (Its grip keeps the focus, in its new place)
      void set({ order }, { part: "grip", group: moved });
    };
    const allHidden = ordered.length > 0 && ordered.every((group) => hidden.has(group.key));
    const empty = el(doc, "button", {
      class: "swd-group-switch",
      attrs: { role: "switch", "aria-checked": String(arrangement.hideEmpty) },
      run: () => void set({ hideEmpty: !host.listing.groupArrangement.hideEmpty }, { part: "switch" }),
    }, el(doc, "span", { class: "swd-group-switch-label", text: "Hide empty groups" }), el(doc, "span", { class: "swd-group-switch-track", attrs: { "aria-hidden": "true" } }));
    const head = el(
      doc,
      "div",
      "swd-group-list-head",
      el(doc, "span", { text: "Groups" }),
      el(doc, "button", { class: "swd-group-all", text: allHidden ? "Show all" : "Hide all", run: () => void set({ hidden: allHidden ? [] : now().keys }, { part: "all" }) }),
    );
    const list = el(
      doc,
      "div",
      { class: "swd-group-rows", attrs: { role: "list", "aria-label": `Groups by ${by.label}` } },
      ...ordered.map((group, at) => {
        const shown = !hidden.has(group.key);
        const grip = el(doc, "button", { class: "swd-group-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { "aria-label": `Move ${group.label} (Alt+Up, Alt+Down)` } });
        const eye = el(doc, "button", {
          class: "swd-group-eye",
          html: shown ? ICONS.shown : ICONS.hidden,
          title: shown ? `Hide ${group.label}` : `Show ${group.label}`,
          attrs: { "aria-pressed": pressed(shown), "aria-label": `Show ${group.label}` },
          run: () => {
            const kept = now().hidden.filter((one) => one !== group.key);
            void set({ hidden: shown ? [...kept, group.key] : kept }, { part: "eye", group: group.key });
          },
        });
        const row = el(
          doc,
          "div",
          { class: `swd-group-row${shown ? "" : " swd-group-off"}`, attrs: { role: "listitem", "data-group": group.key } },
          grip,
          el(doc, "span", { class: `swd-group-row-label${group.known ? "" : " swd-invalid"}`, text: group.label }),
          el(doc, "span", { class: "swd-group-row-count", text: String(group.items.length) }),
          eye,
        );
        grip.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          grip.focus({ preventScroll: true });
          reorder(event, {
            element: row,
            base: "swd-props",
            layer: box,
            flow: "block",
            containers: () => [list],
            items: (container) => [...container.querySelectorAll<HTMLElement>(":scope > .swd-group-row")],
            done: (to) => (to ? move(group.key, to.index - at) : draw()),
          });
        });
        grip.addEventListener("keydown", (event) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
          event.preventDefault();
          event.stopPropagation();
          move(group.key, event.key === "ArrowUp" ? -1 : 1);
        });
        return row;
      }),
    );
    box.replaceChildren(empty, head, list);
  }
  draw();
  return box;
}
