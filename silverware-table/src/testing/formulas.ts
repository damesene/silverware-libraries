// The cells as the formulas module reads them, for tests that call the
// formulas' domain directly; and the domain's functions taking what the module
// gives them (the cells, a table's name from its metadata row) as tests had
// them, so a test says what it checks, not how the module calls the domain.
// The tests write tables and cells as markdown: each is read into the model
// as the module has it (the codec), and what the domain gives back written
// back as the module writes it.
import { formulaCellsOf } from "../features/formulas.ts";
import * as domain from "../formulas/index.ts";
import * as page from "../formulas/page.ts";
import { type ExcelTable, excelFormula as excelFormulaOf } from "../excel/formulas.ts";
import type { ExcelTemplates } from "../excel/functions.ts";
import type { PageTable, Table } from "../markdown.ts";
import { metaName, metaPins, withMetaPins } from "../meta.ts";
import { ownMeta } from "../core/metaaccess.ts";
import { attributeIn, type TableModel, withAttributeIn } from "../../../shared/table/model.ts";
import { calculatedTable, viewCalculated } from "../calculated/index.ts";
import { modelCellNames, modelRowNames } from "../../../shared/table/names.ts";
import { withCellName } from "../names.ts";
import { decode, decodeCell, encode, encodeCell } from "../store/markdown/codec.ts";

type IndexMap = domain.IndexMap;
type TableSource = domain.TableSource;

export const CELLS: domain.FormulaCells = formulaCellsOf(
  {
    get: (cell, key) => attributeIn(cell.attributes, "formulas", key),
    with: (cell, key, value) => {
      const attributes = withAttributeIn(cell.attributes, "formulas", key, value);
      return attributes === cell.attributes ? cell : { ...cell, attributes };
    },
  },
  { rowNames: modelRowNames, cellNames: modelCellNames },
);

// What the view module's host gives it of what tables keep: its own attributes
const VIEW_META = ownMeta("view", () => true);

// The cells with views as the view module keeps them (its attribute formula, view.formula in the metadata row), written with no header renamed
export const VIEW_CELLS: domain.FormulaCells = {
  ...CELLS,
  calculated: (table) => {
    const formula = VIEW_META.attribute(table, "formula");
    if (!formula) return undefined;
    return {
      formulas: [formula],
      calculate: (read) => {
        const result = domain.viewGrid(read.evaluate(formula));
        return result instanceof domain.FormulaError ? result : calculatedTable(table, viewCalculated(result), {}, { pinsOf: metaPins, withPins: withMetaPins });
      },
      follow: () => table,
    };
  },
};

/** A table of the tests as the domain takes it, and a source of tables (by name) of the tests' as the domain's */
export const model = (table: Table): TableModel => decode(table);
export const sourceOf = (tables: (name: string, page?: string) => Table | undefined): TableSource => (name, at) => {
  const table = tables(name, at);
  return table && decode(table);
};

// A text's tables as the domain takes them: each told apart by where it starts (the module gives its key), named
const named = (tables: readonly PageTable[]) => tables.map((t) => ({ key: String(t.range.from), table: decode(t.table), name: metaName(t.table) }));

/** Other pages' tables as the tests have them, by page (null: no such page; undefined: not read) */
type OtherPages = { readonly tables: (page: string) => readonly PageTable[] | null | undefined };

export const formulaOf = (cell: string) => CELLS.formulaOf(decodeCell(cell));
export const formulaCell = (value: string, formula: string, name?: string) => withCellName(encodeCell(CELLS.formulaCell(value, formula)), name);
export const hasFormulas = (table: Table) => domain.hasFormulas(CELLS, decode(table));
export const formulaCount = (table: Table) => domain.formulaCount(CELLS, decode(table));
export const recalculate = (table: Table, tables?: TableSource) => encode(domain.recalculate(decode(table), { cells: CELLS, tables, name: metaName(table) }), table);
// Each error as a cell's title says it: its code and why
export const formulaErrors = (table: Table, tables?: TableSource) =>
  new Map([...domain.formulaErrors(decode(table), { cells: CELLS, tables, name: metaName(table) })].map(([at, error]) => [at, `${error.code} ${error.detail}`]));
export const totalRows = (table: Table) => domain.totalRows(CELLS, decode(table));
export const calculatedFormula = (table: Table, column: number, except?: ReadonlySet<number>) => domain.calculatedFormula(CELLS, decode(table), column, except);
export const withCalculatedCells = (table: Table, row: number, added?: ReadonlySet<number>) => encode(domain.withCalculatedCells(CELLS, decode(table), row, added), table);
export const withoutFormulas = (table: Table) => encode(domain.withoutFormulas(CELLS, decode(table)), table);
const following = (before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap): domain.Following => ({
  cells: CELLS,
  rowMap,
  columnMap,
  names: { before: metaName(before), after: metaName(after) },
});
export const formulasAfterEdit = (before: Table, after: Table, edit: { readonly rowMap?: IndexMap; readonly columnMap?: IndexMap; readonly tables?: TableSource }) =>
  encode(domain.formulasAfterEdit(decode(before), decode(after), { ...following(before, after, edit.rowMap, edit.columnMap), tables: edit.tables }), after);
export const shiftReferences = (before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap) =>
  encode(domain.shiftReferences(decode(before), decode(after), following(before, after, rowMap, columnMap)), after);
export const followTable = (table: Table, before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap) =>
  encode(domain.followTable(decode(table), decode(before), decode(after), following(before, after, rowMap, columnMap)), table);
export const followFormula = (formula: string, before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap) =>
  domain.followFormula(formula, decode(before), decode(after), following(before, after, rowMap, columnMap));
export const qualifyCellNames = (formula: string, own: Table, tables: TableSource) => domain.qualifyCellNames(formula, { table: decode(own), name: metaName(own) }, tables, CELLS);
export const cellNamesOf = (table: Table) => domain.cellNamesOf(CELLS, decode(table));
export const referredPages = (table: Table) => domain.referredPages(CELLS, decode(table));
export const referredTableNames = (table: Table) => domain.referredTableNames(CELLS, decode(table));
export const callsCustomFunctions = (table: Table) => domain.callsCustomFunctions(CELLS, decode(table));
export const pageTables = (
  tables: () => readonly PageTable[],
  here: string,
  replace?: { readonly from: number; readonly table: Table },
  others?: OtherPages,
  spaceSource?: (name: string) => Table | null | undefined,
) =>
  page.pageTables(CELLS, () => named(tables()), here, replace && { key: String(replace.from), table: decode(replace.table), name: metaName(replace.table) }, {
    ...(others && {
      pages: {
        tables: (name: string) => {
          const list = others.tables(name);
          return list ? named(list) : list;
        },
      },
    }),
    ...(spaceSource && {
      spaceSource: (name: string) => {
        const table = spaceSource(name);
        return table ? decode(table) : table;
      },
    }),
  });
export const pageNameChoices = (tables: readonly PageTable[]) => page.pageNameChoices(CELLS, named(tables));
export const ownNameChoices = (table: Table) => page.ownNameChoices(CELLS, decode(table));
export const tablesWritten = (all: readonly PageTable[], source: string) =>
  page.tablesWritten(CELLS, named(all), String(all.find((t) => t.range.text === source)?.range.from ?? "")).map((table) => all.find((t) => decode(t.table) === table)?.table ?? table);
export const excelFormula = (formula: string, table: Table, row: number, column: number, templates?: ExcelTemplates, structured?: ExcelTable["structured"]) =>
  excelFormulaOf(formula, { table: decode(table), name: metaName(table), cells: CELLS, ...(structured ? { structured } : {}) }, row, column, templates);
