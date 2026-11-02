// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { MERMAID_FORMAT } from "../formats/mermaid.ts";
import { BUILTIN_TYPES } from "../types/index.ts";
import { type ChartMenuHost, chartMenu } from "./chartmenu.ts";
import type { Drawn } from "./drawn.ts";
import type { ChartModel } from "./model.ts";

const MODEL: ChartModel = { type: "bar", stacked: true, labels: ["a"], series: [{ values: [1] }] };
const entry = { model: MODEL, format: MERMAID_FORMAT } as unknown as Drawn;

function host(over: Partial<ChartMenuHost> = {}): ChartMenuHost {
  return {
    doc: document,
    types: () => BUILTIN_TYPES,
    formats: () => [MERMAID_FORMAT],
    palette: () => ["#111111", "#222222"],
    candidates: async () => [],
    rewrite: vi.fn(async () => {}),
    pick: vi.fn(async () => {}),
    convert: vi.fn(async () => {}),
    editSource: vi.fn(async () => {}),
    copySource: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    copyImage: () => undefined,
    ...over,
  };
}

describe("the chart's menu", () => {
  it("offers Type, Data, Edit source and Copy as image; Convert only where there is another format", () => {
    expect(chartMenu(host(), entry).items?.map((i) => i.label)).toEqual(["Type", "Series", "Data", "Edit source", "Copy source", "Copy as image", "Reload"]);
    expect(chartMenu(host(), entry).items?.find((i) => i.label === "Copy as image")?.disabled).toBeTruthy();
    const other = { ...MERMAID_FORMAT, name: "obsidian", label: "Obsidian Charts" };
    expect(chartMenu(host({ formats: () => [MERMAID_FORMAT, other] }), entry).items?.map((i) => i.label)).toContain("Convert to Obsidian Charts");
  });

  it("shows the types and their variants, the chart's marked, and writes the one picked with its flags", async () => {
    const h = host();
    const type = chartMenu(h, entry).items![0]!.open!();
    expect(type.tiles).toBe(true);
    expect(type.items?.filter((i) => i.checked).map((i) => i.label)).toEqual(["Stacked bar"]);
    await type.items!.find((i) => i.label === "Horizontal bar")!.run!();
    const change = (h.rewrite as ReturnType<typeof vi.fn>).mock.calls[0]![1] as (model: ChartModel) => ChartModel;
    expect(change(MODEL)).toEqual({ type: "bar", horizontal: true, labels: ["a"], series: [{ values: [1] }] });
    // A series' own kind given up: the chart drawn all as the type picked
    await type.items!.find((i) => i.label === "Line")!.run!();
    const toLine = (h.rewrite as ReturnType<typeof vi.fn>).mock.calls[1]![1] as (model: ChartModel) => ChartModel;
    expect(toLine({ ...MODEL, series: [{ kind: "bar", values: [1] }, { kind: "line", values: [2] }] }).series).toEqual([{ values: [1] }, { values: [2] }]);
  });

  it("sets each series' name, kind and color; a kind the chart's type has is written as none", async () => {
    const h = host();
    const model: ChartModel = { type: "bar", labels: ["a"], series: [{ name: "one", values: [1] }, { name: "two", kind: "line", values: [2] }] };
    const view = chartMenu(h, { ...entry, model } as Drawn).items!.find((i) => i.label === "Series")!.open!();
    const form = view.element!({ close: vi.fn(), open: vi.fn() });
    const [first, second] = [...form.querySelectorAll(".swc-menu-series")];
    expect([...form.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.value)).toEqual(["bar", "line"]);
    first!.querySelector<HTMLSelectElement>("select")!.value = "line";
    second!.querySelector<HTMLSelectElement>("select")!.value = "bar";
    second!.querySelector<HTMLInputElement>("input[type=text]")!.value = "Two";
    form.querySelector<HTMLButtonElement>(".swc-menu-apply")!.click();
    const change = (h.rewrite as ReturnType<typeof vi.fn>).mock.calls[0]![1] as (model: ChartModel) => ChartModel;
    expect(change(model)).toEqual({ ...model, series: [{ name: "one", kind: "line", values: [1] }, { name: "Two", values: [2] }] });
    // A color picked: every series' color written
    first!.querySelector<HTMLInputElement>("input[type=color]")!.value = "#ff0000";
    form.querySelector<HTMLButtonElement>(".swc-menu-apply")!.click();
    const colored = (h.rewrite as ReturnType<typeof vi.fn>).mock.calls[1]![1] as (model: ChartModel) => ChartModel;
    expect(colored(model).colors).toEqual(["#ff0000", "#222222"]);
  });

  it("lists the page's tables, then their columns: the text one as labels, the number ones ticked", async () => {
    const h = host({ candidates: async () => [{ label: "Table above", table: "above", columns: [{ name: "Month", numeric: false }, { name: "Qty", numeric: true }] }] });
    const opened: unknown[] = [];
    const menu = { close: vi.fn(), open: (view: unknown) => opened.push(view) };
    const list = chartMenu(h, entry).items!.find((i) => i.label === "Data")!.open!().element!(menu);
    await vi.waitFor(() => expect(list.querySelectorAll("button")).toHaveLength(1));
    list.querySelector("button")!.click();
    const form = (opened[0] as { element(m: typeof menu): HTMLElement }).element(menu);
    expect(form.querySelector("select")!.value).toBe("Month");
    expect([...form.querySelectorAll<HTMLInputElement>("input")].map((box) => box.checked)).toEqual([false, true]);
    form.querySelector<HTMLButtonElement>(".swc-menu-apply")!.click();
    expect(h.pick).toHaveBeenCalledWith(entry, { table: "above", x: "Month", series: ["Qty"] });
  });
});
