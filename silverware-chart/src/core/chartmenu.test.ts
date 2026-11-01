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
    candidates: async () => [],
    rewrite: vi.fn(async () => {}),
    pick: vi.fn(async () => {}),
    convert: vi.fn(async () => {}),
    editSource: vi.fn(async () => {}),
    copyImage: () => undefined,
    ...over,
  };
}

describe("the chart's menu", () => {
  it("offers Type, Data, Edit source and Copy as image; Convert only where there is another format", () => {
    expect(chartMenu(host(), entry).items?.map((i) => i.label)).toEqual(["Type", "Data", "Edit source", "Copy as image"]);
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
  });

  it("lists the page's tables, then their columns: the text one as labels, the number ones ticked", async () => {
    const h = host({ candidates: async () => [{ label: "Table above", table: "above", columns: [{ name: "Month", numeric: false }, { name: "Qty", numeric: true }] }] });
    const opened: unknown[] = [];
    const menu = { close: vi.fn(), open: (view: unknown) => opened.push(view) };
    const list = chartMenu(h, entry).items![1]!.open!().element!(menu);
    await vi.waitFor(() => expect(list.querySelectorAll("button")).toHaveLength(1));
    list.querySelector("button")!.click();
    const form = (opened[0] as { element(m: typeof menu): HTMLElement }).element(menu);
    expect(form.querySelector("select")!.value).toBe("Month");
    expect([...form.querySelectorAll<HTMLInputElement>("input")].map((box) => box.checked)).toEqual([false, true]);
    form.querySelector<HTMLButtonElement>(".swc-menu-apply")!.click();
    expect(h.pick).toHaveBeenCalledWith(entry, { table: "above", x: "Month", series: ["Qty"] });
  });
});
