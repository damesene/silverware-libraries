// The table: a row per item, a column per property (the name first), each
// value as its type shows it. The basic table of a space without Silverware
// Table, which is to offer a table of its own over a database (its formulas,
// column types, widths): so this one stays small, and what every view needs
// (the filter, the sort, Undo) is the place's bar, not the table's. A click on
// a cell edits it (editors.ts), a checkbox turns at once, a header sorts by its
// column (ascending, descending, none). Grouped (Group by in ⋯), it draws its
// groups itself: one table, a part of it per group (its head, its own header
// row, its rows, + New in it), so every group's columns are as wide as the
// others' (the browser lays them out together); a group folded keeps its rows
// in the layout, unseen, so folding moves no column.
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import type { Item, Property } from "../../model/database.ts";
import { editValue, NAME, toggle } from "../editors.ts";
import { createInGroup, foldedOf, groupHead, setFolded } from "../groups.ts";
import { ownIcon, VIEW_ICONS } from "../icons.ts";
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
  const columns: Column[] = [{ key: NAME, label: "Name" }, ...host.look.shownProperties.map((property) => ({ key: property.key, label: property.label, property }))];
  const sorted = host.listing.sort[0];
  // The header row: the table's, or each group's own
  const headRow = () => el(
    doc,
    "tr",
    "swd-table-headrow",
    // (The grips' column: no name)
    el(doc, "th", { class: "swd-table-gripcol", attrs: { scope: "col", "aria-label": "Order" } }),
    ...columns.map((column) =>
      el(
        doc,
        "th",
        { attrs: { scope: "col", "aria-sort": sorted?.key === column.key ? (sorted.direction === "asc" ? "ascending" : "descending") : undefined } },
        // (A property's own icon before its name; its type's left out here, a header of every column's would be busy)
        el(
          doc,
          "button",
          { class: "swd-table-sort", title: `Sort by ${column.label}`, run: () => void host.listing.setSort(nextSort(host, column.key)) },
          ...((own) => (own ? [host.look.ownIcon(own, "swd-table-head-icon")] : []))(column.property && ownIcon(column.property)),
          ...headLabel(doc, column.label, sorted?.key === column.key ? (sorted.direction === "asc" ? "↑" : "↓") : undefined),
        ),
      ),
    ),
    el(doc, "th", { class: "swd-table-actions", attrs: { scope: "col", "aria-label": "Actions" } }),
  );
  // An item's row: its grip first, dragged to its place by hand among the rows of its part (the table's body, its group's)
  const row = (item: Item, part: () => HTMLElement) => {
    const tr: HTMLElement = el(doc, "tr", { attrs: { "data-item": item.key } });
    host.look.item(item, tr);
    tr.append(el(doc, "td", "swd-table-grip", rowGrip(host, item, () => tr, part, ":scope > tr[data-item]")), ...columns.map((column) => cell(host, item, column, editing)), actions(host, item));
    return tr;
  };
  const shown = host.items.length === host.total ? "" : `${host.items.length} of ${host.total} shown`;
  const count = shown && el(doc, "span", { class: "swd-table-count", text: shown });
  const grouping = host.grouping;
  if (!grouping) {
    const body: HTMLElement = el(doc, "tbody");
    body.append(...host.items.map((item) => row(item, () => body)));
    const add = el(doc, "button", { class: "swd-table-add", text: "+ New", title: "Add an item", run: () => void host.create() });
    element.replaceChildren(el(doc, "div", "swd-table-box", el(doc, "table", "swd-table", el(doc, "thead", undefined, headRow()), body)), el(doc, "div", "swd-table-foot", add, count));
    return;
  }
  // Grouped: a part per group (its head over the whole width, its header row, its rows, + New adding in it)
  const folded = foldedOf(host);
  // (A group's head pressed: the focus on it again, the table drawn anew)
  const fold = (key: string, open: boolean) => setFolded(host, key, open).then(() => element.querySelector<HTMLElement>(`.swd-table-group[data-group="${CSS.escape(key)}"] .swd-group-head`)?.focus({ preventScroll: true }));
  const span = String(columns.length + 2);
  const parts = grouping.groups.map((group) => {
    const open = !folded.has(group.key);
    const part: HTMLElement = el(doc, "tbody", { class: `swd-table-group${open ? "" : " swd-folded"}`, attrs: { "data-group": group.key, "aria-label": `${grouping.property.label}: ${group.label}` } });
    part.append(
      el(doc, "tr", "swd-table-group-head", el(doc, "th", { attrs: { colspan: span, scope: "rowgroup" } }, groupHead(doc, group, open, () => void fold(group.key, open)))),
      headRow(),
      ...group.items.map((item) => row(item, () => part)),
      el(doc, "tr", "swd-table-group-add", el(doc, "td", { attrs: { colspan: span } }, el(doc, "button", { class: "swd-table-add", text: "+ New", title: `Add an item in ${group.label}`, run: () => void createInGroup(host, grouping.property, group) }))),
    );
    return part;
  });
  // (No group shown, all hidden or none there: + New under the table still, an item added with no group's value)
  const add = parts.length ? undefined : el(doc, "button", { class: "swd-table-add", text: "+ New", title: "Add an item", run: () => void host.create() });
  element.replaceChildren(el(doc, "div", "swd-table-box", el(doc, "table", "swd-table", ...parts)), ...(count || add ? [el(doc, "div", "swd-table-foot", add, count)] : []));
}

/** A value's cell: as its type shows it (invalid: marked, its reason the title), edited by a click (a checkbox turned) */
function cell(host: ViewHost, item: Item, column: Column, editing: Editing): HTMLElement {
  const doc = host.document;
  const { property } = column;
  // (Its type named on it: the style page keeps a date or a number on one line)
  const td = el(doc, "td", { attrs: { "data-key": column.key, ...(property ? { "data-type": host.type(property).name } : {}) } });
  // (`written`: the item with the value just saved, shown so until the table is drawn anew)
  const show = (written?: Item) => {
    const was = editing.cell === td;
    if (was) editing.cell = undefined;
    td.classList.remove("swd-editing");
    td.replaceChildren(...content(host, written ?? item, column));
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
  // The name and its Open in one line of text: Open right after the name's last word, held to it (never on a line of its own,
  // never off at the cell's edge where the name wraps), as a touch screen shows it; a mouse's laid over the cell's right end
  if (column.key === NAME) {
    // (Its icon, a page's; its word "Open" the style page's, where the cell has room: the name's text is the name alone)
    const open = el(doc, "button", { class: "swd-open", title: `Open ${item.name}`, html: VIEW_ICONS.item, attrs: { "aria-label": `Open ${item.name}` }, run: () => void host.open(item) });
    const cut = item.name.search(/\S+\s*$/);
    const head = cut > 0 ? item.name.slice(0, cut) : "";
    const last = item.name.slice(head.length);
    // (In a box of its own, which a mouse's style page lays over the whole cell: the button at its right end, its label as
    // the cell's width allows)
    return [el(doc, "span", "swd-table-name", host.look.icon(item), head, el(doc, "span", "swd-table-name-end", last, el(doc, "span", "swd-open-room", open)))];
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
  // (Its groups drawn by itself: one table, its columns as wide in every group)
  groupBy: { draws: true },
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
