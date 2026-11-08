// The table: a row per item, a column per property (the name first), each
// value as its type shows it. The basic table of a space without Silverware
// Table, which is to offer a table of its own over a database (its formulas,
// column types, widths): so this one stays small, and what every view needs
// (the filter, the sort, Undo) is the place's bar, not the table's. A click on
// a cell edits it (editors.ts), a checkbox turns at once, a header sorts by its
// column (ascending, descending, none).
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import type { Item, Property } from "../../model/database.ts";
import { editValue, NAME, toggle } from "../editors.ts";
import { rowGrip } from "../order.ts";
import { missing, problemOf, valueNodes } from "../values.ts";

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 7h12M6 3v10" stroke="currentColor" stroke-width="1.3"/></svg>';

type Column = { readonly key: string; readonly label: string; readonly property?: Property };

/** The next sort a header's click asks: ascending, then descending, then none (the order by hand) */
function nextSort(host: ViewHost, key: string) {
  const now = host.listing.sort[0];
  if (now?.key !== key) return [{ key, direction: "asc" as const }];
  return now.direction === "asc" ? [{ key, direction: "desc" as const }] : [];
}

// The cell being edited, and whether the data changed meanwhile (drawn once the edit ends)
type Editing = { cell?: HTMLElement; pending: boolean; redraw: () => void };

function draw(host: ViewHost, element: HTMLElement, editing: Editing): void {
  const doc = host.document;
  const columns: Column[] = [{ key: NAME, label: "Name" }, ...host.database.properties.filter((property) => !property.hidden).map((property) => ({ key: property.key, label: property.label, property }))];
  const sorted = host.listing.sort[0];
  const head = el(
    doc,
    "tr",
    undefined,
    // (The grips' column: no name)
    el(doc, "th", { class: "swd-table-gripcol", attrs: { scope: "col", "aria-label": "Order" } }),
    ...columns.map((column) =>
      el(
        doc,
        "th",
        { attrs: { scope: "col", "aria-sort": sorted?.key === column.key ? (sorted.direction === "asc" ? "ascending" : "descending") : undefined } },
        el(doc, "button", { class: "swd-table-sort", title: `Sort by ${column.label}`, run: () => void host.listing.setSort(nextSort(host, column.key)) }, ...headLabel(doc, column.label, sorted?.key === column.key ? (sorted.direction === "asc" ? "↑" : "↓") : undefined)),
      ),
    ),
    el(doc, "th", { class: "swd-table-actions", attrs: { scope: "col", "aria-label": "Actions" } }),
  );
  const body = el(doc, "tbody");
  const rows = host.items.map((item) => {
    const tr: HTMLElement = el(doc, "tr", { attrs: { "data-item": item.key } });
    // Its grip first: dragged to its place by hand
    tr.append(el(doc, "td", "swd-table-grip", rowGrip(host, item, () => tr, () => body, ":scope > tr")), ...columns.map((column) => cell(host, item, column, editing)), actions(host, item));
    return tr;
  });
  body.append(...rows);
  const add = el(doc, "button", { class: "swd-table-add", text: "+ New", title: "Add an item", run: () => void host.create() });
  const shown = host.items.length === host.total ? "" : `${host.items.length} of ${host.total} shown`;
  element.replaceChildren(
    el(doc, "div", "swd-table-box", el(doc, "table", "swd-table", el(doc, "thead", undefined, head), body)),
    el(doc, "div", "swd-table-foot", add, shown && el(doc, "span", { class: "swd-table-count", text: shown })),
  );
}

/** A value's cell: as its type shows it (invalid: marked, its reason the title), edited by a click (a checkbox turned) */
function cell(host: ViewHost, item: Item, column: Column, editing: Editing): HTMLElement {
  const doc = host.document;
  const { property } = column;
  // (Its type named on it: the style page keeps a date or a number on one line)
  const td = el(doc, "td", { attrs: { "data-key": column.key, ...(property ? { "data-type": host.type(property).name } : {}) } });
  const show = () => {
    const was = editing.cell === td;
    if (was) editing.cell = undefined;
    td.classList.remove("swd-editing");
    td.replaceChildren(...content(host, item, column));
    // An edit ended (saved or put aside) with the data changed meanwhile: drawn now
    if (was && editing.pending) {
      editing.pending = false;
      queueMicrotask(editing.redraw);
    }
  };
  show();
  const problem = property ? problemOf(host, item, property) : undefined;
  if (problem) {
    td.classList.add("swd-invalid");
    td.title = problem;
  }
  // A required value missing: its cell says so (the style page's word in it)
  if (property && missing(host, item, property)) td.classList.add("swd-missing");
  if (property?.readonly) td.classList.add("swd-readonly");
  else if (property && host.type(property).editor === "toggle") return td;
  else {
    const edit = () => {
      if (editing.cell === td) return;
      editing.cell = td;
      // What the cell showed stays under its editor, hidden, holding the row's height and the column's width whatever the
      // table's layout (one scrolled sideways sizes columns by their content); the editor is laid over it (style page)
      const shown = [...td.childNodes];
      td.classList.add("swd-editing");
      editValue(host, td, item, column.key, show);
      // (Only where an editor took the cell: else what it shows stays as it is)
      if (editing.cell === td && td.querySelector(":scope > .swd-editor") && !shown.some((node) => td.contains(node))) td.append(el(host.document, "span", { class: "swd-editing-held", attrs: { "aria-hidden": "true" } }, ...shown));
    };
    // Reached by Tab, edited by Enter or F2, as a click edits it
    td.tabIndex = 0;
    td.addEventListener("click", (event) => {
      // (A link in it is followed, not edited)
      if (!(event.target as Element).closest("a, button")) edit();
    });
    td.addEventListener("keydown", (event) => {
      if (event.target !== td || (event.key !== "Enter" && event.key !== "F2")) return;
      event.preventDefault();
      edit();
    });
  }
  return td;
}

/** A header's name and its sort's arrow: the arrow held to the name's last word (never on a line of its own where the name wraps) */
function headLabel(doc: Document, label: string, arrow: string | undefined): Node[] {
  if (!arrow) return [doc.createTextNode(label)];
  const cut = label.search(/\S+\s*$/);
  const head = cut > 0 ? label.slice(0, cut) : "";
  return [doc.createTextNode(head), el(doc, "span", { class: "swd-table-sort-end", text: `${label.slice(head.length)}\u00a0${arrow}` })];
}

/** What a cell shows: the name with a button opening its page, a checkbox turned by a click, else the value's text */
function content(host: ViewHost, item: Item, column: Column): Node[] {
  const doc = host.document;
  // The name and its ↗ in one line of text: the ↗ right after the name's last word, held to it (never on a line of its own,
  // never off at the cell's edge where the name wraps)
  if (column.key === NAME) {
    // (Its ↗ drawn by the style page: the name's text is the name alone)
    const open = el(doc, "button", { class: "swd-open", title: `Open ${item.name}`, attrs: { "aria-label": `Open ${item.name}` }, run: () => void host.open(item) });
    const cut = item.name.search(/\S+\s*$/);
    const head = cut > 0 ? item.name.slice(0, cut) : "";
    const last = item.name.slice(head.length);
    return [el(doc, "span", "swd-table-name", head, el(doc, "span", "swd-table-name-end", last, open))];
  }
  const { property } = column;
  if (property && host.type(property).look === "check") {
    const box = el(doc, "input", { attrs: { type: "checkbox", "aria-label": `${property.label} of ${item.name}` } });
    box.checked = item.values[property.key] === true;
    box.disabled = property.readonly;
    box.addEventListener("change", () => void toggle(host, item, property.key));
    return [box];
  }
  return property ? valueNodes(host, item, property) : [doc.createTextNode(host.text(item, column.key))];
}

function actions(host: ViewHost, item: Item): HTMLElement {
  const doc = host.document;
  return el(doc, "td", "swd-table-actions", el(doc, "button", { class: "swd-remove", title: `Remove ${item.name}`, text: "✕", attrs: { "aria-label": `Remove ${item.name}` }, run: () => void host.remove([item]) }));
}

export const TABLE_VIEW: ViewDefinition = {
  name: "table",
  label: "Table",
  icon: ICON,
  render(host, element) {
    // A cell being edited is kept: the data changed meanwhile drawn once it is saved or put aside (its `show`)
    const editing: Editing = { pending: false, redraw: () => draw(host, element, editing) };
    const update = () => {
      if (editing.cell?.isConnected) editing.pending = true;
      else draw(host, element, editing);
    };
    draw(host, element, editing);
    return { update };
  },
};
