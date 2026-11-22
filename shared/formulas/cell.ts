// A formula in a cell, and what the formulas read of a table besides its
// values: the formulas of its cells, the names of its rows and cells, and how
// a table calculated from others is calculated (a view's formula, a pivot's
// definition: their modules', here so that whatever asks what a table's
// formulas refer to or call, forFormulas, sees theirs with its cells'). The
// domain reads none of it from the markdown itself: the formulas module gives
// the functions that do (FormulaCells, made of its host), so the domain names
// no attribute and reads no metadata. A table is the model (shared/table/model.ts):
// its rows keep the markdown's numbers here (the header 0, the body from 1),
// the model's row r being `rows[r - 1]`.
import { type ModelCell, NO_ATTRIBUTES, type TableModel } from "../table/model.ts";
import type { CellNameAt, RowName } from "../table/names.ts";
import type { Following } from "./edits.ts";
import { ERROR_CODES, type ErrorCode, type FormulaError, type Result, type Scalar } from "./values.ts";

export type { CellNameAt, RowName };

export type StoredFormula = {
  // The formula, starting with "="
  readonly formula: string;
  // The result written with it: the cell's content
  readonly value: string;
};

/** How the formulas read and write what a table keeps for them (given by the formulas module) */
export type FormulaCells = {
  /** The formula a cell holds, or undefined for a plain cell */
  readonly formulaOf: (cell: ModelCell) => StoredFormula | undefined;
  /** A cell holding `formula`, showing `value` (its content); the other attributes of `from` (the cell as it was) kept */
  readonly formulaCell: (value: string, formula: string, from?: ModelCell) => ModelCell;
  /** A formula cell as a plain one: its result its content, its other attributes kept */
  readonly withoutFormula: (cell: ModelCell) => ModelCell;
  /** A table's named rows, in their order (a name may be written twice: the first counts) */
  readonly rowNames: (table: TableModel) => readonly RowName[];
  /** A table's named body cells, in their order (the first of a name counts) */
  readonly cellNames: (table: TableModel) => readonly CellNameAt[];
  /**
   * A plain cell's value as it is, where its rows keep values of a type of their own (a database's number, logical
   * value, text): read so, not guessed from its text (`007` a text, not 7; `TRUE` a logical value). Undefined: the
   * cell's text read as a markdown table's is (a number where it reads as one, a time, an error's code, else text).
   */
  readonly plainValue?: (cell: ModelCell) => Scalar | undefined;
  /**
   * How a table calculated from others (a view, a pivot) is calculated, as its
   * module gives it; undefined for any other table (none: no table is one)
   */
  readonly calculated?: (table: TableModel) => CalculatedBy | undefined;
  /**
   * The formulas a module keeps in a table's metadata row that calculate none
   * of its cells (a choice list's), as its module gives them; undefined where
   * the table has none
   */
  readonly held?: (table: TableModel) => HeldFormulas | undefined;
};

/**
 * Formulas a table holds besides its cells' and calculating none of them (a
 * choice list's: its values calculated as its column shows, never written):
 * what the table reads, so that their references follow the edits of what
 * they read as a cell's do
 */
export type HeldFormulas = {
  /** The formulas, with their "=" */
  readonly formulas: readonly string[];
  /** The table with each of them as `follow` makes it (an edit of what it reads followed), written back where changed */
  readonly follow: (follow: (formula: string) => string) => TableModel;
};

/**
 * Cells read as data only (a source of the space's): no formula, no name, a
 * hidden tag in a value left out as in any plain cell
 */
export const PLAIN_CELLS: FormulaCells = {
  formulaOf: () => undefined,
  formulaCell: (value, _formula, from) => ({ content: value, attributes: from?.attributes ?? NO_ATTRIBUTES }),
  withoutFormula: (cell) => cell,
  rowNames: () => [],
  cellNames: () => [],
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
  readonly calculate: (read: CalculatedRead, before?: TableModel) => TableModel | FormulaError;
  /** The table with its definition following an edit of a table it reads (`before` → `after`: renamed, its columns renamed or moved) */
  readonly follow: (before: TableModel, after: TableModel, following: Following) => TableModel;
};

/** What a calculated table reads, as the formulas have it now */
export type CalculatedRead = {
  /** A formula's whole result in none of the table's cells: what it reads of the table itself is #CYCLE! (its cells are what is calculated) */
  readonly evaluate: (formula: string) => Result;
  /** A table by its name (on `page`, else the calculated table's), its formulas' results as calculated now (a calculated one as calculated now) */
  readonly table: (name: string, page?: string) => TableModel | FormulaError;
  /** A source of the space by its name (@tasks), or why there is none */
  readonly source: (name: string) => TableModel | FormulaError;
};

/** A table's named rows by their names (lowercase), the first row of each name; rows of the markdown (header 0) */
export function rowsByName(cells: FormulaCells, table: TableModel): Map<string, number> {
  const rows = new Map<string, number>();
  for (const { name, row } of cells.rowNames(table)) if (!rows.has(name.toLowerCase())) rows.set(name.toLowerCase(), row);
  return rows;
}

/** A table's named body cells by their names (lowercase), the first cell of each name; rows of the markdown (header 0) */
export function cellsByName(cells: FormulaCells, table: TableModel): Map<string, { readonly row: number; readonly column: number }> {
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

/**
 * A result as a table's cell holds it as its content (cellResult): one line,
 * no spaces around it, as a table's cell is a line of its row (what a cell
 * holds is the same written and read again: a result kept up to date)
 */
export function resultContent(text: string): string {
  return cellResult(text.replace(/\r?\n/g, " ").trim());
}

export function hasFormulas(cells: FormulaCells, table: TableModel): boolean {
  return table.rows.some((row) => row.cells.some((cell) => cells.formulaOf(cell) !== undefined));
}

/** How many cells of the table hold a formula */
export function formulaCount(cells: FormulaCells, table: TableModel): number {
  return table.rows.reduce((n, row) => n + row.cells.filter((cell) => cells.formulaOf(cell)).length, 0);
}

/** Each formula of a table: its cells', a calculated table's and those it holds (what the table refers to and calls, as its cells' formulas do) */
export function forFormulas(cells: FormulaCells, table: TableModel, each: (formula: string) => void): void {
  for (const formula of cells.calculated?.(table)?.formulas ?? []) each(formula);
  for (const formula of cells.held?.(table)?.formulas ?? []) each(formula);
  table.rows.forEach((row) => {
    for (const cell of row.cells) {
      const stored = cells.formulaOf(cell);
      if (stored) each(stored.formula);
    }
  });
}

/**
 * A formula as written where its "=" may be left out (a condition's, Space
 * Lua's): the formula with it, and how far its places moved (1 where it was added)
 */
export function withEquals(text: string): { readonly formula: string; readonly shift: number } {
  return text.trimStart().startsWith("=") ? { formula: text, shift: 0 } : { formula: `=${text}`, shift: 1 };
}
