import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDES, DEFAULT_MIN_PANE_WIDTH, guideName, keptGuides, PATHS, readFontSize, readSettings, validateFontSize, validateGuide } from "./settings.ts";

const configured = (values: Record<string, unknown>) => (path: string) => values[path];

describe("Silverware Layout's settings", () => {
  it("their defaults where nothing is configured: the theme's text width, 600 px, guides of 900 px, 1200 px and full, the theme's font size, font zoom on", () => {
    expect(readSettings(configured({}))).toEqual({ textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH, guides: DEFAULT_GUIDES, fontSize: undefined, fontZoom: true });
    expect(DEFAULT_GUIDES).toEqual([900, 1200, "full"]);
  });

  it("as configured: a text width in px or %, the pane's least width, the guides, the font size, font zoom off", () => {
    const settings = readSettings(
      configured({ [PATHS.textWidth]: "90%", [PATHS.minPaneWidth]: 700, [PATHS.guides]: ["600px", 1000, "full"], [PATHS.fontSize]: "20px", [PATHS.fontZoom]: false }),
    );
    expect(settings).toEqual({ textWidth: { amount: 90, unit: "%" }, minPaneWidth: 700, guides: [600, 1000, "full"], fontSize: 20, fontZoom: false });
    expect(PATHS.fontZoom).toBe("silverware.layout.fontZoom.enabled");
  });

  it("guides from Lua (an object of 1, 2, …), each once, one not read left out, an empty list kept empty", () => {
    expect(readSettings(configured({ [PATHS.guides]: { 1: "900px", 2: "900", 3: "wide", 4: "90%", 5: 50, 6: "full", 7: "5%", 8: "120%", 9: "90 %" } })).guides).toEqual([900, "90%", "full"]);
    expect(readSettings(configured({ [PATHS.guides]: {} })).guides).toEqual([]);
  });

  it("a value not read takes its default", () => {
    expect(readSettings(configured({ [PATHS.textWidth]: "wide", [PATHS.minPaneWidth]: "600" }))).toMatchObject({ textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH });
  });

  it("a guide named by its width, checked, kept as the configuration writes it: pixels, a percent of the pane, full", () => {
    expect(guideName(1200)).toBe("1200 px");
    expect(guideName("80%")).toBe("80 %");
    expect(guideName("full")).toBe("Full width");
    expect(validateGuide(900)).toBeUndefined();
    expect(validateGuide(150)).toBe("A guide is a whole number of 200 to 10000 px");
    expect(validateGuide(900.5)).toBe("A guide is a whole number of 200 to 10000 px");
    expect(validateGuide(80, "%")).toBeUndefined();
    expect(validateGuide(5, "%")).toBe("A guide is a whole number of 10 to 100 %");
    expect(validateGuide(101, "%")).toBe("A guide is a whole number of 10 to 100 %");
    expect(keptGuides([900, "80%", "full"])).toEqual(["900px", "80%", "full"]);
  });

  it("a font size read from a number or px, checked: 5 to 40 px, whole; anything else none", () => {
    expect([18, "18px", " 20 ", "20PX"].map(readFontSize)).toEqual([18, 18, 20, 20]);
    expect([4, 41, 18.5, "", "big", "1em", null, undefined, true].map(readFontSize)).toEqual(Array(9).fill(undefined));
    expect(validateFontSize(5)).toBeUndefined();
    expect(validateFontSize(41)).toBe("A font size is a whole number of 5 to 40 px");
  });
});
