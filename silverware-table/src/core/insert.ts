// Inserting rows and columns with a + on a table's border. While the table has
// the focus (a cell of it edited or selected), a dot marks each border where a
// row or column can be inserted: left of the table between rows (and under the
// last), above the header between columns (and right of the last), in a lane
// of its own beside the grips. A mouse or a pen coming near a dot turns it
// into a +, with the line it inserts at; hovering a table without the focus
// shows neither, as they were in the way while writing. A finger does not
// hover: it inserts from the row and column menus.
//
// A press on the + or in the band is taken on mousedown (SilverBullet's table
// widget would move the cursor into the table on a click and show its
// markdown), but one on a line of the page's text the band reaches over (text
// right above the table), and the mouseup and click ending a press that inserted are
// swallowed: the table rendered anew puts something else under the pointer (a
// link the click would follow).
import { parseTable } from "../markdown.ts";
import { ICONS } from "../icons.ts";
import { inTextLine, renderedTable, WIDGET_SELECTOR } from "../dom.ts";
import { coveredAt, underWindow } from "./overwindow.ts";
import { appendColumnAt, appendRowAt } from "../pins.ts";
import type { RowHold, TableHost, WidgetInfo } from "./feature.ts";
import { heldBounds, intersect, isEmpty, type Rect } from "./geometry.ts";
import { insertColumnWith, insertRowWith } from "./structure.ts";
import type { TableKey } from "./tables.ts";

// How near the table's end a column border must be to count as in view
export const INSERT_REACH = 6;
// The + inserting a row (column) has a lane of its own beside the grips (which
// sit on the table's left edge and on the header's top edge, 12px thick, and
// end short of a row's or column's border): its centre (and its border's dot)
// this far out from the edge, the band reaching this far out (and this far
// past the table's last row or column), no + nearer the edge than
// INSERT_LANE_FROM (over the grip)
const INSERT_LANE_AT = 13;
const INSERT_LANE_FROM = 7;
const INSERT_LANE_BAND = 32;
const INSERT_LANE_PAST = 16;
// How near a dot the pointer turns it into a +: the +'s radius (16px in the
// CSS), so the + shows only with the pointer on it, hovered, its cursor shown
const INSERT_NEAR = 8;

// The click that ends a press that inserted (the + takes the press, the table
// is rendered anew under the pointer) is swallowed within this time
const INSERT_CLICK_MS = 1000;

type Axis = "row" | "column";

/** Where a + inserts: a row (column) at `at` of the markdown, a new row held beside `beside` while it is edited */
export type InsertTarget = { readonly key: TableKey; readonly axis: Axis; readonly at: number; readonly beside: RowHold };

/** Where a pointer hovering was last */
export type PointerAt = { readonly pointerType: string; readonly clientX: number; readonly clientY: number };

/** What the + controls need of the controller beside the host: the hover state, which is the controller's */
export type InsertContext = {
  readonly host: TableHost;
  /** The table and the cell hovered */
  readonly hovered: () => { readonly widget: HTMLElement | undefined; readonly cell: HTMLTableCellElement | undefined };
  /** The table rendered anew after a + inserted into it is the one hovered */
  readonly hoverTable: (widget: HTMLElement) => void;
  /** As if the pointer were over this cell: the grips go to its row and column */
  readonly hoverAt: (widget: HTMLElement, info: WidgetInfo, cell: HTMLTableCellElement | undefined) => void;
  readonly pointer: () => PointerAt | undefined;
  /** Something holds the pointer (Feature.pointerBusy) */
  readonly busy: () => "drag" | "menu" | "pick" | undefined;
  /** The toolbar's or a cell's menu is open */
  readonly menuOpen: () => boolean;
  readonly floatingButton: (className: string, title: string, icon: string) => HTMLButtonElement;
};

/** A border a row (column) can be inserted at: where it is on screen, and which border (a row's below it, a column's index of the line right of it) */
type Edge = { readonly edge: number; readonly i: number };

/** A row shown, as far as it shows between the rows held over it, and its bottom border */
type RowSpan = { readonly tr: HTMLTableRowElement; readonly top: number; readonly bottom: number; readonly edge: number };

export class InsertControls {
  // The + the pointer brought up, and the line it inserts at
  private readonly mark: HTMLButtonElement;
  private readonly line: HTMLElement;
  // The dots on the borders of the table with the focus, one layer for all; that table as showDots found it, and
  // the band around it (where a pointer away from every table can bring up its +)
  private readonly dots: HTMLElement;
  private focusedWidget: HTMLElement | undefined;
  private focusedBand: Rect | undefined;
  /** Where the + the pointer brought up inserts */
  at: InsertTarget | undefined;
  /** The pointer is over the band around the table where a + inserts: as over the table, its controls stay */
  inBand = false;
  // When a press inserted: the click that ends it is no click on what is under the pointer then
  private pressAt = 0;
  // The table a + inserted into, to show the + again once it is rendered anew
  private insertedIn: string | undefined;

  constructor(private readonly context: InsertContext) {
    this.mark = context.floatingButton("swt-insert", "Insert here", ICONS.plus);
    this.line = context.host.floating("div", "swt-insert-line");
    this.dots = context.host.floating("div", "swt-insert-dots");
    // A click without a press (the keyboard); a press is taken in mouseDown
    this.mark.addEventListener("click", () => this.insertHere());
  }

  remove(): void {
    for (const el of [this.mark, this.line, this.dots]) el.remove();
  }

  // ---- presses -------------------------------------------------------------

  /** Any press, first: only the press that inserted has its end swallowed */
  pressStarted(): void {
    this.pressAt = 0;
  }

  /**
   * A press (after the features'): on a +, or in the band beside the table that
   * misses it (or where none shows), it is the +'s: one on the + inserts at once,
   * one beside it nothing. True: taken.
   */
  mouseDown(e: MouseEvent): boolean {
    if (e.button !== 0) return false;
    const onMark = e.target instanceof Node && this.mark.contains(e.target);
    // (Not one on a line of the page's text the band reaches over, text right above the table: it is the text's)
    if (onMark || (this.inBand && !(e.target instanceof Node && this.context.host.isFloating(e.target)) && !inTextLine(e.target))) {
      e.preventDefault();
      e.stopPropagation();
      // Only a press on the + inserts: one beside it, in the band, is taken
      // (SilverBullet would show the table's markdown) and does nothing, as a
      // row or column inserted by a press near the + was mostly not meant
      if (onMark && this.at) {
        this.pressAt = Date.now();
        this.insertHere();
      }
      return true;
    }
    return false;
  }

  /** Whether a mouseup or click (not from the keyboard) ends a press that inserted: it reaches nothing */
  endsInsertingPress(e: MouseEvent): boolean {
    if (e.button !== 0 || !this.pressAt || Date.now() - this.pressAt > INSERT_CLICK_MS) return false;
    // The click is the press's last event
    if (e.type === "click") this.pressAt = 0;
    return true;
  }

  // ---- the pointer ---------------------------------------------------------

  /** The pointer moved: the + where it is (none while a menu is open or something is dragged) */
  pointerMoved(e: PointerEvent): void {
    const busy = this.context.busy();
    this.inBand = !this.context.menuOpen() && busy !== "drag" ? this.show(e, !busy) : this.hide();
  }

  /** The pointer left the window: the + goes (no move tells it so) */
  pointerLeft(): void {
    this.inBand = this.hide();
  }

  /** The table moved under a pointer that did not: the + where the pointer is now */
  followPointer(): void {
    if (this.at || this.inBand) this.showUnderPointer();
  }

  /** A table rendered anew after a + inserted into it: the + where the pointer still is */
  tableEnhanced(widget: HTMLElement, info: WidgetInfo): void {
    if (this.insertedIn !== info.key || !this.context.pointer()) return;
    this.insertedIn = undefined;
    this.context.hoverTable(widget);
    this.showUnderPointer();
  }

  /** The table's controls are hidden: the pointer's + too (the dots of the table with the focus stay) */
  hidePointers(): void {
    this.mark.classList.remove("swt-visible");
    this.line.classList.remove("swt-visible");
    this.at = undefined;
  }

  /** The + where the pointer is now, as a move there would show it */
  private showUnderPointer(): void {
    const pointer = this.context.pointer();
    const busy = this.context.busy();
    if (!pointer || this.context.menuOpen() || busy === "drag") {
      this.inBand = this.hide();
      return;
    }
    const target = this.context.host.doc.elementFromPoint?.(pointer.clientX, pointer.clientY) ?? null;
    this.inBand = this.show({ ...pointer, buttons: 0, target }, !busy);
  }

  /**
   * A pointer that hovers (a mouse, a pen) near a border of the table shown:
   * on a border between rows (or under the last), left of the table, or between
   * columns (or right of the last), above the header, a + inserts one there,
   * shown where the table has the focus and the pointer is near that border's
   * dot. Whether the pointer is in that band around the table. `mark` false (a
   * menu open): the grips follow the pointer along the edges, no + is shown.
   */
  private show(e: Pick<PointerEvent, "pointerType" | "buttons" | "target" | "clientX" | "clientY">, mark = true): boolean {
    const { host } = this.context;
    const hovered = this.context.hovered();
    // No table hovered: the band of the table with the focus (its dots show), so the pointer may come to a dot from
    // outside the table; only that one table is measured, no table of the page is looked for
    // (No band while that table is out of view; away from the band nothing is measured on a move over the page)
    const band = !hovered.widget && this.focusedWidget?.isConnected ? this.focusedBand : undefined;
    if (band && !(e.clientX >= band.left && e.clientX <= band.right && e.clientY >= band.top && e.clientY <= band.bottom)) return this.hide();
    const fromFocus = band && this.focusedWidget;
    const widget = hovered.widget ?? fromFocus;
    const hoverCell = fromFocus ? undefined : hovered.cell;
    const info = widget && host.infoOf(widget);
    if (e.pointerType === "touch" || e.buttons !== 0 || !widget || !info || renderedTable(widget) !== info.table) return this.hide();
    // Rows and columns that come from a calculation (a pivot's): none inserted
    if (host.fixedShape(parseTable(info.source))) return this.hide();
    if (e.target instanceof Node && this.mark.contains(e.target)) return true;
    if (e.target instanceof Node && host.isFloating(e.target)) return this.hide();
    // Over another table (it is hovered next), or over what is laid over the window above this one (the sheet's board)
    if (e.target instanceof Element && e.target.closest(WIDGET_SELECTOR) && e.target.closest(WIDGET_SELECTOR) !== widget) return this.hide();
    if (e.target instanceof Node && coveredAt(widget, e.target)) return this.hide();
    // Over a dialog laid over the page (the host's own: SilverBullet's confirm), its presses its own
    if (e.target instanceof Element && e.target.closest("dialog")) return this.hide();
    const shown = host.shownRect(widget, info);
    const view = host.viewBounds(widget);
    const header = info.table.rows[0]!.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    // The + only where the dots show (the table has the focus, the border in view), on one of them
    const markable = () => mark && widget === this.focusedWidget;
    // Left of the table: the borders under the header and under each row shown;
    // over the row grip (on the edge) the band, but no +; left of it, the +
    // on a border whose dot the pointer is near
    if (x >= shown.left - INSERT_LANE_BAND && x <= shown.left + 2 && y >= header.top && y <= shown.bottom + INSERT_LANE_PAST) {
      // In the band of the table with the focus: hovered from now on, as if the pointer had come over it
      if (fromFocus) this.context.hoverTable(widget);
      // The rows near the pointer, the borders in view
      const { rows, edges } = rowLines(host, info, shown, Math.max(view.top, y - INSERT_LANE_BAND), Math.min(view.bottom, y + INSERT_LANE_BAND));
      // The row grip goes to the row beside the pointer
      const besideRow = rows.find((row, i) => i > 0 && y >= row.top && y < row.bottom)?.tr;
      if (besideRow) this.context.hoverAt(widget, info, besideRow.cells[hoverCell?.cellIndex ?? 0] ?? besideRow.cells[0]);
      const center = shown.left - INSERT_LANE_AT;
      if (edges.length && x <= shown.left - INSERT_LANE_FROM && x >= center - INSERT_NEAR && markable()) {
        const { edge, i } = nearest(edges, y);
        if (Math.hypot(x - center, y - edge) <= INSERT_NEAR) {
          this.markAt(info, rowTarget(host, info, rows, i), edge, shown);
          return true;
        }
      }
      return this.hide(true);
    }
    // Above the header: the borders between columns, and right of the last; over
    // the column grip (on the header's top edge) the band, but no +; above it,
    // the + on a border whose dot the pointer is near, as for rows
    if (y >= header.top - INSERT_LANE_BAND && y <= header.top + 2 && x >= shown.left - INSERT_REACH && x <= shown.right + INSERT_LANE_PAST) {
      if (fromFocus) this.context.hoverTable(widget);
      const lines = columnLines(info, shown);
      const cells = lines.cells;
      const edges = lines.edges.filter(({ edge }) => edge >= view.left && edge <= view.right);
      // The column grip goes to the column under the pointer (in the row hovered last): a pinned
      // column over one the table scrolled sideways under it
      const under = cells.filter((c) => x >= c.getBoundingClientRect().left && x < c.getBoundingClientRect().right);
      const column = (under.find(isPinned) ?? under[0])?.cellIndex ?? -1;
      const row = (hoverCell?.parentElement as HTMLTableRowElement | undefined) ?? info.table.rows[0]!;
      if (column >= 0 && row.closest("table") === info.table) this.context.hoverAt(widget, info, row.cells[column]);
      const center = header.top - INSERT_LANE_AT;
      if (edges.length && y <= header.top - INSERT_LANE_FROM && y >= center - INSERT_NEAR && markable()) {
        const { edge, i } = nearest(edges, x);
        if (Math.hypot(x - edge, y - center) <= INSERT_NEAR) {
          this.markAt(info, columnTarget(info, cells, i), edge, shown);
          return true;
        }
      }
      return this.hide(true);
    }
    return this.hide();
  }

  private markAt(info: WidgetInfo, at: InsertTarget, edge: number, shown: Rect): void {
    this.at = at;
    const mark = this.mark;
    mark.title = at.axis === "row" ? "Insert a row here" : "Insert a column here";
    mark.setAttribute("aria-label", mark.title);
    mark.classList.add("swt-visible");
    this.place(info, at.axis, edge, shown);
  }

  /**
   * The + and the line it inserts at: a row's left of the row grips, the line
   * across the table; a column's above the column grips, the line down the
   * table
   */
  private place(info: WidgetInfo, axis: Axis, edge: number, shown: Rect): void {
    const { host } = this.context;
    const { mark, line } = this;
    line.classList.add("swt-visible");
    if (axis === "row") {
      const center = shown.left - INSERT_LANE_AT;
      Object.assign(line.style, { left: `${center}px`, top: `${edge - 1}px`, width: `${shown.right - center}px`, height: "2px" });
      host.place(mark, center - mark.offsetWidth / 2, edge - mark.offsetHeight / 2);
    } else {
      const center = info.table.rows[0]!.getBoundingClientRect().top - INSERT_LANE_AT;
      Object.assign(line.style, { left: `${edge - 1}px`, top: `${center}px`, width: "2px", height: `${shown.bottom - center}px` });
      host.place(mark, edge - mark.offsetWidth / 2, center - mark.offsetHeight / 2);
    }
  }

  /**
   * The + the pointer brought up goes, its line with it; `inBand`: the pointer
   * is still in the band around the table (the table's controls stay)
   */
  private hide(inBand = false): boolean {
    this.at = undefined;
    this.mark.classList.remove("swt-visible");
    this.line.classList.remove("swt-visible");
    return inBand;
  }

  // ---- the dots of the table with the focus ----------------------------------

  /**
   * The table with the focus: the one with the cell edited, else with cells
   * selected (Feature.selected, whichever feature selects); none out of sight
   * or of a fixed shape
   */
  private focused(): { widget: HTMLElement; info: WidgetInfo } | undefined {
    const { host } = this.context;
    const edited = host.editing?.cell;
    const selected = edited ? undefined : host.shownTables().find((info) => host.selectedCells(info).length > 0);
    const widget = edited?.isConnected ? host.enhancedWidgetOf(edited)?.[0] : selected && host.widgetForKey(selected.key);
    const info = widget && host.infoOf(widget);
    // A table under what is over the window (its cell still selected): out of sight
    if (!widget || !info || underWindow(widget)) return undefined;
    if (renderedTable(widget) !== info.table || host.fixedShape(parseTable(info.source))) return undefined;
    return { widget, info };
  }

  /** A dot on every border of the table with the focus that shows in view (none without one); all read, then all written */
  showDots(): void {
    const { host } = this.context;
    const focus = this.focused();
    this.focusedWidget = focus?.widget;
    this.focusedBand = undefined;
    const points: (readonly [number, number])[] = [];
    const shown = focus && host.shownRect(focus.widget, focus.info);
    const view = focus && host.viewBounds(focus.widget);
    // A table scrolled out of view has none
    if (focus && shown && view && !isEmpty(intersect(shown, view))) {
      const { info } = focus;
      const header = info.table.rows[0]!.getBoundingClientRect();
      this.focusedBand = { left: shown.left - INSERT_LANE_BAND, right: shown.right + INSERT_LANE_PAST, top: header.top - INSERT_LANE_BAND, bottom: shown.bottom + INSERT_LANE_PAST };
      const rowX = shown.left - INSERT_LANE_AT;
      for (const { edge } of rowLines(host, info, shown, view.top, view.bottom).edges) points.push([rowX, edge]);
      const columnY = header.top - INSERT_LANE_AT;
      if (columnY >= view.top && columnY <= view.bottom) {
        // A border between columns is both columns' edge: one dot
        const seen = new Set<number>();
        for (const { edge, i } of columnLines(info, shown).edges) {
          if (seen.has(i) || edge < view.left || edge > view.right) continue;
          seen.add(i);
          points.push([edge, columnY]);
        }
      }
    }
    const dots = this.dots;
    points.forEach(([x, y], n) => {
      const dot = (dots.children[n] as HTMLElement | undefined) ?? dots.appendChild(host.doc.createElement("span"));
      dot.hidden = false;
      dot.style.left = `${Math.round(x)}px`;
      dot.style.top = `${Math.round(y)}px`;
    });
    for (let n = points.length; n < dots.children.length; n++) (dots.children[n] as HTMLElement).hidden = true;
    dots.classList.toggle("swt-visible", points.length > 0);
  }

  // ---- inserting -------------------------------------------------------------

  /** The + clicked: a row (column) inserted there, its first cell (name) edited */
  private insertHere(): void {
    const at = this.at;
    const widget = at && this.context.host.widgetForKey(at.key);
    const info = widget && this.context.host.infoOf(widget);
    if (at && widget && info) this.insert(widget, info, at);
  }

  private insert(widget: HTMLElement, info: WidgetInfo, at: InsertTarget): void {
    const { host } = this.context;
    // The table rendered anew shows the + again under the pointer (tableEnhanced): another click inserts another
    this.insertedIn = info.key;
    if (at.axis === "row") void insertRowWith(host, info, at.at, firstVisibleColumn(widget, info), undefined, at.beside);
    else void insertColumnWith(host, info, at.at);
  }
}

/** A column pinned left or right (held over the others as the table scrolls sideways) */
const isPinned = (c: HTMLTableCellElement) => c.classList.contains("swt-pin-left") || c.classList.contains("swt-pin-right");

/** The border nearest a place along the axis */
function nearest(edges: readonly Edge[], at: number): Edge {
  return edges.reduce((best, e) => (Math.abs(at - e.edge) < Math.abs(at - best.edge) ? e : best));
}

/**
 * The rows shown that reach `from`..`to` (and the one after them, which the
 * last border there inserts above), as far as they show between the rows held
 * over them (the header held at the top, rows pinned there or to the bottom):
 * one that scrolled under them gets no grip, its border no + nor dot; and the
 * borders under them that show within `from`..`to` and the table's box (which
 * a large table scrolls in)
 */
function rowLines(host: TableHost, info: WidgetInfo, shown: Rect, from: number, to: number): { readonly rows: readonly RowSpan[]; readonly edges: readonly Edge[] } {
  const held = { ...heldBounds(info) };
  held.top = Math.max(held.top, shown.top);
  held.bottom = Math.min(held.bottom, shown.bottom);
  const body = (tr: HTMLTableRowElement) => tr.parentElement?.tagName === "TBODY";
  const rows = near(host.shownRows(info), body, from, to)
    .map((tr): RowSpan => {
      const r = tr.getBoundingClientRect();
      // (A DOMRect's fields are getters: spreading it copies none)
      return body(tr) ? { tr, top: Math.max(r.top, held.top), bottom: Math.min(r.bottom, held.bottom), edge: r.bottom } : { tr, top: r.top, bottom: r.bottom, edge: r.bottom };
    })
    .filter((row) => row.bottom > row.top + 1);
  const edges = rows
    .map((row, i) => ({ edge: row.edge, i }))
    .filter(({ edge, i }) => edge >= from && edge <= to && edge >= shown.top - 1 && edge <= shown.bottom + 1 && (!body(rows[i]!.tr) || (edge >= held.top - 1 && edge <= held.bottom + 1)));
  return { rows, edges };
}

/**
 * Of the rows shown, those held at the top and bottom (the header, rows
 * pinned there: few, all of them) and the body rows reaching `from`..`to`,
 * with the one after them: the body's rows lie in order down the table, so
 * they are found by halving, not by measuring each (a table of a thousand rows
 * is measured on every frame of a scroll). Rows a feature keeps out of the
 * document (largeTables) are left out: they have no place to measure.
 */
function near(all: readonly HTMLTableRowElement[], body: (tr: HTMLTableRowElement) => boolean, from: number, to: number): HTMLTableRowElement[] {
  const first = all.findIndex(body);
  if (first < 0) return [...all];
  let last = first;
  while (last + 1 < all.length && body(all[last + 1]!)) last++;
  const rows = all.slice(first, last + 1).filter((tr) => tr.isConnected);
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]!.getBoundingClientRect().bottom < from) lo = mid + 1;
    else hi = mid;
  }
  let end = lo;
  while (end < rows.length && rows[end]!.getBoundingClientRect().top <= to) end++;
  return [...all.slice(0, first), ...rows.slice(lo, end + 1), ...all.slice(last + 1)];
}

/** Where a row is inserted at the border under the `i`th row shown: above the row shown below it; under the last one, at the end (above rows pinned to the bottom) */
function rowTarget(host: TableHost, info: WidgetInfo, rows: readonly RowSpan[], i: number): InsertTarget {
  const next = rows[i + 1];
  const below = next && host.rowOf(info, next.tr);
  const above = i > 0 ? host.rowOf(info, rows[i]!.tr) : undefined;
  const at = below !== undefined && below > 0 ? below : appendRowAt(info.pins, info.rows);
  const beside: RowHold = below !== undefined && below > 0 ? { before: below } : above !== undefined ? { after: above } : {};
  return { key: info.key, axis: "row", at, beside };
}

/**
 * The header's cells, and the borders in view (a wide table scrolls sideways,
 * under its pinned columns), by the column they insert at: a pinned column's,
 * and the others' between the pinned ones
 */
function columnLines(info: WidgetInfo, shown: Rect): { readonly cells: readonly HTMLTableCellElement[]; readonly edges: readonly Edge[] } {
  const cells = Array.from(info.table.rows[0]!.cells);
  const held = heldBounds(info);
  const edges = cells
    .flatMap((c, i) => {
      const r = c.getBoundingClientRect();
      return [
        { edge: r.left, i, pinned: isPinned(c) },
        { edge: r.right, i: i + 1, pinned: isPinned(c) },
      ];
    })
    .filter(({ edge, pinned }) => (pinned || (edge >= held.left - 1 && edge <= held.right + 1)) && edge >= shown.left - INSERT_REACH && edge <= shown.right + INSERT_REACH)
    .map(({ edge, i }) => ({ edge, i }));
  return { cells, edges };
}

/** Where a column is inserted at the `i`th border: before that column, past the last one at the end (left of columns pinned right) */
function columnTarget(info: WidgetInfo, cells: readonly HTMLTableCellElement[], i: number): InsertTarget {
  const at = i < cells.length ? i : appendColumnAt(info.pins, info.columns);
  return { key: info.key, axis: "column", at, beside: {} };
}

/** The leftmost column in view, so editing a new row does not scroll a wide table back */
function firstVisibleColumn(widget: HTMLElement, info: WidgetInfo): number {
  const left = widget.getBoundingClientRect().left;
  const cells = Array.from(info.table.rows[0]!.cells);
  const index = cells.findIndex((cell) => cell.getBoundingClientRect().left >= left - 1);
  return Math.max(0, index);
}
