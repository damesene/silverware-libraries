// The board: a column per value of a select property (its meta's `groupBy`;
// none set: the database's first select), first a column for items of none
// where there are any, one
// for each value kept that is none of its options (so no item is out of
// sight), a card per item in the order by hand. A card is dragged to another
// column (its value set there) or within one (its place: `move`, the item's
// rank alone written); a card's column changes too through its value (the
// table, the peek). + adds an item in its column. Sorted (the bar's sort), cards change column only: an order by
// hand would not show.
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import type { Item, Property } from "../../model/database.ts";
import { shownValue } from "../editors.ts";
import { missing, missingPill, optionPill, valueNodes } from "../values.ts";

// What a card dragged carries: its own type, so dropped on the page's text it inserts nothing there
const DRAG_TYPE = "application/x-silverware-database-item";

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="3.5" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="6.25" y="2.5" width="3.5" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="2.5" width="3.5" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

// A drag going on: the card dragged, the line showing where it goes (before the card `before`, null: at the column's end), the
// column it is over
type Drag = { item?: Item; line?: HTMLElement; before?: string | null; over?: HTMLElement };

// A column: the value its cards have (undefined: none), what it is called
type Column = { readonly value: string | undefined; readonly label: string; readonly items: Item[] };

/** The select property a board groups by: the one picked (Group by in ⋯, the place's `listing.group`), else the first */
function groupedBy(host: ViewHost): Property | undefined {
  const selects = host.database.properties.filter((property) => host.type(property).name === "select");
  return selects.find((property) => property.key === host.listing.group) ?? selects[0];
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
  // The column of none only where an item has no value, and first
  const none = columns.get(undefined)!;
  columns.delete(undefined);
  return none.items.length ? [none, ...columns.values()] : [...columns.values()];
}

function draw(host: ViewHost, element: HTMLElement, drag: Drag): void {
  const doc = host.document;
  const by = groupedBy(host);
  if (!by) {
    element.replaceChildren(el(doc, "p", { class: "swd-place-note", text: "A board groups by a property of the type select: this database has none." }));
    return;
  }
  const sorted = host.listing.sort.length > 0;
  const columns = columnsOf(host, by);
  const board = el(doc, "div", "swd-board", ...columns.map((column) => columnElement(host, by, column, columns, drag, sorted)));
  edgeScroll(board, drag);
  element.replaceChildren(board);
}

// How near the board's left or right edge a card dragged scrolls it (px; a sixth of a narrow board at most), and how fast at
// the edge itself (px a second, whatever the screen's frame rate)
const EDGE = 72;
const EDGE_SPEED = 1300;
// A drag's last word older than this (a browser tells a drag's place again at least every 350 ms or so, moved or not;
// the drag ended without telling): the scroll stops
const EDGE_QUIET_MS = 500;

/**
 * A card dragged near the board's left or right edge scrolls the board that way, the faster the nearer the edge, as
 * long as it is held there; away from the edges, out of the board, or the drag over, it stops. Either way alike.
 */
function edgeScroll(board: HTMLElement, drag: Drag): void {
  const at = { x: 0, when: 0, running: false, inside: false, last: 0 };
  const view = board.ownerDocument.defaultView;
  const step = (now: number) => {
    if (!drag.item || !at.inside || performance.now() - at.when > EDGE_QUIET_MS || !board.isConnected) return void (at.running = false);
    const seconds = Math.min(0.05, (now - at.last) / 1000);
    at.last = now;
    const box = board.getBoundingClientRect();
    const edge = Math.min(EDGE, box.width / 6);
    const left = at.x - box.left;
    const right = box.right - at.x;
    const by = (distance: number) => Math.ceil(((edge - Math.max(0, distance)) / edge) * EDGE_SPEED * seconds);
    if (left < edge && board.scrollLeft > 0) board.scrollLeft -= by(left);
    else if (right < edge && board.scrollLeft < board.scrollWidth - board.clientWidth) board.scrollLeft += by(right);
    view?.requestAnimationFrame(step);
  };
  board.addEventListener("dragover", (event) => {
    if (!carries(event, drag)) return;
    at.x = event.clientX;
    at.when = performance.now();
    at.inside = true;
    if (at.running || !view) return;
    at.running = true;
    at.last = performance.now();
    view.requestAnimationFrame(step);
  });
  // (Out of the board: no more scrolling, at once)
  board.addEventListener("dragleave", (event) => {
    if (!board.contains(event.relatedTarget as Node | null)) at.inside = false;
  });
}

/**
 * Whether a drag over the board is one of its cards: one started on it (`drag.item`) carrying its own type (a browser
 * that tells no dragend to a card drawn anew leaves `drag.item` set: a text or a file dragged after it is no card)
 */
function carries(event: DragEvent | Event, drag: Drag): boolean {
  if (!drag.item) return false;
  const data = (event as DragEvent).dataTransfer;
  return !data || [...data.types].includes(DRAG_TYPE);
}

/** A drag over (dropped, put aside): its line and its column's mark gone */
function endDrag(drag: Drag): void {
  drag.line?.remove();
  drag.over?.classList.remove("swd-drop");
  drag.item = undefined;
  drag.line = undefined;
  drag.before = undefined;
  drag.over = undefined;
}

function columnElement(host: ViewHost, by: Property, column: Column, columns: readonly Column[], drag: Drag, sorted: boolean): HTMLElement {
  const doc = host.document;
  const cards = el(doc, "div", "swd-board-cards", ...column.items.map((item) => card(host, by, item, drag)));
  const box = el(
    doc,
    "section",
    { class: "swd-board-column", attrs: { "data-value": column.value ?? "", "aria-label": column.label } },
    el(
      doc,
      "h3",
      "swd-board-title",
      column.value === undefined ? el(doc, "span", { class: `swd-board-none${by.required ? " swd-board-missing" : ""}`, text: column.label, ...(by.required ? { title: `${by.label} is required: these items have none yet` } : {}) }) : optionPill(doc, by, column.value),
      el(doc, "span", { class: "swd-board-count", text: String(column.items.length) }),
    ),
    cards,
    el(doc, "button", { class: "swd-board-add", text: "+ New", title: `Add an item to ${column.label}`, run: () => void host.create({ values: column.value === undefined ? {} : { [by.key]: column.value } }) }),
  );
  box.addEventListener("dragover", (event) => {
    if (!carries(event, drag)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    if (drag.over !== box) {
      drag.over?.classList.remove("swd-drop");
      drag.over = box;
      box.classList.add("swd-drop");
    }
    // Sorted, a card goes to a column only (no order by hand shows): no line among the cards
    if (sorted) return void drag.line?.remove();
    // The line before the first card whose middle is under the pointer, else at the column's end
    const others = [...cards.querySelectorAll<HTMLElement>(".swd-board-card")].filter((one) => one.dataset.item !== drag.item!.key);
    const next = others.find((one) => {
      const rect = one.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    const before = next?.dataset.item ?? null;
    if (drag.line?.parentElement === cards && drag.before === before) return;
    drag.line ??= el(doc, "div", { class: "swd-board-drop-line", attrs: { "aria-hidden": "true" } });
    drag.before = before;
    cards.insertBefore(drag.line, next ?? null);
  });
  box.addEventListener("dragleave", (event) => {
    // (Left for a card or a line within it: still over it)
    if (box.contains(event.relatedTarget as Node | null)) return;
    box.classList.remove("swd-drop");
    if (drag.over === box) drag.over = undefined;
    if (drag.line?.parentElement === cards) drag.line.remove();
  });
  box.addEventListener("drop", (event) => {
    // (Not a card of this board's drag: a text, a file, a drag left over from a board drawn anew: nothing written)
    if (!carries(event, drag) || (event.dataTransfer && event.dataTransfer.getData(DRAG_TYPE) !== drag.item!.key)) return void endDrag(drag);
    event.preventDefault();
    const item = drag.item;
    const before = drag.before;
    endDrag(drag);
    if (!item) return;
    const same = column.items.some((one) => one.key === item.key);
    const rest = column.items.filter((one) => one.key !== item.key);
    // Sorted (no order by hand shown): its column alone; in its own column nothing moves
    if (sorted) return same ? undefined : void host.move(item, { values: { [by.key]: column.value } });
    const target = before ? rest.find((one) => one.key === before) : undefined;
    // Where it is already (before the card after it, or at the end as the last): nothing moves
    if (same) {
      const at = column.items.findIndex((one) => one.key === item.key);
      if ((target && column.items[at + 1]?.key === target.key) || (!target && at === column.items.length - 1)) return;
    }
    const last = rest.at(-1);
    const place = target ? { before: target } : last ? { after: last } : {};
    // In its own column only its place changes: its value (a list, a number) is never written as the column's text
    void host.move(item, same ? place : { ...place, values: { [by.key]: column.value } });
  });
  return box;
}

function card(host: ViewHost, by: Property, item: Item, drag: Drag): HTMLElement {
  const doc = host.document;
  const box = el(
    doc,
    "article",
    { class: "swd-board-card", attrs: { draggable: "true", "data-item": item.key } },
    el(doc, "button", { class: "swd-board-name", title: `Open ${item.name}`, text: item.name, run: () => void host.open(item) }),
    ...host.database.properties.flatMap((property) => {
      if (property.hidden || property.key === by.key) return [];
      // A required one without a value said missing; else nothing where empty
      if (missing(host, item, property)) return [el(doc, "span", { class: "swd-board-value", attrs: { "data-key": property.key } }, missingPill(doc, property))];
      if (shownValue(host, item, property) === undefined) return [];
      // (A checkbox its property's name where ticked; any other value as the views draw it: a select's as pills)
      const shown = host.type(property).name === "checkbox" ? [shownValue(host, item, property)!] : valueNodes(host, item, property);
      return [el(doc, "span", { class: "swd-board-value", title: property.label, attrs: { "data-key": property.key } }, ...shown)];
    }),
  );
  box.addEventListener("dragstart", (event) => {
    drag.item = item;
    event.dataTransfer?.setData(DRAG_TYPE, item.key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    // (Faded once the browser has taken its picture of the card: the picture is the card as it is)
    requestAnimationFrame(() => box.classList.add("swd-dragging"));
  });
  box.addEventListener("dragend", () => {
    box.classList.remove("swd-dragging");
    endDrag(drag);
  });
  return box;
}

export const BOARD_VIEW: ViewDefinition = {
  name: "board",
  label: "Board",
  icon: ICON,
  // A column per option of a select: always grouped, by the first select where none is picked
  groupBy: { types: ["select"], required: true, draws: true },
  render(host, element) {
    const drag: Drag = {};
    draw(host, element, drag);
    return { update: () => draw(host, element, drag) };
  },
};
