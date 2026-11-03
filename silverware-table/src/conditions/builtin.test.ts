// Every built-in condition and format on values worked out by hand, its edges too (bounds, empty cells, text
// for a number, equal numbers, negative ones, ends given the wrong way round): what each is meant to do, fixed
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Style } from "./api.ts";
import { cellOf, conditionNamed, evaluateRules, formatNamed, type Placed, readParams, type Rule } from "./index.ts";

/** A column of cells, rows from 1 */
const column = (values: readonly string[]): Placed[] =>
  values.map((v, i) => {
    const cell = cellOf(v, v, "x");
    return { row: i + 1, column: 0, cell, rowCells: { x: cell } };
  });

const run = (rule: Omit<Rule, "scope">, values: readonly string[], formula?: (row: number) => string | number | boolean | undefined) => {
  const cells = column(values);
  const { styles, problems } = evaluateRules([{ rule: { scope: { kind: "column", column: 0 }, ...rule }, cells }], formula && ((row) => formula(row)));
  expect(problems).toEqual([]);
  return cells.map((p) => styles.get(`${p.row}:0`));
};

/** Which cells a condition picks */
const picks = (name: string, params: Record<string, unknown>, values: readonly string[], formula?: (row: number) => string | number | boolean | undefined) =>
  run({ when: { name, params }, format: { name: "bold", params: {} } }, values, formula).map((s) => s !== undefined);

/** What a format gives each cell, no condition */
const looks = (name: string, params: Record<string, unknown>, values: readonly string[]): (Style | undefined)[] => run({ format: { name, params } }, values);

/** A format's fills as the index of each among those it gave, in order (0 the first fill seen): its levels */
const levelsOf = (name: string, params: Record<string, unknown>, values: readonly string[]) => {
  const fills = looks(name, params, values).map((s) => (s ? JSON.stringify(s) : undefined));
  const distinct = [...new Set(fills.filter((f) => f !== undefined))];
  return fills.map((f) => (f === undefined ? undefined : distinct.indexOf(f)));
};

const BW = { low: "#000000", high: "#ffffff" };

afterEach(() => vi.useRealTimers());

describe("Built-in conditions", () => {
  it("greater than and less than: numbers only, the value itself not", () => {
    expect(picks("greater", { value: 10 }, ["9", "10", "11", "abc", "", "-20", "10,5"])).toEqual([false, false, true, false, false, false, true]);
    expect(picks("less", { value: 10 }, ["9", "10", "11", "abc", "", "-20"])).toEqual([true, false, false, false, false, true]);
  });

  it("between: both ends in, ends given either way round", () => {
    expect(picks("between", { from: 10, to: 20 }, ["9", "10", "15", "20", "21", "x"])).toEqual([false, true, true, true, false, false]);
    expect(picks("between", { from: 20, to: 10 }, ["10", "20", "21"])).toEqual([true, true, false]);
  });

  it("equal to and not equal to: as numbers where both are, else as text, case and diacritics ignored", () => {
    expect(picks("equal", { value: "10" }, ["10", "10.0", "10,0 €", "100", "ten"])).toEqual([true, true, true, false, false]);
    expect(picks("equal", { value: "Česko" }, ["česko", "CESKO", "Česko ", "Slovensko", ""])).toEqual([true, true, true, false, false]);
    expect(picks("notEqual", { value: "open" }, ["open", "Open", "done", ""])).toEqual([false, false, true, true]);
    expect(picks("notEqual", { value: "5" }, ["5", "5.0", "6", "x"])).toEqual([false, false, true, true]);
  });

  it("text contains, does not contain, starts with, ends with: case and diacritics ignored; an empty text picks nothing", () => {
    const values = ["Žlutý kůň", "zlute", "kun", ""];
    expect(picks("contains", { text: "kun" }, values)).toEqual([true, false, true, false]);
    expect(picks("notContains", { text: "kun" }, values)).toEqual([false, true, false, true]);
    expect(picks("startsWith", { text: "zlut" }, values)).toEqual([true, true, false, false]);
    expect(picks("endsWith", { text: "KUN" }, values)).toEqual([true, false, true, false]);
    for (const name of ["contains", "startsWith", "endsWith"]) expect(picks(name, { text: "" }, values), name).toEqual([false, false, false, false]);
  });

  it("matches as a filter does: words anywhere, /regex/, =whole|cells, >10, !not; an empty pattern picks nothing", () => {
    const values = ["blocked", "done", "Done later", "12", ""];
    expect(picks("matches", { pattern: "done" }, values)).toEqual([false, true, true, false, false]);
    expect(picks("matches", { pattern: "/^bl/" }, values)).toEqual([true, false, false, false, false]);
    expect(picks("matches", { pattern: "=done|blocked" }, values)).toEqual([true, true, false, false, false]);
    expect(picks("matches", { pattern: ">10" }, values)).toEqual([false, false, false, true, false]);
    expect(picks("matches", { pattern: "!done" }, values)).toEqual([true, false, false, true, true]);
    expect(picks("matches", { pattern: "" }, values)).toEqual([false, false, false, false, false]);
  });

  it("empty and not empty: spaces are empty", () => {
    expect(picks("empty", {}, ["", "  ", "x", "0"])).toEqual([true, true, false, false]);
    expect(picks("notEmpty", {}, ["", "  ", "x", "0"])).toEqual([false, false, true, true]);
  });

  it("duplicate and unique values: among the rule's cells, case ignored, empty cells never; numbers by their value and unit", () => {
    const values = ["a", "A", "b", "", "", "c"];
    expect(picks("duplicate", {}, values)).toEqual([true, true, false, false, false, false]);
    expect(picks("unique", {}, values)).toEqual([false, false, true, false, false, true]);
    // 1 and 1.0 one number, as Excel counts them (checked in Excel 16); 3 kg and 3 m not one value
    expect(picks("duplicate", {}, ["1", "1.0", "3 kg", "3 m", "3 kg"])).toEqual([true, true, true, false, true]);
  });

  it("top and bottom values: a count, ties all in; a percent of the cells with numbers, at least one", () => {
    const values = ["5", "3", "5", "9", "1", "x"];
    expect(picks("top", { count: 2 }, values)).toEqual([true, false, true, true, false, false]);
    expect(picks("top", { count: 1 }, values)).toEqual([false, false, false, true, false, false]);
    expect(picks("bottom", { count: 2 }, values)).toEqual([false, true, false, false, true, false]);
    // 40 % of 5 numbers: 2; 10 %: still 1
    expect(picks("top", { count: 40, percent: true }, values)).toEqual([true, false, true, true, false, false]);
    expect(picks("bottom", { count: 10, percent: true }, values)).toEqual([false, false, false, false, true, false]);
  });

  it("above and below average: of the numbers, the average itself neither", () => {
    expect(picks("aboveAverage", {}, ["1", "2", "3", "x"])).toEqual([false, false, true, false]);
    expect(picks("belowAverage", {}, ["1", "2", "3", "x"])).toEqual([true, false, false, false]);
  });

  it("dates around today: days, weeks from Monday, months, the year, before and after; a time of the day counts as its day", () => {
    // Wednesday 2026-11-04
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 15, 0));
    const dates = ["2026-11-04", "2026-11-04 23:30", "2026-11-03", "2026-11-05", "2026-10-29", "2026-10-28", "2026-11-02", "2026-11-08", "2026-11-09", "2026-10-31", "2026-12-01", "2026-01-01", "2025-12-31", "x"];
    const when = (period: string) => picks("dateIn", { period }, dates);
    expect(when("today")).toEqual([true, true, false, false, false, false, false, false, false, false, false, false, false, false]);
    expect(when("yesterday")).toEqual([false, false, true, false, false, false, false, false, false, false, false, false, false, false]);
    expect(when("tomorrow")).toEqual([false, false, false, true, false, false, false, false, false, false, false, false, false, false]);
    // The last 7 days: today and the 6 before (29 Oct to 4 Nov)
    expect(when("last7")).toEqual([true, true, true, false, true, false, true, false, false, true, false, false, false, false]);
    // The next 7 days: today and the 6 after (4 to 10 Nov)
    expect(when("next7")).toEqual([true, true, false, true, false, false, false, true, true, false, false, false, false, false]);
    // Monday 2 Nov to Sunday 8 Nov
    expect(when("thisWeek")).toEqual([true, true, true, true, false, false, true, true, false, false, false, false, false, false]);
    expect(when("lastWeek")).toEqual([false, false, false, false, true, true, false, false, false, true, false, false, false, false]);
    expect(when("nextWeek")).toEqual([false, false, false, false, false, false, false, false, true, false, false, false, false, false]);
    expect(when("thisMonth")).toEqual([true, true, true, true, false, false, true, true, true, false, false, false, false, false]);
    expect(when("lastMonth")).toEqual([false, false, false, false, true, true, false, false, false, true, false, false, false, false]);
    expect(when("nextMonth")).toEqual([false, false, false, false, false, false, false, false, false, false, true, false, false, false]);
    expect(when("thisYear")).toEqual([true, true, true, true, true, true, true, true, true, true, true, true, false, false]);
    expect(when("past")).toEqual([false, false, true, false, true, true, true, false, false, true, false, true, true, false]);
    expect(when("future")).toEqual([false, false, false, true, false, false, false, true, true, false, true, false, false, false]);
  });

  it("a formula: true, a number other than 0 or TRUE picks; false, 0, text, an error or no formulas module not", () => {
    const results: (string | number | boolean | undefined)[] = [true, false, 1, 0, "TRUE", "yes", undefined];
    expect(picks("formula", { formula: "=[@x]" }, results.map(() => "v"), (row) => results[row - 1])).toEqual([true, false, true, false, true, false, false]);
    expect(picks("formula", { formula: "" }, ["v"], () => true)).toEqual([false]);
  });
});

describe("Built-in formats", () => {
  it("the fills, red text and bold: one style for every cell, text too", () => {
    const one = (name: string) => looks(name, {}, ["1", "x"]);
    expect(one("redFill")).toEqual([{ fill: "red", color: "red" }, { fill: "red", color: "red" }]);
    expect(one("yellowFill")[0]).toEqual({ fill: "yellow", color: "yellow" });
    expect(one("greenFill")[0]).toEqual({ fill: "green", color: "green" });
    expect(one("blueFill")[0]).toEqual({ fill: "blue", color: "blue" });
    expect(one("redText")[0]).toEqual({ color: "red" });
    expect(one("bold")[0]).toEqual({ bold: true });
  });

  it("own style: the style set, else purple", () => {
    expect(looks("custom", {}, ["x"])).toEqual([{ fill: "purple" }]);
    expect(looks("custom", { style: { color: "#123456", italic: true } }, ["x"])).toEqual([{ color: "#123456", italic: true }]);
  });

  it("by keywords: the first row whose pattern matches, a filter's syntax; empty patterns skipped", () => {
    const rows = [
      { pattern: "", style: { bold: true } },
      { pattern: "/^bl/", style: { fill: "red" } },
      { pattern: "done", style: { fill: "green" } },
      { pattern: "o", style: { italic: true } },
    ];
    expect(looks("byPattern", { rows }, ["blocked done", "Done", "open", "x", ""])).toEqual([{ fill: "red" }, { fill: "green" }, { italic: true }, undefined, undefined]);
  });

  it("by number ranges: from in, to out, either end open, the first range that fits; text not", () => {
    const rows = [
      { to: 50, style: { fill: "red" } },
      { from: 50, to: 80, style: { fill: "yellow" } },
      { from: 80, style: { fill: "green" } },
    ];
    expect(looks("byRange", { rows }, ["-5", "49.99", "50", "79", "80", "1000", "x"]).map((s) => s?.fill)).toEqual(["red", "red", "yellow", "yellow", "green", "green", undefined]);
    expect(looks("byRange", { rows: [{ from: 1, to: 10, style: { bold: true } }, { from: 5, style: { italic: true } }] }, ["5"])).toEqual([{ bold: true }]);
  });

  it("color scale: red at the smallest, yellow at the 50th percentile, green at the largest; text not", () => {
    const fills = looks("colorScale", {}, ["0", "10", "20", "1000", "x"]).map((s) => s?.fill);
    // The midpoint: the 50th percentile of 0, 10, 20, 1000 is 15
    expect(fills).toEqual([
      "var(--swt-cf-red-fill)",
      "color-mix(in oklab, var(--swt-cf-red-fill) 33.3%, var(--swt-cf-yellow-fill))",
      "color-mix(in oklab, var(--swt-cf-yellow-fill) 99.5%, var(--swt-cf-green-fill))",
      "var(--swt-cf-green-fill)",
      undefined,
    ]);
  });

  it("color scale's points: numbers, a percent, none; a number past a point takes its color; ends the wrong way round invert it", () => {
    const two = { minColor: "#000000", maxColor: "#ffffff", midType: "none" };
    expect(looks("colorScale", { ...two, minType: "number", minValue: 10, maxType: "number", maxValue: 20 }, ["0", "10", "15", "20", "30"]).map((s) => s?.fill)).toEqual([
      "#000000",
      "#000000",
      "color-mix(in oklab, #000000 50%, #ffffff)",
      "#ffffff",
      "#ffffff",
    ]);
    // 25 % of the range 0..100: 25, the midpoint's color there
    expect(looks("colorScale", { midType: "percent", midValue: 25 }, ["0", "25", "100"]).map((s) => s?.fill)[1]).toBe("var(--swt-cf-yellow-fill)");
    expect(looks("colorScale", { ...two, minType: "number", minValue: 100, maxType: "number", maxValue: 0 }, ["0", "100"]).map((s) => s?.fill)).toEqual(["#ffffff", "#000000"]);
  });

  it("color scale of numbers all alike: the largest's color", () => {
    expect(looks("colorScale", {}, ["5", "5"]).map((s) => s?.fill)).toEqual(["var(--swt-cf-green-fill)", "var(--swt-cf-green-fill)"]);
  });

  it("levels of equal counts: as many in each, the ends alike, equal numbers together", () => {
    const fills = (values: string[]) => looks("levels", { ...BW, count: 3 }, values).map((s) => s?.fill);
    expect(levelsOf("levels", { ...BW, count: 3 }, ["1", "2", "3", "4"])).toEqual([0, 1, 1, 2]);
    const sorted = fills(["1", "2", "3", "4"]);
    expect([sorted[0], sorted[3]]).toEqual(["#000000", "#ffffff"]);
    // By the numbers, not by where they are
    expect(fills(["4", "1", "3", "2"])).toEqual([sorted[3], sorted[0], sorted[2], sorted[1]]);
    expect(levelsOf("levels", { ...BW, count: 5 }, Array.from({ length: 10 }, (_, i) => String(i + 1)))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(levelsOf("levels", { ...BW, count: 3 }, ["1", "1", "1", "9"])).toEqual([0, 0, 0, 1]);
  });

  it("levels of equal ranges: a number on a bound in the level above it, decimals too", () => {
    const fills = (values: string[]) => looks("levels", { ...BW, count: 3, split: "equal" }, values).map((s) => s?.fill);
    // 1..4 in thirds: [1, 2), [2, 3), [3, 4]
    const [low, mid, high] = fills(["1", "2", "3", "4"]);
    expect([low, high]).toEqual(["#000000", "#ffffff"]);
    expect(fills(["1", "1.99", "2", "2.99", "3", "4"])).toEqual([low, low, mid, mid, high, high]);
    // 0..0.4 in quarters: 0.3 on a bound, though 0.3 / 0.4 * 4 is 2.9999999999999996 in binary
    expect(levelsOf("levels", { ...BW, count: 4, split: "equal" }, ["0", "0.1", "0.2", "0.3", "0.4"])).toEqual([0, 1, 2, 3, 3]);
  });

  it("heat map: ten levels of equal counts, blue to red", () => {
    const fills = looks("heatMap", {}, Array.from({ length: 20 }, (_, i) => String(i))).map((s) => s?.fill);
    expect(new Set(fills).size).toBe(10);
    expect(fills[0]).toBe("var(--swt-cf-blue-fill)");
    expect(fills[19]).toBe("var(--swt-cf-red-fill)");
  });

  it("traffic light: three equal ranges, red, yellow, green from the smallest", () => {
    expect(looks("traffic", {}, ["0", "34", "67", "100", "x"]).map((s) => s?.fill)).toEqual(["red", "yellow", "green", "green", undefined]);
  });

  it("data bar: a share of the largest from 0 (or the smallest below 0); negative numbers no bar; all zero no bar", () => {
    expect(looks("dataBar", {}, ["0", "25", "100", "x"]).map((s) => s?.bar?.share)).toEqual([0, 0.25, 1, undefined]);
    expect(looks("dataBar", {}, ["-50", "0", "50"]).map((s) => s?.bar?.share)).toEqual([0, 0.5, 1]);
    expect(looks("dataBar", {}, ["0", "0"]).map((s) => s?.bar?.share)).toEqual([0, 0]);
  });

  it("arrows and dots: three equal ranges, down red, right yellow, up green", () => {
    expect(looks("arrows", {}, ["0", "50", "100"]).map((s) => [s?.icon, s?.iconColor])).toEqual([
      ["▼", "red"],
      ["▶", "yellow"],
      ["▲", "green"],
    ]);
    expect(looks("dots", {}, ["0", "50", "100", "x"]).map((s) => s?.iconColor)).toEqual(["red", "yellow", "green", undefined]);
  });
});

describe("Built-in definitions in an Excel file", () => {
  const condition = (name: string, params: Record<string, unknown> = {}) => {
    const d = conditionNamed(name)!;
    return d.excel!(readParams(d.params, params), "B2");
  };
  const format = (name: string, params: Record<string, unknown> = {}) => {
    const d = formatNamed(name)!;
    return d.excel!(readParams(d.params, params), "B2");
  };

  it("a condition as Excel's rule: the same cells as the table picks", () => {
    // Numbers only (Excel's cellIs would take text as greater than any number, an empty cell as 0: checked in Excel 16)
    expect(condition("greater", { value: 10 })).toEqual({ type: "expression", formulas: ["AND(ISNUMBER(B2),B2>10)"] });
    expect(condition("less", { value: -1.5 })).toEqual({ type: "expression", formulas: ["AND(ISNUMBER(B2),B2<-1.5)"] });
    expect(condition("between", { from: 20, to: 10 })).toEqual({ type: "expression", formulas: ["AND(ISNUMBER(B2),B2>=10,B2<=20)"] });
    expect(condition("equal", { value: "10,5" })).toEqual({ type: "expression", formulas: ["AND(ISNUMBER(B2),B2=10.5)"] });
    expect(condition("notEqual", { value: "0" })).toEqual({ type: "expression", formulas: ["NOT(AND(ISNUMBER(B2),B2=0))"] });
    expect(condition("notEqual", { value: "open" })).toEqual({ type: "cellIs", attrs: { operator: "notEqual" }, formulas: ['"open"'] });
    expect(condition("equal", { value: 'a"b' })).toEqual({ type: "cellIs", attrs: { operator: "equal" }, formulas: ['"a""b"'] });
    expect(condition("contains", { text: "kun" })).toEqual({ type: "containsText", attrs: { operator: "containsText", text: "kun" }, formulas: ['NOT(ISERROR(SEARCH("kun",B2)))'] });
    expect(condition("startsWith", { text: "ab" })).toEqual({ type: "beginsWith", attrs: { operator: "beginsWith", text: "ab" }, formulas: ['LEFT(B2,LEN("ab"))="ab"'] });
    expect(condition("endsWith", { text: "ab" })).toEqual({ type: "endsWith", attrs: { operator: "endsWith", text: "ab" }, formulas: ['RIGHT(B2,LEN("ab"))="ab"'] });
    expect(condition("empty")).toEqual({ type: "containsBlanks", formulas: ["LEN(TRIM(B2))=0"] });
    expect(condition("duplicate")).toEqual({ type: "duplicateValues" });
    expect(condition("top", { count: 40, percent: true })).toEqual({ type: "top10", attrs: { rank: "40", percent: "1" } });
    expect(condition("bottom", { count: 3 })).toEqual({ type: "top10", attrs: { rank: "3", bottom: "1" } });
    expect(condition("belowAverage")).toEqual({ type: "aboveAverage", attrs: { aboveAverage: "0" } });
    expect(condition("dateIn", { period: "today" })).toEqual({ type: "timePeriod", attrs: { timePeriod: "today" }, formulas: ["FLOOR(B2,1)=TODAY()"] });
    expect(condition("dateIn", { period: "thisWeek" })).toEqual({ type: "expression", formulas: ["AND(ISNUMBER(B2),FLOOR(B2,1)-WEEKDAY(FLOOR(B2,1),2)=TODAY()-WEEKDAY(TODAY(),2))"] });
  });

  it("an empty text, an empty pattern, a formula: no Excel form, said why (Excel would pick every cell, or cannot)", () => {
    for (const name of ["contains", "startsWith", "endsWith"]) expect(condition(name, { text: "" }), name).toBe("an empty text picks no cells");
    expect(condition("matches", { pattern: "" })).toBe("an empty pattern");
    expect(typeof condition("formula", { formula: "=[@x]" })).toBe("string");
  });

  it("a format of its own look as Excel's: ranges as their tests, a scale's points, a bar, icons; levels none", () => {
    expect(format("byRange", { rows: [{ from: 1, to: 5, style: { bold: true } }] })).toEqual({
      kind: "rules",
      rules: [{ test: { type: "expression", formulas: ["AND(ISNUMBER(B2),B2>=1,B2<5)"] }, style: { bold: true } }],
    });
    expect(format("colorScale")).toEqual({
      kind: "colorScale",
      points: [
        { type: "min", color: "red" },
        { type: "percentile", value: 50, color: "yellow" },
        { type: "max", color: "green" },
      ],
    });
    expect(format("dataBar")).toEqual({ kind: "dataBar", color: "blue" });
    expect(format("arrows")).toEqual({ kind: "iconSet", set: "3Arrows" });
    for (const name of ["levels", "heatMap", "traffic"]) expect(typeof format(name), name).toBe("string");
  });
});
