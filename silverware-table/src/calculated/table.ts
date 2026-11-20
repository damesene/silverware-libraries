// What a table calculated from sources needs, whoever calculates it (the
// pivot now, views later): its result written over the table's body, the
// headers the user renamed kept by what each column stands for (an id the
// calculation gives, as the core follows a column's attributes by place, not
// by what a calculated column is), its totals pinned, and whether the table
// shown is as calculated now. Pure: the module that calculates the table reads
// and writes its attributes through its host, and hands in the pins'.
import { columnOfHeader, headerText, matchColumns, modelHeads, withHeaderOf } from "../columns.ts";
import { cellResult } from "../formulas/index.ts";
import { type ModelColumn, NO_ATTRIBUTES, type TableModel } from "../model/model.ts";
import type { Pins } from "../view.ts";

/** A column of the result: what it stands for (kept through a refresh, its header named by the user), its header as made, its alignment */
export type CalculatedColumn = { readonly id: string; readonly header: string; readonly numeric: boolean };

/** A table's body as calculated */
export type Calculated = {
  readonly columns: readonly CalculatedColumn[];
  // The body's cells as written (texts), the totals' row last where it has one
  readonly body: readonly (readonly string[])[];
  // Whether its last row is the totals', and how many of its last columns are totals
  readonly totalRow: boolean;
  readonly totalColumns: number;
};

/** The headers the user named, by what each column stands for (CalculatedColumn.id) */
export type Renames = Readonly<Record<string, string>>;

/** How a table's pins are read and set: the module's host's */
export type PinsAccess = {
  readonly pinsOf: (table: TableModel) => Pins;
  readonly withPins: (table: TableModel, pins: Pins) => TableModel;
};

/** The renamed headers as stored (JSON by id); anything else none */
export function readRenames(stored: string | undefined): Renames {
  try {
    const read = JSON.parse(stored ?? "{}") as unknown;
    return read && typeof read === "object" && !Array.isArray(read) ? Object.fromEntries(Object.entries(read).filter((e): e is [string, string] => typeof e[1] === "string")) : {};
  } catch {
    return {};
  }
}

/** The renamed headers to store for a result: those of its columns only; none: no attribute */
export function storedRenames(renames: Renames, calculated: Calculated): string | undefined {
  const kept = Object.fromEntries(Object.entries(renames).filter(([id]) => calculated.columns.some((column) => column.id === id)));
  return Object.keys(kept).length ? JSON.stringify(kept) : undefined;
}

/**
 * The renamed headers after an edit of the table (`before` → `after`): a
 * header changed in it named so for the column it is (the table as shown is
 * as calculated now), one given its made name back or emptied no more renamed
 */
export function renamedIn(before: TableModel, after: TableModel, calculated: Calculated, renames: Renames): Renames {
  const out: Record<string, string> = { ...renames };
  const was = before.columns.map(headerText);
  const now = after.columns.map(headerText);
  if (now.length !== calculated.columns.length) return out;
  now.forEach((header, i) => {
    if (header === was[i]) return;
    const column = calculated.columns[i]!;
    const name = header.trim();
    if (!name || name === column.header) delete out[column.id];
    else out[column.id] = name;
  });
  return out;
}

/** The renamed headers with their columns' ids as they are now (what a column stands for written anew: a source's column renamed) */
export function movedRenames(renames: Renames, idNow: (id: string) => string): Renames {
  return Object.fromEntries(Object.entries(renames).map(([id, name]) => [idNow(id), name]));
}

/**
 * The table written as calculated: its headers (the user's names kept), its
 * cells (an error so that it is no hashtag, as a formula's result is), numbers
 * right-aligned, its totals pinned (the row at the bottom, the columns at the
 * right: in view, out of a sort; other pins as they were); its attributes
 * otherwise as they were, a column's kept by the column of its name (as the
 * core follows them through an edit: matchColumns)
 */
export function calculatedTable(table: TableModel, calculated: Calculated, renames: Renames, pins: PinsAccess): TableModel {
  const made = calculated.columns.map((column) => columnOfHeader(renames[column.id] ?? column.header, column.numeric ? "right" : ""));
  const from = matchColumns(modelHeads(table), modelHeads({ ...table, columns: made }));
  const kept = new Map<number, ModelColumn>();
  table.columns.forEach((column, c) => {
    const to = from(c);
    if (to !== undefined) kept.set(to, column);
  });
  const columns = made.map((column, c): ModelColumn => {
    const was = kept.get(c);
    return was ? withHeaderOf(was, column) : column;
  });
  const rows = calculated.body.map((cells) => ({ cells: cells.map((cell) => ({ content: cellResult(cell), attributes: NO_ATTRIBUTES })), attributes: NO_ATTRIBUTES }));
  const totals = { bottom: calculated.totalRow ? 1 : 0, right: calculated.totalColumns };
  const result: TableModel = { ...table, columns, rows };
  return pins.withPins(result, { ...pins.pinsOf(result), ...totals });
}

/** Whether two tables' cells are the same, headers too (a table shown against it as calculated now: out of date where not) */
export function sameCells(a: TableModel, b: TableModel): boolean {
  const sameRow = (x: readonly string[], y: readonly string[]) => x.length === y.length && x.every((text, i) => text === y[i]);
  return (
    a.rows.length === b.rows.length &&
    sameRow(a.columns.map(headerText), b.columns.map(headerText)) &&
    a.rows.every((row, r) => sameRow(row.cells.map((cell) => cell.content), b.rows[r]!.cells.map((cell) => cell.content)))
  );
}
