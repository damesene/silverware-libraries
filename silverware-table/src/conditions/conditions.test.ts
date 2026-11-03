import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { afterEach, describe, expect, it } from "vitest";
import type { Cell, Style } from "./api.ts";
import {
  allConditions,
  allFormats,
  BUILT_IN_PROBLEMS,
  cellOf,
  checkedFormats,
  clearCustomDefinitions,
  defineCustomConditions,
  defineCustomFormats,
  evaluateRules,
  formatNamed,
  inOrder,
  isUnread,
  numbered,
  type Placed,
  readParams,
  type Rule,
  rulesOf,
  rulesText,
  scopeOf,
  storedParams,
  styleLook,
} from "./index.ts";
import { HELPERS } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** A column's cells, rows from 1 */
const column = (values: readonly string[], key = "score"): Placed[] =>
  values.map((v, i) => {
    const cell = cellOf(v, v, key);
    return { row: i + 1, column: 0, cell, rowCells: { [key]: cell } };
  });

const rule = (format: string | [string, Record<string, unknown>], when?: string | [string, Record<string, unknown>], more: Partial<Rule> = {}): Rule => ({
  scope: { kind: "column", column: 0 },
  format: typeof format === "string" ? { name: format, params: {} } : { name: format[0], params: format[1] },
  ...(when ? { when: typeof when === "string" ? { name: when, params: {} } : { name: when[0], params: when[1] } } : {}),
  ...more,
});

const stylesOf = (rules: Rule[], cells: Placed[]) => {
  const { styles, problems } = evaluateRules(rules.map((r) => ({ rule: r, cells })));
  return { styles: cells.map((p) => styles.get(`${p.row}:${p.column}`)), problems };
};

afterEach(() => clearCustomDefinitions());

describe("Built-in definitions", () => {
  it("are all made through the checks a user's are, none refused", () => {
    expect(BUILT_IN_PROBLEMS).toEqual([]);
    expect(allConditions().length).toBe(readdirSync(join(here, "builtin/conditions")).length);
    expect(allFormats().length).toBe(readdirSync(join(here, "builtin/formats")).length);
  });

  it("import nothing but the API's types", () => {
    for (const folder of ["conditions", "formats"]) {
      for (const file of readdirSync(join(here, "builtin", folder))) {
        const source = readFileSync(join(here, "builtin", folder, file), "utf8");
        const imports = source.match(/^import .*$/gm) ?? [];
        for (const line of imports) expect(line, `${folder}/${file}`).toMatch(/^import type \{[^}]+\} from "\.\.\/\.\.\/api\.ts";$/);
      }
    }
  });

  it("work as a user's file: their types stripped, given as definitions they are the same", () => {
    for (const folder of ["conditions", "formats"]) {
      for (const file of readdirSync(join(here, "builtin", folder))) {
        const source = readFileSync(join(here, "builtin", folder, file), "utf8");
        const js = transformSync(source, { loader: "ts", format: "cjs" }).code;
        const module = { exports: {} as { default?: unknown } };
        new Function("module", "exports", js)(module, module.exports);
        const given = module.exports.default as (h: typeof HELPERS) => { name: string };
        expect(typeof given, file).toBe("function");
        const name = given(HELPERS).name;
        if (folder === "formats") {
          const { list, problems } = checkedFormats([given]);
          expect(problems, file).toEqual([]);
          expect(list[0]!.name).toBe(name);
        }
      }
    }
  });
});

describe("Scope", () => {
  const cells = ["10", "40", "70", "100", "n/a", "40"].map((v) => cellOf(v, v, "x"));
  const scope = scopeOf(cells);
  it("reads numbers, ranks, positions and counts as asked", () => {
    expect([scope.min, scope.max, scope.average]).toEqual([10, 100, 52]);
    expect(scope.position(cells[1]!)).toBeCloseTo(1 / 3);
    expect(scope.position(cells[4]!)).toBeUndefined();
    expect(scope.rank(cells[3]!)).toBe(1);
    expect(scope.rank(cells[0]!, true)).toBe(1);
    expect(scope.rank(cells[1]!)).toBe(3);
    expect(scope.count(cells[1]!)).toBe(2);
    expect(scope.quantile(cells[0]!)).toBe(0);
    expect(scope.share(cells[1]!)).toBeCloseTo(0.4);
  });
});

describe("Evaluation", () => {
  it("formats the cells a condition picks with a format's style", () => {
    const { styles } = stylesOf([rule("redFill", ["greater", { value: 50 }])], column(["10", "60", "90"]));
    expect(styles).toEqual([undefined, { fill: "red", color: "red" }, { fill: "red", color: "red" }]);
  });

  it("formats every cell where a rule has no condition: a color scale from the smallest through the 50th percentile to the largest", () => {
    const { styles } = stylesOf([rule("colorScale")], column(["0", "10", "20", "1000", "x"]));
    expect(styles[0]).toEqual({ fill: "var(--swt-cf-red-fill)" });
    // The midpoint the 50th percentile (15), not half the range: 20 is past it, toward the largest
    expect(styles[1]!.fill).toMatch(/^color-mix\(in oklab, var\(--swt-cf-red-fill\) 33\.3%, var\(--swt-cf-yellow-fill\)\)$/);
    expect(styles[2]!.fill).toMatch(/var\(--swt-cf-yellow-fill\) 99\.5%, var\(--swt-cf-green-fill\)/);
    expect(styles[3]).toEqual({ fill: "var(--swt-cf-green-fill)" });
    expect(styles[4]).toBeUndefined();
  });

  it("places a scale's points as set: a number, a percent of the range, no midpoint; a cell past a point takes its color", () => {
    const fills = (params: Record<string, unknown>) => stylesOf([rule(["colorScale", params])], column(["0", "40", "60", "100"])).styles.map((s) => s?.fill);
    const byNumbers = fills({ minType: "number", minValue: 40, midType: "none", maxType: "number", maxValue: 60, minColor: "#000000", maxColor: "#ffffff" });
    expect(byNumbers).toEqual(["#000000", "#000000", "#ffffff", "#ffffff"]);
    const byPercent = fills({ midType: "percent", midValue: 40 });
    expect(byPercent[1]).toBe("var(--swt-cf-yellow-fill)");
  });

  it("reads a percentile between two numbers, as PERCENTILE.INC", () => {
    const scope = scopeOf(["1", "2", "3", "4"].map((v) => cellOf(v, v, "x")));
    expect([scope.percentile(0), scope.percentile(50), scope.percentile(100), scope.percentile(25)]).toEqual([1, 2.5, 4, 1.75]);
  });

  it("styles by number ranges and by keywords, the first row that fits", () => {
    const ranges = stylesOf([rule("byRange")], column(["10", "50", "79", "80", "x"])).styles.map((s) => s?.fill);
    expect(ranges).toEqual(["red", "yellow", "yellow", "green", undefined]);
    const keywords = stylesOf(
      [rule(["byPattern", { rows: [{ pattern: "/^bl/", style: { bold: true } }, { pattern: "done", style: { strike: true } }] }])],
      column(["Blocked", "Done!", "open", "block done"]),
    ).styles;
    expect(keywords).toEqual([{ bold: true }, { strike: true }, undefined, { bold: true }]);
  });

  it("grades numbers into levels: as many colors as asked, equal ranges or equal counts", () => {
    const five = stylesOf([rule(["levels", { count: 3, low: "#000000", high: "#ffffff", split: "equal" }])], column(["0", "40", "100"])).styles.map((s) => s?.fill);
    expect(five[0]).toBe("#000000");
    expect(five[1]).toMatch(/color-mix/);
    expect(five[2]).toBe("#ffffff");
  });

  it("grades by equal counts by default: one far larger number does not leave the others in the first level", () => {
    const fills = stylesOf([rule(["levels", { count: 3, low: "#000000", high: "#ffffff" }])], column(["1", "2", "3", "1000"])).styles.map((s) => s?.fill);
    expect(fills[0]).toBe("#000000");
    expect(fills[1]).toMatch(/color-mix/);
    expect(fills[3]).toBe("#ffffff");
  });

  it("keeps a property an earlier rule set; stop leaves the cells it picked to it", () => {
    const cells = column(["10", "90"]);
    const both = stylesOf([rule("redText", ["greater", { value: 50 }]), rule("greenFill")], cells).styles;
    expect(both[1]).toEqual({ color: "red", fill: "green" });
    const stopped = stylesOf([rule("redText", ["greater", { value: 50 }], { stop: true }), rule("greenFill")], cells).styles;
    expect(stopped).toEqual([{ fill: "green", color: "green" }, { color: "red" }]);
  });

  it("picks duplicates, top values and above average among the rule's cells", () => {
    const cells = column(["5", "3", "5", "9", "1"]);
    expect(stylesOf([rule("bold", "duplicate")], cells).styles.map(Boolean)).toEqual([true, false, true, false, false]);
    expect(stylesOf([rule("bold", ["top", { count: 2 }])], cells).styles.map(Boolean)).toEqual([true, false, true, true, false]);
    expect(stylesOf([rule("bold", "aboveAverage")], cells).styles.map(Boolean)).toEqual([true, false, true, true, false]);
  });

  it("asks a formula condition for each cell's row", () => {
    const cells = column(["a", "b", "c"]);
    const { styles } = evaluateRules([{ rule: rule("bold", ["formula", { formula: "=[@x]" }]), cells }], (row) => row === 2);
    expect([...styles.keys()]).toEqual(["2:0"]);
  });

  it("says what failed and formats nothing for that rule, the others go on", () => {
    defineCustomFormats(checkedFormats([{ name: "broken", label: "Broken", look: () => ({ fill: "red; color: blue" }) }]).list);
    defineCustomConditions([{ name: "throws", label: "Throws", test: () => { throw new Error("no"); } }]);
    const { styles, problems } = stylesOf([rule("broken"), rule("bold", "throws"), rule("missing"), rule("redText")], column(["1"]));
    expect(styles).toEqual([{ color: "red" }]);
    expect(problems).toEqual(['the format broken failed: a style\'s fill "red; color: blue" is no color', "the condition throws failed: no", "no format is named missing"]);
  });
});

describe("Custom definitions", () => {
  it("are a list or a function of the helpers; each one a definition or a function giving one; a built-in name replaced in its place", () => {
    const given = (helpers: typeof HELPERS) => [
      { name: "status", label: "Status", look: (cell: Cell): Style | undefined => (/urgent/i.test(cell.text) ? { color: helpers.palette.red, bold: true } : undefined) },
      () => ({ name: "redFill", label: "Mine", style: { fill: "#ff0000" } }),
      { name: "1bad", label: "x", style: {} },
      { name: "neither", label: "Neither" },
    ];
    const { list, problems } = checkedFormats({ default: given });
    expect(list.map((f) => f.name)).toEqual(["status", "redFill"]);
    expect(problems).toEqual(["format 3 has no name (letters, digits and _, starting with a letter)", "format 4 neither: has either a style or a look(cell, context)"]);
    defineCustomFormats(list);
    expect(allFormats()[0]!.label).toBe("Mine");
    expect(formatNamed("status")).toBeDefined();
  });
});

describe("Rules as stored", () => {
  it("read and write back a column's and a table's rules, a row's on the table, a rule that does not read kept as written", () => {
    const text = '[{"when":["greater",{"value":100}],"format":"redFill"},{"format":["colorScale",{"high":"green"}],"stop":true,"at":2},{"x":1}]';
    const rules = rulesOf(text, { kind: "column", column: 1 });
    expect(rules[0]).toEqual({ scope: { kind: "column", column: 1 }, when: { name: "greater", params: { value: 100 } }, format: { name: "redFill", params: {} } });
    expect(isUnread(rules[2]!)).toBe(true);
    expect(rulesText(rules)).toBe(text);
    expect(rulesOf('[{"format":"bold","together":true}]', { kind: "table" })[0]).toMatchObject({ together: true });
    expect(rulesText(rulesOf('[{"format":"bold","together":true}]', { kind: "table" }))).toBe('[{"format":"bold","together":true}]');
    const table = rulesOf('[{"row":"pear","format":"bold"}]', { kind: "table" });
    expect(table[0]).toMatchObject({ scope: { kind: "row", name: "pear" } });
    expect(rulesOf("not json", { kind: "table" }).map(isUnread)).toEqual([true]);
    expect(rulesText(rulesOf("not json", { kind: "table" }))).toBe("not json");
  });

  it("orders rules by their place, the table's before the columns' where none is stored", () => {
    const col = rule("bold");
    const tab: Rule = { ...rule("redText"), scope: { kind: "table" } };
    expect(inOrder([col, tab])).toEqual([tab, col]);
    expect(inOrder(numbered([col, tab]))).toEqual(numbered([col, tab]));
  });

  it("reads params by their specs, a value that does not fit its default; stores only what differs", () => {
    const specs = formatNamed("levels")!.params;
    expect(readParams(specs, { count: "12", low: "#000", split: "nope" })).toEqual({ count: 10, low: "#000", high: "red", split: "quantiles" });
    expect(storedParams(specs, { count: 5, low: "green", high: "blue", split: "quantiles" })).toEqual({ high: "blue" });
  });
});

describe("Styles as looks", () => {
  it("are marks and Silverware Table's custom properties, a palette's color by its use, both looks", () => {
    expect(styleLook({ fill: "red", color: { light: "#111", dark: "#eee" }, bold: true, strike: true, bar: { share: 0.25 }, icon: "▲", iconColor: "green" })).toEqual({
      marks: ["cf", "cf-fill", "cf-color", "cf-text", "cf-bar", "cf-icon"],
      vars: {
        "--swt-cf-fill": "var(--swt-cf-red-fill)",
        "--swt-cf-fill-dark": "var(--swt-cf-red-fill)",
        "--swt-cf-color": "#111",
        "--swt-cf-color-dark": "#eee",
        "--swt-cf-weight": "bold",
        "--swt-cf-line": "line-through",
        "--swt-cf-bar": "25%",
        "--swt-cf-bar-color": "var(--swt-cf-blue-solid)",
        "--swt-cf-bar-color-dark": "var(--swt-cf-blue-solid)",
        "--swt-cf-icon": '"▲"',
        "--swt-cf-icon-color": "var(--swt-cf-green-solid)",
        "--swt-cf-icon-color-dark": "var(--swt-cf-green-solid)",
      },
    });
  });
});
