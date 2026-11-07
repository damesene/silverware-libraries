// A pivot calculated: a source table's rows grouped by its definition's rows
// and columns, each group's values calculated by the formulas over its rows,
// totals over the rows of a row, of a column and of all; a value shown as a
// share divided by the total it is a share of. Pure: the module
// gives the source and how formulas read it, this gives the table's cells.
// The rows are read as they show (a formula cell by its result), so a group's
// own formulas are not calculated again in it.
import type { Calculated, CalculatedColumn } from "../calculated/index.ts";
import { columnKey, columnName } from "../columns.ts";
import { type Calculation, isErrorText, rowValues, type Scalar, scalarText, tableValue } from "../formulas/index.ts";
import type { Table } from "../markdown.ts";
import { compareValues } from "../../../shared/compare.ts";
import { groupFormula, type PivotDefinition, valueParts } from "./definition.ts";

const TOTAL = "Total";
// The type of a column of shares: a fraction shown as a percentage
const PERCENT = "#percent-1";
const SHARE_DIGITS = 10_000;

/** A cell's value as a group's key: its text, as the cell shows it */
const keyOf = (value: Scalar): string => scalarText(value);

/** Whether a condition's value lets a row count: TRUE, or a number other than 0 */
const holds = (value: Scalar): boolean => value === true || (typeof value === "number" && value !== 0);

/**
 * The default header of a group or a value: a column's name for `region`
 * (or the column a formula of one row reads first: `TEXT([@date], "yyyy-mm")`
 * is Date's), "Sum of Revenue" for `SUM([revenue])`, else the formula
 */
function headerOf(item: string, headers: readonly string[], value: boolean, typed = true): string {
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
  const tags = verb === "Count" || !typed ? "" : (unescapeHeader(header).match(/(^|\s)#[^\s#]+/g) ?? []).map((tag) => ` ${tag.trim()}`).join("");
  return `${verb} of ${columnName(header)}${tags}`;
}

const unescapeHeader = (header: string) => header.replace(/\\\|/g, "|");

/** The source's rows as formulas read them in a pivot: every formula cell as its result */
function asShown(source: Table, calculation: Calculation): Table {
  return { ...source, rows: source.rows.map((row, r) => (r === 0 ? row : { ...row, cells: row.cells.map((cell) => calculation.cells.withoutFormula(cell)) })) };
}

/** The pivot of a source table by its definition: a calculated table, its columns' ids row:<group>, value:<value>, column:<key>|<value>, total:<value> */
export function pivotOf(source: Table, definition: PivotDefinition, calculation: Calculation): Calculated {
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
  // A formula over some of the rows: over a table of those alone
  const calculated = (formula: string, rows: readonly number[]): Scalar => tableValue({ ...table, rows: [table.rows[0]!, ...rows.map((i) => table.rows[i + 1]!)] }, formula, calculation);
  // The totals shares are of (all rows', a column's), calculated once for a value
  const totals = new Map<string, Scalar>();
  const totalOf = (formula: string, column: string | undefined): Scalar => {
    const id = JSON.stringify([formula, column ?? null]);
    if (!totals.has(id)) totals.set(id, calculated(formula, column === undefined ? indexes : indexes.filter((i) => columnKey_(i) === column)));
    return totals.get(id)!;
  };
  // A pivot's row's whole (its rows' list the same for each of its columns), calculated once for a value
  const rowWholes = new WeakMap<readonly number[], Map<string, Scalar>>();
  const rowWholeOf = (formula: string, row: readonly number[]): Scalar => {
    let wholes = rowWholes.get(row);
    if (!wholes) rowWholes.set(row, (wholes = new Map()));
    if (!wholes.has(formula)) wholes.set(formula, calculated(formula, row));
    return wholes.get(formula)!;
  };
  // A value of some rows (`own`) of a pivot's row (`row`: all its rows), in a column of the column groups' or not: as calculated, or its share
  const valueOf = (item: string, own: readonly number[], row: readonly number[], column?: string): string => {
    if (!own.length) return "";
    const { formula, show } = valueParts(item);
    const part = calculated(formula, own);
    if (!show || typeof part !== "number") return keyOf(part);
    const whole = show === "row" ? rowWholeOf(formula, row) : totalOf(formula, show === "column" ? column : undefined);
    if (typeof whole !== "number") return isErrorText(keyOf(whole)) ? keyOf(whole) : "#VALUE!";
    // (Rounded as the percentage shows it, and a little past: what the markdown holds stays readable)
    return whole === 0 ? "#DIV/0!" : keyOf(Math.round((part / whole) * SHARE_DIGITS) / SHARE_DIGITS);
  };
  const across = definition.columns.length > 0;
  const showRowTotals = across && (definition.totals === "both" || definition.totals === "column");
  const showTotalRow = definition.totals === "both" || definition.totals === "row";
  const valueLabel = (value: string) => {
    const { formula, show } = valueParts(value);
    return show ? `${headerOf(formula, headers, true, false)} (% of ${show}) ${PERCENT}` : headerOf(formula, headers, true);
  };

  // The columns: the groups', then each column key's values (or the values alone), then the rows' totals
  const out: CalculatedColumn[] = definition.rows.map((item) => ({ id: `row:${item}`, header: headerOf(item, headers, false), numeric: false }));
  const cellsOf = (rows: readonly number[]): string[] => {
    if (!across) return definition.values.map((value) => valueOf(value, rows, rows));
    const byColumn = columnList.flatMap((column) => {
      const own = rows.filter((i) => columnKey_(i) === column);
      return definition.values.map((value) => valueOf(value, own, rows, column));
    });
    return showRowTotals ? [...byColumn, ...definition.values.map((value) => valueOf(value, rows, rows))] : byColumn;
  };
  if (!across) out.push(...definition.values.map((value) => ({ id: `value:${value}`, header: valueLabel(value), numeric: true })));
  else {
    // (A column of shares named by its group alone still says its type)
    const named = (column: string, value: string) => (definition.values.length > 1 ? `${column} ${valueLabel(value)}` : valueParts(value).show ? `${column} ${PERCENT}` : column);
    for (const column of columnList) for (const value of definition.values) out.push({ id: `column:${column}|${value}`, header: named(column, value), numeric: true });
    if (showRowTotals) for (const value of definition.values) out.push({ id: `total:${value}`, header: named(TOTAL, value), numeric: true });
  }

  // The rows: by the sort's keys, else by their groups as numbers, dates or texts sort
  const list = [...groups.values()].map((group) => ({ key: group.key, cells: cellsOf(group.rows), rows: group.rows }));
  const sortValue = (row: (typeof list)[number], by: string): string => {
    const at = definition.rows.findIndex((item) => item.trim().toLowerCase() === by.trim().toLowerCase());
    if (at >= 0) return row.key[at]!;
    // A value: the row's over all its rows (across columns: its total), a share by what it is a share of
    const value = definition.values.find((v) => v.trim().toLowerCase() === by.trim().toLowerCase());
    return value ? keyOf(calculated(valueParts(value).formula, row.rows)) : "";
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
  return { columns: out, body, totalRow: showTotalRow && list.length > 0, totalColumns: showRowTotals ? definition.values.length : 0 };
}
