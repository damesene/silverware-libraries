// The board: a column per group of its items by a property (Group in ⋯: any
// property; none picked, the database's first select, else its first
// property), as the place groups them (`host.grouping`): a select's options in
// their order, then values that are none of them, a column of none first where
// an item has none, those hidden left out, in the order given them. A card is
// dragged to another column (its value set to that column's; a multi-select's
// one value of the column it left replaced, the rest kept) or within one (its
// place: `move`, the item's rank alone written); a card's column changes too
// through its value (the table, the peek). + adds an item in its column.
// Sorted (the bar's sort), cards change column only: an order by hand would
// not show. Grouped by a property not changed by hand, a card keeps its column.
import { el } from "../../../../shared/elements.ts";
import type { ItemGroup, ViewDefinition, ViewHost } from "../../core/view.ts";
import { movedValue } from "../../domain/grouping.ts";
import type { Item, Property } from "../../model/database.ts";
import { edgeScroll } from "../edgescroll.ts";
import { fieldNodes, optionPill } from "../values.ts";

// What a card dragged carries: its own type, so dropped on the page's text it inserts nothing there
const DRAG_TYPE = "application/x-silverware-database-item";

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="3.5" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="6.25" y="2.5" width="3.5" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="2.5" width="3.5" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

// A drag going on: the card dragged and the column it left, the line showing where it goes (before the card `before`, null: at
// the column's end), the column it is over
type Drag = { item?: Item; from?: ItemGroup; line?: HTMLElement; before?: string | null; over?: HTMLElement };

function draw(host: ViewHost, element: HTMLElement, drag: Drag): void {
  const doc = host.document;
  const grouping = host.grouping;
  if (!grouping) {
    element.replaceChildren(el(doc, "p", { class: "swd-place-note", text: "A board groups its items by a property: this database has none yet." }));
    return;
  }
  const sorted = host.listing.sort.length > 0;
  const by = grouping.property;
  const board = el(doc, "div", "swd-board", ...grouping.groups.map((column) => columnElement(host, by, column, drag, sorted)));
  boardEdgeScroll(board, drag);
  element.replaceChildren(board);
}

// A drag's last word older than this (a browser tells a drag's place again at least every 350 ms or so, moved or not;
// the drag ended without telling): the scroll stops
const EDGE_QUIET_MS = 500;

/**
 * A card dragged near the board's left or right edge scrolls the board that way (views/edgescroll.ts), as long as it is
 * held there; out of the board, or the drag over, it stops
 */
function boardEdgeScroll(board: HTMLElement, drag: Drag): void {
  const scroll = edgeScroll(board, { quietMs: EDGE_QUIET_MS });
  board.addEventListener("dragover", (event) => {
    if (!carries(event, drag)) return;
    scroll.at(event.clientX);
  });
  // (Out of the board: no more scrolling, at once)
  board.addEventListener("dragleave", (event) => {
    if (!board.contains(event.relatedTarget as Node | null)) scroll.stop();
  });
  board.addEventListener("drop", () => scroll.stop());
  board.addEventListener("dragend", () => scroll.stop());
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
  drag.from = undefined;
  drag.line = undefined;
  drag.before = undefined;
  drag.over = undefined;
}

/** A column's title: a select's value as its pill, else the group's label (a value that is none of the options said so) */
function title(host: ViewHost, by: Property, column: ItemGroup): HTMLElement {
  const doc = host.document;
  if (column.value === undefined) return el(doc, "span", { class: `swd-board-none${by.required ? " swd-board-missing" : ""}`, text: column.label, ...(by.required ? { title: `${by.label} is required: these items have none yet` } : {}) });
  const one = Array.isArray(column.value) ? column.value[0] : column.value;
  if (host.type(by).look === "options" && typeof one === "string") return optionPill(doc, by, one, host.type(by), host.openMention);
  return el(doc, "span", { class: `swd-board-label${column.known ? "" : " swd-invalid"}`, text: column.label });
}

/** The column's value as text on its element (`data-value`): a list's one value; empty for none */
function valueText(column: ItemGroup): string {
  const one = Array.isArray(column.value) ? column.value[0] : column.value;
  return one === undefined ? "" : String(one);
}

function columnElement(host: ViewHost, by: Property, column: ItemGroup, drag: Drag, sorted: boolean): HTMLElement {
  const doc = host.document;
  const cards = el(doc, "div", "swd-board-cards", ...column.items.map((item) => card(host, by, item, column, drag)));
  // An item added here gets the column's value, where the property is changed by hand
  const values = column.value === undefined || by.readonly ? {} : { [by.key]: column.value };
  const box = el(
    doc,
    "section",
    { class: "swd-board-column", attrs: { "data-value": valueText(column), "data-group": column.key, "aria-label": column.label } },
    el(doc, "h3", "swd-board-title", title(host, by, column), el(doc, "span", { class: "swd-board-count", text: String(column.items.length) })),
    cards,
    el(doc, "button", { class: "swd-board-add", text: "+ New", title: `Add an item to ${column.label}`, run: () => void host.create({ values }) }),
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
    const from = drag.from;
    const before = drag.before;
    endDrag(drag);
    if (!item) return;
    // Dropped in the column it came from; a multi-select's item in another of its columns already: nothing to move there
    const same = from?.key === column.key;
    if (!same && column.items.some((one) => one.key === item.key)) return;
    // A property not changed by hand: the card keeps its column
    if (!same && by.readonly) return void host.notify(`${by.label} is not changed by hand: the card stays in its column`);
    const values = { [by.key]: movedValue(item.values[by.key], from, column, host.type(by), by.params) };
    const rest = column.items.filter((one) => one.key !== item.key);
    // Sorted (no order by hand shown): its column alone; in its own column nothing moves
    if (sorted) return same ? undefined : void host.move(item, { values });
    const target = before ? rest.find((one) => one.key === before) : undefined;
    // Where it is already (before the card after it, or at the end as the last): nothing moves
    if (same) {
      const at = column.items.findIndex((one) => one.key === item.key);
      if ((target && column.items[at + 1]?.key === target.key) || (!target && at === column.items.length - 1)) return;
    }
    const last = rest.at(-1);
    const place = target ? { before: target } : last ? { after: last } : {};
    // In its own column only its place changes: its value (a list, a number) is never written as the column's text
    void host.move(item, same ? place : { ...place, values });
  });
  return box;
}

function card(host: ViewHost, by: Property, item: Item, column: ItemGroup, drag: Drag): HTMLElement {
  const doc = host.document;
  const box = el(
    doc,
    "article",
    { class: "swd-board-card", attrs: { draggable: "true", "data-item": item.key } },
    el(doc, "button", { class: "swd-board-name", title: `Open ${item.name}`, run: () => void host.open(item) }, host.look.icon(item), item.name),
    ...host.look.shownProperties.flatMap((property) => {
      if (property.key === by.key) return [];
      // (As it stands alone: a required one without a value said missing, nothing where empty)
      const shown = fieldNodes(host, item, property);
      return shown.length ? [el(doc, "span", { class: "swd-board-value", title: property.label, attrs: { "data-key": property.key } }, ...shown)] : [];
    }),
  );
  host.look.item(item, box);
  box.addEventListener("dragstart", (event) => {
    drag.item = item;
    drag.from = column;
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
  // A column per group: always grouped, by any property, the first select where none is picked
  groupBy: { required: true, draws: true, prefer: ["select"] },
  render(host, element) {
    const drag: Drag = {};
    draw(host, element, drag);
    return { update: () => draw(host, element, drag) };
  },
};
