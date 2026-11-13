import { describe, expect, it } from "vitest";
import type { Guide } from "../model/settings.ts";
import { cssWidgetWidth, draggedRoomWidth, draggedWidth, keptWidgetWidth, readWidgetWidth, roomTargets, shownWidgetWidth, snapped, snapTargets, widthName } from "./widgetwidth.ts";

const guides: Guide[] = [1200, "80%", "full"];

describe("A widget's width", () => {
  it("read from its entries: pixels, a percent of the pane, or full; nothing else", () => {
    expect(readWidgetWidth("1200")).toBe(1200);
    expect(readWidgetWidth(" 1200px ")).toBe(1200);
    expect(readWidgetWidth("1199.6")).toBe(1200);
    expect(readWidgetWidth("80%")).toBe("80%");
    expect(readWidgetWidth("79.6 %")).toBe("80%");
    expect(readWidgetWidth("full")).toBe("full");
    for (const value of [undefined, "", "wide", "0", "-5", "0%", "120%"]) expect(readWidgetWidth(value), String(value)).toBeUndefined();
  });

  it("kept as text, given to CSS as pixels, a share of the pane's width or the pane's width", () => {
    expect(keptWidgetWidth(1200)).toBe("1200");
    expect(keptWidgetWidth("80%")).toBe("80%");
    expect(keptWidgetWidth("full")).toBe("full");
    expect(cssWidgetWidth(1200)).toBe("1200px");
    expect(cssWidgetWidth("80%")).toBe("calc(var(--swl-pane-width, 100vw) * 0.8)");
    expect(cssWidgetWidth("full")).toBe("var(--swl-pane-width, 100vw)");
  });

  it("shown at most as wide as the pane less its gutter; a percent of the pane as that share of it", () => {
    expect(shownWidgetWidth(1200, 1600)).toBe(1200);
    expect(shownWidgetWidth(1200, 1000)).toBe(960);
    expect(shownWidgetWidth("80%", 1600)).toBe(1280);
    expect(shownWidgetWidth("100%", 1600)).toBe(1560);
    expect(shownWidgetWidth("full", 1600)).toBe(1560);
  });

  it("dragged: twice the distance (centred), not under 200 px nor past the pane", () => {
    expect(draggedWidth(760, 100, 1600)).toBe(960);
    expect(draggedWidth(760, -400, 1600)).toBe(200);
    expect(draggedWidth(760, 900, 1600)).toBe(1560);
  });

  it("snapped to the text's width (kept: none), a guide of pixels, of a percent (kept so: the same share in any pane) or full, within 8 px", () => {
    const targets = snapTargets(760, guides, 1600);
    expect(targets.map((t) => [t.name, t.width, t.kept])).toEqual([
      ["Page width", 760, undefined],
      ["1200 px", 1200, 1200],
      ["80 %", 1280, "80%"],
      ["Full width", 1560, "full"],
    ]);
    expect(snapped(1285, targets)).toEqual({ width: 1280, kept: "80%", name: "80 %" });
    expect(snapTargets(760, guides, 1000).find((t) => t.kept === "80%")?.width).toBe(800);
    expect(snapped(765, targets)).toEqual({ width: 760, kept: undefined, name: "Page width" });
    expect(snapped(1193, targets)).toEqual({ width: 1200, kept: 1200, name: "1200 px" });
    expect(snapped(1555, targets)).toEqual({ width: 1560, kept: "full", name: "Full width" });
    expect(snapped(900.4, targets)).toEqual({ width: 900, kept: 900 });
  });

  it("only the guides a drag reaches: none of pixels wider than the pane, none under the narrowest a drag makes", () => {
    expect(snapTargets(760, guides, 1000).map((t) => t.name)).toEqual(["Page width", "80 %", "Full width"]);
    expect(snapTargets(760, ["10%", 300], 1600).map((t) => t.name)).toEqual(["Page width", "300 px"]);
  });

  it("one target of a width (to the pixel), the first: the line shown, the name said and the width kept are one guide's", () => {
    // 80 % of 1500 px is 1200 px, as a guide of 1200 px: the first given is the one
    const targets = snapTargets(760, [1200, "80%", "full"], 1500);
    expect(targets.map((t) => t.name)).toEqual(["Page width", "1200 px", "Full width"]);
    expect(snapped(1199, targets)).toEqual({ width: 1200, kept: 1200, name: "1200 px" });
    // A guide as wide as the text: the text's
    expect(snapTargets(760, [760, 1200], 1600).map((t) => t.name)).toEqual(["Page width", "1200 px"]);
  });

  it("named: the text's width, a guide's pixels or percent, Full width", () => {
    expect([undefined, 1200, "80%" as const, "full" as const].map(widthName)).toEqual(["Page width", "1200 px", "80 %", "Full width"]);
  });

  it("in a room of its own (a cell): snapped to its quarters as pixels, dragged within it, not under the least", () => {
    expect(roomTargets(400)).toEqual([
      { width: 100, kept: 100, name: "25 %" },
      { width: 200, kept: 200, name: "50 %" },
      { width: 300, kept: 300, name: "75 %" },
      { width: 400, kept: 400, name: "100 %" },
    ]);
    expect(roomTargets(120).map((t) => t.name)).toEqual(["50 %", "75 %", "100 %"]);
    expect(snapped(296, roomTargets(400))).toEqual({ width: 300, kept: 300, name: "75 %" });
    expect(draggedRoomWidth(120, 500, 400, "start")).toBe(400);
    expect(draggedRoomWidth(120, -500, 400, "start")).toBe(40);
    expect(draggedRoomWidth(120, 30, 400, "center")).toBe(180);
    expect(draggedRoomWidth(30, -10, 30, "start")).toBe(30);
  });
});
