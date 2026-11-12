import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_PANE_WIDTH, DEFAULT_PRESETS, PATHS, readSettings } from "./settings.ts";

const configured = (values: Record<string, unknown>) => (path: string) => values[path];

describe("Silverware Layout's settings", () => {
  it("their defaults where nothing is configured: the theme's text width, 600 px, Wide and Full width", () => {
    expect(readSettings(configured({}))).toEqual({ textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH, presets: DEFAULT_PRESETS });
  });

  it("as configured: a text width in px or %, the pane's least width, the presets", () => {
    const settings = readSettings(
      configured({
        [PATHS.textWidth]: "90%",
        [PATHS.minPaneWidth]: 700,
        [PATHS.presets]: [
          { name: "Narrow", width: "600px" },
          { name: " Full ", width: "full" },
        ],
      }),
    );
    expect(settings).toEqual({
      textWidth: { amount: 90, unit: "%" },
      minPaneWidth: 700,
      presets: [
        { name: "Narrow", width: { amount: 600, unit: "px" } },
        { name: "Full", width: "full" },
      ],
    });
  });

  it("presets from Lua (an object of 1, 2, …), one not read left out", () => {
    const settings = readSettings(configured({ [PATHS.presets]: { 1: { name: "A", width: 900 }, 2: { name: "", width: 1000 }, 3: { name: "B", width: "wide" }, 4: "C" } }));
    expect(settings.presets).toEqual([{ name: "A", width: { amount: 900, unit: "px" } }]);
  });

  it("a value not read takes its default", () => {
    expect(readSettings(configured({ [PATHS.textWidth]: "wide", [PATHS.minPaneWidth]: "600" }))).toMatchObject({ textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH });
  });
});
