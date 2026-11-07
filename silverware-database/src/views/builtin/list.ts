// The list: an item a line, its name and the values of its properties not
// hidden in the views (Properties, the eye), those it has, each as its type
// shows it. (Its own Properties button, a list's own pick of them kept as
// `list.properties`, went on 2026-11-07: the schema hides a property for every
// view; a block keeping the key of before is read as nothing.)
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import type { Item } from "../../model/database.ts";
import { shownValue } from "../editors.ts";
import { rowGrip } from "../order.ts";
import { missing, missingPill, problemOf, valueNodes } from "../values.ts";

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4h9M5 8h9M5 12h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.5" cy="4" r="1" fill="currentColor"/><circle cx="2.5" cy="8" r="1" fill="currentColor"/><circle cx="2.5" cy="12" r="1" fill="currentColor"/></svg>';

function line(host: ViewHost, item: Item, list: () => HTMLElement): HTMLElement {
  const doc = host.document;
  // (A required one without a value too: said missing)
  const shown = host.database.properties.filter((property) => !property.hidden && (shownValue(host, item, property) !== undefined || missing(host, item, property)));
  const li: HTMLElement = el(doc, "li", { class: "swd-list-item", attrs: { "data-item": item.key } });
  li.append(
    // Its grip first: dragged to its place by hand
    rowGrip(host, item, () => li, list, ":scope > li"),
    el(doc, "button", { class: "swd-list-name", title: `Open ${item.name}`, text: item.name, run: () => void host.open(item) }),
    ...shown.map((property) => {
      const problem = problemOf(host, item, property);
      // (A checkbox its property's name where ticked; any other value as the views draw it: a select's as pills)
      const shown = missing(host, item, property) ? [missingPill(doc, property)] : host.type(property).name === "checkbox" ? [shownValue(host, item, property)!] : valueNodes(host, item, property);
      return el(doc, "span", { class: `swd-list-value${problem ? " swd-invalid" : ""}`, title: problem ?? property.label, attrs: { "data-key": property.key } }, ...shown);
    }),
  );
  return li;
}

function draw(host: ViewHost, element: HTMLElement): void {
  const doc = host.document;
  const list: HTMLElement = el(doc, "ul", "swd-list");
  list.append(...host.items.map((item) => line(host, item, () => list)));
  element.replaceChildren(
    list,
    el(doc, "div", "swd-table-foot", el(doc, "button", { class: "swd-table-add", text: "+ New", title: "Add an item", run: () => void host.create() })),
  );
}

export const LIST_VIEW: ViewDefinition = {
  name: "list",
  label: "List",
  icon: ICON,
  render(host, element) {
    draw(host, element);
    return { update: () => draw(host, element) };
  },
};
