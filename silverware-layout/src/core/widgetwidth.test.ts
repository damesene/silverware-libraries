import { describe, expect, it } from "vitest";
import type { Guide } from "../model/settings.ts";
import { cssWidgetWidth, draggedWidth, keptWidgetWidth, readWidgetWidth, shownWidgetWidth, snapped, snapTargets, widthName } from "./widgetwidth.ts";

const guides: Guide[] = [1200, "full"];

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

  it("snapped to the text's width (kept: none), a guide of pixels or full, within 8 px", () => {
    const targets = snapTargets(760, guides, 1600);
    expect(targets.map((t) => [t.name, t.width, t.kept])).toEqual([
      ["Text width", 760, undefined],
      ["1200 px", 1200, 1200],
      ["Full width", 1560, "full"],
    ]);
    expect(snapped(765, targets)).toEqual({ width: 760, kept: undefined, name: "Text width" });
    expect(snapped(1193, targets)).toEqual({ width: 1200, kept: 1200, name: "1200 px" });
    expect(snapped(1555, targets)).toEqual({ width: 1560, kept: "full", name: "Full width" });
    expect(snapped(900.4, targets)).toEqual({ width: 900, kept: 900 });
  });

  it("a guide wider than the pane snaps where it is shown", () => {
    expect(snapTargets(760, guides, 1000).find((t) => t.name === "1200 px")).toEqual({ width: 960, kept: 1200, name: "1200 px" });
  });

  it("named: the text's width, a guide's pixels, Full width", () => {
    expect([undefined, 1200, "full" as const].map(widthName)).toEqual(["Text width", "1200 px", "Full width"]);
  });
});
