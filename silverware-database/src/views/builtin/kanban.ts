// The kanban: a column per value of a select property (its meta's `groupBy`;
// none set: the database's first select), a column for items of none, one
// for each value kept that is none of its options (so no item is out of
// sight), a card per item in the order by hand. A card is dragged to another
// column (its value set there) or within one (its place: `move`, the item's
// rank alone written); a card's Move to… does the same from the keys or a
// touch screen, as dragging on a phone is brittle. + adds an item in its
// column. Sorted (the bar's sort), cards change column only: an order by
// hand would not show.
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import type { Item, Property } from "../../model/database.ts";
import { pickFrom, shownValue } from "../editors.ts";

// What a card dragged carries: its own type, so dropped on the page's text it inserts nothing there
const DRAG_TYPE = "application/x-silverware-database-item";

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="3.5" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="6.25" y="2.5" width="3.5" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="2.5" width="3.5" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

// A column: the value its cards have (undefined: none), what it is called
type Column = { readonly value: string | undefined; readonly label: string; readonly items: Item[] };

/** The select properties a kanban can group by, and the one it does */
function grouping(host: ViewHost): { readonly selects: readonly Property[]; readonly by: Property | undefined } {
  const selects = host.database.properties.filter((property) => host.type(property).name === "select");
  const kept = host.getMeta("groupBy");
  return { selects, by: selects.find((property) => property.key === kept) ?? selects[0] };
}

function columnsOf(host: ViewHost, by: Property): Column[] {
  const options = Array.isArray(by.params.options) ? by.params.options.filter((one): one is string => typeof one === "string") : [];
  const columns = new Map<string | undefined, Column>([[undefined, { value: undefined, label: `No ${by.label}`, items: [] }]]);
  for (const option of options) columns.set(option, { value: option, label: option, items: [] });
  for (const item of host.items) {
    const raw = item.values[by.key];
    const value = typeof raw === "string" && raw ? raw : raw === undefined || raw === null || raw === "" ? undefined : String(raw);
    if (!columns.has(value)) columns.set(value, { value, label: `${value} (none of its options)`, items: [] });
    columns.get(value)!.items.push(item);
  }
  // The column of none first only where it has cards: an empty one goes last, as a place to drop a card
  const none = columns.get(undefined)!;
  columns.delete(undefined);
  return none.items.length ? [none, ...columns.values()] : [...columns.values(), none];
}

function draw(host: ViewHost, element: HTMLElement, drag: { item?: Item }): void {
  const doc = host.document;
  const { selects, by } = grouping(host);
  if (!by) {
    element.replaceChildren(el(doc, "p", { class: "swd-place-note", text: "A kanban groups by a property of the type select: this database has none." }));
    return;
  }
  const picker = el(doc, "select", { class: "swd-kanban-by", attrs: { "aria-label": "Group by" } }, ...selects.map((property) => new Option(property.label, property.key, false, property.key === by.key)));
  picker.addEventListener("change", () => void host.setMeta({ groupBy: picker.value }).then(() => host.refresh()));
  const sorted = host.listing.sort.length > 0;
  const columns = columnsOf(host, by);
  element.replaceChildren(
    el(doc, "div", "swd-kanban-head", el(doc, "label", undefined, "Group by ", picker)),
    el(doc, "div", "swd-kanban", ...columns.map((column) => columnElement(host, by, column, columns, drag, sorted))),
  );
}

function columnElement(host: ViewHost, by: Property, column: Column, columns: readonly Column[], drag: { item?: Item }, sorted: boolean): HTMLElement {
  const doc = host.document;
  const cards = el(doc, "div", "swd-kanban-cards", ...column.items.map((item) => card(host, by, item, columns, drag)));
  const box = el(
    doc,
    "section",
    { class: "swd-kanban-column", attrs: { "data-value": column.value ?? "", "aria-label": column.label } },
    el(doc, "h3", { class: "swd-kanban-title", text: `${column.label} ${column.items.length}` }),
    cards,
    el(doc, "button", { class: "swd-kanban-add", text: "+ New", title: `Add an item to ${column.label}`, run: () => void host.create({ values: column.value === undefined ? {} : { [by.key]: column.value } }) }),
  );
  box.addEventListener("dragover", (event) => {
    if (!drag.item) return;
    event.preventDefault();
    box.classList.add("swd-drop");
  });
  box.addEventListener("dragleave", () => box.classList.remove("swd-drop"));
  box.addEventListener("drop", (event) => {
    event.preventDefault();
    box.classList.remove("swd-drop");
    const item = drag.item;
    drag.item = undefined;
    if (!item) return;
    // Before the card under the pointer, else at the column's end (sorted: its value alone, no place by hand)
    const under = (event.target as Element).closest<HTMLElement>(".swd-kanban-card");
    const same = column.items.some((one) => one.key === item.key);
    // Dropped on itself, or (sorted, no order by hand shown) in its own column: nothing moves
    if (same && (under?.dataset.item === item.key || sorted)) return;
    const before = sorted ? undefined : column.items.find((one) => one.key === under?.dataset.item && one.key !== item.key);
    const last = column.items.filter((one) => one.key !== item.key).at(-1);
    // In its own column at its end already (its last card, its only one): nothing moves
    if (same && !before && column.items.at(-1)?.key === item.key) return;
    const place = before ? { before } : !sorted && last ? { after: last } : {};
    // In its own column only its place changes: its value (a list, a number) is never written as the column's text
    void host.move(item, same ? place : { ...place, values: { [by.key]: column.value } });
  });
  return box;
}

function card(host: ViewHost, by: Property, item: Item, columns: readonly Column[], drag: { item?: Item }): HTMLElement {
  const doc = host.document;
  const value = item.values[by.key];
  // Move to…: a column by its place among the columns (one of none has no value to name it by)
  const mover = el(doc, "select", { class: "swd-kanban-move", attrs: { "aria-label": `Move ${item.name} to` } }, new Option("Move to…", "", true, true), ...columns.map((column, at) => new Option(column.label, String(at))));
  // Picked by the mouse, or by the keys and Enter (a closed list's arrows change it with each key on Windows)
  pickFrom(
    mover,
    () => {
      const target = columns[Number(mover.value)];
      const own = value === undefined || value === null || value === "" ? undefined : String(value);
      if (!mover.value || !target || target.value === own) return;
      const last = target.items.at(-1);
      void host.move(item, { ...(last ? { after: last } : {}), values: { [by.key]: target.value } });
    },
    { onLeave: false },
  );
  const box = el(
    doc,
    "article",
    { class: "swd-kanban-card", attrs: { draggable: "true", "data-item": item.key } },
    el(doc, "button", { class: "swd-kanban-name", title: `Open ${item.name}`, text: item.name, run: () => void host.open(item) }),
    ...host.database.properties.flatMap((property) => {
      const text = property.key === by.key ? undefined : shownValue(host, item, property);
      return text === undefined ? [] : [el(doc, "span", { class: "swd-kanban-value", title: property.label, text })];
    }),
    mover,
  );
  box.addEventListener("dragstart", (event) => {
    drag.item = item;
    event.dataTransfer?.setData(DRAG_TYPE, item.key);
  });
  box.addEventListener("dragend", () => {
    drag.item = undefined;
  });
  return box;
}

export const KANBAN_VIEW: ViewDefinition = {
  name: "kanban",
  label: "Kanban",
  icon: ICON,
  render(host, element) {
    const drag: { item?: Item } = {};
    draw(host, element, drag);
    return { update: () => draw(host, element, drag) };
  },
};
