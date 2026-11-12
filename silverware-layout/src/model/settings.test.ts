import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDES, DEFAULT_MIN_PANE_WIDTH, guideName, keptGuides, PATHS, readSettings, validateGuide } from "./settings.ts";

const configured = (values: Record<string, unknown>) => (path: string) => values[path];

describe("Silverware Layout's settings", () => {
  it("their defaults where nothing is configured: the theme's text width, 600 px, guides of 900 px, 1200 px and full", () => {
    expect(readSettings(configured({}))).toEqual({ textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH, guides: DEFAULT_GUIDES });
    expect(DEFAULT_GUIDES).toEqual([900, 1200, "full"]);
  });

  it("as configured: a text width in px or %, the pane's least width, the guides", () => {
    const settings = readSettings(configured({ [PATHS.textWidth]: "90%", [PATHS.minPaneWidth]: 700, [PATHS.guides]: ["600px", 1000, "full"] }));
    expect(settings).toEqual({ textWidth: { amount: 90, unit: "%" }, minPaneWidth: 700, guides: [600, 1000, "full"] });
  });

  it("guides from Lua (an object of 1, 2, …), each once, one not read left out, an empty list kept empty", () => {
    expect(readSettings(configured({ [PATHS.guides]: { 1: "900px", 2: "900", 3: "wide", 4: "90%", 5: 50, 6: "full" } })).guides).toEqual([900, "full"]);
    expect(readSettings(configured({ [PATHS.guides]: {} })).guides).toEqual([]);
  });

  it("a value not read takes its default", () => {
    expect(readSettings(configured({ [PATHS.textWidth]: "wide", [PATHS.minPaneWidth]: "600" }))).toMatchObject({ textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH });
  });

  it("a guide named by its width, checked, kept as the configuration writes it", () => {
    expect(guideName(1200)).toBe("1200 px");
    expect(guideName("full")).toBe("Full width");
    expect(validateGuide(900)).toBeUndefined();
    expect(validateGuide(150)).toBe("A guide is a whole number of 200 to 10000 px");
    expect(validateGuide(900.5)).toBe("A guide is a whole number of 200 to 10000 px");
    expect(keptGuides([900, "full"])).toEqual(["900px", "full"]);
  });
});
