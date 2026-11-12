import { describe, expect, it } from "vitest";
import type { Preset } from "../model/settings.ts";
import { cssWidgetWidth, draggedWidth, keptWidgetWidth, namedWidths, readWidgetWidth, shownWidgetWidth, snapped, snapTargets } from "./widgetwidth.ts";

const presets: Preset[] = [
  { name: "Wide", width: { amount: 1200, unit: "px" } },
  { name: "Half", width: { amount: 50, unit: "%" } },
  { name: "Full width", width: "full" },
];

describe("A widget's width", () => {
  it("read from its entries: pixels, or full; nothing else", () => {
    expect(readWidgetWidth("1200")).toBe(1200);
    expect(readWidgetWidth(" 1200px ")).toBe(1200);
    expect(readWidgetWidth("1199.6")).toBe(1200);
    expect(readWidgetWidth("full")).toBe("full");
    for (const value of [undefined, "", "wide", "90%", "0", "-5"]) expect(readWidgetWidth(value), String(value)).toBeUndefined();
  });

  it("kept as text, given to CSS as pixels or the pane's width", () => {
    expect(keptWidgetWidth(1200)).toBe("1200");
    expect(keptWidgetWidth("full")).toBe("full");
    expect(cssWidgetWidth(1200)).toBe("1200px");
    expect(cssWidgetWidth("full")).toBe("100cqw");
  });

  it("shown at most as wide as the pane less its gutter", () => {
    expect(shownWidgetWidth(1200, 1600)).toBe(1200);
    expect(shownWidgetWidth(1200, 1000)).toBe(960);
    expect(shownWidgetWidth("full", 1600)).toBe(1560);
  });

  it("dragged: twice the distance (centred), not under 200 px nor past the pane", () => {
    expect(draggedWidth(760, 100, 1600)).toBe(960);
    expect(draggedWidth(760, -400, 1600)).toBe(200);
    expect(draggedWidth(760, 900, 1600)).toBe(1560);
  });

  it("snapped to the text's width (kept: none), a preset of pixels or full (a preset in % left out), within 8 px", () => {
    const targets = snapTargets(760, presets, 1600);
    expect(targets.map((t) => [t.name, t.width, t.kept])).toEqual([
      ["Text width", 760, undefined],
      ["Wide", 1200, 1200],
      ["Full width", 1560, "full"],
    ]);
    expect(snapped(765, targets)).toEqual({ width: 760, kept: undefined, name: "Text width" });
    expect(snapped(1193, targets)).toEqual({ width: 1200, kept: 1200, name: "Wide" });
    expect(snapped(1555, targets)).toEqual({ width: 1560, kept: "full", name: "Full width" });
    expect(snapped(900.4, targets)).toEqual({ width: 900, kept: 900 });
  });

  it("a preset wider than the pane snaps where it is shown", () => {
    expect(snapTargets(760, presets, 1000).find((t) => t.name === "Wide")).toEqual({ width: 960, kept: 1200, name: "Wide" });
  });

  it("named: the text's width, then each preset of pixels or full (one in % is no widget's width)", () => {
    expect(namedWidths(presets)).toEqual([
      { kept: undefined, name: "Text width" },
      { kept: 1200, name: "Wide" },
      { kept: "full", name: "Full width" },
    ]);
  });
});
