// A pivot calculated: a source table's rows grouped by its definition's rows
// and columns, each group's values calculated by the formulas over its rows,
// totals over the rows of a row, of a column and of all. Pure: the module
// gives the source and how formulas read it, this gives the table's cells.
// The rows are read as they show (a formula cell by its result), so a group's
// own formulas are not calculated again in it.
import { columnKey, columnName } from "../columns.ts";
import { type Calculation, rowValues, type Scalar, scalarText, tableValue } from "../formulas/index.ts";
import type { Table } from "../markdown.ts";
import { compareValues } from "../view.ts";
import { groupFormula, type PivotDefinition } from "./definition.ts";

/** A column of the pivot: what it stands for (kept through a refresh, its header named by the user), its header as made, its alignment */
export type PivotColumn = { readonly id: string; readonly header: string; readonly numeric: boolean };

export type Pivot = {
  readonly columns: readonly PivotColumn[];
  // The body's cells as written (texts), the totals' row last where it has one
  readonly body: readonly (readonly string[])[];
};

const TOTAL = "Total";

/** A cell's value as a group's key: its text, as the cell shows it */
const keyOf = (value: Scalar): string => scalarText(value);

/** Whether a condition's value lets a row count: TRUE, or a number other than 0 */
const holds = (value: Scalar): boolean => value === true || (typeof value === "number" && value !== 0);

/**
 * The default header of a group or a value: a column's name for `region`
 * (or the column a formula of one row reads first: `TEXT([@date], "yyyy-mm")`
 * is Date's), "Sum of Revenue" for `SUM([revenue])`, else the formula
 */
function headerOf(item: string, headers: readonly string[], value: boolean): string {
  const named = (key: string) => headers.find((h) => columnKey(h) === columnKey(key) || columnName(h).toLowerCase() === key.trim().toLowerCase());
  if (!value) {
    const column = /\[@([^\]]+)\]/.exec(groupFormula(item))?.[1];
    return (column && named(column) && columnName(named(column)!)) || item;
  }
  const m = /^\s*([A-Za-z.]+)\(\s*\[([^\]@]+)\]\s*\)\s*$/.exec(item);
  const header = m && named(m[2]!);
  if (!m || !header) return item;
  const name = m[1]!.toUpperCase();
  const verb = name === "COUNTA" || name === "COUNT" ? "Count" : name[0] + name.slice(1).toLowerCase();
  // A column's type (its hashtag: #euro) where the value keeps its unit: a sum, not a count
  const tags = verb === "Count" ? "" : (unescapeHeader(header).match(/(^|\s)#[^\s#]+/g) ?? []).map((tag) => ` ${tag.trim()}`).join("");
  return `${verb} of ${columnName(header)}${tags}`;
}

const unescapeHeader = (header: string) => header.replace(/\\\|/g, "|");

/** The source's rows as formulas read them in a pivot: every formula cell as its result */
function asShown(source: Table, calculation: Calculation): Table {
  return { ...source, rows: source.rows.map((row, r) => (r === 0 ? row : { ...row, cells: row.cells.map((cell) => calculation.cells.withoutFormula(cell)) })) };
}

/** The pivot of a source table by its definition */
export function pivotOf(source: Table, definition: PivotDefinition, calculation: Calculation): Pivot {
  const table = asShown(source, calculation);
  const headers = table.rows[0]?.cells ?? [];
  const count = table.rows.length - 1;
  // The rows that count, their groups' keys
  const counted = definition.where ? rowValues(table, definition.where, calculation).map(holds) : Array.from({ length: count }, () => true);
  const rowKeys = definition.rows.map((item) => rowValues(table, groupFormula(item), calculation).map(keyOf));
  const columnKeys = definition.columns.map((item) => rowValues(table, groupFormula(item), calculation).map(keyOf));
  const rowKey = (i: number) => rowKeys.map((keys) => keys[i]!);
  const columnKey_ = (i: number) => columnKeys.map((keys) => keys[i]!).join(" · ");
  const indexes = Array.from({ length: count }, (_, i) => i).filter((i) => counted[i]);
  // The groups in the order met, then sorted
  const groups = new Map<string, { readonly key: readonly string[]; readonly rows: number[] }>();
  const columns = new Set<string>();
  for (const i of indexes) {
    const key = rowKey(i);
    const id = JSON.stringify(key);
    const group = groups.get(id) ?? { key, rows: [] };
    group.rows.push(i);
    groups.set(id, group);
    if (definition.columns.length) columns.add(columnKey_(i));
  }
  const columnList = [...columns].sort(compareValues);
  // A value over some of the rows: the formula over a table of those alone
  const valueOf = (formula: string, rows: readonly number[]): string =>
    rows.length ? keyOf(tableValue({ ...table, rows: [table.rows[0]!, ...rows.map((i) => table.rows[i + 1]!)] }, formula, calculation)) : "";
  const across = definition.columns.length > 0;
  const showRowTotals = across && (definition.totals === "both" || definition.totals === "columns");
  const showTotalRow = definition.totals === "both" || definition.totals === "rows";
  const valueLabel = (value: string) => headerOf(value, headers, true);

  // The columns: the groups', then each column key's values (or the values alone), then the rows' totals
  const out: PivotColumn[] = definition.rows.map((item) => ({ id: `row:${item}`, header: headerOf(item, headers, false), numeric: false }));
  const cellsOf = (rows: readonly number[]): string[] => {
    if (!across) return definition.values.map((value) => valueOf(value, rows));
    const byColumn = columnList.flatMap((column) => {
      const own = rows.filter((i) => columnKey_(i) === column);
      return definition.values.map((value) => valueOf(value, own));
    });
    return showRowTotals ? [...byColumn, ...definition.values.map((value) => valueOf(value, rows))] : byColumn;
  };
  if (!across) out.push(...definition.values.map((value) => ({ id: `value:${value}`, header: valueLabel(value), numeric: true })));
  else {
    const named = (column: string, value: string) => (definition.values.length > 1 ? `${column} ${valueLabel(value)}` : column);
    for (const column of columnList) for (const value of definition.values) out.push({ id: `column:${column}|${value}`, header: named(column, value), numeric: true });
    if (showRowTotals) for (const value of definition.values) out.push({ id: `total|${value}`, header: named(TOTAL, value), numeric: true });
  }

  // The rows: by the sort's keys, else by their groups as numbers, dates or texts sort
  const list = [...groups.values()].map((group) => ({ key: group.key, cells: cellsOf(group.rows), rows: group.rows }));
  const sortValue = (row: (typeof list)[number], by: string): string => {
    const at = definition.rows.findIndex((item) => item.trim().toLowerCase() === by.trim().toLowerCase());
    if (at >= 0) return row.key[at]!;
    // A value: the row's over all its rows (across columns: its total)
    const value = definition.values.find((v) => v.trim().toLowerCase() === by.trim().toLowerCase());
    return value ? valueOf(value, row.rows) : "";
  };
  const keys = definition.sort.length ? definition.sort : definition.rows.map((by) => ({ by, descending: false }));
  list.sort((a, b) => {
    for (const { by, descending } of keys) {
      const order = compareValues(sortValue(a, by), sortValue(b, by));
      if (order) return descending ? -order : order;
    }
    return 0;
  });
  const body: string[][] = list.map((row) => [...row.key, ...row.cells]);
  if (showTotalRow && list.length) {
    const label = definition.rows.map((_, i) => (i === 0 ? TOTAL : ""));
    body.push([...label, ...cellsOf(indexes)]);
  }
  return { columns: out, body };
}
