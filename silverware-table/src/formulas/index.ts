// Formulas in table cells. `=SUM(A1:A3)` typed into a cell is stored as its
// result followed by a `<meta formulas.f='…'>` tag that holds the formula:
//
//   | Total | 19 <meta formulas.f='=SUM(B1:B3)'> |
//
// Browsers do not show <meta> and other renderers drop it, so the result is
// what every reader of the markdown sees. Silverware Table writes the results again
// whenever it edits the table.
//
// References: A1 is the first body row (the header is not counted), A1:B3 a
// range, [Qty] the column named Qty (without the cells whose formulas refer to
// that whole column, such as a total below it), [@Qty] the Qty cell of the
// formula's own row. Columns are named as columns.ts names them: of several
// columns named Qty, [Qty:2] is the second. Another table of the page, named
// in its metadata row (<meta core.table core.name='prices'>), is referred to
// by its name and "!": prices!B2, prices!A1:B3, prices![Price].
//
// This is the formulas' API for the rest of Silverware Table; the parts are the
// files beside it, the functions in builtin/ (only functions: what a formula
// can call), custom functions in custom.ts, which exist in registry.ts.
export { type CalculatedBy, type CalculatedRead, type CellNameAt, cellResult, withEquals, cellsByName, errorCodeIn, type FormulaCells, formulaCount, forFormulas, hasFormulas, isErrorText, isFormulaInput, type RowName, rowsByName, type StoredFormula } from "./cell.ts";

/**
 * What the formulas module offers other modules (ModelHost.offered("formulas")): its cells as the formulas read them;
 * `evaluate`: a formula calculated in no table, on the page's text (the Space Lua API's), a range as its values,
 * and the other pages it read
 */
export type FormulasOffer = {
  readonly cells: import("./cell.ts").FormulaCells;
  readonly evaluate: (formula: string, text: string, page?: string) => Promise<{ readonly value: import("./values.ts").Value; readonly pages: readonly string[] }>;
  /** The errors the formula cells of a page's tables show, calculated now on its text (the Space Lua API's errors), and the other pages read */
  readonly errors: (text: string, page?: string) => Promise<{ readonly errors: readonly FormulaErrorAt[]; readonly pages: readonly string[] }>;
  /**
   * What the name typed before `caret` in `formula` may be, on the page's `text`: its place in `formula` and the
   * choices; `table`, the table the formula is of (as a cell's formula is): its columns in [ ] and [@ ], its named
   * rows and cells, its own name's prefix, as a cell's formula has them
   */
  readonly complete: (formula: string, caret: number, text: string, table?: import("../markdown.ts").Table) => import("./help.ts").FormulaChoices | undefined;
  /** The function the caret is in, its syntax with the argument at the caret; undefined out of any */
  readonly help: (formula: string, caret: number) => import("./help.ts").FormulaHelp | undefined;
  /** Why a formula does not read (a ")" missing); undefined: it does */
  readonly problem: (formula: string) => string | undefined;
  /** A formula of one row (`[@due] < TODAY()`) calculated for each body row of a table of the page shown (values[0]: row 1), as a cell of none */
  readonly rowValues: (table: import("../markdown.ts").Table, formula: string) => readonly import("./values.ts").Scalar[];
  /**
   * A view's formula calculated on the page shown, as a write would (its result a grid, or why there is none;
   * undefined where it reads a page not read): `table` the view's own (none: a view to be inserted), `replace` a
   * table of the page (where it starts) as it will be written with it (a source named in the same edit)
   */
  readonly view: (
    formula: string,
    table?: import("../markdown.ts").Table,
    replace?: { readonly from: number; readonly table: import("../markdown.ts").Table },
  ) => import("./values.ts").Grid | import("./values.ts").FormulaError | undefined;
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
  readonly calculated: (table: import("../markdown.ts").Table) => import("../markdown.ts").Table | import("./values.ts").FormulaError | undefined;
  readonly fieldHelpers: (table?: () => import("../markdown.ts").Table, outside?: import("./help.ts").FormulaHelp) => import("../formulafield.ts").FormulaHelpers;
};

/**
 * A formula cell showing an error, as the formulas module's `errors` gives it: its table's name (none where
 * unnamed), its cell as formulas address it (`C3`), its column's key, where its row starts in the page's
 * text, its formula, and the error's code and why
 */
export type FormulaErrorAt = {
  readonly table?: string;
  readonly cell: string;
  readonly column: string;
  readonly at: number;
  readonly formula: string;
  readonly code: import("./values.ts").ErrorCode;
  readonly detail: string;
};

/** What the pageLinks module offers: the other pages these formulas and tables refer to (and theirs, in turn) read anew; which they are */
export type PageLinksOffer = {
  readonly readFor: (formulas: readonly string[], tables: readonly import("../markdown.ts").Table[]) => Promise<readonly string[]>;
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
  readonly calculated: (table: import("../markdown.ts").Table) => import("./cell.ts").CalculatedBy | undefined;
};
export { type Area, areaText, callsCustomFunctions, callsPureFunctionsOnly, columnIdText, formulaPages, type Fixed, cellName, cellNamesOf, columnLetters, columnRangeText, columnRefText, type NamedReference, namedReferences, type Reference, referencedColumn, referencedColumnId, references, referredPages, referredTableNames, type TableRef, withColumnKeys } from "./references.ts";
export { autofixFormula, type FormulaFix, qualifyCellNames } from "./autofix.ts";
export { type Calculation, cellWholeResult, evaluateFormula, formulaErrors, givesList, type NamedCell, recalculate, rowValues, scalarText, tableValue, type TableSource, totalRows, calculatedNow, viewGrid, viewResult } from "./evaluate.ts";
export { type Node as FormulaNode, parse as parseFormula } from "./parser.ts";
export { parseDate, toUnit, type Unit } from "./dates.ts";
export { asGrid, ERROR_CODES, FormulaError, Grid, parseClock, type Result, type Scalar, type Value } from "./values.ts";
export { withAreasWritten, type WrittenArea, writtenArea } from "./frame.ts";
export { REF_ERROR, type Token, tokenize } from "./tokens.ts";
export { tablesWritten } from "./page.ts";
export { calculatedFormula, filledFormula, followFormula, followOwnFormula, followTable, type Following, formulasAfterEdit, shiftReferences, withCalculatedCells, withoutFormulas } from "./edits.ts";
export { argumentSpan, type ColumnChoice, columnChoicesOf, type FormulaChoice, type FormulaChoices, choiceText, cycleFixed, findFunctions, type FormulaHelp, formulaChoices, formulaHelp, functionHelp, nameTyped, needsOperator, type PointedSpan, REFERENCE_HELP, referenceSlot } from "./help.ts";
export { FUNCTION_CATEGORIES, type AnyFunction, type FormulaFunction, type FunctionCategory } from "./function.ts";
export { functionNamed, isCustomFunction } from "./registry.ts";
export type { IndexMap } from "../ops.ts";
