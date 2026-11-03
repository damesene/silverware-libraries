// Conditional formatting in the .xlsx file: a table's rules as Excel's
// (<conditionalFormatting> in the sheet, their looks as differential formats
// in styles.xml). How a condition or a format is written in Excel is the
// definition's own (`excel`, conditions/api.ts: the built-in ones' and the
// user's alike), so nothing here knows one by name; a format of a style is its
// cell format. One without an Excel form (a regular expression, a formula by
// column names, levels) is not written: listed with why. Excel's formulas in
// rules are relative to the range's first cell.
import { type Color, conditionNamed, type ExcelLook, type ExcelTest, formatNamed, type Params, readParams, type Rule, type Style } from "../conditions/index.ts";
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

// ---- the rules written ---------------------------------------------------------------------------

const cfvo = (type: string, val?: number) => `<cfvo type="${type}"${val !== undefined ? ` val="${val}"` : ""}/>`;
const NO_COLOR = "a color Excel cannot take (only the palette's and #rrggbb)";

/** A look of Excel's own drawing the cells (a scale, a bar, icons): its rule's type and what is in it; or why it has none */
function drawn(look: Exclude<ExcelLook, { readonly kind: "rules" }>): { readonly type: string; readonly inner: string } | { readonly reason: string } {
  if (look.kind === "colorScale") {
    const colors = look.points.map((p) => excelColor(p.color, "fill"));
    if (look.points.length < 2 || look.points.length > 3) return { reason: "a color scale of Excel has two or three points" };
    if (colors.some((c) => !c)) return { reason: NO_COLOR };
    const points = look.points.map((p) => (p.type === "min" || p.type === "max" ? cfvo(p.type) : cfvo(p.type, Number.isFinite(p.value) ? p.value : 0)));
    return { type: "colorScale", inner: `<colorScale>${points.join("")}${colors.map((c) => `<color rgb="${c}"/>`).join("")}</colorScale>` };
  }
  if (look.kind === "dataBar") {
    const color = excelColor(look.color, "solid");
    return color ? { type: "dataBar", inner: `<dataBar>${cfvo("min")}${cfvo("max")}<color rgb="${color}"/></dataBar>` } : { reason: NO_COLOR };
  }
  // As many thresholds as the set has icons (3Arrows: 3), in equal percents of the range
  const count = Number(/^\d+/.exec(look.set)?.[0] ?? 3);
  const points = Array.from({ length: count }, (_, i) => cfvo("percent", Math.round((i * 100) / count)));
  return { type: "iconSet", inner: `<iconSet iconSet="${xmlText(look.set)}">${points.join("")}</iconSet>` };
}

const attrsText = (attrs: Readonly<Record<string, string>> | undefined) =>
  Object.entries(attrs ?? {})
    .map(([k, v]) => ` ${k}="${xmlText(v)}"`)
    .join("");
const ruleXml = (test: ExcelTest, priority: number, dxfId: number | undefined, stop: boolean, inner = "") =>
  `<cfRule type="${xmlText(test.type)}"${dxfId !== undefined ? ` dxfId="${dxfId}"` : ""} priority="${priority}"${stop ? ' stopIfTrue="1"' : ""}${attrsText(test.attrs)}>` +
  `${(test.formulas ?? []).map((f) => `<formula>${xmlText(f)}</formula>`).join("")}${inner}</cfRule>`;

/** A rule's name as the dialog lists it */
const ruleName = (rule: Rule) => {
  const condition = rule.when ? (conditionNamed(rule.when.name)?.label ?? rule.when.name) : "All cells";
  return `${condition} → ${formatNamed(rule.format.name)?.label ?? rule.format.name}`;
};

/** A definition's Excel form: what its `excel` gives, why it has none, or why it failed (the user's code) */
function formOf<T>(name: string, excel: ((params: Params, at: string) => T | string) | undefined, params: Params, at: string): T | { readonly reason: string } {
  if (!excel) return { reason: `${name} has no Excel form` };
  try {
    const made = excel(params, at);
    return typeof made === "string" ? { reason: made } : made;
  } catch (e) {
    return { reason: `its Excel form failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * The rules as Excel's, in their order (Excel's priority), each on its cells
 * as the file has them (the markdown's body row r is Excel's row r + 1); those
 * Excel cannot have, with why. A definition gives its own form (`excel`), the
 * built-in ones and the user's alike; a format of a style is its cell format.
 */
export function excelConditional(ranges: readonly RuleRange[]): { readonly conditional: ExcelConditional; readonly skipped: readonly SkippedRule[] } {
  const dxfs: string[] = [];
  const parts: string[] = [];
  const skipped: SkippedRule[] = [];
  // A rule skipped once, though it applies to several ranges (each column of a table's rule)
  const said = new Set<Rule>();
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
    const skip = (reason: string) => {
      if (said.has(rule)) return;
      said.add(rule);
      skipped.push({ rule: ruleName(rule), reason });
    };
    if (rows[1] < rows[0] || columns[1] < columns[0]) continue;
    const at = `${columnLetters(columns[0])}${rows[0] + 1}`;
    const sqref = `${at}:${columnLetters(columns[1])}${rows[1] + 1}`;
    const condition = rule.when ? conditionNamed(rule.when.name) : undefined;
    const format = formatNamed(rule.format.name);
    if (rule.when && !condition) {
      skip(`no condition is named ${rule.when.name}`);
      continue;
    }
    if (!format) {
      skip(`no format is named ${rule.format.name}`);
      continue;
    }
    let test: ExcelTest | undefined;
    if (condition) {
      const made = formOf(condition.label, condition.excel as ((params: Params, at: string) => ExcelTest | string) | undefined, readParams(condition.params, rule.when!.params), at);
      if ("reason" in made) {
        skip(made.reason);
        continue;
      }
      test = made;
    }
    const params = readParams(format.params, rule.format.params);
    const rules: string[] = [];
    if (format.style !== undefined) {
      // A style: the cell format of the condition's cells, or of every cell
      let style: Style;
      try {
        style = typeof format.style === "function" ? format.style(params) : format.style;
      } catch (e) {
        skip(`its style failed: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const dxfId = dxfIdOf(style);
      if (typeof dxfId !== "number") {
        skip(dxfId.reason);
        continue;
      }
      rules.push(ruleXml(test ?? { type: "expression", formulas: ["TRUE"] }, priority++, dxfId, !!rule.stop));
    } else {
      const look = formOf(format.label, format.excel as ((params: Params, at: string) => ExcelLook | string) | undefined, params, at);
      if ("reason" in look) {
        skip(look.reason);
        continue;
      }
      if (test) {
        skip("a look of its own (a scale, a bar, icons, keywords, ranges) over the cells a condition picks has no Excel form");
        continue;
      }
      if (look.kind === "rules") {
        // A style of each test of its own: the first that fits styles the cell, each stopping those after it
        const ids = look.rules.map((r) => dxfIdOf(r.style));
        const bad = ids.find((id): id is { reason: string } => typeof id !== "number");
        if (bad) {
          skip(bad.reason);
          continue;
        }
        look.rules.forEach((r, i) => rules.push(ruleXml(r.test, priority++, ids[i] as number, true)));
      } else {
        const made = drawn(look);
        if ("reason" in made) {
          skip(made.reason);
          continue;
        }
        rules.push(ruleXml({ type: made.type }, priority++, undefined, !!rule.stop, made.inner));
      }
    }
    if (rules.length) parts.push(`<conditionalFormatting sqref="${sqref}">${rules.join("")}</conditionalFormatting>`);
  }
  return { conditional: { xml: parts.join(""), dxfs }, skipped };
}
