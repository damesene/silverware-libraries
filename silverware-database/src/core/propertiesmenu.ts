// Visible properties in ⋯ (the place's own, any view's that shows properties): which
// of the database's properties the view shows, as Notion has it per view: the
// properties in the schema's order, each with its eye, Hide all or Show all.
// What is hidden is the view's (`look.hiddenProperties`, kept in its block),
// the schema the same for every view. The list is an element of the menu's:
// its changes are written at once and drawn in it, the menu staying open.
import { el, pressed } from "../../../shared/elements.ts";
import type { MenuEntry } from "../../../shared/menu.ts";
import { ICONS } from "./icons.ts";
import type { PlaceMenuBuilder } from "./placemenu.ts";
import type { ViewDefinition, ViewHost } from "./view.ts";

/** What had the focus in the properties' list as it changed something: a property's eye, Hide all */
export type PropertiesFocus = { readonly part: "eye" | "all"; readonly property?: string };

/** The focus put back in the properties' list (the menu opened again on a place drawn anew) */
export function focusPropertyList(menu: HTMLElement, focus: PropertiesFocus): void {
  const row = focus.property === undefined ? undefined : [...menu.querySelectorAll<HTMLElement>(".swd-shown-row")].find((one) => one.dataset.property === focus.property);
  const target = focus.part === "all" ? menu.querySelector<HTMLElement>(".swd-shown-all") : row?.querySelector<HTMLElement>(".swd-shown-eye");
  target?.focus({ preventScroll: true });
}

/**
 * The Visible properties submenu's entry of ⋯ (none where the view shows no property:
 * `properties: false`); `changing` told before the list writes a change (the
 * place may be drawn anew by it, the menu with it: opened again so)
 */
export function propertiesEntry(view: ViewDefinition, host: ViewHost, menu: PlaceMenuBuilder, changing?: (focus: PropertiesFocus) => void): MenuEntry | undefined {
  if (view.properties === false) return undefined;
  const all = host.database.properties.length;
  const shown = host.look.shownProperties.length;
  const none = all ? {} : { disabled: "The database has no property" };
  return menu.submenu({ label: "Visible properties", icon: ICONS.shown, value: { text: shown === all ? "All shown" : `${shown} of ${all} shown` }, ...none }, () => [{ kind: "element", element: propertyList(host, changing) }]);
}

/** The properties as a list in the menu: each its name and eye; Hide all or Show all. Written at once and drawn anew in place, the menu staying open */
function propertyList(host: ViewHost, changing?: (focus: PropertiesFocus) => void): HTMLElement {
  const doc = host.document;
  const box = el(doc, "div", { class: "swd-shown-list" });
  const set = (hidden: readonly string[], focus: PropertiesFocus) => {
    changing?.(focus);
    return host.look.setHiddenProperties(hidden).then(() => {
      draw();
      focusPropertyList(box, focus);
    });
  };
  function draw(): void {
    const { properties } = host.database;
    // (Each change read against what is hidden as it is made: one written meanwhile kept)
    const hiddenNow = () => host.look.hiddenProperties;
    const hidden = new Set(hiddenNow());
    const allHidden = properties.length > 0 && properties.every((one) => hidden.has(one.key));
    const head = el(
      doc,
      "div",
      "swd-shown-head",
      el(doc, "span", { text: "Shown in this view" }),
      el(doc, "button", { class: "swd-shown-all", text: allHidden ? "Show all" : "Hide all", run: () => void set(allHidden ? [] : properties.map((one) => one.key), { part: "all" }) }),
    );
    const rows = el(
      doc,
      "div",
      { class: "swd-shown-rows", attrs: { role: "list", "aria-label": "Properties shown in this view" } },
      ...properties.map((property) => {
        const shown = !hidden.has(property.key);
        const eye = el(doc, "button", {
          class: "swd-shown-eye",
          html: shown ? ICONS.shown : ICONS.hidden,
          title: shown ? `Hide ${property.label} in this view` : `Show ${property.label} in this view`,
          attrs: { "aria-pressed": pressed(shown), "aria-label": `Show ${property.label}` },
          run: () => {
            const kept = hiddenNow().filter((one) => one !== property.key);
            void set(shown ? [...kept, property.key] : kept, { part: "eye", property: property.key });
          },
        });
        return el(
          doc,
          "div",
          { class: `swd-shown-row${shown ? "" : " swd-shown-off"}`, attrs: { role: "listitem", "data-property": property.key } },
          el(doc, "span", { class: "swd-shown-label", text: property.label }),
          eye,
        );
      }),
    );
    box.replaceChildren(head, rows);
  }
  draw();
  return box;
}
