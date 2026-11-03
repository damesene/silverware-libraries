import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { allConditions, allFormats, checkedFormats, clearCustomDefinitions, defineCustomFormats, type Rule } from "../conditions/index.ts";
import { excelColor, excelConditional, PALETTE_HEX, type RuleRange } from "./conditions.ts";
import { xlsxParts } from "./xlsx.ts";

const here = dirname(fileURLToPath(import.meta.url));

const range = (format: string | [string, Record<string, unknown>], when?: string | [string, Record<string, unknown>], more: Partial<RuleRange> = {}): RuleRange => ({
  rule: {
    scope: { kind: "column", column: 1 },
    format: typeof format === "string" ? { name: format, params: {} } : { name: format[0], params: format[1] },
    ...(when ? { when: typeof when === "string" ? { name: when, params: {} } : { name: when[0], params: when[1] } } : {}),
  } as Rule,
  rows: [1, 4],
  columns: [1, 1],
  ...more,
});

afterEach(() => clearCustomDefinitions());

describe("Conditional formatting in Excel", () => {
  it("has a decision for every built-in condition and format of a look: its Excel form, or why it has none", () => {
    for (const c of allConditions()) expect(typeof c.excel, c.name).toBe("function");
    for (const f of allFormats()) if (f.look) expect(typeof f.excel, f.name).toBe("function");
  });

  it("writes your own format by its own Excel form, as a built-in one's", () => {
    defineCustomFormats(
      checkedFormats([
        {
          name: "hot",
          label: "Hot",
          look: () => ({ fill: "red" }),
          excel: (_: unknown, at: string) => ({ kind: "rules", rules: [{ formula: `${at}>100`, style: { fill: "#ff0000" } }] }),
        },
        { name: "plain", label: "Plain", look: () => undefined },
      ]).list,
    );
    const { conditional, skipped } = excelConditional([range("hot"), range("plain")]);
    expect(conditional.xml).toBe('<conditionalFormatting sqref="B2:B5"><cfRule type="expression" dxfId="0" priority="1"><formula>B2&gt;100</formula></cfRule></conditionalFormatting>');
    expect(skipped).toEqual([{ rule: "All cells → Plain", reason: "Plain has no Excel form" }]);
  });

  it("knows the palette's light colors as the style page has them", () => {
    const style = readFileSync(join(here, "../../silverware-table-style.md"), "utf8");
    const root = /:root \{([^}]*--swt-cf-red-fill[^}]*)\}/.exec(style)![1]!;
    for (const [name, shades] of Object.entries(PALETTE_HEX)) {
      for (const [use, hex] of Object.entries(shades)) expect(root, `${name} ${use}`).toContain(`--swt-cf-${name}-${use}: ${hex};`);
    }
  });

  it("writes colors as ARGB: a palette's by its use, #rgb and #rrggbb; others not", () => {
    expect(excelColor("red", "fill")).toBe("FFFFC7CE");
    expect(excelColor("red", "text")).toBe("FF9C0006");
    expect(excelColor("#0af", "fill")).toBe("FF00AAFF");
    expect(excelColor({ light: "#123456", dark: "#000000" }, "fill")).toBe("FF123456");
    expect(excelColor("color-mix(in oklab, red 50%, blue)", "fill")).toBeUndefined();
  });

  it("writes a condition with its format as a cell format, on the range of the rule, rows as the file has them", () => {
    const { conditional, skipped } = excelConditional([range("redFill", ["greater", { value: 50 }]), range("bold", "duplicate", { rule: { ...range("bold").rule, stop: true } as Rule })]);
    expect(skipped).toEqual([]);
    expect(conditional.xml).toBe(
      '<conditionalFormatting sqref="B2:B5"><cfRule type="expression" dxfId="0" priority="1"><formula>AND(ISNUMBER(B2),B2&gt;50)</formula></cfRule></conditionalFormatting>' +
        '<conditionalFormatting sqref="B2:B5"><cfRule type="expression" dxfId="1" priority="2" stopIfTrue="1"><formula>TRUE</formula></cfRule></conditionalFormatting>',
    );
    expect(conditional.dxfs).toEqual(['<dxf><font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>', "<dxf><font><b/></font></dxf>"]);
  });

  it("writes scales, bars, icons and ranges as Excel's own; texts with quotes; dates relative to the first cell", () => {
    const { conditional } = excelConditional([
      range("colorScale"),
      range("dataBar"),
      range("arrows"),
      range(["byRange", { rows: [{ to: 50, style: { fill: "red" } }, { from: 50, style: { fill: "green" } }] }]),
      range("redText", ["contains", { text: 'say "hi"' }]),
      range("redText", ["dateIn", { period: "past" }]),
    ]);
    expect(conditional.xml).toContain('<colorScale><cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/><color rgb="FFFFC7CE"/><color rgb="FFFFEB9C"/><color rgb="FFC6EFCE"/></colorScale>');
    // From 0 (or the smallest below it), as the table draws it
    expect(conditional.xml).toContain('<dataBar><cfvo type="formula" val="MIN(0,MIN($B$2:$B$5))"/><cfvo type="max"/><color rgb="FF4A7CF0"/></dataBar>');
    expect(conditional.xml).toContain('<iconSet iconSet="3Arrows">');
    // A range's rows: the first that holds styles a cell, no rule after it stopped
    expect(conditional.xml).toContain('<cfRule type="expression" dxfId="0" priority="4"><formula>AND(ISNUMBER(B2),B2&lt;50)</formula></cfRule>');
    expect(conditional.xml).toContain('<cfRule type="expression" dxfId="1" priority="5"><formula>AND(NOT(OR(AND(ISNUMBER(B2),B2&lt;50))),AND(ISNUMBER(B2),B2&gt;=50))</formula></cfRule>');
    expect(conditional.xml).toContain('text="say &quot;hi&quot;"><formula>NOT(ISERROR(SEARCH(&quot;say &quot;&quot;hi&quot;&quot;&quot;,B2)))</formula>');
    expect(conditional.xml).toContain("<formula>AND(ISNUMBER(B2),FLOOR(B2,1)&lt;TODAY())</formula>");
  });

  it("writes a scale's points as set: a number, a percent, no midpoint", () => {
    const { conditional } = excelConditional([range(["colorScale", { minType: "number", minValue: 10, midType: "none", maxType: "percent", maxValue: 90, minColor: "#000000", maxColor: "#ffffff" }])]);
    expect(conditional.xml).toContain('<colorScale><cfvo type="num" val="10"/><cfvo type="percent" val="90"/><color rgb="FF000000"/><color rgb="FFFFFFFF"/></colorScale>');
  });

  it("writes a filter's syntax as a formula, a regular expression by REGEXTEST, said to need Microsoft 365", () => {
    const { conditional, skipped, notes } = excelConditional([
      range("redFill", ["matches", { pattern: "/^bl/" }]),
      range("bold", ["matches", { pattern: "=done|closed" }]),
      range(["byPattern", { rows: [{ pattern: "!open", style: { bold: true } }, { pattern: ">10", style: { italic: true } }] }]),
    ]);
    expect(skipped).toEqual([]);
    expect(conditional.xml).toContain("<formula>_xlfn.REGEXTEST(B2,&quot;^bl&quot;,1)</formula>");
    expect(conditional.xml).toContain("<formula>OR(TRIM(B2)=&quot;done&quot;,TRIM(B2)=&quot;closed&quot;)</formula>");
    expect(conditional.xml).toContain("<formula>NOT(ISNUMBER(SEARCH(&quot;open&quot;,B2)))</formula>");
    expect(conditional.xml).toContain("AND(ISNUMBER(B2),B2&gt;10))</formula>");
    expect(notes).toEqual([{ rule: "Matches → Light red fill with dark red text", reason: "a regular expression needs Microsoft 365 (REGEXTEST): an older Excel leaves its cells as they are" }]);
  });

  it("lists what Excel cannot have, with why: levels, a formula, a look over a condition's cells; your own style is written", () => {
    defineCustomFormats([{ name: "mine", label: "Mine", style: { bold: true } }]);
    const { conditional, skipped } = excelConditional([
      range("heatMap"),
      range("bold", ["formula", { formula: "=[@x]" }]),
      range("mine"),
      range("colorScale", "duplicate"),
    ]);
    expect(conditional.xml).toBe('<conditionalFormatting sqref="B2:B5"><cfRule type="expression" dxfId="0" priority="1"><formula>TRUE</formula></cfRule></conditionalFormatting>');
    expect(skipped.map((s) => s.reason)).toEqual([
      "levels have no Excel form",
      "a formula condition reads columns by name, which Excel's conditional formatting cannot",
      "a look of its own (a scale, a bar, icons, keywords, ranges) over the cells a condition picks has no Excel form",
    ]);
  });

  it("puts the rules in the sheet before its table part, their formats in styles.xml", () => {
    const { conditional } = excelConditional([range("redFill", ["greater", { value: 1 }])]);
    const parts = new Map(xlsxParts({ name: "T", header: ["A", "B"], rows: [[{ value: { kind: "text", value: "x" } }, { value: { kind: "number", value: 2 } }]], table: { name: "T", totalsRow: false, calculated: [] }, conditional }));
    const sheet = parts.get("xl/worksheets/sheet1.xml")!;
    expect(sheet.indexOf("<conditionalFormatting")).toBeGreaterThan(sheet.indexOf("</sheetData>"));
    expect(sheet.indexOf("<conditionalFormatting")).toBeLessThan(sheet.indexOf("<tableParts"));
    expect(parts.get("xl/styles.xml")).toContain('<dxfs count="1"><dxf>');
  });
});
