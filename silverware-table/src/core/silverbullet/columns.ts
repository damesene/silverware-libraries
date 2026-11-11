// How the adapter lays out a table's columns where every one has a width
// (ColumnWidths): a colgroup and `table-layout: fixed`, each column its share
// of their sum, the table their sum over the box they were set in of the box
// it has now. Once laid out (in the next frame, and again as its box
// resizes), a table narrower than when its widths were set keeps each column
// as wide as its header needs, up to HEADER_FLOOR_MAX and never wider than it
// was set (shrunkWidths): the other columns give the room, and where they
// cannot the table scrolls sideways; `resized` tells what is placed by the
// columns (pins, cells cut). In the same pass every table's headers cut (an
// ellipsis) get their names as their titles. All is read first, then
// written: one layout for every table. What a table's widths and box came to
// is kept and shown at once when it is rendered anew (every write): the pass
// then finds nothing to change, and the table is laid out once.
import { WIDGET_SELECTOR } from "../../dom.ts";
import { oncePerFrame } from "../frame.ts";

// A table laid out by its columns' widths: its colgroup and the table both have the class
const FIXED_COLUMNS_CLASS = "swt-fixed-columns";
// The least and most a header's need holds its column at as its table narrows (a longer name is cut; one being
// edited, its need not known, the least), in pixels
const HEADER_FLOOR_MIN = 80;
const HEADER_FLOOR_MAX = 160;
// How many tables' last shares are kept (recent tables: those written and rendered anew)
const KEPT_SHARES = 64;
// A header's name whose title this module set (it takes it back once the name shows whole)
const TITLE_MARK = "swtCutTitle";

/** An element's padding left and right */
export function horizontalPadding(doc: Document, element: Element): number {
  const style = doc.defaultView!.getComputedStyle(element);
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
}

/** A header cell's line (its name and icons) */
const headOf = (cell: Element) => cell.querySelector<HTMLElement>(":scope > .swt-head");
const nameOf = (head: Element) => head.querySelector<HTMLElement>(":scope > .swt-head-name");

/** What a header cell needs to show its name and icons whole (0: no line, being edited): its line, the name's text past its box, the padding */
export function headerNeed(doc: Document, cell: HTMLTableCellElement): number {
  const head = headOf(cell);
  if (!head) return 0;
  const name = nameOf(head);
  return head.offsetWidth + (name ? name.scrollWidth - name.clientWidth : 0) + horizontalPadding(doc, cell);
}

/**
 * Widths made `width` wide together, each its share of it, none under its
 * floor (a floor at most its width): those that would be are held at their
 * floor and the others share the rest; where the floors alone are wider, the
 * floors (their sum more than `width`)
 */
export function shrunkWidths(widths: readonly number[], floors: readonly number[], width: number): number[] {
  const held = new Set<number>();
  for (;;) {
    const free = widths.map((_, i) => i).filter((i) => !held.has(i));
    const room = width - Array.from(held, (i) => floors[i]!).reduce((a, b) => a + b, 0);
    const freeSum = free.reduce((sum, i) => sum + widths[i]!, 0);
    const scale = freeSum > 0 ? Math.max(0, room) / freeSum : 0;
    const under = free.filter((i) => widths[i]! * scale < floors[i]!);
    if (!under.length) return widths.map((w, i) => (held.has(i) ? floors[i]! : w * scale));
    for (const i of under) held.add(i);
  }
}

/** What the pass after layout writes for a table: its columns' shares and least width (fixed tables), its headers' titles */
type Plan = {
  readonly table: HTMLTableElement;
  readonly shares?: readonly number[];
  readonly minWidth?: number;
  readonly titles: readonly { readonly name: HTMLElement; readonly title: string | undefined }[];
};

/** What a table's widths and box came to once laid out: its columns' shares and least width */
type Shown = { readonly shares: readonly number[]; readonly minWidth: number | undefined };

export class ColumnLayouts {
  // The widths and box of each table laid out by them (fix)
  private readonly layouts = new WeakMap<HTMLTableElement, { readonly widths: readonly number[]; readonly box: number | undefined }>();
  // Tables to look at once laid out, and the widgets whose box is watched (their table now)
  private readonly pending = new Set<HTMLTableElement>();
  private readonly watched = new WeakMap<Element, HTMLTableElement>();
  // What each widths and box came to last (by layoutKey), the latest last
  private readonly shown = new Map<string, Shown>();
  private readonly queue: () => void;
  private readonly resizes: ResizeObserver | undefined;

  constructor(
    private readonly doc: Document,
    private readonly resized: (table: HTMLTableElement) => void,
  ) {
    this.queue = oncePerFrame(doc, () => this.laidOut());
    this.resizes =
      typeof ResizeObserver === "function"
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
              const table = this.watched.get(entry.target);
              if (table) this.pending.add(table);
            }
            this.queue();
          })
        : undefined;
  }

  stop(): void {
    this.resizes?.disconnect();
    this.pending.clear();
  }

  /**
   * A table laid out by its columns' widths (undefined: by its cells), as
   * its shares of them until it is laid out; looked at once it is
   */
  fix(table: HTMLTableElement, widths: readonly number[] | undefined, box: number | undefined): void {
    let colgroup = table.querySelector<HTMLTableColElement>(`:scope > colgroup.${FIXED_COLUMNS_CLASS}`);
    if (!widths) {
      this.layouts.delete(table);
      if (colgroup) {
        colgroup.remove();
        table.classList.remove(FIXED_COLUMNS_CLASS);
        Object.assign(table.style, { width: "", minWidth: "" });
      }
      this.watch(table);
      return;
    }
    if (!colgroup) {
      colgroup = this.doc.createElement("colgroup");
      colgroup.className = FIXED_COLUMNS_CLASS;
      table.prepend(colgroup);
    }
    while (colgroup.children.length < widths.length) colgroup.append(this.doc.createElement("col"));
    while (colgroup.children.length > widths.length) colgroup.lastElementChild!.remove();
    const sum = widths.reduce((a, b) => a + b, 0);
    // As they came to last (rendered anew after a write), else as their shares until laid out
    const last = this.shown.get(layoutKey(widths, box));
    this.setShares(colgroup, last?.shares ?? widths.map((width) => width / sum));
    table.classList.add(FIXED_COLUMNS_CLASS);
    Object.assign(table.style, { width: box && box > 0 ? `${(sum / box) * 100}%` : "", minWidth: last?.minWidth === undefined ? "" : `${Math.ceil(last.minWidth)}px` });
    this.layouts.set(table, { widths, box });
    this.watch(table);
  }

  /** Looked at in the next frame, and whenever its box resizes */
  private watch(table: HTMLTableElement): void {
    this.pending.add(table);
    const widget = table.closest(WIDGET_SELECTOR);
    if (widget && this.watched.get(widget) !== table) {
      this.watched.set(widget, table);
      this.resizes?.observe(widget);
    }
    this.queue();
  }

  private laidOut(): void {
    const tables = Array.from(this.pending).filter((table) => table.isConnected);
    this.pending.clear();
    const plans = tables.map((table) => this.read(table));
    for (const plan of plans) this.write(plan);
  }

  private read(table: HTMLTableElement): Plan {
    const cells = Array.from(table.rows[0]?.cells ?? []);
    const names = cells.map((cell) => {
      const head = headOf(cell);
      return head ? nameOf(head) : null;
    });
    const widget = table.closest<HTMLElement>(WIDGET_SELECTOR);
    const now = widget ? widget.clientWidth - horizontalPadding(this.doc, widget) : 0;
    // Its box not laid out (hidden): nothing to tell, all as it is
    if (now <= 0) return { table, titles: [] };
    const layout = this.layouts.get(table);
    if (!layout || layout.widths.length !== cells.length) {
      // Laid out by its cells: a name is cut where its box shows less than its text
      return { table, titles: names.flatMap((name, i) => (name ? [{ name, title: name.scrollWidth > name.clientWidth + 1 ? titleOf(name, cells[i]!) : undefined }] : [])) };
    }
    const { widths, box } = layout;
    const sum = widths.reduce((a, b) => a + b, 0);
    const target = box && box > 0 ? (now * sum) / box : now;
    const needs = cells.map((cell) => headerNeed(this.doc, cell));
    const floors = widths.map((width, i) => Math.min(width, Math.max(HEADER_FLOOR_MIN, Math.min(needs[i]!, HEADER_FLOOR_MAX))));
    const shown = shrunkWidths(widths, floors, target);
    const total = shown.reduce((a, b) => a + b, 0);
    const plan = { shares: shown.map((width) => width / total), minWidth: total > target + 0.5 ? total : undefined };
    this.keepShown(layoutKey(widths, box), plan);
    return { table, ...plan, titles: names.flatMap((name, i) => (name ? [{ name, title: shown[i]! < needs[i]! - 0.5 ? titleOf(name, cells[i]!) : undefined }] : [])) };
  }

  private keepShown(key: string, shown: Shown): void {
    this.shown.delete(key);
    this.shown.set(key, shown);
    if (this.shown.size > KEPT_SHARES) this.shown.delete(this.shown.keys().next().value!);
  }

  private write({ table, shares, minWidth, titles }: Plan): void {
    const colgroup = table.querySelector<HTMLTableColElement>(`:scope > colgroup.${FIXED_COLUMNS_CLASS}`);
    if (shares && colgroup) {
      let changed = this.setShares(colgroup, shares);
      const least = minWidth === undefined ? "" : `${Math.ceil(minWidth)}px`;
      if (table.style.minWidth !== least) {
        table.style.minWidth = least;
        changed = true;
      }
      if (changed) this.resized(table);
    }
    for (const { name, title } of titles) {
      if (title !== undefined) {
        if (name.title !== title) name.title = title;
        name.dataset[TITLE_MARK] = "";
      } else if (name.dataset[TITLE_MARK] !== undefined) {
        name.removeAttribute("title");
        delete name.dataset[TITLE_MARK];
      }
    }
  }

  /** Each column its share (only those changed: a style written lays the table out again); whether any changed */
  private setShares(colgroup: HTMLTableColElement, shares: readonly number[]): boolean {
    let changed = false;
    shares.forEach((share, column) => {
      const col = colgroup.children[column] as HTMLElement | undefined;
      const width = `${share * 100}%`;
      if (col && col.style.width !== width) {
        col.style.width = width;
        changed = true;
      }
    });
    return changed;
  }
}

/** Widths and a box as a key */
const layoutKey = (widths: readonly number[], box: number | undefined) => `${widths.join(",")}/${box ?? ""}`;

/**
 * A cut header's title: its name as it shows (innerText: its hidden hashtags
 * left out where the browser lays them out), and the header cell's own title
 * (a look's) after it, which the name's would hide over the name
 */
function titleOf(name: HTMLElement, cell: HTMLTableCellElement): string {
  const text = (name.innerText ?? name.textContent ?? "").trim();
  return cell.title ? `${text}\n${cell.title}` : text;
}
