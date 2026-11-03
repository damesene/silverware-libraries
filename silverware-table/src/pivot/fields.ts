// A pivot's definition as its dialog shows it, and back: a group a column
// (grouped by year, month… where it holds dates) or a formula of its own, a
// value a function of a column or a formula, the conditions rows (a column,
// an operator, a value) all or any of which must hold, else a formula of its
// own. What the dialog cannot show as such stays a formula, written as it was.
// Pure.
import { splitList, type PivotDefinition, type SortKey, type Totals } from "./definition.ts";

export const GROUPINGS = ["", "year", "quarter", "yearMonth", "month", "day"] as const;
export type Grouping = (typeof GROUPINGS)[number];
export const GROUPING_LABELS: Readonly<Record<Grouping, string>> = { "": "as it is", year: "by year", quarter: "by quarter", yearMonth: "by month", month: "by month of the year", day: "by day" };

export const FUNCTIONS = ["SUM", "AVERAGE", "COUNTA", "MIN", "MAX"] as const;
export type Fn = (typeof FUNCTIONS)[number];
export const FUNCTION_LABELS: Readonly<Record<Fn, string>> = { SUM: "Sum", AVERAGE: "Average", COUNTA: "Count", MIN: "Min", MAX: "Max" };

export const OPERATORS = ["=", "<>", ">", ">=", "<", "<="] as const;
export type Operator = (typeof OPERATORS)[number];

export type GroupField = { readonly column: string; readonly grouping: Grouping } | { readonly formula: string };
export type ValueField = { readonly fn: Fn; readonly column: string } | { readonly formula: string };
export type Condition = { readonly column: string; readonly op: Operator; readonly value: string };

export type Fields = {
  readonly source: string;
  readonly rows: readonly GroupField[];
  readonly columns: readonly GroupField[];
  readonly values: readonly ValueField[];
  // The conditions, all of them (else any) holding; or a formula the dialog shows as it is
  readonly conditions: readonly Condition[];
  readonly any: boolean;
  readonly where?: string;
  readonly sort: readonly SortKey[];
  readonly totals: Totals;
};

const cellOf = (column: string) => `[@${column}]`;

/** A group's formula of one row: a column alone by its name */
export function groupText(field: GroupField): string {
  if ("formula" in field) return field.formula;
  const c = cellOf(field.column);
  switch (field.grouping) {
    case "year":
      return `YEAR(${c})`;
    case "quarter":
      return `YEAR(${c}) & "-Q" & ROUNDUP(MONTH(${c}) / 3, 0)`;
    case "yearMonth":
      return `TEXT(${c}, "yyyy-mm")`;
    case "month":
      return `TEXT(${c}, "mm")`;
    case "day":
      return `TEXT(${c}, "yyyy-mm-dd")`;
    default:
      return /^[\p{L}\p{N} _]+$/u.test(field.column) ? field.column : c;
  }
}

/** A group read from its formula: a column (and how it is grouped) where it is one of those groupText writes */
export function readGroup(text: string): GroupField {
  const t = text.trim();
  const col = String.raw`\[@([^\]]+)\]`;
  const patterns: [Grouping, RegExp][] = [
    ["year", new RegExp(`^YEAR\\(${col}\\)$`, "i")],
    ["quarter", new RegExp(`^YEAR\\(${col}\\) & "-Q" & ROUNDUP\\(MONTH\\(\\[@\\1\\]\\) / 3, 0\\)$`, "i")],
    ["yearMonth", new RegExp(`^TEXT\\(${col}, "yyyy-mm"\\)$`, "i")],
    ["month", new RegExp(`^TEXT\\(${col}, "mm"\\)$`, "i")],
    ["day", new RegExp(`^TEXT\\(${col}, "yyyy-mm-dd"\\)$`, "i")],
    ["", new RegExp(`^${col}$`)],
  ];
  for (const [grouping, re] of patterns) {
    const m = re.exec(t);
    if (m) return { column: m[1]!, grouping };
  }
  return /^[\p{L}\p{N} _]+$/u.test(t) ? { column: t, grouping: "" } : { formula: t };
}

export function valueText(field: ValueField): string {
  return "formula" in field ? field.formula : `${field.fn}([${field.column}])`;
}

export function readValue(text: string): ValueField {
  const m = /^\s*(SUM|AVERAGE|COUNTA|MIN|MAX)\(\s*\[([^\]@]+)\]\s*\)\s*$/i.exec(text);
  return m ? { fn: m[1]!.toUpperCase() as Fn, column: m[2]! } : { formula: text.trim() };
}

/** A condition's formula: its value a number as it is, else a text in quotes */
export function conditionText(condition: Condition): string {
  const value = condition.value.trim();
  const literal = /^-?\d+(\.\d+)?$/.test(value) ? value : `"${value.replace(/"/g, '""')}"`;
  return `${cellOf(condition.column)} ${condition.op} ${literal}`;
}

function readCondition(text: string): Condition | undefined {
  const m = /^\[@([^\]]+)\]\s*(<>|>=|<=|=|>|<)\s*(.+)$/.exec(text.trim());
  if (!m) return undefined;
  const raw = m[3]!.trim();
  const quoted = /^"(.*)"$/.exec(raw);
  if (!quoted && !/^-?\d+(\.\d+)?$/.test(raw)) return undefined;
  return { column: m[1]!, op: m[2] as Operator, value: quoted ? quoted[1]!.replace(/""/g, '"') : raw };
}

/** The fields of a definition, as the dialog shows them */
export function fieldsOf(definition: PivotDefinition): Fields {
  const where = definition.where?.trim();
  let conditions: Condition[] = [];
  let any = false;
  let kept: string | undefined;
  if (where) {
    const both = /^(AND|OR)\((.*)\)$/i.exec(where);
    const parts = both ? splitList(both[2]!) : [where];
    const read = parts.map(readCondition);
    if (read.every((c): c is Condition => c !== undefined)) {
      conditions = read;
      any = both?.[1]!.toUpperCase() === "OR";
    } else kept = where;
  }
  return {
    source: definition.source,
    rows: definition.rows.map(readGroup),
    columns: definition.columns.map(readGroup),
    values: definition.values.map(readValue),
    conditions,
    any,
    ...(kept ? { where: kept } : {}),
    sort: definition.sort,
    totals: definition.totals,
  };
}

/** The definition the fields make */
export function definitionOf(fields: Fields): PivotDefinition {
  const parts = fields.conditions.filter((c) => c.column && c.value.trim() !== "").map(conditionText);
  const where = fields.where ?? (parts.length > 1 ? `${fields.any ? "OR" : "AND"}(${parts.join(", ")})` : parts[0]);
  return {
    source: fields.source,
    rows: fields.rows.map(groupText),
    columns: fields.columns.map(groupText),
    values: fields.values.map(valueText),
    ...(where ? { where } : {}),
    sort: fields.sort,
    totals: fields.totals,
  };
}
