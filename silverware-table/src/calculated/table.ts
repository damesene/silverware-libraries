// What a table calculated from sources needs, whoever calculates it (the
// pivot now, views later): its result written over the table's body, the
// headers the user renamed kept by what each column stands for (an id the
// calculation gives, as the core follows a column's attributes by place, not
// by what a calculated column is), its totals pinned, and whether the table
// shown is as calculated now. Pure: the module that calculates the table reads
// and writes its attributes through its host, and hands in the pins'.
import { cellResult } from "../formulas/index.ts";
import { escapeCell, type Table, unescapeCell } from "../markdown.ts";
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
  readonly pinsOf: (table: Table) => Pins;
  readonly withPins: (table: Table, pins: Pins) => Table;
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
export function renamedIn(before: Table, after: Table, calculated: Calculated, renames: Renames): Renames {
  const out: Record<string, string> = { ...renames };
  const was = before.rows[0]?.cells ?? [];
  const now = after.rows[0]?.cells ?? [];
  if (now.length !== calculated.columns.length) return out;
  now.forEach((cell, i) => {
    if (cell === was[i]) return;
    const column = calculated.columns[i]!;
    const name = unescapeCell(cell).trim();
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
 * right: in view, out of a sort; other pins as they were); its metadata
 * otherwise as it was
 */
export function calculatedTable(table: Table, calculated: Calculated, renames: Renames, pins: PinsAccess): Table {
  const header = calculated.columns.map((column) => escapeCell(renames[column.id] ?? column.header));
  const rows = [{ cells: header }, ...calculated.body.map((cells) => ({ cells: cells.map((cell) => escapeCell(cellResult(cell))) }))];
  const align = calculated.columns.map((column): Table["align"][number] => (column.numeric ? "right" : ""));
  const totals = { bottom: calculated.totalRow ? 1 : 0, right: calculated.totalColumns };
  // (Its delimiter row as written where its columns are aligned as before)
  const same = align.length === table.align.length && align.every((a, i) => a === table.align[i]);
  const made: Table = same ? { ...table, rows } : { ...table, rows, align, delimiterSource: undefined, alignSource: undefined };
  return pins.withPins(made, { ...pins.pinsOf(made), ...totals });
}

/** Whether two tables' cells are the same (a table shown against it as calculated now: out of date where not) */
export function sameCells(a: Table, b: Table): boolean {
  return a.rows.length === b.rows.length && a.rows.every((row, r) => row.cells.length === b.rows[r]!.cells.length && row.cells.every((cell, c) => cell === b.rows[r]!.cells[c]));
}
