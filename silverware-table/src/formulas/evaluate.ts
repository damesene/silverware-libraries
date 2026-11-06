// Calculating formulas: a table's cells as a sheet, the other tables they
// refer to as a book, results and the reasons of errors.
import { columnName } from "../columns.ts";
import { escapeCell, type Table, unescapeCell } from "../markdown.ts";
import { setCell } from "../ops.ts";
import { withoutTags } from "../tags.ts";
import { asNumber } from "../view.ts";
import { cellResult, cellsByName, errorCodeIn, type FormulaCells, hasFormulas, rowsByName } from "./cell.ts";
import { dateArithmetic, parseDate } from "./dates.ts";
import { type Node, parse, refersToOwnData, wholeColumnNames } from "./parser.ts";
import { type Area, areaText, cellName, formulaPages, referencedColumn, type TableRef } from "./references.ts";
import { takesGrids } from "./function.ts";
import { functionNamed } from "./registry.ts";
import {
  asTime,
  asValue,
  cellValue,
  FormulaError,
  Grid,
  isError,
  isGrid,
  isRange,
  parseClock,
  type Result,
  type Scalar,
  single,
  timeArithmetic,
  TimeValue,
  toNumber,
  toText,
  type Value,
} from "./values.ts";

const DECIMAL_COMMA_RE = /\d,\d/;

/**
 * Where formulas find the other tables they refer to: the table with a name
 * (compared ignoring case) on the formula's page, or with `page` on another;
 * undefined when there is none
 */
export type TableSource = ((name: string, page?: string) => Table | undefined) & {
  /** The first cell named so (compared ignoring case) on the page or on `page`, its row of the markdown (header 0); a source without cellsNamed gives this one */
  readonly cell?: (name: string, page?: string) => NamedCell | undefined;
  /** Every cell named so on the page or on `page` (a name is unique in a table only), in the order of the tables */
  readonly cellsNamed?: (name: string, page?: string) => readonly NamedCell[];
  /** Whether formulas may not read `page` (links to other pages are off): those referring to it keep their results */
  readonly unread?: (page: string) => boolean;
};

/** Where a named cell is: its table (and the table's name, if it has one), and its row (of the markdown, header 0) and column */
export type NamedCell = { readonly table: Table; readonly tableName?: string; readonly row: number; readonly column: number };

/** The sheets of the tables formulas refer to, each made once: their results are computed once too */
class Book {
  private readonly sheets = new Map<string, Sheet>();
  // The sheets by table, whether reached by the table's name or a named cell's
  private readonly tableSheets = new Map<Table, Sheet>();
  constructor(
    readonly cells: FormulaCells,
    private readonly source: TableSource | undefined,
  ) {}

  /** Whether a formula refers to a page formulas may not read: it keeps its stored result */
  keepsResult(formula: string): boolean {
    const unread = this.source?.unread;
    return !!unread && formulaPages(formula).some(unread);
  }

  /** The cells named so on `page` (undefined: the formulas' page), in every table: what a bare name not in its own table may have meant */
  cellsNamed(name: string, page: string | undefined): readonly NamedCell[] {
    const found = this.source?.cellsNamed?.(name, page);
    if (found) return found;
    const first = this.source?.cell?.(name, page);
    return first ? [first] : [];
  }

  /** The table's sheet, made on its first use (by its name or by a named cell's) */
  private sheetOf(table: Table, page: string | undefined, name: string): Sheet {
    let sheet = this.tableSheets.get(table);
    if (!sheet) {
      sheet = new Sheet(table, this, page, name);
      this.tableSheets.set(table, sheet);
    }
    return sheet;
  }

  /** The sheet a reference from `from` is to: the other table, or `from` itself when it is named so */
  sheet(ref: TableRef, from: Sheet): Sheet | FormulaError {
    const page = ref.page ?? from.page;
    if (page === from.page && from.name !== undefined && from.name.toLowerCase() === ref.name.toLowerCase()) return from;
    const key = `${page ?? ""}\u0000${ref.name.toLowerCase()}`;
    let sheet = this.sheets.get(key);
    if (!sheet) {
      const table = this.source?.(ref.name, page);
      if (!table) return new FormulaError("#REF!", `there is no table named ${ref.name}${page === undefined ? " on this page" : ` on ${page}`}`);
      sheet = this.sheetOf(table, page, ref.name);
      this.sheets.set(key, sheet);
    }
    return sheet;
  }
}

/**
 * A table's total rows (body rows from 0): those with a cell that refers to
 * its own whole column, as =SUM([qty]) under Qty, or to its whole body ([#Data]). A cell that refers to
 * another column ([@qty] / SUM([qty]) in a Share column) does not make its row
 * one. [qty] leaves them out.
 */
export function totalRows(cells: FormulaCells, table: Table): ReadonlySet<number> {
  const headers = table.rows[0]?.cells ?? [];
  const totals = new Set<number>();
  table.rows.slice(1).forEach((row, r) => {
    row.cells.forEach((cell, column) => {
      const stored = cells.formulaOf(cell);
      const tree = stored && parse(stored.formula);
      if (!tree || isError(tree)) return;
      // (Its whole body, [#Data], as of every column: the row is a total row, as Excel's totals row is out of it)
      if (refersToOwnData(tree) || Array.from(wholeColumnNames(tree, new Set())).some((name) => referencedColumn(headers, name) === column)) totals.add(r);
    });
  });
  return totals;
}

/** A table's cells as a sheet: values of plain cells, results of formula cells */
class Sheet {
  private readonly headers: readonly string[];
  private readonly body: readonly (readonly string[])[];
  private readonly results = new Map<string, Scalar>();
  private readonly evaluating = new Set<string>();
  // Numbers in the table are written with a decimal comma: results are too
  readonly decimalComma: boolean;
  // The table's name, by which formulas refer to it
  readonly name: string | undefined;
  private totals: ReadonlySet<number> | undefined;
  private cellNames: Map<string, { readonly row: number; readonly column: number }> | undefined;
  private rowNames: Map<string, number> | undefined;

  /**
   * `page`: the page the table is on, when it is not the formulas' own (its
   * unnamed references are to tables there); `name`: the table's, by which
   * its own formulas may refer to it too
   */
  constructor(
    private readonly table: Table,
    private readonly book: Book,
    readonly page?: string,
    name?: string,
  ) {
    this.name = name?.trim() || undefined;
    this.headers = table.rows[0]?.cells ?? [];
    this.body = table.rows.slice(1).map((r) => r.cells);
    let comma = 0;
    let point = 0;
    for (const cells of this.body) {
      for (const cell of cells) {
        if (book.cells.formulaOf(cell)) continue;
        const text = unescapeCell(cell).trim();
        if (asNumber(text) === undefined) continue;
        if (DECIMAL_COMMA_RE.test(text)) comma++;
        else if (/\d\.\d/.test(text)) point++;
      }
    }
    this.decimalComma = comma > point;
  }

  /**
   * [@a] and [@[a]:[b]] of this table: the cell of its row `row` (from 0) in
   * column a, or its cells from a to b, either way round (`prefix`: the
   * table's name as written, for the errors)
   */
  rowColumnsValue(row: number, name: string, last: string | undefined, prefix: string): Value {
    const at = prefix ? ` in ${prefix.slice(0, -1)}` : "";
    if (row >= this.rows) return new FormulaError("#REF!", `${prefix}[@…]: the row ${row + 1} is outside the table`);
    const index = referencedColumn(this.headers, name);
    if (index === undefined) return new FormulaError("#REF!", `there is no column named "${name}"${at}`);
    if (last === undefined) return this.value(row, index);
    const end = referencedColumn(this.headers, last);
    if (end === undefined) return new FormulaError("#REF!", `there is no column named "${last}"${at}`);
    const values: Scalar[] = [];
    for (let c = Math.min(index, end); c <= Math.max(index, end); c++) values.push(this.value(row, c));
    return values;
  }

  get rows(): number {
    return this.body.length;
  }

  get columns(): number {
    return this.headers.length;
  }

  /** A cell's value: a plain cell's text (a number if it reads as one), a formula cell's result */
  value(row: number, column: number): Scalar {
    const cell = this.body[row]?.[column];
    if (cell === undefined || column >= this.columns) {
      return new FormulaError("#REF!", `${cellName(row, column)} is outside the table`);
    }
    const stored = this.book.cells.formulaOf(cell);
    if (!stored) {
      const text = unescapeCell(withoutTags(cell)).trim();
      if (text === "") return null;
      // A number, a time (14:30, 40:00), or text (an error's code as it shows, `\#REF!` written: a pivot's cell)
      return asNumber(text) ?? parseClock(text) ?? errorCodeIn(text) ?? text;
    }
    return this.result(row, column, stored.formula);
  }

  /** The result of the formula in a cell */
  result(row: number, column: number, formula: string): Scalar {
    const key = `${row},${column}`;
    const known = this.results.get(key);
    if (known !== undefined) return known;
    if (this.evaluating.has(key)) {
      return new FormulaError("#CYCLE!", `${cellName(row, column)} depends on its own result`);
    }
    // Refers to a page formulas may not read: the result stored, which
    // the formulas using the cell use too
    if (this.book.keepsResult(formula)) {
      const shown = unescapeCell(this.book.cells.formulaOf(this.body[row]?.[column] ?? "")?.value ?? "").trim();
      // None yet, or an error code written: an error, saying why it is not calculated
      const code = shown === "" ? "#REF!" : errorCodeIn(shown);
      const kept: Scalar = code ? new FormulaError(code, "the other page is not read (are links to other pages turned off?)") : (asNumber(shown) ?? parseClock(shown) ?? shown);
      this.results.set(key, kept);
      return kept;
    }
    this.evaluating.add(key);
    let result: Scalar;
    try {
      const tree = parse(formula);
      result = isError(tree) ? tree : cellValue(this.evaluate(tree, row, column));
      if ((typeof result === "number" && !Number.isFinite(result)) || (result instanceof TimeValue && !Number.isFinite(result.seconds))) {
        result = new FormulaError("#NUM!", "the result is not a finite number");
      }
    } finally {
      this.evaluating.delete(key);
    }
    this.results.set(key, result);
    return result;
  }

  /** A formula's value in no cell but with a body row as its own (`[@column]` that row's), one value; none of the cells' results kept by it */
  atRow(tree: Node, row: number): Scalar {
    return cellValue(this.evaluate(tree, row, -1));
  }

  /** A formula's value in none of the table's cells (evaluateFormula): a range stays one (a grid its cells, row by row), no cell's result being one value */
  standalone(formula: string): Value {
    const tree = parse(formula);
    return isError(tree) ? tree : asValue(this.evaluate(tree, 0, 0));
  }

  /** The result of a cell's formula as it is, a grid too: what a cell showing #SPILL! holds (Show result) */
  wholeResult(row: number, column: number, formula: string): Result {
    if (this.book.keepsResult(formula)) return this.result(row, column, formula);
    const tree = parse(formula);
    return isError(tree) ? tree : this.evaluate(tree, row, column);
  }

  /** The text a formula cell shows for its result */
  text(row: number, column: number, formula: string): string {
    const result = this.result(row, column, formula);
    if (isError(result)) return result.code;
    const text = toText(result) as string;
    return typeof result === "number" && this.decimalComma ? text.replace(".", ",") : text;
  }

  /** The cell of the row named `row` in the column `column` */
  rowCellValue(row: string, column: string, prefix = ""): Value {
    this.rowNames ??= rowsByName(this.book.cells, this.table);
    const r = this.rowNames.get(row.toLowerCase());
    if (r === undefined) return new FormulaError("#REF!", `there is no row named ${row}${prefix ? ` in ${prefix.slice(0, -1)}` : ""}`);
    const c = referencedColumn(this.headers, column);
    if (c === undefined) return new FormulaError("#REF!", `there is no column named "${column}"${prefix ? ` in ${prefix.slice(0, -1)}` : ""}`);
    // rowsByName counts the header as row 0, the body starts at 0 here
    return this.value(r - 1, c);
  }

  /** The values of an area: one cell's value, or a range's (`range`) */
  areaValue(area: Area, range: boolean, prefix = ""): Value {
    const { top, left, bottom, right } = area;
    if (bottom >= this.rows || right >= this.columns) {
      return new FormulaError("#REF!", `${prefix}${areaText(area)} is outside the table`);
    }
    const values: Scalar[] = [];
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) values.push(this.value(r, c));
    }
    return range ? values : values[0]!;
  }

  /** A column's display name (its header without tags, hashtags and emphasis), as a grid names its columns */
  private headerName(column: number): string | undefined {
    const header = this.headers[column];
    return header === undefined ? undefined : columnName(header) || undefined;
  }

  /** An area's values as a grid of its rows and columns, named by the table's headers */
  areaGrid(area: Area, prefix = ""): Result {
    const values = this.areaValue(area, true, prefix);
    if (!isRange(values)) return values;
    const names = Array.from({ length: area.right - area.left + 1 }, (_, c) => this.headerName(area.left + c));
    return new Grid(area.bottom - area.top + 1, area.right - area.left + 1, values, names);
  }

  /** A column's values (see columnValue) as a grid of one column, named by its header */
  columnGrid(name: string, prefix = ""): Result {
    const values = this.columnValue(name, prefix);
    if (!isRange(values)) return values;
    return new Grid(values.length, 1, values, [this.headerName(referencedColumn(this.headers, name)!)]);
  }

  /** [@[a]:[b]]: the row's cells from column a to b as a grid of one row */
  rowColumnsGrid(row: number, name: string, last: string, prefix: string): Result {
    const values = this.rowColumnsValue(row, name, last, prefix);
    if (!isRange(values)) return values;
    const from = Math.min(referencedColumn(this.headers, name)!, referencedColumn(this.headers, last)!);
    return new Grid(1, values.length, values, values.map((_, c) => this.headerName(from + c)));
  }

  /** [#Data]: the table's body as a grid, every column, its total rows left out as a column's are (see columnValue) */
  dataGrid(): Grid {
    const totals = this.totalRows();
    const rows: Scalar[][] = [];
    for (let r = 0; r < this.rows; r++) {
      if (!totals.has(r)) rows.push(Array.from({ length: this.columns }, (_, c) => this.value(r, c)));
    }
    return Grid.ofRows(
      rows,
      Array.from({ length: this.columns }, (_, c) => this.headerName(c)),
      this.columns,
    );
  }

  /**
   * A column's values, without the table's total rows (see totalRows), so the
   * columns of a table line up: XLOOKUP over one gives the value beside it in another
   */
  columnValue(name: string, prefix = ""): Value {
    const index = referencedColumn(this.headers, name);
    if (index === undefined) return new FormulaError("#REF!", `there is no column named "${name}"${prefix ? ` in ${prefix.slice(0, -1)}` : ""}`);
    const totals = this.totalRows();
    const values: Scalar[] = [];
    for (let r = 0; r < this.rows; r++) {
      if (!totals.has(r)) values.push(this.value(r, index));
    }
    return values;
  }

  /** The total rows (see totalRows), once */
  private totalRows(): ReadonlySet<number> {
    this.totals ??= totalRows(this.book.cells, this.table);
    return this.totals;
  }

  /**
   * A named cell's value, or a named row's cells as a range: of this table
   * (vat, pear), or of the table named before it (prices!vat). A cell's name
   * goes first. A row's range is all of its cells: from a cell of that row,
   * the formula is in it, #CYCLE! (a total of a row goes in another row). A
   * bare name is this table's only, as a name is unique in its table only:
   * one of another table is an error saying how to write it.
   */
  private named(node: Extract<Node, { kind: "named" }>): Value {
    if (node.table) {
      const sheet = this.sheetOf(node.table);
      if (isError(sheet)) return sheet;
      return sheet.ownNamed(node.name, node.table.name);
    }
    if (node.page === undefined || node.page === this.page) {
      const own = this.cellNamed(node.name);
      if (own) return this.value(own.row, own.column);
      const named = this.rowNamed(node.name);
      if (named !== undefined) return this.rowValues(named);
    }
    return new FormulaError("#NAME?", this.namedElsewhere(node.name, node.page));
  }

  /** This table's cell named so, or its row's cells, for a reference by the table's name (`table`: as written there) */
  ownNamed(name: string, table: string): Value {
    const own = this.cellNamed(name);
    if (own) return this.value(own.row, own.column);
    const named = this.rowNamed(name);
    return named !== undefined ? this.rowValues(named) : new FormulaError("#NAME?", `there is no cell or row named ${name} in ${table}`);
  }

  /** A body row's (from 0) values as a range */
  private rowValues(row: number): Value {
    const values: Scalar[] = [];
    for (let c = 0; c < this.columns; c++) values.push(this.value(row, c));
    return values;
  }

  /** The body row (from 0) of this table named so (ignoring case), if any */
  private rowNamed(name: string): number | undefined {
    this.rowNames ??= rowsByName(this.book.cells, this.table);
    const found = this.rowNames.get(name.toLowerCase());
    // rowsByName counts the header as row 0, the body starts at 0 here
    return found === undefined ? undefined : found - 1;
  }

  /** Why a bare name is not found: no such cell, or how to write the one of another table */
  private namedElsewhere(name: string, page: string | undefined): string {
    const at = page === undefined ? "" : `[[${page}]]`;
    // Another table's (by the table, or its name: the page's copy of this one may be as it was before the edit)
    const own = this.name?.toLowerCase();
    const others = this.book
      .cellsNamed(name, page ?? this.page)
      .filter((cell) => cell.row > 0 && cell.table !== this.table && !(page === undefined && own && cell.tableName?.trim().toLowerCase() === own));
    if (others.length === 0) return `there is no cell or row named ${name} ${page === undefined ? "in this table" : `on ${page}`}`;
    const names = others.map((cell) => cell.tableName?.trim() || undefined);
    if (others.length > 1) {
      const named = names.filter((n): n is string => !!n);
      return `${name} is a cell of several tables${named.length ? ` (${named.join(", ")})` : ""}: write which, as ${named[0] ?? "table"}!${name}`;
    }
    const table = names[0];
    return table
      ? `${name} is a cell of the table ${table}: write ${at}${table}!${name}`
      : `${name} is a cell of another table, which has no name: name that table (the pencil in its ⋯ menu's title), then write its name!${name}`;
  }

  /** The body cell of this table named so (ignoring case), if any */
  private cellNamed(name: string): { row: number; column: number } | undefined {
    this.cellNames ??= cellsByName(this.book.cells, this.table);
    const found = this.cellNames.get(name.toLowerCase());
    // cellsByName counts the header as row 0, the body starts at 0 here
    return found && { row: found.row - 1, column: found.column };
  }

  /** The sheet a reference's table is: this one, or another the book has */
  private sheetOf(table: TableRef | undefined): Sheet | FormulaError {
    return table ? this.book.sheet(table, this) : this;
  }

  /**
   * An argument of a function taking grids: a reference keeps its shape (A1:C5
   * three columns, [@[a]:[b]] a row, a column named by its header), anything
   * else as it evaluates
   */
  private shaped(node: Node, row: number, column: number): Result {
    if (node.kind === "area" && node.range) {
      const sheet = this.sheetOf(node.table);
      return isError(sheet) ? sheet : sheet.areaGrid(node.area, node.table ? `${node.table.name}!` : "");
    }
    if (node.kind === "column" && (!node.thisRow || node.last !== undefined)) {
      const sheet = this.sheetOf(node.table);
      if (isError(sheet)) return sheet;
      const prefix = node.table ? `${node.table.name}!` : "";
      return node.thisRow ? sheet.rowColumnsGrid(row, node.name, node.last!, prefix) : sheet.columnGrid(node.name, prefix);
    }
    return this.evaluate(node, row, column);
  }

  private evaluate(node: Node, row: number, column: number): Result {
    switch (node.kind) {
      case "literal":
        return node.value;
      case "area": {
        const sheet = this.sheetOf(node.table);
        if (isError(sheet)) return sheet;
        return sheet.areaValue(node.area, node.range, node.table ? `${node.table.name}!` : "");
      }
      case "column": {
        const sheet = this.sheetOf(node.table);
        if (isError(sheet)) return sheet;
        if (node.thisRow) return sheet.rowColumnsValue(row, node.name, node.last, node.table ? `${node.table.name}!` : "");
        return sheet.columnValue(node.name, node.table ? `${node.table.name}!` : "");
      }
      case "named":
        return this.named(node);
      case "data": {
        const sheet = this.sheetOf(node.table);
        return isError(sheet) ? sheet : sheet.dataGrid();
      }
      case "rowCell": {
        const sheet = this.sheetOf(node.table);
        if (isError(sheet)) return sheet;
        return sheet.rowCellValue(node.row, node.column, node.table ? `${node.table.name}!` : "");
      }
      case "call": {
        const f = functionNamed(node.name);
        if (!f) return new FormulaError("#NAME?", `there is no function ${node.name}`);
        if (node.args.length < f.minArgs || (f.maxArgs !== undefined && node.args.length > f.maxArgs)) {
          return new FormulaError("#VALUE!", `wrong number of arguments: ${f.syntax}`);
        }
        // Where it is calculated, as A1 counts (row: the body's, from 1)
        const context = { row: row + 1, column: column + 1 };
        // A function taking grids gets them as they are, its references with their shape
        if (takesGrids(f)) return f.call(node.args.map((arg) => this.shaped(arg, row, column)), context);
        // Any other a grid's cells as a list; a reference as a range, so number functions skip a text cell as in a range
        return f.call(
          node.args.map((arg) => {
            const value = asValue(this.evaluate(arg, row, column));
            const reference = arg.kind === "area" || (arg.kind === "column" && arg.thisRow);
            return reference && !isRange(value) && !isError(value) ? [value] : value;
          }),
          context,
        );
      }
      case "unary":
        return cellByCell([operand(this.evaluate(node.arg, row, column))], ([arg]) => this.unary(node.op, arg!));
      case "binary": {
        const operands = [operand(this.evaluate(node.left, row, column)), operand(this.evaluate(node.right, row, column))];
        return cellByCell(operands, ([left, right]) => this.binary(node.op, left!, right!));
      }
    }
  }

  private unary(op: string, arg: Scalar): Scalar {
    const time = asTime(arg);
    if (time && op !== "%") return op === "-" ? new TimeValue(-time.seconds) : time;
    const n = toNumber(arg);
    if (isError(n)) return n;
    return op === "-" ? -n : op === "%" ? n / 100 : n;
  }

  private binary(op: string, left: Scalar, right: Scalar): Scalar {
    if (isError(left)) return left;
    if (isError(right)) return right;
    if (op === "&") return (toText(left) as string) + (toText(right) as string);
    const comparison = COMPARISONS[op];
    if (comparison) return comparison(compare(left, right));
    // A date and days (or two dates) add and subtract as dates
    const dated = op === "+" || op === "-" ? dateArithmetic(op, left, right) : undefined;
    if (dated !== undefined) return dated;
    // A time and a time or a number: a time where one makes sense (17:30 - 9:00 is 08:30)
    const timed = timeArithmetic(op, left, right);
    if (timed !== undefined) return timed;
    const a = toNumber(left);
    const b = toNumber(right);
    if (isError(a)) return a;
    if (isError(b)) return b;
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? new FormulaError("#DIV/0!", "division by zero") : a / b;
      default:
        return a ** b;
    }
  }
}

/**
 * What an operator works on: a grid of one column or one row as the list of
 * its cells; one of several rows and columns not yet (an error saying so),
 * as an operator on it would need to keep its shape
 */
function operand(value: Result): Value {
  if (!isGrid(value)) return value;
  if (value.width === 1 || value.height <= 1) return value.cells;
  return new FormulaError("#VALUE!", `an operator on ${value.height} rows and ${value.width} columns: pick a column first (CHOOSECOLS), or compare a column`);
}

/**
 * An operator on ranges works cell by cell, as in spreadsheets: a range and a
 * value give a range ("**" & [name]), two ranges of the same size the range of
 * their pairs ([qty] * [price]). A function takes it on (TEXTJOIN, SUM); a
 * cell's result is one value, so a range left there is #VALUE!. A range of one
 * cell (A1) is that cell's value.
 */
function cellByCell(operands: readonly Value[], f: (values: Scalar[]) => Scalar): Value {
  const ranges = operands.filter((v): v is readonly Scalar[] => isRange(v) && v.length !== 1);
  if (ranges.length === 0) return f(operands.map(single));
  const size = ranges[0]!.length;
  const other = ranges.find((r) => r.length !== size);
  if (other) return new FormulaError("#VALUE!", `the ranges are not the same size (${size} and ${other.length} cells)`);
  return Array.from({ length: size }, (_, at) => f(operands.map((v) => (isRange(v) && v.length !== 1 ? v[at]! : single(v)))));
}

const COMPARISONS: Readonly<Record<string, (order: number) => boolean>> = {
  "=": (o) => o === 0,
  "<>": (o) => o !== 0,
  "<": (o) => o < 0,
  ">": (o) => o > 0,
  "<=": (o) => o <= 0,
  ">=": (o) => o >= 0,
};

/** Compares two values: as dates if both are dates, as numbers if both read as numbers, else as text ignoring case */
function compare(a: Scalar, b: Scalar): number {
  // 2025-11-06 is 2025-11-06 00:00, and 2025-11-06T08:00 is before 2025-11-06 09:00
  const da = typeof a === "string" ? parseDate(a) : undefined;
  const db = da && typeof b === "string" ? parseDate(b) : undefined;
  if (da && db) return da.ms - db.ms;
  const na = a === null ? 0 : toNumber(a);
  const nb = b === null ? 0 : toNumber(b);
  if (!isError(na) && !isError(nb) && typeof a !== "boolean" && typeof b !== "boolean") return na - nb;
  const ta = (toText(a) as string).toLowerCase();
  const tb = (toText(b) as string).toLowerCase();
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

/**
 * The table with every formula cell showing its current result. Returns the
 * same table when all results are up to date. Formulas in the header row are
 * left alone: a header is a column's name.
 */
/** What a table's formulas are calculated with: its cells as the formulas read them, the other tables, its own name */
export type Calculation = { readonly cells: FormulaCells; readonly tables?: TableSource; readonly name?: string };

export function recalculate(table: Table, { cells, tables, name }: Calculation): Table {
  if (!hasFormulas(cells, table)) return table;
  const book = new Book(cells, tables);
  const sheet = new Sheet(table, book, undefined, name);
  let result = table;
  table.rows.forEach((row, r) => {
    if (r === 0) return;
    row.cells.forEach((cell, c) => {
      const stored = cells.formulaOf(cell);
      // A result kept as it is written (a link to a page not read)
      if (!stored || (book.keepsResult(stored.formula) && stored.value.trim() !== "")) return;
      // Up to date when the result written is the one calculated: the cell's tag as
      // written stays (a table written before tags' values went into apostrophes too)
      // (An error written so that it is no hashtag: one written before as `#REF!` is out of date)
      const text = cellResult(sheet.text(r - 1, c, stored.formula));
      if (escapeCell(text) === stored.value) return;
      result = setCell(result, r, c, cells.formulaCell(text, stored.formula, cell));
    });
  });
  return result;
}

// The table a formula calculated in none is in: no rows, no columns
const NO_TABLE: Table = { indent: "", align: [], rows: [{ cells: [] }], padded: false };

/**
 * A formula calculated in no table (the Space Lua API's): its value, a range
 * as its values. What it refers to by a table's name (`prices!B2`,
 * `prices![qty]`, `prices!vat`, `[[Page]]prices!B2`) is found as from a cell;
 * a table of its own it has none, so A1, [qty] or [@qty] alone are #REF!
 */
export function evaluateFormula(formula: string, { cells, tables }: Calculation): Value {
  return new Sheet(NO_TABLE, new Book(cells, tables)).standalone(formula);
}

/**
 * Whether a formula's result is a list however many values it holds: a range
 * written as one (`B1:B1`, `[qty]`, `[@[a]:[b]]`) or an operator over one. A
 * cell is a one-cell list too, and a column of one row as well: only the
 * formula tells them apart. A name is a cell's or a row's: not told here.
 */
export function givesList(formula: string): boolean {
  const tree = parse(formula);
  return !isError(tree) && listNode(tree);
}

function listNode(node: Node): boolean {
  switch (node.kind) {
    case "area":
      return node.range;
    case "column":
      return !node.thisRow || node.last !== undefined;
    case "data":
      return true;
    case "call": {
      // A function taking grids gives one (FILTER, SORT…): a list here
      const f = functionNamed(node.name);
      return !!f && takesGrids(f);
    }
    case "unary":
      return listNode(node.arg);
    case "binary":
      return listNode(node.left) || listNode(node.right);
    default:
      return false;
  }
}

/**
 * A formula of one row calculated for each body row of a table, as if in
 * none of its cells (`[@column]` that row's): a pivot's groups and its
 * condition, read row by row
 */
export function rowValues(table: Table, formula: string, { cells, tables, name }: Calculation): Scalar[] {
  const tree = parse(formula);
  const sheet = new Sheet(table, new Book(cells, tables), undefined, name);
  return table.rows.slice(1).map((_, row) => (isError(tree) ? tree : sheet.atRow(tree, row)));
}

/** A formula calculated over a table as a whole, one value (`[qty]` all its rows): a pivot's value of a group's rows */
export function tableValue(table: Table, formula: string, { cells, tables, name }: Calculation): Scalar {
  const tree = parse(formula);
  return isError(tree) ? tree : new Sheet(table, new Book(cells, tables), undefined, name).atRow(tree, 0);
}

/**
 * The whole result of a body cell's formula (row of the markdown, header 0),
 * a grid as it is: what a cell showing #SPILL! holds (Show result); a cell
 * without a formula is undefined
 */
export function cellWholeResult(table: Table, row: number, column: number, { cells, tables, name }: Calculation): Result | undefined {
  const stored = row > 0 ? cells.formulaOf(table.rows[row]?.cells[column] ?? "") : undefined;
  if (!stored) return undefined;
  return new Sheet(table, new Book(cells, tables), undefined, name).wholeResult(row - 1, column, stored.formula);
}

/** A value as a cell shows it: an error by its code */
export function scalarText(value: Scalar): string {
  if (isError(value)) return value.code;
  return toText(value) as string;
}

/** The errors formula cells show: "row,column" (rows of the markdown, header 0) → the error, its code and why */
export function formulaErrors(table: Table, { cells, tables, name }: Calculation): Map<string, FormulaError> {
  const errors = new Map<string, FormulaError>();
  if (!hasFormulas(cells, table)) return errors;
  const sheet = new Sheet(table, new Book(cells, tables), undefined, name);
  table.rows.forEach((row, r) => {
    if (r === 0) return;
    row.cells.forEach((cell, c) => {
      const stored = cells.formulaOf(cell);
      const result = stored && sheet.result(r - 1, c, stored.formula);
      if (isError(result)) errors.set(`${r},${c}`, result);
    });
  });
  return errors;
}
