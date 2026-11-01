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
        { name: "avg", kind: "line", values: [48.1, 41.5, 45.7] },
        { name: "p95", kind: "line", values: [112.2, 75.3, 103] },
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
      [undefined, "bar"],
      [undefined, "line"],
    ]);
  });

  it("reads a pie, its title on its head or a line of its own", () => {
    const pie = { type: "pie", title: "Pets", labels: ["Dogs", "Cats"], series: [{ values: [386, 85] }] };
    expect(readMermaid('pie title Pets\n  "Dogs" : 386\n  "Cats" : 85')).toEqual(pie);
    expect(readMermaid('pie showData\n  title Pets\n  "Dogs" : 386\n  "Cats" : 85')).toEqual(pie);
  });

  it("reads our comments into the model, the keys it has no field for kept", () => {
    const model = readMermaid(`${EXAMPLE}\n%% chart.type: area\n%% chart.stacked: true\n%% chart.colors: #111, #222\n%% chart.legend: bottom\n%% chart.source: [[Data]]sales\n%% chart.x: month\n%% chart.series: revenue, cost\n%% chart.later: 1`) as ChartModel;
    expect(model).toMatchObject({
      type: "area",
      stacked: true,
      colors: ["#111", "#222"],
      legend: "bottom",
      source: { table: "[[Data]]sales", x: "month", series: ["revenue", "cost"] },
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
    const model: ChartModel = { type: "doughnut", title: "Pets", labels: ["Dogs", "Cats"], series: [{ values: [3, null] }], legend: "right", source: { table: "pets", x: "kind", series: ["count"] } };
    expect(writeMermaid(model)).toBe(`pie title Pets
  "Dogs" : 3
  "Cats" : 0
%% chart.type: doughnut
%% chart.legend: right
%% chart.source: pets
%% chart.x: kind
%% chart.series: count`);
  });

  it("writes a type only where the series do not say it", () => {
    const area: ChartModel = { type: "area", labels: ["a"], series: [{ values: [1] }] };
    expect(writeMermaid(area)).toBe('xychart-beta\n  x-axis ["a"]\n  line [1]\n%% chart.type: area');
    expect(writeMermaid({ ...area, type: "line" })).toBe('xychart-beta\n  x-axis ["a"]\n  line [1]');
  });

  it("keeps the previous block's own comments: directives first, the others after", () => {
    const previous = `%%{init: {"theme": "dark"}}%%\n${EXAMPLE}\n%% chart.type: area\n%% a note`;
    const written = writeMermaid(readMermaid(previous) as ChartModel, previous);
    expect(written.split("\n")[0]).toBe('%%{init: {"theme": "dark"}}%%');
    expect(written.endsWith("%% chart.type: area\n%% a note")).toBe(true);
  });
});
