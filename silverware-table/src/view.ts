// View state of a table: sorting changes what is shown, never the markdown
// (filters are the filters module's: features/filters.ts).
import { compareForSort, type SortDirection } from "../../shared/compare.ts";

// Pinned rows and columns are moved to the edges of the table in the markdown
// and kept there: the first `top` and last `bottom` body rows, the first `left`
// and last `right` columns. Pinned rows are not sorted or filtered, and both
// stay in view while the table scrolls.
export type Pins = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

export const NO_PINS: Pins = { top: 0, bottom: 0, left: 0, right: 0 };

export type ViewState = {
  readonly sort?: { readonly column: number; readonly direction: SortDirection };
  readonly pins?: Pins;
};

export const DEFAULT_VIEW: ViewState = {};

export function pinsOf(view: ViewState): Pins {
  return view.pins ?? NO_PINS;
}

export function hasPins(pins: Pins): boolean {
  return pins.top + pins.bottom + pins.left + pins.right > 0;
}

export function withPins(view: ViewState, pins: Pins): ViewState {
  if (hasPins(pins)) return { ...view, pins };
  const { pins: _pins, ...rest } = view;
  return rest;
}

/** Click on a column's sort control: ascending, descending, then source order */
export function cycleSort(view: ViewState, column: number): ViewState {
  if (view.sort?.column !== column) return { ...view, sort: { column, direction: "asc" } };
  if (view.sort.direction === "asc") return { ...view, sort: { column, direction: "desc" } };
  return withoutSort(view);
}

export function withSort(view: ViewState, column: number, direction: SortDirection): ViewState {
  return { ...view, sort: { column, direction } };
}

export function withoutSort(view: ViewState): ViewState {
  const { sort: _sort, ...rest } = view;
  return rest;
}

/**
 * Moves the sorting along with a column change. `map` returns a column's new
 * index, or undefined when the column was deleted (the sorting ends).
 */
export function remapColumns(
  view: ViewState,
  map: (column: number) => number | undefined,
): ViewState {
  const column = view.sort ? map(view.sort.column) : undefined;
  // Pins are counts at the edges: whoever changes the columns sets them
  const result = withoutSort(view);
  return view.sort && column !== undefined ? { ...result, sort: { column, direction: view.sort.direction } } : result;
}

/**
 * The body rows' cell values (row 0 being the table's row 1; a cell a row lacks
 * is empty): what a view reads of the cells it sorts or filters by, and only
 * those, so a table neither sorted nor filtered reads none.
 */
export type CellValues = {
  readonly rows: number;
  value(row: number, column: number): string;
};

/** Cell values each read once, when first asked */
export function cellValues(rows: number, read: (row: number, column: number) => string): CellValues {
  const known: string[][] = [];
  return {
    rows,
    value: (row, column) => ((known[row] ??= [])[column] ??= read(row, column)),
  };
}

/** Cell values given whole, one array per body row */
export function cellValuesOf(values: readonly (readonly string[])[]): CellValues {
  return { rows: values.length, value: (row, column) => values[row]?.[column] ?? "" };
}

/**
 * The body rows to show between the pinned ones, in display order, as indexes
 * into `values`, but those `hidden` (by a feature: filters). Pinned rows are
 * left out: they are not sorted or hidden. Empty cells sort last in both
 * directions; ties keep the source order.
 */
export function visibleRows(
  values: CellValues,
  view: ViewState,
  hidden: ReadonlySet<number> = new Set(),
  // What sorting compares of a row's cell, where it is not its value
  sortKey: (row: number, column: number) => string = (row, column) => values.value(row, column),
): number[] {
  const { top, bottom } = pinsOf(view);
  const indexes = Array.from({ length: values.rows }, (_, i) => i).filter((i) => i >= top && i < values.rows - bottom && !hidden.has(i));
  const sort = view.sort;
  if (!sort) return indexes;
  return indexes.sort((a, b) => compareForSort(sortKey(a, sort.column), sortKey(b, sort.column), sort.direction) || a - b);
}
