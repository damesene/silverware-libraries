// A pivot's definition as its table's metadata row keeps it, in the formulas'
// language: `source` the table summarized (of this page, or of another as
// formulas refer to it: [[Orders]]orders), `rows` and `columns` what groups
// its rows (a column, or a formula of one row), `values` what each group
// shows (a formula over its rows, or its share of a total), `where` which rows count (a formula of one
// row), `sort` the rows' order, `totals` the totals shown. Pure: the module
// reads and writes the attributes, this reads and writes their values.
import { type Token, tokenize } from "../formulas/tokens.ts";

// The totals shown: the Total row and (a cross table's) the Total column, the row alone, the column alone, none.
// The row and the column by what they are, not as Excel's "grand totals for rows", which is the Total column
export type Totals = "both" | "row" | "column" | "none";
export const TOTALS: readonly Totals[] = ["both", "row", "column", "none"];

/** A key the rows are sorted by: a row's group (`region`) or a value (`SUM([revenue])`), as the definition writes it */
export type SortKey = { readonly by: string; readonly descending: boolean };

export type PivotDefinition = {
  readonly source: string;
  readonly rows: readonly string[];
  readonly columns: readonly string[];
  readonly values: readonly string[];
  readonly where?: string;
  readonly sort: readonly SortKey[];
  readonly totals: Totals;
};

/** The definition's attributes by their keys (the module's: pivot.<key>) */
export const KEYS = ["source", "rows", "columns", "values", "where", "sort", "totals"] as const;
export type Key = (typeof KEYS)[number];

/**
 * A list as the definition writes it: its items apart at the commas outside
 * parentheses and quotes (`SUM([qty]), TEXT([@date], "yyyy-mm")`), as the
 * formulas' tokens find them; each trimmed, none empty
 */
export function splitList(text: string): string[] {
  const { tokens, error } = tokenize(text);
  if (error) return text.trim() ? [text.trim()] : [];
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (const token of tokens) {
    if (token.kind !== "op") continue;
    if (token.text === "(") depth++;
    else if (token.text === ")") depth--;
    else if (token.text === "," && depth === 0) {
      items.push(text.slice(start, token.from));
      start = token.to;
    }
  }
  items.push(text.slice(start));
  return items.map((item) => item.trim()).filter((item) => item !== "");
}

/** The table a pivot summarizes: its name, and the page it is on where the source says one (`[[Orders]]orders`, as formulas refer to it) */
export type SourceRef = { readonly name: string; readonly page?: string };

export function sourceRef(source: string): SourceRef {
  const m = /^\[\[([^\]]*)\]\]([\s\S]*)$/.exec(source.trim());
  return m ? { page: m[1]!.trim(), name: m[2]!.trim() } : { name: source.trim() };
}

export function sourceText(ref: SourceRef): string {
  return ref.page !== undefined ? `[[${ref.page}]]${ref.name}` : ref.name;
}

/** The definition of a table's attributes; undefined where it has no source (no pivot), else why it cannot be one */
export function readDefinition(attribute: (key: Key) => string | undefined): PivotDefinition | { readonly problem: string } | undefined {
  const source = attribute("source")?.trim();
  if (!source) return undefined;
  const ref = sourceRef(source);
  if (!ref.name || ref.page === "") return { problem: "its source names no table (pivot.source: orders, or [[Page]]orders on another page)" };
  const values = splitList(attribute("values") ?? "");
  const rows = splitList(attribute("rows") ?? "");
  if (!values.length) return { problem: "it says no values (pivot.values: SUM([revenue]))" };
  if (!rows.length && !splitList(attribute("columns") ?? "").length) return { problem: "it says no rows or columns to group by (pivot.rows: region)" };
  const totals = (attribute("totals")?.trim() || "both") as Totals;
  if (!TOTALS.includes(totals)) return { problem: `its totals are "${totals}" (both, row, column or none)` };
  const where = attribute("where")?.trim();
  return {
    source,
    rows,
    columns: splitList(attribute("columns") ?? ""),
    values,
    ...(where ? { where } : {}),
    sort: splitList(attribute("sort") ?? "").map((item) => {
      const m = /^(.*?)\s+(asc|desc)$/i.exec(item);
      return m ? { by: m[1]!.trim(), descending: m[2]!.toLowerCase() === "desc" } : { by: item, descending: false };
    }),
    totals,
  };
}

/** A definition read as far as it goes (one with a problem: for its dialog to fix it), what it says wrong left out */
export function looseDefinition(attribute: (key: Key) => string | undefined): PivotDefinition {
  const totals = attribute("totals")?.trim() as Totals | undefined;
  const where = attribute("where")?.trim();
  return {
    source: attribute("source")?.trim() ?? "",
    rows: splitList(attribute("rows") ?? ""),
    columns: splitList(attribute("columns") ?? ""),
    values: splitList(attribute("values") ?? ""),
    ...(where ? { where } : {}),
    sort: [],
    totals: totals && TOTALS.includes(totals) ? totals : "both",
  };
}

/** The attributes writing a definition (what it leaves out, as it was by default, not written) */
export function definitionAttributes(definition: PivotDefinition): [Key, string][] {
  const list = (items: readonly string[]) => items.join(", ");
  const out: [Key, string][] = [["source", definition.source]];
  if (definition.rows.length) out.push(["rows", list(definition.rows)]);
  if (definition.columns.length) out.push(["columns", list(definition.columns)]);
  out.push(["values", list(definition.values)]);
  if (definition.where) out.push(["where", definition.where]);
  if (definition.sort.length) out.push(["sort", list(definition.sort.map((key) => (key.descending ? `${key.by} desc` : key.by)))]);
  if (definition.totals !== "both") out.push(["totals", definition.totals]);
  return out;
}

/** How a value shows: as calculated, or as a share of the grand total, of its row's total or of its column's */
export type Show = "" | "total" | "row" | "column";
export const SHOWS: readonly Show[] = ["", "total", "row", "column"];

/**
 * A value's formula and how it shows, as the definition writes it: the
 * formula, or a share of it, `SHARE(SUM([revenue]))` of the grand total,
 * `SHARE(SUM([revenue]), "row")` of its row's ("column": its column's).
 * SHARE is the pivot's, not a function of the formulas: only the whole value
 * is one (in a formula it is an unknown name). The item as written stays
 * what the pivot knows it by (its column, a sort's key).
 */
export function valueParts(item: string): { readonly formula: string; readonly show: Show } {
  const plain = { formula: item.trim(), show: "" as Show };
  const call = /^SHARE\s*\(([\s\S]*)\)$/i.exec(plain.formula);
  if (!call || !closesLast(plain.formula)) return plain;
  const [formula, of, ...more] = splitList(call[1]!);
  const show = of === undefined ? "total" : /^"(total|row|column)"$/i.exec(of)?.[1]?.toLowerCase();
  return formula && show && !more.length ? { formula, show: show as Show } : plain;
}

/** Whether a call's parenthesis is closed by the text's last one (`SHARE(a) + SHARE(b)` is no call of SHARE alone) */
function closesLast(text: string): boolean {
  const { tokens, error } = tokenize(text);
  if (error) return false;
  let depth = 0;
  const parens = tokens.filter((t): t is Extract<Token, { kind: "op" }> => t.kind === "op" && (t.text === "(" || t.text === ")"));
  return parens.every((t, i) => {
    depth += t.text === "(" ? 1 : -1;
    return depth > 0 || i === parens.length - 1;
  });
}

export function valueItem(formula: string, show: Show): string {
  if (!show) return formula;
  return show === "total" ? `SHARE(${formula})` : `SHARE(${formula}, "${show}")`;
}

/** A group as a formula of one row: a column's name stands for its cell in the row (`region` is `[@region]`) */
export function groupFormula(item: string): string {
  return /^[^[\]()"=!<>&*/+^,-]+$/.test(item) && !/^\d/.test(item.trim()) ? `[@${item.trim()}]` : item;
}
