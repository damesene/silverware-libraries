import { describe, expect, it } from "vitest";
import { type Bridge, DEFAULT_SHORTCUT, missingBridgeFunctions, MODULE_NAMES, readSettings } from "./bridge.ts";
import libraryPage from "../silverware-toolbar.md?raw";
import { DEFAULT_FAVORITES } from "./core/favorites.ts";

const bridge = (config: Record<string, unknown>, extra: Partial<Bridge> = {}): Bridge => ({
  getSelection: () => ({ from: 0, to: 0, text: "" }),
  setSelection: () => undefined,
  replaceRange: () => undefined,
  getText: () => "",
  flash: () => undefined,
  getConfig: (path, fallback) => (path in config ? config[path] : fallback),
  ...extra,
});

describe("Settings", () => {
  it("are the defaults where nothing is configured, every module on", async () => {
    const settings = await readSettings(bridge({}));
    expect(settings.favorites).toEqual(DEFAULT_FAVORITES);
    expect([...settings.modules]).toEqual([...MODULE_NAMES]);
  });

  it("take what is configured, a module turned off left out; what is not valid is its default", async () => {
    const settings = await readSettings(bridge({ "silverware.toolbar.favorites": [[{ id: "formats.bold" }]], "silverware.toolbar.modules.clear.enabled": false }));
    expect(settings.favorites).toEqual([[{ id: "formats.bold" }]]);
    expect(settings.modules.has("clear")).toBe(false);
    expect((await readSettings(bridge({ "silverware.toolbar.favorites": [1, 2] }))).favorites).toEqual(DEFAULT_FAVORITES);
  });

  it("take a list handed over from Lua as an object of 1, 2, …", async () => {
    const settings = await readSettings(bridge({ "silverware.toolbar.favorites": { 1: { 1: { id: "formats.code" }, 2: { type: "separator" } }, 2: {} } }));
    expect(settings.favorites).toEqual([[{ id: "formats.code" }, { type: "separator" }], []]);
    expect((await readSettings(bridge({ "silverware.toolbar.favorites": { a: "formats.code" } }))).favorites).toEqual(DEFAULT_FAVORITES);
  });

  it("leave out an item that is none: not an object, without its id, a show or a type not known, a property more", async () => {
    const settings = await readSettings(
      bridge({
        "silverware.toolbar.favorites": [
          ["formats.bold", { id: "formats.italic", show: "label" }, { show: "icon" }, { id: "formats.code", show: "big" }, { type: "line" }, { id: "x", shwo: "label" }, { type: "action", id: "formats.link" }],
        ],
      }),
    );
    expect(settings.favorites).toEqual([[{ id: "formats.italic", show: "label" }, { id: "formats.link" }]]);
  });

  it("are the defaults when reading them fails, or without getConfig", async () => {
    const failing = bridge({}, { getConfig: () => Promise.reject(new Error("no config")) });
    expect((await readSettings(failing)).favorites).toEqual(DEFAULT_FAVORITES);
    const { getConfig: _, ...without } = bridge({});
    expect((await readSettings(without)).favorites).toEqual(DEFAULT_FAVORITES);
  });

  it("names what the library page did not hand over", () => {
    expect(missingBridgeFunctions({ getText: () => "" })).toEqual(["getSelection", "setSelection", "replaceRange", "flash"]);
  });
});

describe("The library page", () => {
  const page = libraryPage;

  it("defines the same default favourites, key and modules as the code", () => {
    // The defaults as Lua writes them: rows of items
    const lua = (value: unknown): string =>
      Array.isArray(value)
        ? `{ ${value.map(lua).join(", ")} }`
        : typeof value === "object" && value
          ? `{ ${Object.entries(value).map(([k, v]) => `${k} = ${lua(v)}`).join(", ")} }`
          : JSON.stringify(value);
    const defaults = /favorites = \{[\s\S]*?default = (\{[\s\S]*?\n {6}\}),/.exec(page)?.[1]?.replace(/\s+/g, " ").replace(/, \}/g, " }");
    expect(defaults).toBe(lua(DEFAULT_FAVORITES));
    expect(/shortcut = \{[\s\S]*?default = "([^"]*)"/.exec(page)?.[1]).toBe(DEFAULT_SHORTCUT);
    expect(page).toContain(`config.get("silverware.toolbar.shortcut", "${DEFAULT_SHORTCUT}")`);
    for (const name of MODULE_NAMES) expect(page).toContain(`${name} = { type = "object"`);
  });
});
