// The list: an item a line, its name and the values of the properties the
// view shows (its meta's `properties`, picked by its Properties button; none
// picked: every property with a value), each as its type shows it.
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import type { Item } from "../../model/database.ts";
import { shownValue } from "../editors.ts";

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4h9M5 8h9M5 12h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.5" cy="4" r="1" fill="currentColor"/><circle cx="2.5" cy="8" r="1" fill="currentColor"/><circle cx="2.5" cy="12" r="1" fill="currentColor"/></svg>';

/** The keys the view shows (its meta's, those still in the database), none picked: undefined */
function picked(host: ViewHost): readonly string[] | undefined {
  const kept = host.getMeta("properties");
  if (!Array.isArray(kept)) return undefined;
  const keys = new Set(host.database.properties.map((one) => one.key));
  return kept.filter((key): key is string => typeof key === "string" && keys.has(key));
}

function line(host: ViewHost, item: Item, keys: readonly string[] | undefined): HTMLElement {
  const doc = host.document;
  const shown = host.database.properties.filter((property) => (keys ? keys.includes(property.key) : true) && shownValue(host, item, property) !== undefined);
  return el(
    doc,
    "li",
    { class: "swd-list-item", attrs: { "data-item": item.key } },
    el(doc, "button", { class: "swd-list-name", title: `Open ${item.name}`, text: item.name, run: () => void host.open(item) }),
    ...shown.map((property) => {
      const value = item.values[property.key];
      const problem = value === undefined ? undefined : host.type(property).validate(value, property.params);
      return el(doc, "span", { class: `swd-list-value${problem ? " swd-invalid" : ""}`, title: problem ?? property.label, attrs: { "data-key": property.key } }, shownValue(host, item, property)!);
    }),
  );
}

/** The Properties button: a box per property, the list showing those ticked (written into the view's meta as it is closed) */
function chooser(host: ViewHost): HTMLElement {
  const doc = host.document;
  const keys = picked(host);
  const panel = el(doc, "div", { class: "swd-list-chooser", attrs: { hidden: "" } });
  const boxes = host.database.properties.map((property) => {
    const box = el(doc, "input", { attrs: { type: "checkbox", value: property.key } });
    box.checked = keys ? keys.includes(property.key) : true;
    panel.append(el(doc, "label", undefined, box, property.label));
    return box;
  });
  const button = el(doc, "button", {
    class: "swd-list-properties",
    text: "Properties",
    attrs: { "aria-expanded": "false" },
    run: () => {
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      // Closed: written where it changed (all ticked: none picked, every value shown)
      if (!open) {
        const ticked = boxes.filter((box) => box.checked).map((box) => box.value);
        const next = ticked.length === boxes.length ? undefined : ticked;
        if (JSON.stringify(next) !== JSON.stringify(keys)) void host.setMeta({ properties: next }).then(() => host.refresh());
      }
    },
  });
  return el(doc, "div", "swd-list-head", button, panel);
}

function draw(host: ViewHost, element: HTMLElement): void {
  const doc = host.document;
  const keys = picked(host);
  element.replaceChildren(
    chooser(host),
    el(doc, "ul", "swd-list", ...host.items.map((item) => line(host, item, keys))),
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
