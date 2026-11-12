import { describe, expect, it } from "vitest";
import type { ChartModel } from "../core/model.ts";
import { listItems, readMermaid, writeMermaid } from "./mermaid.ts";

const EXAMPLE = `xychart-beta
  title "An Example Chart"
  x-axis ["90d", "60d", "30d"]
  y-axis "Seconds" 0 --> 198.2
  line "avg" [48.1, 41.5, 45.7]
  line "p95" [112.2, 75.3, 103.0]`;

describe("readMermaid", () => {
  it("reads an xychart as Mermaid writes it", () => {
    expect(readMermaid(EXAMPLE)).toEqual({
      type: "line",
      title: "An Example Chart",
      labels: ["90d", "60d", "30d"],
      series: [
        { name: "avg", values: [48.1, 41.5, 45.7] },
        { name: "p95", values: [112.2, 75.3, 103] },
      ],
      y: { title: "Seconds", min: 0, max: 198.2 },
    });
  });

  it("takes bars with lines as a bar chart, horizontal from its head, series without names", () => {
    const model = readMermaid("xychart-beta horizontal\n  x-axis [a, b]\n  bar [1, 2]\n  line [3, 4]") as ChartModel;
    expect(model.type).toBe("bar");
    expect(model.horizontal).toBe(true);
    expect(model.labels).toEqual(["a", "b"]);
    expect(model.series.map((s) => [s.name, s.kind])).toEqual([
      [undefined, undefined],
      [undefined, "line"],
    ]);
  });

  it("reads each series' kind from chart.kinds where Mermaid has no word for it, none where it is the type's own", () => {
    const model = readMermaid('xychart-beta\n  x-axis [a]\n  bar "s" [1]\n  line "t" [2]\n  line "u" [3]\n  line "v" [4]\n%% chart.kinds: bar, area, point, sunburst') as ChartModel;
    expect(model.series.map((s) => s.kind)).toEqual([undefined, "area", "point", "line"]);
    // An area chart's lines are its areas
    const area = readMermaid('xychart-beta\n  x-axis [a]\n  line [1]\n  bar [2]\n%% chart.type: area') as ChartModel;
    expect(area.series.map((s) => s.kind)).toEqual([undefined, "bar"]);
  });

  it("reads a pie, its title on its head or a line of its own", () => {
    const pie = { type: "pie", title: "Pets", labels: ["Dogs", "Cats"], series: [{ values: [386, 85] }] };
    expect(readMermaid('pie title Pets\n  "Dogs" : 386\n  "Cats" : 85')).toEqual(pie);
    expect(readMermaid('pie showData\n  title Pets\n  "Dogs" : 386\n  "Cats" : 85')).toEqual(pie);
  });

  it("reads our comments into the model, the keys it has no field for kept", () => {
    const model = readMermaid(`${EXAMPLE}\n%% chart.type: area\n%% chart.stacked: true\n%% chart.colors: #111, #222\n%% chart.legend: bottom\n%% chart.source: [[Data]]sales\n%% chart.labels: month\n%% chart.series: revenue, cost\n%% chart.later: 1`) as ChartModel;
    expect(model).toMatchObject({
      type: "area",
      stacked: true,
      colors: ["#111", "#222"],
      legend: "bottom",
      source: { table: "[[Data]]sales", labels: "month", series: ["revenue", "cost"] },
      extra: { later: "1" },
    });
  });

  it("hands other diagrams on, and says what it cannot read of its own", () => {
    expect(readMermaid("flowchart LR\n  A --> B")).toBeUndefined();
    expect(readMermaid("%% only a comment")).toBeUndefined();
    expect(readMermaid("xychart-beta\n  bar 1, 2")).toEqual({ problem: '"bar 1, 2" has no values in [ ]' });
  });
});

describe("listItems", () => {
  it("splits on commas outside quotes", () => {
    expect(listItems('"a, b", c ,"d"')).toEqual(["a, b", "c", "d"]);
    expect(listItems("")).toEqual([]);
    expect(listItems('""')).toEqual([""]);
  });
});

describe("writeMermaid", () => {
  it("writes back what it read", () => {
    expect(readMermaid(writeMermaid(readMermaid(EXAMPLE) as ChartModel))).toEqual(readMermaid(EXAMPLE));
  });

  it("says in comments what Mermaid cannot, a pie for round types", () => {
    const model: ChartModel = { type: "doughnut", title: "Pets", labels: ["Dogs", "Cats"], series: [{ values: [3, null] }], legend: "right", source: { table: "pets", labels: "kind", series: ["count"] } };
    expect(writeMermaid(model)).toBe(`pie title Pets
  "Dogs" : 3
  "Cats" : 0
%% chart.type: doughnut
%% chart.legend: right
%% chart.source: pets
%% chart.labels: kind
%% chart.series: count`);
  });

  it("writes a type only where the series do not say it", () => {
    const area: ChartModel = { type: "area", labels: ["a"], series: [{ values: [1] }] };
    expect(writeMermaid(area)).toBe('xychart-beta\n  x-axis ["a"]\n  line [1]\n%% chart.type: area');
    expect(writeMermaid({ ...area, type: "line" })).toBe('xychart-beta\n  x-axis ["a"]\n  line [1]');
  });

  it("writes an area, points and steps as lines, their kinds in chart.kinds, read back as they were", () => {
    const model: ChartModel = { type: "bar", labels: ["a"], series: [{ name: "s", values: [1] }, { name: "t", kind: "area", values: [2] }, { name: "u", kind: "step", values: [3] }] };
    const written = writeMermaid(model);
    expect(written).toBe('xychart-beta\n  x-axis ["a"]\n  bar "s" [1]\n  line "t" [2]\n  line "u" [3]\n%% chart.kinds: bar, area, step');
    expect(readMermaid(written)).toEqual(model);
    // Bars and lines alone need none
    expect(writeMermaid({ ...model, series: [{ values: [1] }, { kind: "line", values: [2] }] })).not.toContain("kinds");
  });

  it("keeps the previous block's own comments: directives first, the others after", () => {
    const previous = `%%{init: {"theme": "dark"}}%%\n${EXAMPLE}\n%% chart.type: area\n%% a note`;
    const written = writeMermaid(readMermaid(previous) as ChartModel, previous);
    expect(written.split("\n")[0]).toBe('%%{init: {"theme": "dark"}}%%');
    expect(written.endsWith("%% chart.type: area\n%% a note")).toBe(true);
  });

  it("writes an axis' range in Mermaid's y-axis with both ends, one end alone in a comment (a syntax error there), read back so", () => {
    const bars: ChartModel = { type: "bar", labels: ["a"], series: [{ values: [1] }] };
    const both = writeMermaid({ ...bars, y: { title: "EUR", min: 0, max: 200 } });
    expect(both).toContain('  y-axis "EUR" 0 --> 200');
    expect(both).not.toContain("chart.y");
    const from = writeMermaid({ ...bars, y: { title: "EUR", min: 0 } });
    expect(from).toContain('  y-axis "EUR"\n');
    expect(from).toContain("%% chart.yFrom: 0");
    expect((readMermaid(from) as ChartModel).y).toEqual({ title: "EUR", min: 0 });
    const to = writeMermaid({ ...bars, y: { max: 50 } });
    expect(to).not.toContain("y-axis");
    expect((readMermaid(to) as ChartModel).y).toEqual({ max: 50 });
  });

  it("writes a scatter's x range in comments (its x axis has the labels in Mermaid), read back so; an end no number kept as written", () => {
    const scatter: ChartModel = { type: "scatter", labels: ["1", "4"], series: [{ values: [2, 3] }], x: { min: 0, max: 10 } };
    const written = writeMermaid(scatter);
    expect(written).toContain("%% chart.xFrom: 0\n%% chart.xTo: 10");
    expect((readMermaid(written) as ChartModel).x).toEqual({ min: 0, max: 10 });
    const odd = readMermaid(`${EXAMPLE}\n%% chart.yFrom: zero`) as ChartModel;
    expect(odd.y).toEqual({ title: "Seconds", min: 0, max: 198.2 });
    expect(odd.extra).toEqual({ yFrom: "zero" });
  });
});

describe("Silverware Layout's entries in a Mermaid chart", () => {
  it("read from `%% layout.<key>` comments into the model's layout, for an xychart and a pie", () => {
    expect((readMermaid(`${EXAMPLE}\n%% layout.width: 1100`) as ChartModel).layout).toEqual({ width: "1100" });
    expect((readMermaid('pie\n  "a" : 1\n%% layout.width: full') as ChartModel).layout).toEqual({ width: "full" });
    expect((readMermaid(`${EXAMPLE}\n%% layout.width: 80%`) as ChartModel).layout).toEqual({ width: "80%" });
    expect((readMermaid(EXAMPLE) as ChartModel).layout).toBeUndefined();
  });

  it("written after the chart's own comments, once, the other comments kept; none written where the layout has none", () => {
    const previous = `${EXAMPLE}\n%% layout.width: 900\n%% a note of the user's`;
    const model = readMermaid(previous) as ChartModel;
    const written = writeMermaid({ ...model, layout: { width: "1100" } }, previous);
    expect(written.match(/%% layout\./g)).toHaveLength(1);
    expect(written).toContain("%% layout.width: 1100");
    expect(written).toContain("%% a note of the user's");
    expect((readMermaid(written) as ChartModel).layout).toEqual({ width: "1100" });
    const { layout: _, ...without } = model;
    expect(writeMermaid(without, previous)).not.toContain("layout.");
  });
});
