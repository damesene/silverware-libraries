// The widths module: columns' widths are set by dragging the edge between two
// columns (a handle on a header's right edge, none on the last: the table
// keeps its width), a column fitted to its text by double-clicking its edge
// or with "Fit to content" in its menu. With the metadata setting they are
// stored in the table (widths.-c-price.size='180'), which follows the column
// through renames and moves (metadataAfterEdit); without it, they hold for
// the view only. "Reset column widths" in the table's menu makes every column
// automatic again.
//
// A drag moves only that edge: what one side gains the other loses, from the
// nearest column on, none below what its header needs (movedEdge). On release
// every column's width is kept, and the width of the box the table had then
// (widths.box): the table is shown as that share of whatever box it has, so
// it widens and narrows with it (full screen, another window). A column added
// or deleted keeps the table so (widthsAfterEdit, in the write). A table of
// its own width (narrower or wider than its box) is a sum other than the box:
// the same data (docs/silverware-table-column-resize.md).
//
// Where a feature lays the table out on a grid of its own (TableHost.addressFrame:
// the sheet view), the columns are the grid's: a handle sets the grid's column
// (for every table in it, the last one too; a double-click makes it
// automatic), the table's own widths give way.
//
// While dragging, the widths are those at the press changed by how far the
// pointer moved since, never measured again: a scrollbar showing or going, or
// the table moving as it gets narrower, cannot feed back into them. The widths
// are the module's (columnWidths); the core shows them, and the handles (a
// handle layer per table, as every table's headers have them).
import type { ColumnsMeasure, ColumnWidths, Feature, HandleLayer, LineMenuBuilder, LineMenuGroup, LineMenuTarget, ModelHost, PartTable, TableInfo, TableKey, ToolbarButton, WriteEdit } from "../core/feature.ts";
import { tablePartsOf } from "../core/feature.ts";
import { ICONS } from "../icons.ts";
import { parseTable, type Table } from "../markdown.ts";

// The narrowest a column can be dragged to, in pixels
const MIN_WIDTH = 40;
// The table's attribute: the width of its box when its columns' widths were set
const BOX_KEY = "box";

// The handles' layers, one per table
const LAYER = "width:";
const HANDLE_CLASS = "swt-col-resize";
const HANDLE_TITLE = "Drag to move the edge between the columns; double-click to fit the column to its content";
const GRID_HANDLE_TITLE = "Drag to set the column's width; double-click for automatic";

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
    // (Past what adding floats loses: 66.67 + 133.33 is 200)
    const next = Math.floor(edge + 1e-9);
    const result = next - whole;
    whole = next;
    return result;
  });
}

/**
 * Every column's width after an edit added or deleted columns (`map`: where
 * each old column went, undefined: deleted), the table as wide a share of its
 * box as before: the columns kept keep their sum, each new column an equal
 * share of it, the others narrower in proportion; `scale` is how the sum
 * changed (the box changes alike), `added` whether there are new columns.
 * Undefined: no column kept
 */
export function widthsAfterEdit(old: readonly number[], map: (column: number) => number | undefined, columns: number): { readonly widths: number[]; readonly scale: number; readonly added: boolean } | undefined {
  const kept = new Map<number, number>();
  old.forEach((width, column) => {
    const to = map(column);
    if (to !== undefined && to < columns) kept.set(to, width);
  });
  const sum = old.reduce((a, b) => a + b, 0);
  const keptSum = Array.from(kept.values()).reduce((a, b) => a + b, 0);
  if (!kept.size || !keptSum || !sum) return undefined;
  const share = keptSum / columns;
  const narrower = kept.size / columns;
  const widths = Array.from({ length: columns }, (_, column) => {
    const width = kept.get(column);
    return width === undefined ? share : width * narrower;
  });
  return { widths: wholePixels(widths), scale: keptSum / sum, added: kept.size < columns };
}

const byColumn = (widths: readonly number[]) => new Map(widths.map((width, column) => [column, width]));

/** The columns as measured, each with the narrowest a drag may make it: what its header needs, at least MIN_WIDTH */
const draggedColumns = (measured: ColumnsMeasure): DraggedColumn[] => measured.columns.map(({ width, header }) => ({ width, min: Math.max(MIN_WIDTH, Math.ceil(header)) }));

/** One table's widths (the module's part for it, core/parts.ts): those set for the view, those stored, its handles */
class TableWidths {
  // Set for the view only (none stored): widths by column (undefined: automatic), the box they were set in
  private viewed = new Map<number, number | undefined>();
  private viewedBox: { readonly box: number | undefined } | undefined;
  // The widths stored in the table as last read (parsing a large table for its metadata row on every view is slow)
  private stored: { readonly source: string; readonly widths: ReadonlyMap<number, number>; readonly box: number | undefined } | undefined;
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

  /** Its columns' widths and their box: those set for the view, else those stored */
  layoutOf(info: TableInfo): { readonly widths: Map<number, number>; readonly box: number | undefined } {
    if (this.stored?.source !== info.source) {
      const table = parseTable(info.source);
      const read = new Map<number, number>();
      for (const [column, value] of this.host.columnsMeta(table, "size")) {
        const n = Number(value);
        // As stored, not raised to MIN_WIDTH: their shares of the box are what they say
        if (Number.isFinite(n) && n > 0) read.set(column, Math.round(n));
      }
      const box = Number(this.host.getMeta(table, BOX_KEY));
      this.stored = { source: info.source, widths: read, box: Number.isFinite(box) && box > 0 ? box : undefined };
    }
    const widths = new Map(this.stored.widths);
    for (const [column, width] of this.viewed) {
      if (width === undefined) widths.delete(column);
      else widths.set(column, width);
    }
    return { widths, box: this.viewedBox ? this.viewedBox.box : this.stored.box };
  }

  columnWidths(info: TableInfo): ColumnWidths {
    // Laid out on a grid of a feature's: its columns' widths, not the table's own
    return this.host.addressFrame(info) ? { widths: new Map() } : this.layoutOf(info);
  }

  /** A handle on each header cell's right edge (shown by CSS while the header is hovered, selected or edited) */
  enhanced(info: TableInfo): void {
    this.placeHandles(info, undefined);
  }

  placeHandles(info: TableInfo, active: number | undefined): void {
    // The last column's right edge is the table's, which keeps its width; a grid's columns have no such edge
    const grid = !!this.host.addressFrame(info);
    const count = grid ? info.columns : info.columns - 1;
    this.handles.place(
      info.key,
      Array.from({ length: Math.max(0, count) }, (_, column) => ({
        // One handle per column (a layer's handles are told apart by their classes), the one dragged lit
        className: `${HANDLE_CLASS} ${HANDLE_CLASS}-${column}`,
        active: column === active,
        row: 0,
        column,
        title: grid ? GRID_HANDLE_TITLE : HANDLE_TITLE,
      })),
    );
  }

  /** A grid's column's width set (undefined: automatic), where a feature lays the table out on one */
  async setGridWidth(info: TableInfo, column: number, width: number | undefined): Promise<void> {
    await this.host.addressFrame(info)?.setColumnWidth(column, width);
  }

  /** A column fitted to its text: the edge after it moved (the last column's: the edge before it), the table's width kept */
  fit(info: TableInfo, column: number): void {
    const fitted = fittedWidths(this.host, info, column);
    if (fitted) void this.keepMeasured(info, fitted.widths, fitted.box);
  }

  /** Every column's width as dragged or fitted, with the box measured then (none measured: the box it has kept) */
  keepMeasured(info: TableInfo, widths: ReadonlyMap<number, number>, box: number | undefined): Promise<void> {
    return this.keep(info, widths, box ?? this.layoutOf(info).box);
  }

  /**
   * Columns' widths (undefined: automatic) and the box they were set in
   * (undefined: none) kept: stored in the table where they can be, else for the view
   */
  async keep(info: TableInfo, set: ReadonlyMap<number, number | undefined>, box: number | undefined): Promise<void> {
    for (const [column, width] of set) this.viewed.set(column, width);
    this.viewedBox = { box };
    this.host.showColumnWidths(info, undefined);
    // Reset column widths offered or not
    this.host.toolbarChanged();
    // What the table can take (the metadata setting off: only where it has it stored); the rest is the view's
    const table = parseTable(info.source);
    const stored = [...set.keys()].filter((column) => set.get(column) === undefined || this.host.canStoreMeta(table, "size", { column }));
    const boxStored = box === undefined || this.host.canStoreMeta(table, BOX_KEY);
    if (!stored.length && !boxStored) return;
    const result = await this.host.writeTable(info, (t) => {
      const widths = this.host.columnsMeta(t, "size");
      for (const [column, width] of set) {
        if (width === undefined) widths.delete(column);
        else widths.set(column, String(width));
      }
      return this.host.setMeta(this.host.setColumnsMeta(t, "size", widths), BOX_KEY, box === undefined ? undefined : String(box));
    });
    // Stored (or already so): the table's metadata has them now
    if (result === "failed") return;
    for (const column of stored) this.viewed.delete(column);
    if (boxStored) this.viewedBox = undefined;
  }

  /**
   * Columns moved, inserted or deleted: the widths set for the view go with
   * them, and their box shrinks with the widths deleted, as the stored one does (Widths.writeStep)
   */
  columnsMoved(_key: TableKey, map: (column: number) => number | undefined): void {
    const moved = new Map<number, number | undefined>();
    let sum = 0;
    let kept = 0;
    for (const [column, width] of this.viewed) {
      const target = map(column);
      sum += width ?? 0;
      if (target === undefined) continue;
      moved.set(target, width);
      kept += width ?? 0;
    }
    this.viewed = moved;
    const box = this.viewedBox?.box;
    if (box !== undefined && sum > 0 && kept < sum) this.viewedBox = { box: Math.ceil((box * kept) / sum) };
  }

  // Before Remove metadata (the widths module comes before it), which would remove them too
  toolbarButtons(info: TableInfo): ToolbarButton[] {
    const { widths } = this.layoutOf(info);
    // On a grid of a feature's the table's own widths do not show: nothing to reset there
    if (!widths.size || this.host.addressFrame(info)) return [];
    return [
      {
        label: "Reset column widths",
        icon: ICONS.columnWidth,
        danger: true,
        title: "Make every column as wide as its text again",
        run: () => {
          // As rendered now (the menu stays open across a write)
          const now = this.table.current() ?? info;
          void this.keep(now, new Map(Array.from(this.layoutOf(now).widths.keys(), (column) => [column, undefined])), undefined);
        },
      },
    ];
  }

  /** Fit to content in a column's menu (how it looks); on a grid of a feature's, Auto width (how it shows) where the grid's column has a width */
  lineMenu(info: TableInfo, { axis, at: column }: LineMenuTarget, menu: LineMenuBuilder): LineMenuGroup[] {
    if (axis !== "column") return [];
    const grid = this.host.addressFrame(info);
    if (grid) {
      const width = grid.columnWidth(column);
      if (width === undefined) return [];
      return [
        menu.slot.view([
          menu.item({
            label: "Auto width",
            icon: ICONS.columnWidth,
            hint: `The column is ${width}px wide: make it as wide as its text`,
            run: () => void this.setGridWidth(this.table.current() ?? info, column, undefined),
          }),
        ]),
      ];
    }
    // A table of one column: it is the table's width
    if (info.columns < 2) return [];
    return [
      menu.slot.look([
        menu.item({
          label: "Fit to content",
          icon: ICONS.columnWidth,
          hint: "Make the column as wide as its text; the column beside it gives or takes the difference, the table keeps its width",
          run: () => this.fit(this.table.current() ?? info, column),
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

  /** Columns added or deleted in a table with a width for every column: every column has one after (widthsAfterEdit) */
  writeStep(before: Table, after: Table, edit: WriteEdit): Table {
    const columns = after.rows[0]?.cells.length ?? 0;
    const count = before.rows[0]?.cells.length ?? 0;
    if (columns === count || !count || !columns) return after;
    const sizes = this.host.columnsMeta(before, "size");
    if (sizes.size !== count) return after;
    const old = Array.from({ length: count }, (_, column) => Number(sizes.get(column)));
    if (old.some((width) => !Number.isFinite(width) || width <= 0)) return after;
    const changed = widthsAfterEdit(old, edit.columnMap ?? ((column) => column), columns);
    if (!changed) return after;
    // One column left: it is the table, without a handle or Fit to content; automatic again
    if (columns === 1) return this.host.setMeta(this.host.setColumnsMeta(after, "size", new Map()), BOX_KEY, undefined);
    // Only columns deleted: the others keep theirs, which the core's write step carries (written here, a width equal
    // to the one a column of the same name had would be taken for that column's), the box shrinks with them
    const widths = changed.added ? this.host.setColumnsMeta(after, "size", new Map(changed.widths.map((width, column) => [column, String(width)]))) : after;
    const box = Number(this.host.getMeta(before, BOX_KEY));
    return Number.isFinite(box) && box > 0 ? this.host.setMeta(widths, BOX_KEY, String(Math.ceil(box * changed.scale))) : widths;
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
    // The second press of a double click: the column fitted (a grid's: automatic), unless it moves
    const double = e.detail >= 2;
    const start = drag.widths(0);
    let shown = start;
    const moved = () => Array.from(shown.widths).some(([c, width]) => width !== start.widths.get(c));
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
        // Not moved: a double-click fits the column; a click shows it as it was
        else if (double) drag.fit(now, widths);
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

/** A drag of a column's edge: the widths a move gives, those shown for now (undefined: as they are kept), kept on release; a double-click's */
type EdgeDrag = {
  widths(by: number): ColumnWidths;
  show(info: TableInfo, widths: ColumnWidths | undefined): void;
  store(info: TableInfo, part: TableWidths, widths: ColumnWidths): Promise<void>;
  fit(info: TableInfo, part: TableWidths): void;
};

/** On a feature's grid (the sheet): the grid's column alone, as wide as the pointer makes it (the tables beside it move) */
function gridDrag(host: ModelHost, info: TableInfo, column: number): EdgeDrag | undefined {
  const header = host.rectOf(info, { column });
  if (!header) return undefined;
  const start = Math.round(header.right - header.left);
  return {
    widths: (by) => ({ widths: new Map([[column, Math.max(MIN_WIDTH, Math.round(start + by))]]) }),
    show: (now, widths) => host.addressFrame(now)?.previewColumnWidth(column, widths?.widths.get(column)),
    store: (now, part, widths) => part.setGridWidth(now, column, widths.widths.get(column)),
    fit: (now, part) => void part.setGridWidth(now, column, undefined),
  };
}

/** In a table: the edge between two of its columns, the table's width kept (movedEdge), every column's width and the box kept on release */
function tableDrag(host: ModelHost, info: TableInfo, column: number): EdgeDrag | undefined {
  const measured = host.measureColumns(info);
  if (measured.columns.length !== info.columns || column >= measured.columns.length - 1) return undefined;
  const columns = draggedColumns(measured);
  return {
    widths: (by) => ({ widths: byColumn(wholePixels(movedEdge(columns, column, by))), box: boxOf(measured) }),
    show: (now, widths) => host.showColumnWidths(now, widths),
    store: (now, part, { widths, box }) => part.keepMeasured(now, widths, box),
    fit: (now, part) => part.fit(now, column),
  };
}

/** A column as wide as its text and header need (TableWidths.fit); undefined: a table of one column, or not measured */
function fittedWidths(host: ModelHost, info: TableInfo, column: number): { readonly widths: Map<number, number>; readonly box: number | undefined } | undefined {
  const measured = host.measureColumns(info);
  if (info.columns < 2 || measured.columns.length !== info.columns || column >= info.columns) return undefined;
  const columns = draggedColumns(measured);
  const by = Math.max(columns[column]!.min, Math.ceil(host.columnContentWidth(info, column))) - columns[column]!.width;
  // The edge after it, the last column's the edge before it (moved the other way)
  const moved = column < columns.length - 1 ? movedEdge(columns, column, by) : movedEdge(columns, column - 1, -by);
  return { widths: byColumn(wholePixels(moved)), box: boxOf(measured) };
}

/** The table's box as measured, in whole pixels (up: the widths' sum, rounded down, never passes it); undefined: none measured (not laid out) */
const boxOf = (measured: ColumnsMeasure): number | undefined => (measured.box > 0 ? Math.ceil(measured.box) : undefined);
