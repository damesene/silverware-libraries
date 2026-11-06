// A formula in a cell, and what the formulas read of a table besides its
// values: the formulas of its cells, the names of its rows and cells, and how
// a table calculated from others is calculated (a view's formula, a pivot's
// definition: their modules', here so that whatever asks what a table's
// formulas refer to or call, forFormulas, sees theirs with its cells'). The
// domain reads none of it from the markdown itself: the formulas module gives
// the functions that do (FormulaCells, made of its host), so the domain names
// no attribute and reads no metadata.
import type { Table } from "../markdown.ts";
import type { Following } from "./edits.ts";
import { ERROR_CODES, type ErrorCode, type FormulaError, type Result } from "./values.ts";

export type StoredFormula = {
  // The formula, starting with "="
  readonly formula: string;
  // The result written with it, as markdown
  readonly value: string;
};

/** A named row: its name as written, its row of the markdown (header 0) */
export type RowName = { readonly name: string; readonly row: number };

/** A named body cell: its name as written, its row of the markdown (header 0) and column */
export type CellNameAt = { readonly name: string; readonly row: number; readonly column: number };

/** How the formulas read and write what a table keeps for them (given by the formulas module) */
export type FormulaCells = {
  /** The formula a cell holds, or undefined for a plain cell */
  readonly formulaOf: (cell: string) => StoredFormula | undefined;
  /** A cell holding `formula`, showing `value` (plain text); the other hidden tags of `from` (the cell as it was) kept */
  readonly formulaCell: (value: string, formula: string, from?: string) => string;
  /** A formula cell as a plain one: its result as its text, its other hidden tags kept */
  readonly withoutFormula: (cell: string) => string;
  /** A table's named rows, in their order (a name may be written twice: the first counts) */
  readonly rowNames: (table: Table) => readonly RowName[];
  /** A table's named body cells, in their order (the first of a name counts) */
  readonly cellNames: (table: Table) => readonly CellNameAt[];
  /**
   * How a table calculated from others (a view, a pivot) is calculated, as its
   * module gives it; undefined for any other table (none: no table is one)
   */
  readonly calculated?: (table: Table) => CalculatedBy | undefined;
};

/**
 * A table calculated from others, as its module calculates it: the formulas
 * calculate it in their order (a table reading it follows its sources in the
 * same calculation), read it as its module would write it, and write it with
 * the other tables an edit changes
 */
export type CalculatedBy = {
  /**
   * What it refers to and calls, as formulas (with their "="): a view's formula; a pivot's source as a reference to
   * it (`=orders![#Data]`) and its definition's formulas. A page among them not read: the table keeps what it shows
   */
  readonly formulas: readonly string[];
  /**
   * The table written as calculated now, or why it cannot be (nothing is written then): `read` what it reads as the
   * formulas have it now; `before` the table before an edit of it (a header renamed in it named so from now on)
   */
  readonly calculate: (read: CalculatedRead, before?: Table) => Table | FormulaError;
  /** The table with its definition following an edit of a table it reads (`before` → `after`: renamed, its columns renamed or moved) */
  readonly follow: (before: Table, after: Table, following: Following) => Table;
};

/** What a calculated table reads, as the formulas have it now */
export type CalculatedRead = {
  /** A formula's whole result in none of the table's cells: what it reads of the table itself is #CYCLE! (its cells are what is calculated) */
  readonly evaluate: (formula: string) => Result;
  /** A table by its name (on `page`, else the calculated table's), its formulas' results as calculated now (a calculated one as calculated now) */
  readonly table: (name: string, page?: string) => Table | FormulaError;
};

/** A table's named rows by their names (lowercase), the first row of each name; rows of the markdown (header 0) */
export function rowsByName(cells: FormulaCells, table: Table): Map<string, number> {
  const rows = new Map<string, number>();
  for (const { name, row } of cells.rowNames(table)) if (!rows.has(name.toLowerCase())) rows.set(name.toLowerCase(), row);
  return rows;
}

/** A table's named body cells by their names (lowercase), the first cell of each name; rows of the markdown (header 0) */
export function cellsByName(cells: FormulaCells, table: Table): Map<string, { readonly row: number; readonly column: number }> {
  const found = new Map<string, { readonly row: number; readonly column: number }>();
  for (const { name, row, column } of cells.cellNames(table)) if (!found.has(name.toLowerCase())) found.set(name.toLowerCase(), { row, column });
  return found;
}

/** Whether text typed into a cell is a formula: "=" and something after it */
export function isFormulaInput(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("=") && trimmed.length > 1;
}

/**
 * The error code a cell holds, as written now (`\#REF!`) or before (`#REF!`);
 * undefined: none
 */
export function errorCodeIn(text: string): ErrorCode | undefined {
  const code = text.trim().replace(/^\\(?=#)/, "");
  return ERROR_CODES.find((c) => c === code);
}

/** Whether a cell shows a formula error such as #REF! */
export function isErrorText(text: string): boolean {
  return errorCodeIn(text) !== undefined;
}

/**
 * A result as a cell holds it: an error's code with its `#` escaped
 * (`\#REF!`), which shows as written but is no hashtag: SilverBullet would
 * take `#REF!` for the tag REF, highlighted short of its `!` and given to the
 * table's row in its index (verified in 2.12.1, 2026-11-05)
 */
export function cellResult(text: string): string {
  const code = errorCodeIn(text);
  return code ? `\\${code}` : text;
}

export function hasFormulas(cells: FormulaCells, table: Table): boolean {
  return table.rows.some((row, r) => r > 0 && row.cells.some((cell) => cells.formulaOf(cell) !== undefined));
}

/** How many cells of the table hold a formula */
export function formulaCount(cells: FormulaCells, table: Table): number {
  return table.rows.reduce((n, row, r) => n + (r === 0 ? 0 : row.cells.filter((cell) => cells.formulaOf(cell)).length), 0);
}

/** Each formula of a table: its cells', and a calculated table's (what the table refers to and calls, as its cells' formulas do) */
export function forFormulas(cells: FormulaCells, table: Table, each: (formula: string) => void): void {
  for (const formula of cells.calculated?.(table)?.formulas ?? []) each(formula);
  table.rows.forEach((row, r) => {
    if (r === 0) return;
    for (const cell of row.cells) {
      const stored = cells.formulaOf(cell);
      if (stored) each(stored.formula);
    }
  });
}
