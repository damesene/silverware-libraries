import { describe, expect, it } from "vitest";
import { LAYOUT_VERSION, type LayoutProvider, layoutOf } from "../../../shared/layout.ts";
import { Registry } from "./registry.ts";

const provider = (name: string, selector = `.${name}`): LayoutProvider => ({ name, selector, read: () => ({}), write: async () => undefined });

describe("The providers' registry", () => {
  it("is the API a widget's plugin takes (layoutOf: this version)", () => {
    const api = new Registry(() => undefined).api();
    expect(api.version).toBe(LAYOUT_VERSION);
    expect(layoutOf(api)).toBe(api);
  });

  it("keeps one provider per name: registered again (Space Lua loaded again), the new one replaces it", () => {
    const registry = new Registry(() => undefined);
    let told = 0;
    registry.onChanged(() => told++);
    const table = provider("table");
    const tableAgain = provider("table", ".sb-table-widget");
    registry.register(table);
    registry.register(provider("chart"));
    registry.register(tableAgain);
    expect(registry.providers).toEqual([tableAgain, expect.objectContaining({ name: "chart" })]);
    expect(told).toBe(3);
  });

  it("unregisters a provider only while it is the one of its name", () => {
    const registry = new Registry(() => undefined);
    const first = registry.register(provider("table"));
    const again = provider("table");
    registry.register(again);
    first();
    expect(registry.providers).toEqual([again]);
    registry.register(provider("chart"))();
    expect(registry.providers).toEqual([again]);
  });

  it("refuses what is no provider, saying why", () => {
    const problems: string[] = [];
    const registry = new Registry((message) => problems.push(message));
    registry.register({ name: "table" } as unknown as LayoutProvider)();
    registry.register(null as unknown as LayoutProvider);
    expect(registry.providers).toEqual([]);
    expect(problems).toEqual(["Silverware Layout: the provider table has no selector; nothing registered", "Silverware Layout: a provider is an object; nothing registered"]);
  });
});
