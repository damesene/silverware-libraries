// Conditional formatting in the .xlsx file: a table's rules as Excel's
// (<conditionalFormatting> in the sheet, their looks as differential formats
// in styles.xml). How each built-in condition and format is written in Excel
// is a table here by its name (a test requires every built-in one in it, so a
// new one needs a decision); one Excel has no form of (a regular expression, a
// formula by column names, levels), or a custom one, is not written: listed
// with why. Excel's formulas in rules are relative to the range's first cell.
import { type Color, conditionNamed, formatNamed, isBuiltInCondition, isBuiltInFormat, type Params, readParams, type Rule, type Style } from "../conditions/index.ts";
import { columnLetters } from "../formulas/index.ts";
import { xmlText } from "./xlsx.ts";

/** A rule with the cells it applies to: the markdown's body rows (first to last) and columns, the pinned ones left out */
export type RuleRange = { readonly rule: Rule; readonly rows: readonly [number, number]; readonly columns: readonly [number, number] };

/** What the sheet gets: its <conditionalFormatting> elements, the differential formats they use (styles.xml's dxfs) */
export type ExcelConditional = { readonly xml: string; readonly dxfs: readonly string[] };

/** A rule not written, and why */
export type SkippedRule = { readonly rule: string; readonly reason: string };

// The palette's light colors (the style page's --swt-cf-<name>-fill / -text / -solid: a test keeps them in step)
export const PALETTE_HEX: Readonly<Record<string, { readonly fill: string; readonly text: string; readonly solid: string }>> = {
  red: { fill: "#ffc7ce", text: "#9c0006", solid: "#e5534b" },
  orange: { fill: "#fdd9b5", text: "#8a4300", solid: "#f08c2e" },
  yellow: { fill: "#ffeb9c", text: "#9c5700", solid: "#e0b000" },
  green: { fill: "#c6efce", text: "#006100", solid: "#3fa34d" },
  teal: { fill: "#c3ece8", text: "#0b5c55", solid: "#1aa39a" },
  blue: { fill: "#cfe2ff", text: "#0b3d91", solid: "#4a7cf0" },
  purple: { fill: "#e3d5f7", text: "#4b2a85", solid: "#8a63d2" },
  pink: { fill: "#fbd3e9", text: "#8a1d55", solid: "#d9488f" },
  gray: { fill: "#e3e3e3", text: "#3d3d3d", solid: "#8a8a8a" },
};

/** A color as Excel's ARGB, its light look; undefined: none Excel can take (a mix, a variable) */
export function excelColor(color: Color | undefined, use: "fill" | "text" | "solid"): string | undefined {
  if (color === undefined) return undefined;
  const text = (typeof color === "string" ? color : color.light).trim().toLowerCase();
  const hex = PALETTE_HEX[text]?.[use] ?? text;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(hex);
  if (short) return `FF${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  const long = /^#([0-9a-f]{6})$/.exec(hex);
  return long ? `FF${long[1]!.toUpperCase()}` : undefined;
}

/** A style as a differential format; a reason where Excel cannot show it so */
export function dxfOf(style: Style): string | { readonly reason: string } {
  if (style.bar || style.icon) return { reason: "a bar or an icon is no cell format in Excel" };
  const fill = excelColor(style.fill, "fill");
  const color = excelColor(style.color, "text");
  if ((style.fill !== undefined && !fill) || (style.color !== undefined && !color)) return { reason: "a color Excel cannot take (only the palette's and #rrggbb)" };
  const font = `${style.bold ? "<b/>" : ""}${style.italic ? "<i/>" : ""}${style.strike ? "<strike/>" : ""}${style.underline ? "<u/>" : ""}${color ? `<color rgb="${color}"/>` : ""}`;
  return `<dxf>${font ? `<font>${font}</font>` : ""}${fill ? `<fill><patternFill><bgColor rgb="${fill}"/></patternFill></fill>` : ""}</dxf>`;
}

// ---- conditions ------------------------------------------------------------------------------

/** A condition as Excel's rule: its type, attributes and formulas (of the range's first cell, `at`) */
type ExcelTest = { readonly type: string; readonly attrs?: Readonly<Record<string, string>>; readonly formulas?: readonly string[] };
type ConditionInExcel = (params: Params, at: string) => ExcelTest | { readonly reason: string };

const text = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? String(value) : undefined);
// A value compared: a number as it is, else text in quotes
const compared = (value: unknown) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value.replace(",", ".")) : value;
  return number(n) ?? text(value);
};
// A filter's pattern Excel can have: a plain word or words, found anywhere
const plainPattern = (pattern: unknown) => typeof pattern === "string" && pattern.trim() !== "" && !/^[=!<>/]|\|/.test(pattern.trim());
const day = (at: string) => `FLOOR(${at},1)`;
const isDate = (at: string, test: string) => ({ type: "expression", formulas: [`AND(ISNUMBER(${at}),${test})`] });
const monday = (date: string) => `${date}-WEEKDAY(${date},2)`;

/** How each built-in condition is written in Excel (every one listed: a test requires it) */
export const CONDITIONS_IN_EXCEL: Readonly<Record<string, ConditionInExcel>> = {
  greater: (p) => ({ type: "cellIs", attrs: { operator: "greaterThan" }, formulas: [number(p.value) ?? "0"] }),
  less: (p) => ({ type: "cellIs", attrs: { operator: "lessThan" }, formulas: [number(p.value) ?? "0"] }),
  between: (p) => ({ type: "cellIs", attrs: { operator: "between" }, formulas: [String(Math.min(p.from, p.to)), String(Math.max(p.from, p.to))] }),
  equal: (p) => ({ type: "cellIs", attrs: { operator: "equal" }, formulas: [compared(p.value)] }),
  notEqual: (p) => ({ type: "cellIs", attrs: { operator: "notEqual" }, formulas: [compared(p.value)] }),
  contains: (p, at) => ({ type: "containsText", attrs: { operator: "containsText", text: String(p.text) }, formulas: [`NOT(ISERROR(SEARCH(${text(p.text)},${at})))`] }),
  notContains: (p, at) => ({ type: "notContainsText", attrs: { operator: "notContains", text: String(p.text) }, formulas: [`ISERROR(SEARCH(${text(p.text)},${at}))`] }),
  startsWith: (p, at) => ({ type: "beginsWith", attrs: { operator: "beginsWith", text: String(p.text) }, formulas: [`LEFT(${at},LEN(${text(p.text)}))=${text(p.text)}`] }),
  endsWith: (p, at) => ({ type: "endsWith", attrs: { operator: "endsWith", text: String(p.text) }, formulas: [`RIGHT(${at},LEN(${text(p.text)}))=${text(p.text)}`] }),
  matches: (p, at) =>
    plainPattern(p.pattern)
      ? { type: "containsText", attrs: { operator: "containsText", text: String(p.pattern).trim() }, formulas: [`NOT(ISERROR(SEARCH(${text(String(p.pattern).trim())},${at})))`] }
      : { reason: "a pattern of a filter's syntax (a regular expression, =a|b, >10, !…) has no Excel form" },
  empty: (_, at) => ({ type: "containsBlanks", formulas: [`LEN(TRIM(${at}))=0`] }),
  notEmpty: (_, at) => ({ type: "notContainsBlanks", formulas: [`LEN(TRIM(${at}))>0`] }),
  duplicate: () => ({ type: "duplicateValues" }),
  unique: () => ({ type: "uniqueValues" }),
  top: (p) => ({ type: "top10", attrs: { rank: String(p.count), ...(p.percent ? { percent: "1" } : {}) } }),
  bottom: (p) => ({ type: "top10", attrs: { rank: String(p.count), bottom: "1", ...(p.percent ? { percent: "1" } : {}) } }),
  aboveAverage: () => ({ type: "aboveAverage" }),
  belowAverage: () => ({ type: "aboveAverage", attrs: { aboveAverage: "0" } }),
  dateIn: (p, at) => {
    const period = (name: string, formula: string) => ({ type: "timePeriod", attrs: { timePeriod: name }, formulas: [formula] });
    const month = (by: number) => `AND(MONTH(${at})=MONTH(EDATE(TODAY(),${by})),YEAR(${at})=YEAR(EDATE(TODAY(),${by})))`;
    switch (p.period) {
      case "today":
        return period("today", `${day(at)}=TODAY()`);
      case "yesterday":
        return period("yesterday", `${day(at)}=TODAY()-1`);
      case "tomorrow":
        return period("tomorrow", `${day(at)}=TODAY()+1`);
      case "last7":
        return period("last7Days", `AND(TODAY()-${day(at)}<=6,${day(at)}<=TODAY())`);
      case "thisMonth":
        return period("thisMonth", month(0));
      case "lastMonth":
        return period("lastMonth", month(-1));
      case "nextMonth":
        return period("nextMonth", month(1));
      // Weeks from Monday (Excel's own periods start on Sunday)
      case "thisWeek":
        return isDate(at, `${monday(day(at))}=${monday("TODAY()")}`);
      case "lastWeek":
        return isDate(at, `${monday(day(at))}=${monday("TODAY()")}-7`);
      case "nextWeek":
        return isDate(at, `${monday(day(at))}=${monday("TODAY()")}+7`);
      case "next7":
        return isDate(at, `${day(at)}>=TODAY(),${day(at)}<TODAY()+7`);
      case "thisYear":
        return isDate(at, `YEAR(${at})=YEAR(TODAY())`);
      case "past":
        return isDate(at, `${day(at)}<TODAY()`);
      case "future":
        return isDate(at, `${day(at)}>TODAY()`);
      default:
        return { reason: "a period Excel has no form of" };
    }
  },
  formula: () => ({ reason: "a formula condition reads columns by name, which Excel's conditional formatting cannot" }),
};

// ---- formats ------------------------------------------------------------------------------------

/**
 * A format in Excel: its style as a cell format (with the condition, or for every cell), rules of its own
 * (a range's style: one rule a row), a rule of its own drawing the cells (a scale, a bar, icons: no condition), or why none
 */
type FormatInExcel =
  | { readonly kind: "style" }
  | { readonly kind: "styled"; readonly rules: (params: Params, at: string) => readonly { readonly test: ExcelTest; readonly style: Style }[] | { readonly reason: string } }
  | { readonly kind: "drawn"; readonly rule: (params: Params) => string | { readonly reason: string } }
  | { readonly kind: "none"; readonly reason: string };

const cfvo = (type: string, val?: string) => `<cfvo type="${type}"${val !== undefined ? ` val="${val}"` : ""}/>`;
// A scale's point as Excel's: its kind, its value
const POINT_TYPES: Readonly<Record<string, string>> = { min: "min", max: "max", number: "num", percent: "percent", percentile: "percentile" };
const scale = (p: Params) => {
  const points = (["min", "mid", "max"] as const).filter((k) => p[`${k}Type`] !== "none");
  const argb = points.map((k) => excelColor(p[`${k}Color`], "fill"));
  if (argb.some((c) => !c)) return { reason: "a color Excel cannot take (only the palette's and #rrggbb)" };
  const stops = points.map((k) => {
    const type = POINT_TYPES[p[`${k}Type`]] ?? (k === "max" ? "max" : "min");
    return type === "min" || type === "max" ? cfvo(type) : cfvo(type, String(p[`${k}Value`] ?? 0));
  });
  return `<colorScale>${stops.join("")}${argb.map((c) => `<color rgb="${c}"/>`).join("")}</colorScale>`;
};
const icons = (set: string) => `<iconSet iconSet="${set}">${cfvo("percent", "0")}${cfvo("percent", "33")}${cfvo("percent", "67")}</iconSet>`;

/** How each built-in format is written in Excel (every one listed: a test requires it) */
export const FORMATS_IN_EXCEL: Readonly<Record<string, FormatInExcel>> = {
  redFill: { kind: "style" },
  yellowFill: { kind: "style" },
  greenFill: { kind: "style" },
  blueFill: { kind: "style" },
  redText: { kind: "style" },
  bold: { kind: "style" },
  custom: { kind: "style" },
  byPattern: {
    kind: "styled",
    rules: (p, at) => {
      const rows = (p.rows as readonly { pattern: string; style: Style }[]).filter((r) => r.pattern.trim() !== "");
      if (rows.some((r) => !plainPattern(r.pattern))) return { reason: "a keyword written as a pattern (a regular expression, =a|b, >10, !…) has no Excel form" };
      return rows.map((r) => ({ test: { type: "containsText", attrs: { operator: "containsText", text: r.pattern.trim() }, formulas: [`NOT(ISERROR(SEARCH(${text(r.pattern.trim())},${at})))`] }, style: r.style }));
    },
  },
  byRange: {
    kind: "styled",
    rules: (p, at) =>
      (p.rows as readonly { from?: number; to?: number; style: Style }[]).map((r) => ({
        test: { type: "expression", formulas: [`AND(ISNUMBER(${at})${r.from !== undefined ? `,${at}>=${r.from}` : ""}${r.to !== undefined ? `,${at}<${r.to}` : ""})`] },
        style: r.style,
      })),
  },
  colorScale: { kind: "drawn", rule: (p) => scale(p) },
  dataBar: {
    kind: "drawn",
    rule: (p) => {
      const color = excelColor(p.color, "solid");
      return color ? `<dataBar>${cfvo("min")}${cfvo("max")}<color rgb="${color}"/></dataBar>` : { reason: "a color Excel cannot take (only the palette's and #rrggbb)" };
    },
  },
  arrows: { kind: "drawn", rule: () => icons("3Arrows") },
  dots: { kind: "drawn", rule: () => icons("3TrafficLights1") },
  levels: { kind: "none", reason: "levels have no Excel form" },
  heatMap: { kind: "none", reason: "levels have no Excel form" },
  traffic: { kind: "none", reason: "levels have no Excel form" },
};

// ---- the rules written ---------------------------------------------------------------------------

const attrsText = (attrs: Readonly<Record<string, string>> | undefined) =>
  Object.entries(attrs ?? {})
    .map(([k, v]) => ` ${k}="${xmlText(v)}"`)
    .join("");
const ruleXml = (test: ExcelTest, priority: number, dxfId: number | undefined, stop: boolean, inner = "") =>
  `<cfRule type="${test.type}"${dxfId !== undefined ? ` dxfId="${dxfId}"` : ""} priority="${priority}"${stop ? ' stopIfTrue="1"' : ""}${attrsText(test.attrs)}>` +
  `${(test.formulas ?? []).map((f) => `<formula>${xmlText(f)}</formula>`).join("")}${inner}</cfRule>`;

/** A rule's name as the dialog lists it */
const ruleName = (rule: Rule) => {
  const condition = rule.when ? (conditionNamed(rule.when.name)?.label ?? rule.when.name) : "All cells";
  return `${condition} → ${formatNamed(rule.format.name)?.label ?? rule.format.name}`;
};

/**
 * The rules as Excel's, in their order (Excel's priority), each on its cells
 * as the file has them (the markdown's body row r is Excel's row r + 1); those
 * Excel cannot have, with why
 */
export function excelConditional(ranges: readonly RuleRange[]): { readonly conditional: ExcelConditional; readonly skipped: readonly SkippedRule[] } {
  const dxfs: string[] = [];
  const parts: string[] = [];
  const skipped: SkippedRule[] = [];
  let priority = 1;
  const dxfIdOf = (style: Style): number | { reason: string } => {
    const dxf = dxfOf(style);
    if (typeof dxf !== "string") return dxf;
    const known = dxfs.indexOf(dxf);
    if (known >= 0) return known;
    dxfs.push(dxf);
    return dxfs.length - 1;
  };
  for (const { rule, rows, columns } of ranges) {
    const skip = (reason: string) => skipped.push({ rule: ruleName(rule), reason });
    if (rows[1] < rows[0] || columns[1] < columns[0]) continue;
    const at = `${columnLetters(columns[0])}${rows[0] + 1}`;
    const sqref = `${at}:${columnLetters(columns[1])}${rows[1] + 1}`;
    const condition = rule.when ? conditionNamed(rule.when.name) : undefined;
    const format = formatNamed(rule.format.name);
    if (rule.when && (!condition || !isBuiltInCondition(condition))) {
      skip(condition ? "a condition of your own has no Excel form" : `no condition is named ${rule.when.name}`);
      continue;
    }
    if (!format || !isBuiltInFormat(format)) {
      skip(format ? "a format of your own has no Excel form" : `no format is named ${rule.format.name}`);
      continue;
    }
    const inExcel = FORMATS_IN_EXCEL[format.name];
    if (!inExcel || inExcel.kind === "none") {
      skip(inExcel?.reason ?? "no Excel form");
      continue;
    }
    const formatParams = readParams(format.params, rule.format.params);
    let test: ExcelTest | undefined;
    if (condition) {
      const made = CONDITIONS_IN_EXCEL[condition.name]?.(readParams(condition.params, rule.when!.params), at) ?? { reason: "no Excel form" };
      if ("reason" in made) {
        skip(made.reason);
        continue;
      }
      test = made;
    }
    const rules: string[] = [];
    if (inExcel.kind === "drawn") {
      if (test) {
        skip("a scale, a bar or icons over the cells a condition picks has no Excel form");
        continue;
      }
      const drawn = inExcel.rule(formatParams);
      if (typeof drawn !== "string") {
        skip(drawn.reason);
        continue;
      }
      const type = drawn.startsWith("<colorScale") ? "colorScale" : drawn.startsWith("<dataBar") ? "dataBar" : "iconSet";
      rules.push(ruleXml({ type }, priority++, undefined, !!rule.stop, drawn));
    } else if (inExcel.kind === "style") {
      const style = typeof format.style === "function" ? format.style(formatParams) : format.style;
      const dxfId = style ? dxfIdOf(style) : { reason: "no style" };
      if (typeof dxfId !== "number") {
        skip(dxfId.reason);
        continue;
      }
      rules.push(ruleXml(test ?? { type: "expression", formulas: ["TRUE"] }, priority++, dxfId, !!rule.stop));
    } else {
      // A style of each row (keywords, ranges): a rule each, within the condition's cells where it has one
      const made = inExcel.rules(formatParams, at);
      if ("reason" in made) {
        skip(made.reason);
        continue;
      }
      const ids = made.map((r) => dxfIdOf(r.style));
      const bad = ids.find((id): id is { reason: string } => typeof id !== "number");
      if (bad) {
        skip(bad.reason);
        continue;
      }
      if (test) {
        skip("keywords or ranges over the cells a condition picks have no Excel form");
        continue;
      }
      // The first row that fits styles the cell: each stops the rows after it
      made.forEach((r, i) => rules.push(ruleXml(r.test, priority++, ids[i] as number, true)));
    }
    parts.push(`<conditionalFormatting sqref="${sqref}">${rules.join("")}</conditionalFormatting>`);
  }
  return { conditional: { xml: parts.join(""), dxfs }, skipped };
}
