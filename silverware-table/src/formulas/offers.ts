// What Silverware Table's modules offer each other about formulas (ModelHost.offered): the formulas module's cells
// and calculations, the pageLinks module's pages read, the modules calculating tables (a view, a pivot) and those
// holding formulas in a table's metadata (a choice list). The formulas themselves are shared/formulas/.
import type { KeyedModel, TableModel } from "../../../shared/table/model.ts";
import type { CalculatedBy, ErrorCode, FormulaCells, FormulaChoices, FormulaError, FormulaHelp, Grid, HeldFormulas, Scalar, Value } from "../../../shared/formulas/index.ts";
import type { FormulaHelpers } from "../formulafield.ts";

/**
 * What the formulas module offers other modules (ModelHost.offered("formulas")): its cells as the formulas read them;
 * `evaluate`: a formula calculated in no table, on a page's `tables` (the Space Lua API's), a range as its values,
 * and the other pages it read
 */
export type FormulasOffer = {
  readonly cells: FormulaCells;
  readonly evaluate: (formula: string, tables: readonly KeyedModel[], page?: string) => Promise<{ readonly value: Value; readonly pages: readonly string[] }>;
  /** The errors the formula cells of a page's tables show, calculated now on them (the Space Lua API's errors), and the other pages read */
  readonly errors: (tables: readonly KeyedModel[], page?: string) => Promise<{ readonly errors: readonly FormulaErrorAt[]; readonly pages: readonly string[] }>;
  /**
   * What the name typed before `caret` in `formula` may be, among a page's `tables`: its place in `formula` and the
   * choices; `table`, the table the formula is of (as a cell's formula is): its columns in [ ] and [@ ], its named
   * rows and cells, its own name's prefix, as a cell's formula has them
   */
  readonly complete: (formula: string, caret: number, tables: readonly KeyedModel[], table?: TableModel) => FormulaChoices | undefined;
  /** The function the caret is in, its syntax with the argument at the caret; undefined out of any */
  readonly help: (formula: string, caret: number) => FormulaHelp | undefined;
  /** Why a formula does not read (a ")" missing); undefined: it does */
  readonly validate: (formula: string) => string | undefined;
  /** A formula of one row (`[@due] < TODAY()`) calculated for each body row of a table of the page shown (values[0]: row 1), as a cell of none */
  readonly rowValues: (table: TableModel, formula: string) => readonly Scalar[];
  /**
   * A formula of `table`'s calculated in none of its cells, on the page shown (a choice list's): its values as cells
   * show them, in the result's order, or why there are none; undefined where it reads a page or source not read
   */
  readonly list: (table: TableModel, formula: string) => readonly string[] | FormulaError | undefined;
  /**
   * A view's formula calculated on the page shown, as a write would (its result a grid, or why there is none;
   * undefined where it reads a page not read): `table` the view's own (none: a view to be inserted), `replace` a
   * table of the page (where it starts) as it will be written with it (a source named in the same edit)
   */
  readonly view: (
    formula: string,
    table?: TableModel,
    replace?: { readonly key: string; readonly table: TableModel },
  ) => Grid | FormulaError | undefined;
  /**
   * The Functions dialog for a formula typed outside a cell (a view's dialog: the Functions dialog opens over it), its
   * caret at `caret`: `picked` gets the formula with the function picked put in and the caret after it
   */
  readonly functions: (formula: string, caret: number, picked: (made: { readonly formula: string; readonly caret: number }) => void) => void;
  /**
   * What a formula's field in a module's dialog (formulafield.ts) offers as a formula is typed, its "=" left out or
   * not: the functions and the page's names, and with `table` (as it is now: asked each time) its columns, named rows
   * and cells, as a cell's formula has them; the function the caret is in, `outside` where it is in none; why it
   * does not read
   */
  /**
   * A table calculated from others (a view, a pivot) as the formulas calculate it now on the page shown, written as
   * its module writes it (what its Out of date compares with), or why it cannot be; undefined where it is none or
   * reads a page not read
   */
  readonly calculated: (table: TableModel) => TableModel | FormulaError | undefined;
  readonly fieldHelpers: (table?: () => TableModel, outside?: FormulaHelp) => FormulaHelpers;
};

/**
 * A formula cell showing an error, as the formulas module's `errors` gives it: its table's name (none where
 * unnamed), its cell as formulas address it (`C3`), its column's key, where it is (`place`: its table's among the
 * tables given, its row there, the header 0, and its column), its formula, and the error's code and why
 */
export type FormulaErrorAt = {
  readonly table?: string;
  readonly cell: string;
  readonly column: string;
  readonly place: { readonly table: number; readonly row: number; readonly column: number };
  readonly formula: string;
  readonly code: ErrorCode;
  readonly detail: string;
};

/** What the pageLinks module offers: the other pages these formulas and tables refer to (and theirs, in turn) read anew; which they are */
export type PageLinksOffer = {
  readonly readFor: (formulas: readonly string[], tables: readonly TableModel[]) => Promise<readonly string[]>;
  // Pages read for another module (a pivot's source), as `otherPages` then gives them; `fresh`: read again those read before
  readonly readPages: (pages: readonly string[], fresh: boolean) => Promise<void>;
};

/**
 * What a module calculating tables from others offers (the view module: a view, a table made by a formula; the pivot
 * module: a pivot): how each of its tables is calculated. The formulas calculate them in their order, read them as
 * calculated now and write them with the other tables an edit changes, through it
 */
export type CalculatedOffer = {
  /** How a table is calculated, undefined for one the module does not calculate */
  readonly calculated: (table: TableModel) => CalculatedBy | undefined;
};

/**
 * What a module keeping formulas in a table's metadata row that calculate none of its cells offers (the column types
 * module: a choice list made by a formula): the formulas see them as the table's (what it reads) and have their
 * references follow the edits of what they read, in the same write
 */
export type HeldFormulasOffer = {
  /** The formulas a table holds so, and how they are written back; undefined where it holds none */
  readonly held: (table: TableModel) => HeldFormulas | undefined;
};
