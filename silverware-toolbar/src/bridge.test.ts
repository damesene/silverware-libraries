import { describe, expect, it } from "vitest";
import { type Bridge, DEFAULT_SHORTCUT, missingBridgeFunctions, MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_NAMES, readSettings, readShortcut } from "./bridge.ts";
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

  it("leave out an item that is none: not an object, without its id, a show not known, an action's or a separator's property more", async () => {
    const settings = await readSettings(
      bridge({
        "silverware.toolbar.favorites": [
          ["formats.bold", { id: "formats.italic", show: "label" }, { show: "icon" }, { id: "formats.code", show: "big" }, { id: "x", shwo: "label" }, { type: "separator", id: "x" }, { type: "action", id: "formats.link" }],
        ],
      }),
    );
    expect(settings.favorites).toEqual([[{ id: "formats.italic", show: "label" }, { id: "formats.link" }]]);
  });

  it("keep an item of another kind whole, its fields for its kind to read; its show checked", async () => {
    const gesture = { type: "gesture", tap: "formats.bold", up: "formats.italic", show: "label" };
    const settings = await readSettings(bridge({ "silverware.toolbar.favorites": [[gesture, { type: "gesture", show: "big" }, { type: "" }]] }));
    expect(settings.favorites).toEqual([[gesture]]);
  });

  it("read touch's own favourites where set (not valid: none), on unless turned off", async () => {
    expect((await readSettings(bridge({}))).touchFavorites).toBeUndefined();
    expect((await readSettings(bridge({}))).touchOn).toBe(true);
    const settings = await readSettings(bridge({ "silverware.toolbar.favorites-touch": [[{ id: "formats.code" }]], "silverware.toolbar.favorites-touch-enabled": false }));
    expect(settings.touchFavorites).toEqual([[{ id: "formats.code" }]]);
    expect(settings.touchOn).toBe(false);
    expect((await readSettings(bridge({ "silverware.toolbar.favorites-touch": 3 }))).touchFavorites).toBeUndefined();
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

  it("names and describes each module as the library page's config.define does (the settings dialog shows them)", () => {
    for (const name of MODULE_NAMES) {
      const line = page.split("\n").find((l) => l.trimStart().startsWith(`${name} = { type = "object"`)) ?? "";
      expect(line).toContain(`description = "${MODULE_DESCRIPTIONS[name]}"`);
      expect(line).toContain(`label = "${MODULE_LABELS[name]}"`);
    }
  });

  it("read where the toolbar shows: auto by default and where it is none of the three", async () => {
    expect((await readSettings(bridge({}))).placement).toBe("auto");
    expect((await readSettings(bridge({ "silverware.toolbar.placement": "bottom" }))).placement).toBe("bottom");
    expect((await readSettings(bridge({ "silverware.toolbar.placement": "top" }))).placement).toBe("auto");
    expect(page).toContain('enum = { "auto", "selection", "bottom" }');
  });

  it("read when the toolbar shows: always on a phone by default, and where it is none of the three", async () => {
    expect((await readSettings(bridge({}))).show).toBe("mobile");
    expect((await readSettings(bridge({ "silverware.toolbar.show": "always" }))).show).toBe("always");
    expect((await readSettings(bridge({ "silverware.toolbar.show": "never" }))).show).toBe("mobile");
    expect(page).toContain('enum = { "always", "mobile", "selection" },\n      default = "mobile"');
  });

  it("read a word at the caret as if selected: on by default", async () => {
    expect((await readSettings(bridge({}))).wordAtCaret).toBe(true);
    expect((await readSettings(bridge({ "silverware.toolbar.wordAtCaret": false }))).wordAtCaret).toBe(false);
  });

  it("read the key as configured; an empty one or not a text is the default", async () => {
    expect(await readShortcut(bridge({ "silverware.toolbar.shortcut": "Alt-k" }))).toBe("Alt-k");
    expect(await readShortcut(bridge({ "silverware.toolbar.shortcut": " " }))).toBe(DEFAULT_SHORTCUT);
    expect(await readShortcut(bridge({ "silverware.toolbar.shortcut": 3 }))).toBe(DEFAULT_SHORTCUT);
  });
});
