// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MERMAID_FORMAT } from "../formats/mermaid.ts";
import { commonSettings } from "../modules/settings.ts";
import { BAR, LINE } from "../types/xy.ts";
import { PIE } from "../types/round.ts";
import type { ChartModel } from "./model.ts";
import { openSettings } from "./settingsdialog.ts";
import type { ChartType } from "./type.ts";

const SETTINGS = commonSettings((i) => ["#111111", "#222222", "#333333"][i % 3]!);
const BARS: ChartModel = { type: "bar", title: "Sales", labels: ["Oct", "Nov"], series: [{ name: "revenue", values: [1, 2] }, { name: "cost", kind: "line", values: [3, 4] }] };

function open(model: ChartModel, type: ChartType, format = MERMAID_FORMAT) {
  const save = vi.fn(async (_change: (model: ChartModel) => ChartModel) => {});
  openSettings(document, { model, type, format, settings: SETTINGS, save });
  const dialog = document.querySelector<HTMLElement>(".swc-settings")!;
  const tabs = [...dialog.querySelectorAll(".swc-settings-tab")].map((t) => t.textContent);
  const labels = (tab: string) => [...dialog.querySelectorAll(`[data-swc-panel="${tab}"] .swc-settings-name`)].map((n) => n.textContent);
  const saved = async () => {
    dialog.querySelector<HTMLButtonElement>(".swc-settings-save")!.click();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    return save.mock.calls[0]![0](model);
  };
  return { dialog, tabs, labels, saved, save };
}

afterEach(() => document.querySelector(".swc-settings-backdrop")?.remove());

describe("the settings dialog", () => {
  it("shows the settings a bar chart has, on their tabs: smooth where a series is a line", () => {
    const { tabs, labels } = open(BARS, BAR);
    expect(tabs).toEqual(["General", "Axes", "Series"]);
    expect(labels("General")).toEqual(["Title", "Height", "Legend", "Stacked", "Horizontal", "Smooth lines"]);
    document.querySelector(".swc-settings-backdrop")?.remove();
    expect(open({ ...BARS, series: [{ values: [1] }] }, BAR).labels("General")).not.toContain("Smooth lines");
  });

  it("shows a pie's slices' colors and no axes, a line chart no Horizontal", () => {
    const pie = open({ type: "pie", labels: ["Dogs", "Cats"], series: [{ values: [3, 1] }] }, PIE);
    expect(pie.tabs).toEqual(["General", "Slices"]);
    expect(pie.labels("General")).toEqual(["Title", "Height", "Legend"]);
    expect([...pie.dialog.querySelectorAll(".swc-settings-item-name")].map((n) => n.textContent)).toEqual(["Dogs", "Cats"]);
    document.querySelector(".swc-settings-backdrop")?.remove();
    expect(open({ ...BARS, type: "line" }, LINE).labels("General")).not.toContain("Horizontal");
  });

  it("writes what was changed, once saved: the chart's settings, a series' kind, an axis' range", async () => {
    const { dialog, saved } = open(BARS, BAR);
    const field = (tab: string, name: string) => [...dialog.querySelectorAll(`[data-swc-panel="${tab}"] .swc-settings-row`)].find((row) => row.querySelector(".swc-settings-name")?.textContent === name)!;
    const switchOf = (name: string) => field("General", name).querySelector<HTMLInputElement>("input")!;
    switchOf("Stacked").click();
    const title = field("General", "Title").querySelector<HTMLInputElement>("input")!;
    title.value = "";
    title.dispatchEvent(new Event("input"));
    const from = field("Axes", "Y axis from").querySelector<HTMLInputElement>("input")!;
    from.value = "0";
    from.dispatchEvent(new Event("input"));
    const kinds = [...dialog.querySelectorAll<HTMLSelectElement>(".swc-settings-item select")];
    expect(kinds.map((k) => k.value)).toEqual(["bar", "line"]);
    kinds[0]!.value = "area";
    kinds[0]!.dispatchEvent(new Event("change"));
    kinds[1]!.value = "bar";
    kinds[1]!.dispatchEvent(new Event("change"));
    expect(await saved()).toEqual({ type: "bar", stacked: true, y: { min: 0 }, labels: ["Oct", "Nov"], series: [{ name: "revenue", kind: "area", values: [1, 2] }, { name: "cost", values: [3, 4] }] });
  });

  it("writes every series' color once one is picked, the others as they show", async () => {
    const { dialog, saved } = open(BARS, BAR);
    const color = dialog.querySelector<HTMLInputElement>(".swc-settings-item input[type=color]")!;
    color.value = "#ff0000";
    color.dispatchEvent(new Event("input"));
    expect((await saved()).colors).toEqual(["#ff0000", "#222222"]);
  });

  it("shows a chart of a table its source on Data and every column on Series, drawn or not", async () => {
    const model: ChartModel = { ...BARS, series: [{ name: "Revenue", values: [1, 2] }], source: { table: "above", x: "Month", series: ["Revenue"] } };
    const columns = [{ name: "Month", numeric: false }, { name: "Revenue", numeric: true }, { name: "Cost", numeric: true }];
    const save = vi.fn(async (_change: (model: ChartModel) => ChartModel) => {});
    openSettings(document, { model, type: BAR, format: MERMAID_FORMAT, settings: SETTINGS, columns, tab: "Data", save });
    const dialog = document.querySelector<HTMLElement>(".swc-settings")!;
    expect([...dialog.querySelectorAll(".swc-settings-tab")].map((t) => t.textContent)).toEqual(["General", "Data", "Axes", "Series"]);
    expect(dialog.querySelector<HTMLElement>('[data-swc-panel="Data"]')!.hidden).toBe(false);
    expect([...dialog.querySelectorAll('[data-swc-panel="Data"] .swc-settings-name')].map((n) => n.textContent)).toEqual(["Labels", "Rows", "How many rows", "Only where"]);
    // Every column a row: Revenue drawn, the others not
    const rows = [...dialog.querySelectorAll<HTMLElement>(".swc-settings-item")];
    expect(rows.map((r) => r.querySelector(".swc-settings-item-name")!.textContent)).toEqual(["Month", "Revenue", "Cost"]);
    expect(rows.map((r) => r.querySelector<HTMLInputElement>(".swc-settings-switch input")!.checked)).toEqual([false, true, false]);
    // Cost drawn too, as a line; the last 2 rows where Cost > 80
    rows[2]!.querySelector<HTMLInputElement>(".swc-settings-switch input")!.click();
    const kind = rows[2]!.querySelector<HTMLSelectElement>("select")!;
    kind.value = "line";
    kind.dispatchEvent(new Event("change"));
    const data = dialog.querySelector('[data-swc-panel="Data"]')!;
    const [, rowsFrom] = [...data.querySelectorAll<HTMLSelectElement>(".swc-settings-row > select")];
    rowsFrom!.value = "last";
    rowsFrom!.dispatchEvent(new Event("change"));
    const count = data.querySelector<HTMLInputElement>("input[type=number]")!;
    count.value = "2";
    count.dispatchEvent(new Event("input"));
    data.querySelector<HTMLButtonElement>(".swc-settings-add")!.click();
    const [column, op] = [...data.querySelectorAll<HTMLSelectElement>(".swc-settings-condition select")];
    column!.value = "Cost";
    column!.dispatchEvent(new Event("change"));
    op!.value = ">";
    op!.dispatchEvent(new Event("change"));
    const value = data.querySelector<HTMLInputElement>(".swc-settings-condition input")!;
    value.value = "80";
    value.dispatchEvent(new Event("input"));
    dialog.querySelector<HTMLButtonElement>(".swc-settings-save")!.click();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    const after = save.mock.calls[0]![0](model);
    expect(after.source).toEqual({ table: "above", x: "Month", series: ["Revenue", "Cost"], where: [{ column: "Cost", criterion: "> 80" }], rows: { from: "last", count: 2 } });
    expect(after.series.map((s) => [s.name, s.kind])).toEqual([
      ["Revenue", undefined],
      ["Cost", "line"],
    ]);
  });

  it("lets a pie of a table pick the column it draws: the one switched on in place of the other", async () => {
    const model: ChartModel = { type: "pie", labels: ["Oct", "Nov"], series: [{ values: [1, 2] }], colors: ["#aa0000", "#00aa00"], source: { table: "above", x: "Month", series: ["Revenue"] } };
    const columns = [{ name: "Month", numeric: false }, { name: "Revenue", numeric: true }, { name: "Cost", numeric: true }];
    const save = vi.fn(async (_change: (model: ChartModel) => ChartModel) => {});
    openSettings(document, { model, type: PIE, format: MERMAID_FORMAT, settings: SETTINGS, columns, save });
    const dialog = document.querySelector<HTMLElement>(".swc-settings")!;
    const rows = [...dialog.querySelectorAll<HTMLElement>('[data-swc-panel="Series"] .swc-settings-item')];
    expect(rows.map((r) => r.querySelector(".swc-settings-item-name")!.textContent)).toEqual(["Month", "Revenue", "Cost"]);
    rows[2]!.querySelector<HTMLInputElement>(".swc-settings-switch input")!.click();
    dialog.querySelector<HTMLButtonElement>(".swc-settings-save")!.click();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    const after = save.mock.calls[0]![0](model);
    expect(after.source?.series).toEqual(["Cost"]);
    // The slices' colors kept
    expect(after.colors).toEqual(["#aa0000", "#00aa00"]);
  });

  it("shows, not offers, what the block's format cannot write", () => {
    const { dialog } = open(BARS, BAR, { ...MERMAID_FORMAT, label: "Plain", supports: (key) => key !== "stacked" });
    const row = [...dialog.querySelectorAll(".swc-settings-row")].find((r) => r.textContent?.includes("Stacked"))!;
    expect(row.querySelector<HTMLInputElement>("input")!.disabled).toBe(true);
    expect(row.textContent).toContain("The series on top of each other");
  });
});
