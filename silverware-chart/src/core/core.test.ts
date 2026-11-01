// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODULE_NAMES, type ModuleName } from "../bridge.ts";
import { customFormatsAnew, defineCustomFormats, formatsOf } from "../custom.ts";
import { start } from "../index.ts";
import { tablesOf } from "../sources/markdown.ts";
import type { Controller } from "./controller.ts";
import type { NamedTable, TableApi, TextEdit } from "./module.ts";
import type { ChartConfig } from "./type.ts";

// Chart.js stood in for: what it was made with, and each update
type Made = { canvas: HTMLCanvasElement; config: ChartConfig; updates: number; destroyed: boolean; data: unknown };
const made: Made[] = [];
class FakeChart {
  data: unknown;
  options: unknown;
  private readonly entry: Made;
  constructor(canvas: HTMLCanvasElement, config: ChartConfig) {
    this.data = config.data;
    this.options = config.options;
    this.entry = { canvas, config, updates: 0, destroyed: false, data: config.data };
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

const chart = (source: string, values = "120, 140") => `xychart-beta
  x-axis ["Oct", "Nov"]
  bar "revenue" [${values}]
%% chart.source: ${source}
%% chart.x: month
%% chart.series: revenue`;

const page = (block: string, table = SALES) => `# Sales\n\n${table}\n\n\`\`\`mermaid\n${block}\n\`\`\`\n`;

// Silverware Table stood in for: its tables of a text (names from its metadata row, as it reads them), the write listener given
let listener: ((text: string) => Promise<readonly TextEdit[]>) | undefined;
const TABLE_API: TableApi = {
  tables: async (text) =>
    tablesOf(text).map((t): NamedTable => {
      const name = /core\.name='([^']+)'/.exec(text.slice(t.from, t.to + 60))?.[1];
      return { ...t, ...(name ? { name } : {}) };
    }),
  onWrite: (fn) => void (listener = fn),
};

const writes: TextEdit[] = [];
function controller(text: string, modules: readonly ModuleName[] = MODULE_NAMES, table: TableApi | null = TABLE_API): Controller {
  return start(
    document,
    { modules: new Set(modules), height: "300px" },
    {
      getText: async () => text,
      getCurrentPage: async () => "Sales",
      readPage: async (name) => (name === "Other" ? "## Costs\n\n| Month | Cost |\n|---|---|\n| Oct | 5 |\n" : text),
      replaceRange: async (from, to, inserted) => void writes.push({ from, to, text: inserted }),
      loadChart: async () => FakeChart as never,
      table: table ?? undefined,
    },
  );
}

const dataOf = (i = 0) => made[i]?.config.data.datasets.map((d) => d.data);

beforeEach(() => {
  made.length = 0;
  writes.length = 0;
  listener = undefined;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  customFormatsAnew();
  defineCustomFormats([]);
});

describe("the core", () => {
  it("draws a Mermaid chart, its type's configuration with the block's data", async () => {
    const box = await controller("").render("mermaid", 'pie title Pets\n  "Dogs" : 3\n  "Cats" : 1', "Sales");
    expect(box?.className).toBe("swc-chart");
    expect(box?.style.height).toBe("300px");
    expect(made[0]?.config).toMatchObject({ type: "pie", data: { labels: ["Dogs", "Cats"], datasets: [{ data: [3, 1] }] } });
  });

  it("hands on what no format reads as a chart, and says why it cannot draw what it reads", async () => {
    const core = controller("");
    expect(await core.render("mermaid", "flowchart LR\n  A --> B", "Sales")).toBeUndefined();
    expect((await core.render("mermaid", "xychart-beta\n  bar 1", "Sales"))?.textContent).toBe('Silverware Chart: "bar 1" has no values in [ ]');
    expect((await core.render("mermaid", 'pie\n  "a" : 1\n%% chart.type: sunburst', "Sales"))?.textContent).toBe('Silverware Chart: no chart type "sunburst"');
  });

  it("reads the languages of the formats on", () => {
    expect(controller("").languages()).toEqual(["mermaid"]);
    expect(controller("", ["types", "tables"]).languages()).toEqual([]);
  });

  it("destroys a chart whose element is gone, or was never shown", async () => {
    const block = chart("above");
    const core = controller(page(block));
    const shown = await core.render("mermaid", block, "Sales");
    await core.render("mermaid", block, "Sales");
    document.body.append(shown!);
    core.pageModified(page(block), "Sales");
    await vi.advanceTimersByTimeAsync(200);
    shown!.remove();
    vi.setSystemTime(Date.now() + 20_000);
    core.pageModified(page(block), "Sales");
    await vi.advanceTimersByTimeAsync(200);
    expect(made.map((m) => m.destroyed)).toEqual([true, true]);
  });
});

describe("a markdown table as the source (the tables module)", () => {
  it("finds the table above, below, under a heading, on another page", async () => {
    const above = chart("above", "1, 2");
    await controller(page(above)).render("mermaid", above, "Sales");
    expect(dataOf()).toEqual([[120, 140]]);
    const below = chart("below");
    await controller(`\`\`\`mermaid\n${below}\n\`\`\`\n\n${SALES}\n`).render("mermaid", below, "Sales");
    expect(dataOf(1)).toEqual([[120, 140]]);
    const heading = chart("#Sales");
    await controller(page(heading)).render("mermaid", heading, "Sales");
    expect(dataOf(2)).toEqual([[120, 140]]);
    const other = chart("[[Other]]#Costs").replace("revenue\n", "revenue\n").replace("chart.series: revenue", "chart.series: cost");
    await controller(page(other)).render("mermaid", other, "Sales");
    expect(made[3]?.config.data).toMatchObject({ labels: ["Oct"], datasets: [{ data: [5] }] });
  });

  it("says what it cannot find", async () => {
    const core = controller(`# Sales\n\n\`\`\`mermaid\n${chart("above")}\n\`\`\`\n`);
    expect((await core.render("mermaid", chart("above"), "Sales"))?.textContent).toBe("Silverware Chart: no table above the chart");
    const missing = chart("below").replace("chart.series: revenue", "chart.series: profit");
    expect((await controller(`\`\`\`mermaid\n${missing}\n\`\`\`\n\n${SALES}`).render("mermaid", missing, "Sales"))?.textContent).toBe("Silverware Chart: the table below has no column profit (it has Month, Revenue)");
  });

  it("follows its table as the page is edited, once the edits pause, drawn in place", async () => {
    const block = chart("above");
    const core = controller(page(block));
    const box = await core.render("mermaid", block, "Sales");
    document.body.append(box!);
    core.pageModified(page(block, SALES.replace("| 140 |", "| 300 |")), "Sales");
    await vi.advanceTimersByTimeAsync(50);
    expect(made[0]?.updates).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(made[0]?.updates).toBe(1);
    expect((made[0]?.data as ChartConfig["data"]).datasets[0]?.data).toEqual([120, 300]);
    // An edit elsewhere on the page leaves its data as they are: not drawn anew (its animation would start with each key)
    core.pageModified(`Typing here.\n${page(block, SALES.replace("| 140 |", "| 300 |"))}`, "Sales");
    await vi.advanceTimersByTimeAsync(200);
    expect(made[0]?.updates).toBe(1);
    // Another page's edit is not its
    core.pageModified("", "Other");
    await vi.advanceTimersByTimeAsync(200);
    expect(made[0]?.updates).toBe(1);
  });

  it("draws the block's own data without the source modules, and says nothing reads the source", async () => {
    await controller(page(chart("above", "1, 2")), ["mermaid", "types"]).render("mermaid", chart("above", "1, 2"), "Sales");
    expect(made).toHaveLength(0);
    expect((await controller(page(chart("sales")), ["mermaid", "types", "tables"]).render("mermaid", chart("sales"), "Sales"))?.textContent).toBe('Silverware Chart: nothing reads the source "sales"');
  });
});

describe("Stale and Update data", () => {
  it("marks a chart whose block's data are behind its source's, and writes them on request", async () => {
    const block = chart("above", "1, 2");
    const text = page(block);
    const box = await controller(text).render("mermaid", block, "Sales");
    const stale = box?.querySelector<HTMLButtonElement>(".swc-stale");
    expect(stale?.textContent).toBe("Stale: update data");
    stale!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(1);
    const written = text.slice(0, writes[0]!.from) + writes[0]!.text + text.slice(writes[0]!.to);
    expect(written).toBe(page(chart("above")));
  });

  it("is not marked where they are the source's, and loses the mark once they are", async () => {
    const block = chart("above");
    expect((await controller(page(block)).render("mermaid", block, "Sales"))?.querySelector(".swc-stale")).toBeNull();
    const behind = chart("above", "1, 2");
    const core = controller(page(behind));
    const box = await core.render("mermaid", behind, "Sales");
    document.body.append(box!);
    core.pageModified(page(behind, SALES.replace("| 120 |", "| 1 |").replace("| 140 |", "| 2 |")), "Sales");
    await vi.advanceTimersByTimeAsync(200);
    expect(box?.querySelector(".swc-stale")).toBeNull();
    box!.remove();
  });
});

describe("Silverware Table (the silverwareTable module)", () => {
  it("reads a table it named, and none without it", async () => {
    const block = chart("sales");
    await controller(page(block)).render("mermaid", block, "Sales");
    expect(dataOf()).toEqual([[120, 140]]);
    expect((await controller(page(block), MODULE_NAMES, null).render("mermaid", block, "Sales"))?.textContent).toBe('Silverware Chart: nothing reads the source "sales"');
    expect((await controller(page(chart("nope"))).render("mermaid", chart("nope"), "Sales"))?.textContent).toBe("Silverware Chart: no table named nope (named in Silverware Table's ⋯ menu)");
  });

  it("gives the edits that bring the page's charts up to their sources with each of its writes", async () => {
    controller("");
    const text = page(chart("sales", "1, 2")) + `\n\`\`\`mermaid\n${chart("above")}\n\`\`\`\n\n\`\`\`mermaid\n${chart("[[Other]]#Costs")}\n\`\`\`\n`;
    const edits = await listener!(text);
    // The first behind its table; the second as its table is; the third on another page, left out
    expect(edits).toHaveLength(1);
    const written = text.slice(0, edits[0]!.from) + edits[0]!.text + text.slice(edits[0]!.to);
    expect(written).toContain(chart("sales"));
    expect(written).not.toContain('bar "revenue" [1, 2]');
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
    const core = controller("");
    expect(core.languages()).toEqual(["csvchart", "mermaid"]);
    await core.render("csvchart", "a, b", "Sales");
    expect(made[0]?.config.data.labels).toEqual(["a", "b"]);
  });

  it("are given the helpers where a function stands for them, and say what they gave wrong", async () => {
    const { formats } = formatsOf((helpers: { readMermaid: unknown }) => [{ ...CSV, read: () => ({ type: "bar", labels: "x", series: [] }), helpers: typeof helpers.readMermaid }]);
    defineCustomFormats(formats);
    expect((await controller("").render("csvchart", "", "Sales"))?.textContent).toBe("Silverware Chart: the format csv gave labels that are not a list");
  });
});
