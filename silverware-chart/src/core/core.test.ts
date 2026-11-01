// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODULE_NAMES, type ModuleName } from "../bridge.ts";
import { customFormatsAnew, defineCustomFormats, formatsOf } from "../custom.ts";
import { start } from "../index.ts";
import { numberOf, textsOf } from "../modules/tables.ts";
import type { Controller } from "./controller.ts";
import type { ChartConfig } from "./type.ts";

// Chart.js stood in for: what it was made with, and each update
const made: { canvas: HTMLCanvasElement; config: ChartConfig; updates: number; destroyed: boolean; data: unknown; options: unknown }[] = [];
class FakeChart {
  data: unknown;
  options: unknown;
  private readonly entry: (typeof made)[number];
  constructor(canvas: HTMLCanvasElement, config: ChartConfig) {
    this.data = config.data;
    this.options = config.options;
    this.entry = { canvas, config, updates: 0, destroyed: false, data: config.data, options: config.options };
    made.push(this.entry);
  }
  update() {
    this.entry.updates++;
    this.entry.data = this.data;
  }
  destroy() {
    this.entry.destroyed = true;
  }
}

const SALES = `| Month | Revenue |
|---|--:|
| Oct | 120 |
| Nov | 140 |
| <meta core.table core.name='sales'> |`;

const CHART = `xychart-beta
  x-axis ["Oct", "Nov"]
  bar "revenue" [1, 2]
%% chart.source: sales
%% chart.x: month
%% chart.series: revenue`;

// Silverware Table's evaluate stood in for: a column of the sales table on the text given
function evaluate(formula: string, text: string): Promise<string> {
  const rows = text
    .split("\n")
    .filter((line) => /^\| (Oct|Nov|Dec) \|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()));
  if (formula === "=sales![month]") return Promise.resolve(JSON.stringify(rows.map((r) => r[1])));
  if (formula === "=sales![revenue]") return Promise.resolve(JSON.stringify(rows.map((r) => r[2])));
  return Promise.resolve("#REF!");
}

function controller(modules: readonly ModuleName[] = MODULE_NAMES, text = `${SALES}\n\n\`\`\`mermaid\n${CHART}\n\`\`\``): Controller {
  return start(
    document,
    { modules: new Set(modules), height: "300px" },
    {
      getText: async () => text,
      getCurrentPage: async () => "Sales",
      readPage: async () => text,
      loadChart: async () => FakeChart as never,
      table: { evaluate },
    },
  );
}

beforeEach(() => {
  made.length = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  customFormatsAnew();
  defineCustomFormats([]);
});

describe("the core", () => {
  it("draws a Mermaid chart, its type's configuration with the block's data", async () => {
    const box = await controller().render("mermaid", 'pie title Pets\n  "Dogs" : 3\n  "Cats" : 1', "Sales");
    expect(box?.className).toBe("swc-chart");
    expect(box?.style.height).toBe("300px");
    expect(made[0]?.config).toMatchObject({ type: "pie", data: { labels: ["Dogs", "Cats"], datasets: [{ data: [3, 1] }] } });
  });

  it("hands on what no format reads as a chart, and says why it cannot draw what it reads", async () => {
    const core = controller();
    expect(await core.render("mermaid", "flowchart LR\n  A --> B", "Sales")).toBeUndefined();
    expect((await core.render("mermaid", "xychart-beta\n  bar 1", "Sales"))?.textContent).toBe('Silverware Chart: "bar 1" has no values in [ ]');
    expect((await core.render("mermaid", 'pie\n  "a" : 1\n%% chart.type: sunburst', "Sales"))?.textContent).toBe('Silverware Chart: no chart type "sunburst"');
  });

  it("reads the languages of the formats on", () => {
    expect(controller().languages()).toEqual(["mermaid"]);
    expect(controller(["types", "tables"]).languages()).toEqual([]);
  });

  it("draws a table's columns in place of the block's data", async () => {
    await controller().render("mermaid", CHART, "Sales");
    expect(made[0]?.config.data).toMatchObject({ labels: ["Oct", "Nov"], datasets: [{ label: "revenue", data: [120, 140] }] });
  });

  it("says what is wrong with its table", async () => {
    const box = await controller().render("mermaid", CHART.replace("revenue\n", "profit\n").replace("chart.series: revenue", "chart.series: profit"), "Sales");
    expect(box?.textContent).toBe("Silverware Chart: sales![profit] is #REF! (is there a table named sales with a column profit?)");
  });

  it("follows its table as the page is edited, once the edits pause, drawn in place", async () => {
    const core = controller();
    const box = await core.render("mermaid", CHART, "Sales");
    document.body.append(box!);
    core.pageModified(`${SALES.replace("| 140 |", "| 300 |")}\n\n${CHART}`, "Sales");
    await vi.advanceTimersByTimeAsync(50);
    expect(made[0]?.updates).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(made[0]?.updates).toBe(1);
    expect((made[0]?.data as ChartConfig["data"]).datasets[0]?.data).toEqual([120, 300]);
    // Another page's edit is not its
    core.pageModified("", "Other");
    await vi.advanceTimersByTimeAsync(200);
    expect(made[0]?.updates).toBe(1);
  });

  it("draws the block's own data without the tables module", async () => {
    await controller(["mermaid", "types"]).render("mermaid", CHART, "Sales");
    expect(made[0]?.config.data.datasets[0]?.data).toEqual([1, 2]);
  });

  it("destroys a chart whose element is gone, or was never shown", async () => {
    const core = controller();
    const shown = await core.render("mermaid", CHART, "Sales");
    await core.render("mermaid", CHART, "Sales");
    document.body.append(shown!);
    core.pageModified(SALES, "Sales");
    await vi.advanceTimersByTimeAsync(200);
    shown!.remove();
    vi.setSystemTime(Date.now() + 20_000);
    core.pageModified(SALES, "Sales");
    await vi.advanceTimersByTimeAsync(200);
    expect(made.map((m) => m.destroyed)).toEqual([true, true]);
  });
});

describe("custom formats", () => {
  const CSV = {
    name: "csv",
    label: "CSV",
    languages: "csvchart",
    read: (text: string) => ({ type: "bar", labels: text.split(",").map((t) => t.trim()), series: [{ values: [1, 2] }] }),
    write: () => "a, b",
  };

  it("are checked, and drawn as the built-in ones", async () => {
    const { formats, problems } = formatsOf([CSV, { name: "1bad" }, { name: "noread", languages: ["x"] }]);
    expect(problems).toEqual(['format 1bad: its name "1bad" is not letters, digits and _ starting with a letter', "format noread: its read is not a function"]);
    defineCustomFormats(formats);
    const core = controller();
    expect(core.languages()).toEqual(["csvchart", "mermaid"]);
    await core.render("csvchart", "a, b", "Sales");
    expect(made[0]?.config.data.labels).toEqual(["a", "b"]);
  });

  it("are given the helpers where a function stands for them, and say what they gave wrong", async () => {
    const { formats } = formatsOf((helpers: { readMermaid: unknown }) => [{ ...CSV, read: () => ({ type: "bar", labels: "x", series: [] }), helpers: typeof helpers.readMermaid }]);
    defineCustomFormats(formats);
    expect((await controller().render("csvchart", "", "Sales"))?.textContent).toBe("Silverware Chart: the format csv gave labels that are not a list");
  });
});

describe("the tables module's reading", () => {
  it("takes one value or a list as evaluate gives them", () => {
    expect(textsOf('["a","b"]')).toEqual(["a", "b"]);
    expect(textsOf("12")).toEqual(["12"]);
    expect(textsOf("[not json")).toEqual(["[not json"]);
  });

  it("reads numbers with their units and a decimal comma", () => {
    expect([numberOf("12"), numberOf("12,99 €"), numberOf("1,234.5"), numberOf("$ -3"), numberOf("n/a"), numberOf("")]).toEqual([12, 12.99, 1234.5, -3, null, null]);
  });
});
