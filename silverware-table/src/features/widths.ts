// The widths module: columns' widths are set by dragging the edge between two
// columns (a handle on a header's right edge, none on the last: the table
// keeps its width), reset to automatic by double-clicking it or with "Auto
// width" in a column's menu. With the metadata setting they are stored in the
// table (widths.-c-price.size='180'), which follows the column through renames
// and moves (metadataAfterEdit); without it, they hold for the view only.
// "Reset column widths" in the table's menu makes every column automatic.
//
// A drag moves only that edge: what one side gains the other loses, from the
// nearest column on, none below what its header needs (movedEdge), and on
// release every column's width is stored, so nothing moves after it
// (docs/silverware-table-column-resize.md).
//
// Where a feature lays the table out on a grid of its own (TableHost.addressFrame:
// the sheet view), the columns are the grid's: a handle sets the grid's column
// (for every table in it, the last one too), the table's own widths give way.
//
// While dragging, the widths are those at the press changed by how far the
// pointer moved since, never measured again: a scrollbar showing or going, or
// the table moving as it gets narrower, cannot feed back into them. The widths
// are the module's (columnWidths); the core shows them, and the handles (a
// handle layer per table, as every table's headers have them).
import { type Feature, type HandleLayer, type LineMenuBuilder, type LineMenuGroup, type LineMenuTarget, type ModelHost, type PartTable, type TableInfo, type TableKey, tablePartsOf, type ToolbarButton } from "../core/feature.ts";
import { ICONS } from "../icons.ts";
import { parseTable } from "../markdown.ts";

// The narrowest a column can be dragged to, in pixels
const MIN_WIDTH = 40;

// The handles' layers, one per table
const LAYER = "width:";
const HANDLE_CLASS = "swt-col-resize";
const HANDLE_TITLE = "Drag to move the edge between the columns; double-click for the column's automatic width";

/** A column at the press of a drag: its width, and the narrowest the drag may make it */
type DraggedColumn = { readonly width: number; readonly min: number };

/**
 * The columns' widths with the edge after `column` moved `by` pixels, the
 * table's width kept: the side the edge moves into gives, its nearest column
 * first, none below its minimum (one already narrower gives nothing); the
 * column on the other side of the edge takes what they gave
 */
export function movedEdge(columns: readonly DraggedColumn[], column: number, by: number): number[] {
  const widths = columns.map((c) => c.width);
  if (column < 0 || column >= columns.length - 1) return widths;
  const giving = by > 0 ? Array.from({ length: columns.length - column - 1 }, (_, i) => column + 1 + i) : Array.from({ length: column + 1 }, (_, i) => column - i);
  let left = Math.abs(by);
  for (const j of giving) {
    if (!left) break;
    const given = Math.min(left, Math.max(0, widths[j]! - columns[j]!.min));
    widths[j]! -= given;
    left -= given;
  }
  widths[by > 0 ? column : column + 1]! += Math.abs(by) - left;
  return widths;
}

/** One table's widths (the module's part for it, core/parts.ts): those set for the view, those stored, its handles */
class TableWidths {
  // Widths set for the view only (no metadata stored), by column; undefined: automatic
  private viewed = new Map<number, number | undefined>();
  // The widths stored in the table as last read (parsing a large table for its metadata row on every view is slow)
  private stored: { readonly source: string; readonly widths: ReadonlyMap<number, number> } | undefined;
  // Its handles
  private readonly handles: HandleLayer;

  constructor(
    private readonly table: PartTable,
    private readonly host: ModelHost,
  ) {
    this.handles = host.handleLayer(`${LAYER}${table.key}`);
  }

  stop(): void {
    this.handles.hide();
  }

  /** Its columns' widths: those set for the view, else those stored */
  widthsOf(info: TableInfo): Map<number, number> {
    if (this.stored?.source !== info.source) {
      const read = new Map<number, number>();
      for (const [column, value] of this.host.columnsMeta(parseTable(info.source), "size")) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) read.set(column, Math.max(MIN_WIDTH, Math.round(n)));
      }
      this.stored = { source: info.source, widths: read };
    }
    const widths = new Map(this.stored.widths);
    for (const [column, width] of this.viewed) {
      if (width === undefined) widths.delete(column);
      else widths.set(column, width);
    }
    return widths;
  }

  columnWidths(info: TableInfo): ReadonlyMap<number, number> {
    // Laid out on a grid of a feature's: its columns' widths, not the table's own
    return this.host.addressFrame(info) ? new Map() : this.widthsOf(info);
  }

  /** A handle on each header cell's right edge (shown by CSS while the header is hovered, selected or edited) */
  enhanced(info: TableInfo): void {
    this.placeHandles(info, undefined);
  }

  placeHandles(info: TableInfo, active: number | undefined): void {
    // The last column's right edge is the table's, which keeps its width; a grid's columns have no such edge
    const count = this.host.addressFrame(info) ? info.columns : info.columns - 1;
    this.handles.place(
      info.key,
      Array.from({ length: Math.max(0, count) }, (_, column) => ({
        // One handle per column (a layer's handles are told apart by their classes), the one dragged lit
        className: `${HANDLE_CLASS} ${HANDLE_CLASS}-${column}`,
        active: column === active,
        row: 0,
        column,
        title: HANDLE_TITLE,
      })),
    );
  }

  /** A column's width set (undefined: automatic): the grid's, where a feature lays the table out on one */
  set(info: TableInfo, column: number, width: number | undefined): Promise<void> {
    const grid = this.host.addressFrame(info);
    return grid ? grid.setColumnWidth(column, width) : this.setAll(info, new Map([[column, width]]));
  }

  /** Columns' widths set (undefined: automatic): stored in the table where they can be, else for the view */
  async setAll(info: TableInfo, set: ReadonlyMap<number, number | undefined>): Promise<void> {
    for (const [column, width] of set) this.viewed.set(column, width);
    this.host.showColumnWidths(info, undefined);
    // Reset column widths offered or not
    this.host.toolbarChanged();
    // Those the table can take (the metadata setting off: only where it has a width stored); the others are the view's
    const table = parseTable(info.source);
    const stored = [...set.keys()].filter((column) => set.get(column) === undefined || this.host.canStoreMeta(table, "size", { column }));
    if (!stored.length) return;
    const result = await this.host.writeTable(info, (t) => {
      const widths = this.host.columnsMeta(t, "size");
      for (const [column, width] of set) {
        if (width === undefined) widths.delete(column);
        else widths.set(column, String(width));
      }
      return this.host.setColumnsMeta(t, "size", widths);
    });
    // Stored (or already so): the table's metadata has them now
    if (result !== "failed") for (const column of stored) this.viewed.delete(column);
  }

  /** Columns moved, inserted or deleted: the widths set for the view go with them */
  columnsMoved(_key: TableKey, map: (column: number) => number | undefined): void {
    const moved = new Map<number, number | undefined>();
    for (const [column, width] of this.viewed) {
      const target = map(column);
      if (target !== undefined) moved.set(target, width);
    }
    this.viewed = moved;
  }

  // Before Remove metadata (the widths module comes before it), which would remove them too
  toolbarButtons(info: TableInfo): ToolbarButton[] {
    const widths = this.widthsOf(info);
    // On a grid of a feature's the table's own widths do not show: nothing to reset there
    if (!widths.size || this.host.addressFrame(info)) return [];
    return [
      {
        label: "Reset column widths",
        icon: ICONS.columnWidth,
        danger: true,
        title: widths.size === 1 ? "Make the column with a width set as wide as its text again" : `Make the ${widths.size} columns with a width set as wide as their text again`,
        run: () => {
          // As rendered now (the menu stays open across a write)
          const now = this.table.current() ?? info;
          void this.setAll(now, new Map(Array.from(this.widthsOf(now).keys(), (column) => [column, undefined])));
        },
      },
    ];
  }

  /** Auto width in a column's menu (how it shows), where its width is set */
  lineMenu(info: TableInfo, { axis, at: column }: LineMenuTarget, menu: LineMenuBuilder): LineMenuGroup[] {
    if (axis !== "column") return [];
    const grid = this.host.addressFrame(info);
    const width = grid ? grid.columnWidth(column) : this.widthsOf(info).get(column);
    if (width === undefined) return [];
    return [
      menu.slot.view([
        menu.item({
          label: "Auto width",
          icon: ICONS.columnWidth,
          hint: `The column is ${width}px wide: make it as wide as its text`,
          run: () => void this.set(this.table.current() ?? info, column, undefined),
        }),
      ]),
    ];
  }
}

/** The widths module: its parts are the tables' widths (TableWidths); itself, the one drag of a handle on the page */
export class Widths implements Feature {
  private drag: { readonly key: TableKey; readonly column: number } | undefined;
  private stopDrag: (() => void) | undefined;
  readonly tableParts = tablePartsOf(TableWidths, (table) => new TableWidths(table, this.host));

  constructor(private readonly host: ModelHost) {}

  stop(): void {
    this.stopDrag?.();
  }

  pointerBusy(): "drag" | undefined {
    return this.drag ? "drag" : undefined;
  }

  mouseDown(e: MouseEvent): boolean {
    const target = this.host.targetOf(e.target);
    if (target.kind !== "handle" || !target.layer.startsWith(LAYER) || e.button !== 0) return false;
    const info = this.host.tableFor(target.key);
    const widths = this.host.tablePart<TableWidths>(this, target.key);
    e.preventDefault();
    e.stopPropagation();
    if (!info || !widths) return true;
    // One drag at a time (a release outside the window may have left one)
    this.stopDrag?.();
    // A cell being edited is saved first, as a press elsewhere would (the press here keeps the focus)
    if (this.host.editing) void this.host.saveEditing();
    const { column } = target;
    const drag = this.host.addressFrame(info) ? gridDrag(this.host, info, column) : tableDrag(this.host, info, column);
    if (!drag) return true;
    const startX = e.clientX;
    // The second press of a double click: the column automatic again (unless it moves)
    const double = e.detail >= 2;
    const start = drag.widths(0);
    let shown = start;
    const moved = () => Array.from(shown).some(([c, width]) => width !== start.get(c));
    this.drag = { key: info.key, column };
    widths.placeHandles(info, column);
    const win = this.host.doc.defaultView!;
    // The widths shown once per frame, however many moves came
    let frame = 0;
    const show = () => {
      frame = 0;
      const now = this.host.tableFor(info.key);
      if (this.drag && now) drag.show(now, shown);
    };
    const stop = this.host.drag(e, {
      key: info.key,
      events: "mouse",
      pageMark: "resizing",
      onMove: (at) => {
        // From the press, never from what is measured now
        shown = drag.widths(at.x - startX);
        if (!frame) frame = win.requestAnimationFrame ? win.requestAnimationFrame(show) : (show(), 0);
      },
      onEnd: () => {
        if (frame && win.cancelAnimationFrame) win.cancelAnimationFrame(frame);
        this.stopDrag?.();
        const now = this.host.tableFor(info.key);
        if (!now) return;
        if (moved()) void drag.store(now, widths, shown);
        // Not moved: a double-click makes the column automatic again; a click shows it as it was
        else if (double) void widths.set(now, column, undefined);
        else drag.show(now, undefined);
      },
    });
    this.stopDrag = () => {
      stop();
      this.drag = undefined;
      this.stopDrag = undefined;
      const now = this.host.tableFor(info.key);
      if (now) widths.placeHandles(now, undefined);
    };
    return true;
  }
}

/**
 * Widths in whole pixels whose sum is never more than theirs: each edge
 * rounded down, not each width (rounded alone, their sum could pass the
 * table's box, which would then scroll sideways)
 */
export function wholePixels(widths: readonly number[]): number[] {
  let edge = 0;
  let whole = 0;
  return widths.map((width) => {
    edge += width;
    const next = Math.floor(edge);
    const result = next - whole;
    whole = next;
    return result;
  });
}

/** A drag of a column's edge: the widths a move gives, those shown for now (undefined: as they are kept), those kept on release */
type EdgeDrag = {
  widths(by: number): ReadonlyMap<number, number>;
  show(info: TableInfo, widths: ReadonlyMap<number, number> | undefined): void;
  store(info: TableInfo, part: TableWidths, widths: ReadonlyMap<number, number>): Promise<void>;
};

/** On a feature's grid (the sheet): the grid's column alone, as wide as the pointer makes it (the tables beside it move) */
function gridDrag(host: ModelHost, info: TableInfo, column: number): EdgeDrag | undefined {
  const header = host.rectOf(info, { column });
  if (!header) return undefined;
  const start = Math.round(header.right - header.left);
  return {
    widths: (by) => new Map([[column, Math.max(MIN_WIDTH, Math.round(start + by))]]),
    show: (now, widths) => host.addressFrame(now)?.previewColumnWidth(column, widths?.get(column)),
    store: (now, part, widths) => part.set(now, column, widths.get(column)),
  };
}

/** In a table: the edge between two of its columns, the table's width kept (movedEdge), every column's width kept on release */
function tableDrag(host: ModelHost, info: TableInfo, column: number): EdgeDrag | undefined {
  const measured = host.measureColumns(info);
  if (measured.length !== info.columns || column >= measured.length - 1) return undefined;
  const columns = measured.map(({ width, header }) => ({ width, min: Math.max(MIN_WIDTH, Math.ceil(header)) }));
  return {
    widths: (by) => new Map(wholePixels(movedEdge(columns, column, by)).map((width, c) => [c, width])),
    show: (now, widths) => host.showColumnWidths(now, widths),
    store: (now, part, widths) => part.setAll(now, widths),
  };
}
