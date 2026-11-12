import { describe, expect, it } from "vitest";
import { LAYOUT_VERSION, type Layout, type LayoutProvider, layoutOf } from "./layout.ts";

describe("The layout a widget's plugin registers with", () => {
  const api: Layout = { version: LAYOUT_VERSION, register: () => () => undefined };
  const provider: LayoutProvider = { name: "table", selector: ".sb-table-widget", read: () => ({}), write: async () => undefined };

  it("Silverware Layout's API where it is there, of this version", () => {
    expect(layoutOf(api)).toBe(api);
    expect(layoutOf({ ...api, version: LAYOUT_VERSION + 1 })).not.toBe(api);
    expect(layoutOf({ version: LAYOUT_VERSION })).not.toBe(api);
  });

  it("else the stand-in: a provider registered lays nothing out, and unregisters", () => {
    for (const given of [undefined, null, "api", { ...api, version: LAYOUT_VERSION + 1 }]) {
      const layout = layoutOf(given);
      expect(layout.version).toBe(LAYOUT_VERSION);
      expect(() => layout.register(provider)()).not.toThrow();
    }
  });
});
