// The cells as the formulas module reads them, for tests that call the
// formulas' domain directly; and the domain's functions taking what the module
// gives them (the cells, a table's name from its metadata row) as tests had
// them, so a test says what it checks, not how the module calls the domain.
import { formulaCellsOf } from "../features/formulas.ts";
import * as domain from "../formulas/index.ts";
import * as page from "../formulas/page.ts";
import { type ExcelTable, excelFormula as excelFormulaOf } from "../excel/formulas.ts";
import type { ExcelTemplates } from "../excel/functions.ts";
import type { OtherPages, PageTable, Table } from "../markdown.ts";
import { attributeName, metaName, metaPins, metaValue, withMetaPins } from "../meta.ts";
import { calculatedTable, viewCalculated } from "../calculated/index.ts";
import { cellNamesIn, rowNamesIn, withCellName } from "../names.ts";
import { tagValue, withTagValue } from "../tagvalues.ts";

type IndexMap = domain.IndexMap;
type TableSource = domain.TableSource;

export const CELLS: domain.FormulaCells = formulaCellsOf({ get: (cell, key) => tagValue(cell, attributeName("formulas", key)), with: (cell, key, value) => withTagValue(cell, attributeName("formulas", key), value) }, { rowNames: rowNamesIn, cellNames: cellNamesIn });

// The cells with views as the view module keeps them (view.formula in the metadata row), written with no header renamed
export const VIEW_CELLS: domain.FormulaCells = {
  ...CELLS,
  calculated: (table) => {
    const formula = metaValue(table, "view", "formula");
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

const named = (tables: readonly PageTable[]) => tables.map((t) => ({ ...t, name: metaName(t.table) }));

export const formulaOf = (cell: string) => CELLS.formulaOf(cell);
export const formulaCell = (value: string, formula: string, name?: string) => withCellName(CELLS.formulaCell(value, formula), name);
export const hasFormulas = (table: Table) => domain.hasFormulas(CELLS, table);
export const formulaCount = (table: Table) => domain.formulaCount(CELLS, table);
export const recalculate = (table: Table, tables?: TableSource) => domain.recalculate(table, { cells: CELLS, tables, name: metaName(table) });
// Each error as a cell's title says it: its code and why
export const formulaErrors = (table: Table, tables?: TableSource) =>
  new Map([...domain.formulaErrors(table, { cells: CELLS, tables, name: metaName(table) })].map(([at, error]) => [at, `${error.code} ${error.detail}`]));
export const totalRows = (table: Table) => domain.totalRows(CELLS, table);
export const calculatedFormula = (table: Table, column: number, except?: ReadonlySet<number>) => domain.calculatedFormula(CELLS, table, column, except);
export const withCalculatedCells = (table: Table, row: number, added?: ReadonlySet<number>) => domain.withCalculatedCells(CELLS, table, row, added);
export const withoutFormulas = (table: Table) => domain.withoutFormulas(CELLS, table);
const following = (before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap): domain.Following => ({
  cells: CELLS,
  rowMap,
  columnMap,
  names: { before: metaName(before), after: metaName(after) },
});
export const formulasAfterEdit = (before: Table, after: Table, edit: { readonly rowMap?: IndexMap; readonly columnMap?: IndexMap; readonly tables?: TableSource }) =>
  domain.formulasAfterEdit(before, after, { ...following(before, after, edit.rowMap, edit.columnMap), tables: edit.tables });
export const shiftReferences = (before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap) => domain.shiftReferences(before, after, following(before, after, rowMap, columnMap));
export const followTable = (table: Table, before: Table, after: Table, rowMap?: IndexMap, columnMap?: IndexMap) =>
  domain.followTable(table, before, after, following(before, after, rowMap, columnMap));
export const qualifyCellNames = (formula: string, own: Table, tables: TableSource) => domain.qualifyCellNames(formula, { table: own, name: metaName(own) }, tables, CELLS);
export const cellNamesOf = (table: Table) => domain.cellNamesOf(CELLS, table);
export const referredPages = (table: Table) => domain.referredPages(CELLS, table);
export const referredTableNames = (table: Table) => domain.referredTableNames(CELLS, table);
export const callsCustomFunctions = (table: Table) => domain.callsCustomFunctions(CELLS, table);
export const pageTables = (tables: () => readonly PageTable[], here: string, replace?: { readonly from: number; readonly table: Table }, others?: OtherPages) =>
  page.pageTables(
    CELLS,
    () => named(tables()),
    here,
    replace && { ...replace, name: metaName(replace.table) },
    others && {
      tables: (name) => {
        const list = others.tables(name);
        return list ? named(list) : list;
      },
    },
  );
export const pageNameChoices = (tables: readonly PageTable[]) => page.pageNameChoices(CELLS, named(tables));
export const ownNameChoices = (table: Table) => page.ownNameChoices(CELLS, table);
export const tablesWritten = (all: readonly PageTable[], source: string) => page.tablesWritten(CELLS, named(all), source);
export const excelFormula = (formula: string, table: Table, row: number, column: number, templates?: ExcelTemplates, structured?: ExcelTable["structured"]) =>
  excelFormulaOf(formula, { table, name: metaName(table), cells: CELLS, ...(structured ? { structured } : {}) }, row, column, templates);
