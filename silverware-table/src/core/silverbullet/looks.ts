// The looks of a table's cells and headers (core/looks.ts) applied to the
// table SilverBullet rendered: what a cell shows in place of its content, its
// value for sorting and filtering (data-swt-value, sorting's own data-swt-sort), marks (classes swt-<mark>), titles, a
// header's icons and hashtags hidden. Applied again (a feature's looks
// changed) it first takes back what it applied before, so a cell whose look is
// gone shows its content as rendered again.
import { cellText, HIDDEN_TAG_CLASS, UI_CLASS } from "../../dom.ts";
import type { CellDisplay } from "../feature.ts";
import type { MergedCell, MergedHeader } from "../looks.ts";

/** What was applied to a cell, to take back: its marks, its title as rendered, its content replaced */
type Applied = {
  readonly marks: readonly string[];
  readonly title: string | null;
  readonly value: boolean;
  readonly sortKey?: boolean;
  // CSS custom properties set, each with the value the cell had before (null: none)
  readonly vars?: ReadonlyMap<string, string | null>;
  // The cell's content as rendered, taken out for the display shown instead (in `box`)
  readonly content?: { readonly box: Element; readonly nodes: readonly Node[]; readonly shown: Node };
  // A header's icons and hashtags hidden
  readonly icons?: readonly Element[];
  readonly tags?: readonly Element[];
  // A body cell's look as applied (`lookKey`): the same look again changes nothing
  readonly key?: string;
};

const applied = new WeakMap<HTMLTableCellElement, Applied>();

/** A cell's text as its markdown rendered, before a look replaced what it shows */
export function renderedText(cell: HTMLTableCellElement): string {
  const content = applied.get(cell)?.content;
  if (!content) return cellText(cell);
  const holder = cell.ownerDocument.createElement("div");
  for (const node of content.nodes) holder.append(node.cloneNode(true));
  return cellText(holder);
}

/** Takes back what was applied to a cell */
function takeBack(cell: HTMLTableCellElement): void {
  const was = applied.get(cell);
  if (!was) return;
  applied.delete(cell);
  for (const mark of was.marks) cell.classList.remove(mark);
  if (was.title === null) cell.removeAttribute("title");
  else cell.title = was.title;
  if (was.value) delete cell.dataset.swtValue;
  if (was.sortKey) delete cell.dataset.swtSort;
  for (const [name, before] of was.vars ?? []) {
    if (before === null) cell.style.removeProperty(name);
    else cell.style.setProperty(name, before);
  }
  if (was.content) {
    // Where the display is now (the core may have moved it into the cell's content box), else where it was put
    const { box, nodes, shown } = was.content;
    const parent = shown.parentNode ?? box;
    const content = cell.ownerDocument.createDocumentFragment();
    content.append(...nodes);
    parent.insertBefore(content, shown.parentNode ? shown : parent.firstChild);
    shown.parentNode?.removeChild(shown);
  }
  for (const icon of was.icons ?? []) icon.remove();
  for (const tag of was.tags ?? []) tag.classList.remove(HIDDEN_TAG_CLASS);
}

/** The node a display shows */
function displayNode(doc: Document, display: CellDisplay): Node {
  if (typeof display === "string") return doc.createTextNode(display);
  if ("meter" in display) {
    const share = Math.min(1, Math.max(0, display.meter));
    const meter = doc.createElement("span");
    meter.className = "swt-meter";
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "1");
    meter.setAttribute("aria-valuenow", String(share));
    const fill = doc.createElement("span");
    fill.className = "swt-meter-fill";
    fill.style.width = `${share * 100}%`;
    const label = doc.createElement("span");
    label.className = "swt-meter-text";
    label.textContent = display.text;
    meter.append(fill, label);
    return meter;
  }
  const link = doc.createElement("a");
  link.href = display.href;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = display.text;
  return link;
}

/** What a body cell's look is, as one text: two looks alike apply alike */
function lookKey(look: MergedCell, editing: boolean): string {
  return JSON.stringify([look.display, look.value, look.sortKey, look.marks, look.titles, look.vars, look.display !== undefined && editing]);
}

/**
 * Applies a body cell's look (none: what was applied before is taken back). The look it has already (and
 * what it shows still in it) is left as it is: a look changed on a few cells of a large table (a rule's
 * value typed) touches those cells only, not every cell's classes and styles (the browser restyling them all)
 */
export function applyCellLook(cell: HTMLTableCellElement, look: MergedCell | undefined, editing: boolean): void {
  const was = applied.get(cell);
  const key = look && lookKey(look, editing);
  if (was ? was.key === key && (!was.content || cell.contains(was.content.shown)) : !look) return;
  takeBack(cell);
  if (!look) return;
  const title = cell.getAttribute("title");
  const marks = look.marks.map((mark) => `swt-${mark}`).filter((mark) => !cell.classList.contains(mark));
  for (const mark of marks) cell.classList.add(mark);
  if (look.titles.length) cell.title = [title, ...look.titles].filter(Boolean).join("\n");
  if (look.value !== undefined) cell.dataset.swtValue = look.value;
  if (look.sortKey !== undefined) cell.dataset.swtSort = look.sortKey;
  let vars: Map<string, string | null> | undefined;
  for (const [name, value] of Object.entries(look.vars ?? {})) {
    (vars ??= new Map()).set(name, cell.style.getPropertyValue(name) || null);
    cell.style.setProperty(name, value);
  }
  let content: Applied["content"];
  // The cell being edited shows its field: what it shows comes back as the editor closes (the table rendered anew)
  if (look.display !== undefined && !editing) {
    const box = cell.querySelector(":scope > .swt-cell-content") ?? cell;
    const nodes = Array.from(box.childNodes).filter((node) => !(node instanceof Element && node.classList.contains(UI_CLASS)));
    const shown = displayNode(cell.ownerDocument, look.display);
    box.insertBefore(shown, nodes[0] ?? box.firstChild);
    for (const node of nodes) node.parentNode?.removeChild(node);
    content = { box, nodes, shown };
  }
  applied.set(cell, { marks, title, value: look.value !== undefined, key, ...(look.sortKey !== undefined ? { sortKey: true } : {}), ...(vars ? { vars } : {}), ...(content ? { content } : {}) });
}

/** Applies a header's look: its icons before the sorting control (else last), marks, title, hashtags hidden */
export function applyHeaderLook(cell: HTMLTableCellElement, column: number, look: MergedHeader | undefined): void {
  takeBack(cell);
  if (!look) return;
  const doc = cell.ownerDocument;
  const title = cell.getAttribute("title");
  const marks = look.marks.map((mark) => `swt-${mark}`).filter((mark) => !cell.classList.contains(mark));
  for (const mark of marks) cell.classList.add(mark);
  if (look.titles.length) cell.title = [title, ...look.titles].filter(Boolean).join("\n");
  const sort = cell.querySelector(".swt-sort");
  const holder = sort?.parentElement ?? cell.querySelector(":scope > .swt-head") ?? cell;
  const icons = [...look.icons].sort((a, b) => a.order - b.order).map((icon) => {
    const span = doc.createElement("span");
    span.className = `${UI_CLASS} ${icon.className}`;
    span.title = icon.title;
    span.innerHTML = icon.svg;
    if (icon.action) {
      span.dataset.swtAction = icon.action;
      span.dataset.swtColumn = String(column);
    }
    holder.insertBefore(span, sort && sort.parentElement === holder ? sort : null);
    return span;
  });
  const tags = look.hidesTag.length
    ? Array.from(cell.querySelectorAll<HTMLElement>("[data-tag-name]")).filter((tag) => look.hidesTag.some((hides) => hides(tag.dataset.tagName ?? "")))
    : [];
  for (const tag of tags) tag.classList.add(HIDDEN_TAG_CLASS);
  applied.set(cell, { marks, title, value: false, icons, tags });
}

