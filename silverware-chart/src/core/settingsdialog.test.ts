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

  it("shows, not offers, what the block's format cannot write", () => {
    const { dialog } = open(BARS, BAR, { ...MERMAID_FORMAT, label: "Plain", supports: (key) => key !== "stacked" });
    const row = [...dialog.querySelectorAll(".swc-settings-row")].find((r) => r.textContent?.includes("Stacked"))!;
    expect(row.querySelector<HTMLInputElement>("input")!.disabled).toBe(true);
    expect(row.textContent).toContain("The series on top of each other");
  });
});
