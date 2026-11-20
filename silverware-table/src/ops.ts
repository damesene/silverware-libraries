// Structural edits of a markdown table (its rows the header's and the body's,
// its cells markdown). Each returns a new table. The model's are model/ops.ts,
// which the modules move onto (docs/silverware-table-store-plan.md, step 3).
import type { Align, Row, Table } from "./markdown.ts";
export { columnAfterMove, type IndexMap, lineAfterBlockMove } from "./model/ops.ts";

function withRows(table: Table, rows: readonly Row[]): Table {
  return { ...table, rows };
}

function emptyRow(columns: number): Row {
  return { cells: Array.from({ length: columns }, () => "") };
}

// The row keeps its source: the serializer rewrites it only if its cells differ
function withCells(row: Row, cells: readonly string[]): Row {
  return { ...row, cells };
}

function padded(cells: readonly string[], length: number): string[] {
  const result = [...cells];
  while (result.length < length) result.push("");
  return result;
}

function moved<T>(items: readonly T[], from: number, to: number): T[] {
  return movedBlock(items, from, from, to);
}

/** Items `first`..`last` moved so that the first of them ends up at index `to` */
function movedBlock<T>(items: readonly T[], first: number, last: number, to: number): T[] {
  const result = [...items];
  const block = result.splice(first, last - first + 1);
  result.splice(to, 0, ...block);
  return result;
}

export function setCell(table: Table, row: number, column: number, value: string): Table {
  return withRows(
    table,
    table.rows.map((r, i) => {
      if (i !== row) return r;
      const cells = padded(r.cells, column + 1);
      cells[column] = value;
      return withCells(r, cells);
    }),
  );
}

/** Inserts a body row (empty, or with the given cells) so that it becomes rows[at] */
export function insertRow(table: Table, at: number, cells?: readonly string[]): Table {
  const rows = [...table.rows];
  rows.splice(Math.max(1, Math.min(at, rows.length)), 0, cells ? { cells: [...cells] } : emptyRow(table.align.length));
  return withRows(table, rows);
}

export function deleteRow(table: Table, row: number): Table {
  if (row < 1 || row >= table.rows.length) return table;
  return withRows(
    table,
    table.rows.filter((_, i) => i !== row),
  );
}

/** Inserts a copy of body row `row` right below it */
export function duplicateRow(table: Table, row: number): Table {
  const original = table.rows[row];
  if (row < 1 || !original) return table;
  const rows = [...table.rows];
  rows.splice(row + 1, 0, { cells: [...original.cells] });
  return withRows(table, rows);
}

/**
 * Puts the body rows in the given order: `order` lists every body row index
 * (1 and up) once, in the new order. Rows keep their source, so unchanged rows
 * are written as they were.
 */
export function reorderRows(table: Table, order: readonly number[]): Table {
  const body = order.map((i) => table.rows[i]).filter((r): r is Row => !!r);
  if (body.length !== table.rows.length - 1) return table;
  return withRows(table, [table.rows[0]!, ...body]);
}

/** Moves body row `from` so that it ends up at index `to` */
export function moveRow(table: Table, from: number, to: number): Table {
  const last = table.rows.length - 1;
  if (from < 1 || from > last || to < 1 || to > last || from === to) return table;
  return withRows(table, moved(table.rows, from, to));
}

/** Inserts an empty column so that it becomes column `at` */
// SilverBullet does not render an empty header cell, so a new column gets a name
export function newColumnName(table: Table): string {
  const names = new Set(table.rows[0]?.cells ?? []);
  let n = table.align.length + 1;
  while (names.has(`Column ${n}`)) n++;
  return `Column ${n}`;
}

/** Inserts a column so that it becomes column `at`, with a generated header */
export function insertColumn(table: Table, at: number): Table {
  const column = Math.max(0, Math.min(at, table.align.length));
  const header = newColumnName(table);
  const align = [...table.align];
  align.splice(column, 0, "");
  return {
    ...table,
    align,
    rows: table.rows.map((r, i) => {
      const cells = padded(r.cells, column);
      cells.splice(column, 0, i === 0 ? header : "");
      return withCells(r, cells);
    }),
  };
}

export function deleteColumn(table: Table, column: number): Table {
  if (table.align.length <= 1 || column < 0 || column >= table.align.length) return table;
  return {
    ...table,
    align: table.align.filter((_, i) => i !== column),
    rows: table.rows.map((r) =>
      withCells(
        r,
        r.cells.filter((_, i) => i !== column),
      ),
    ),
  };
}

/** Moves body rows `first`..`last` so that the first of them ends up at index `to` */
export function moveRows(table: Table, first: number, last: number, to: number): Table {
  const end = table.rows.length - 1;
  const size = last - first + 1;
  if (first < 1 || last > end || size < 1 || to < 1 || to + size - 1 > end || first === to) return table;
  return withRows(table, movedBlock(table.rows, first, last, to));
}

/** Moves columns `first`..`last` so that the first of them ends up at index `to` */
export function moveColumns(table: Table, first: number, last: number, to: number): Table {
  const columns = table.align.length;
  const size = last - first + 1;
  if (first < 0 || last >= columns || size < 1 || to < 0 || to + size - 1 >= columns || first === to) return table;
  return {
    ...table,
    align: movedBlock(table.align, first, last, to),
    rows: table.rows.map((r) => withCells(r, movedBlock(padded(r.cells, columns), first, last, to))),
  };
}

/** Moves column `from` so that it ends up at index `to` */
export function moveColumn(table: Table, from: number, to: number): Table {
  const columns = table.align.length;
  if (from < 0 || from >= columns || to < 0 || to >= columns || from === to) return table;
  return {
    ...table,
    align: moved(table.align, from, to),
    rows: table.rows.map((r) => withCells(r, moved(padded(r.cells, columns), from, to))),
  };
}

export function setAlign(table: Table, column: number, align: Align): Table {
  return {
    ...table,
    align: table.align.map((a, i) => (i === column ? align : a)),
  };
}
