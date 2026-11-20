// Structural edits of the model: each returns a new table, sharing what it
// did not change (a row not touched is the same object, so a store writes it
// as it was). Rows are counted as everywhere (the header 0, the body from 1:
// the model's row r is `rows[r - 1]`); the header is no row, its cells are the
// columns' (`withHeader`). A cell's content set keeps its attributes: which of
// them an edit ends is the core's write step's (an attribute bound to its
// content).
import { type Align, type ModelCell, type ModelColumn, type ModelRow, NO_ATTRIBUTES, type TableModel } from "./model.ts";

// Where a row or column of the table before an edit is after it; undefined: deleted
export type IndexMap = (index: number) => number | undefined;

/** A cell holding nothing */
export const EMPTY_CELL: ModelCell = { content: "", attributes: NO_ATTRIBUTES };

function emptyRow(columns: number): ModelRow {
  return { cells: Array.from({ length: columns }, () => EMPTY_CELL), attributes: NO_ATTRIBUTES };
}

/** Items `first`..`last` moved so that the first of them ends up at index `to` */
function movedBlock<T>(items: readonly T[], first: number, last: number, to: number): T[] {
  const result = [...items];
  const block = result.splice(first, last - first + 1);
  result.splice(to, 0, ...block);
  return result;
}

/** The table with a body cell (`row` from 1) replaced (no such cell: as it was); the same cell: the same table */
export function withCellAt(model: TableModel, row: number, column: number, cell: ModelCell): TableModel {
  const current = model.rows[row - 1]?.cells[column];
  if (!current || current === cell) return model;
  const rows = model.rows.map((r, i) => (i === row - 1 ? { ...r, cells: r.cells.map((c, at) => (at === column ? cell : c)) } : r));
  return { ...model, rows };
}

/** The table with a body cell's content set, its attributes kept; the same content: the same table */
export function withContentAt(model: TableModel, row: number, column: number, content: string): TableModel {
  const current = model.rows[row - 1]?.cells[column];
  return !current || current.content === content ? model : withCellAt(model, row, column, { ...current, content });
}

/** The table with a column's header (its name's text) set, its attributes kept */
export function withHeader(model: TableModel, column: number, header: string): TableModel {
  const current = model.columns[column];
  if (!current || current.header === header) return model;
  return { ...model, columns: model.columns.map((c, i) => (i === column ? { ...c, header } : c)) };
}

/** The table with a column's alignment set */
export function withAlign(model: TableModel, column: number, align: Align): TableModel {
  const current = model.columns[column];
  if (!current || current.align === align) return model;
  return { ...model, columns: model.columns.map((c, i) => (i === column ? { ...c, align } : c)) };
}

/** Inserts a body row (empty, or with the given cells) so that it becomes row `at` (from 1) */
export function insertRow(model: TableModel, at: number, cells?: readonly ModelCell[]): TableModel {
  const rows = [...model.rows];
  const row: ModelRow = cells ? { cells: model.columns.map((_, c) => cells[c] ?? EMPTY_CELL), attributes: NO_ATTRIBUTES } : emptyRow(model.columns.length);
  rows.splice(Math.max(0, Math.min(at - 1, rows.length)), 0, row);
  return { ...model, rows };
}

export function deleteRow(model: TableModel, row: number): TableModel {
  if (row < 1 || row > model.rows.length) return model;
  return { ...model, rows: model.rows.filter((_, i) => i !== row - 1) };
}

/** Inserts a copy of body row `row` right below it: its cells and its attributes, as they are */
export function duplicateRow(model: TableModel, row: number): TableModel {
  const original = model.rows[row - 1];
  if (row < 1 || !original) return model;
  const rows = [...model.rows];
  rows.splice(row, 0, { cells: [...original.cells], attributes: original.attributes });
  return { ...model, rows };
}

/**
 * Puts the body rows in the given order: `order` lists every body row (1 and
 * up) once, in the new order. The rows themselves are kept, so a store writes
 * each as it was.
 */
export function reorderRows(model: TableModel, order: readonly number[]): TableModel {
  const rows = order.map((i) => model.rows[i - 1]).filter((r): r is ModelRow => !!r);
  return rows.length === model.rows.length ? { ...model, rows } : model;
}

/** Moves body row `from` so that it ends up at row `to` */
export function moveRow(model: TableModel, from: number, to: number): TableModel {
  return moveRows(model, from, from, to);
}

/** Moves body rows `first`..`last` so that the first of them ends up at row `to` */
export function moveRows(model: TableModel, first: number, last: number, to: number): TableModel {
  const end = model.rows.length;
  const size = last - first + 1;
  if (first < 1 || last > end || size < 1 || to < 1 || to + size - 1 > end || first === to) return model;
  return { ...model, rows: movedBlock(model.rows, first - 1, last - 1, to - 1) };
}

/** A name for a new column no column has (SilverBullet renders no empty header cell): Column N, N past the columns */
export function newColumnName(model: TableModel): string {
  const names = new Set(model.columns.map((c) => c.header));
  let n = model.columns.length + 1;
  while (names.has(`Column ${n}`)) n++;
  return `Column ${n}`;
}

/** Names every column with an empty header "Column N" (N its place, or the next free number) */
export function nameEmptyHeaders(model: TableModel): TableModel {
  if (!model.columns.some((c) => c.header === "")) return model;
  const names = new Set(model.columns.map((c) => c.header));
  const columns = model.columns.map((column, i): ModelColumn => {
    if (column.header !== "") return column;
    let n = i + 1;
    while (names.has(`Column ${n}`)) n++;
    const header = `Column ${n}`;
    names.add(header);
    return { ...column, header };
  });
  return { ...model, columns };
}

/** Inserts a column so that it becomes column `at`, its header made (newColumnName), its cells empty */
export function insertColumn(model: TableModel, at: number): TableModel {
  const column = Math.max(0, Math.min(at, model.columns.length));
  const columns = [...model.columns];
  columns.splice(column, 0, { header: newColumnName(model), align: "", attributes: NO_ATTRIBUTES });
  const rows = model.rows.map((r) => {
    const cells = [...r.cells];
    cells.splice(column, 0, EMPTY_CELL);
    return { ...r, cells };
  });
  return { ...model, columns, rows };
}

/** Deletes a column, its cells and its attributes with it (a table keeps one column at least) */
export function deleteColumn(model: TableModel, column: number): TableModel {
  if (model.columns.length <= 1 || column < 0 || column >= model.columns.length) return model;
  return {
    ...model,
    columns: model.columns.filter((_, i) => i !== column),
    rows: model.rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== column) })),
  };
}

/** Moves column `from` so that it ends up at column `to` */
export function moveColumn(model: TableModel, from: number, to: number): TableModel {
  return moveColumns(model, from, from, to);
}

/** Moves columns `first`..`last` so that the first of them ends up at column `to`, their attributes with them */
export function moveColumns(model: TableModel, first: number, last: number, to: number): TableModel {
  const count = model.columns.length;
  const size = last - first + 1;
  if (first < 0 || last >= count || size < 1 || to < 0 || to + size - 1 >= count || first === to) return model;
  return {
    ...model,
    columns: movedBlock(model.columns, first, last, to),
    rows: model.rows.map((r) => ({ ...r, cells: movedBlock(r.cells, first, last, to) })),
  };
}

/** Where line (row or column) `i` ends up after moving lines `first`..`last` so that the first is at `to` */
export function lineAfterBlockMove(i: number, first: number, last: number, to: number): number {
  const size = last - first + 1;
  if (i >= first && i <= last) return to + i - first;
  // The others close up, then make room for the block
  const closed = i > last ? i - size : i;
  return closed >= to ? closed + size : closed;
}

/** Where column `c` ends up after moving column `from` to `to` */
export function columnAfterMove(c: number, from: number, to: number): number {
  if (c === from) return to;
  if (from < to && c > from && c <= to) return c - 1;
  if (from > to && c >= to && c < from) return c + 1;
  return c;
}
