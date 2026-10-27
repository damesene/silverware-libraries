import { describe, expect, it } from "vitest";
import { type Bridge, DEFAULT_SHORTCUT, missingBridgeFunctions, MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_NAMES, readSettings, readShortcut } from "./bridge.ts";
import libraryPage from "../silverware-toolbar.md?raw";
import { DEFAULT_FAVORITES, DEFAULT_TOUCH_FAVORITES } from "./core/favorites.ts";

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

  it("take an action's own icon and label, a width within 3 and 30, a pin; an empty one none, one not text the item none", async () => {
    const settings = await readSettings(
      bridge({
        "silverware.toolbar.favorites": [
          [
            { id: "formats.bold", icon: " ★ ", label: "Tučně", show: "label", width: 1, pin: "left" },
            { id: "formats.italic", icon: "", label: "  " },
            { id: "formats.code", label: 5 },
            { id: "formats.link", width: 99, pin: "middle" },
            { id: "formats.highlight", width: 99 },
          ],
        ],
      }),
    );
    expect(settings.favorites).toEqual([
      [{ id: "formats.bold", icon: "★", label: "Tučně", show: "label", width: 3, pin: "left" }, { id: "formats.italic" }, { id: "formats.highlight", width: 30 }],
    ]);
  });

  it("read a kind's slot as an action's id, or one with its own icon and label", async () => {
    const { slotOf } = await import("./core/favorites.ts");
    expect(slotOf("formats.bold")).toEqual({ id: "formats.bold" });
    expect(slotOf({ id: "formats.bold", icon: " ★ ", label: " Tučně " })).toEqual({ id: "formats.bold", icon: "★", label: "Tučně" });
    expect(slotOf({ id: "formats.bold", icon: "", label: 3 })).toEqual({ id: "formats.bold" });
    expect(slotOf("")).toBeUndefined();
    expect(slotOf({ icon: "★" })).toBeUndefined();
  });

  it("keep an item of another kind whole, its fields for its kind to read; its show checked", async () => {
    const gesture = { type: "gesture", tap: "formats.bold", up: "formats.italic", show: "label" };
    const settings = await readSettings(bridge({ "silverware.toolbar.favorites": [[gesture, { type: "gesture", show: "big" }, { type: "" }]] }));
    expect(settings.favorites).toEqual([[gesture]]);
  });

  it("read touch's own favourites: the defaults for touch, else as set (not valid: none, Click's show); on unless turned off", async () => {
    expect((await readSettings(bridge({}))).touchFavorites).toEqual(DEFAULT_TOUCH_FAVORITES);
    // A space's own favourites and none for touch: its own by finger too (as before), the defaults for touch kept
    const own = await readSettings(bridge({ "silverware.toolbar.favorites": [[{ id: "formats.bold" }]] }));
    expect([own.touchOn, own.touchFavorites]).toEqual([false, DEFAULT_TOUCH_FAVORITES]);
    // Both set (the defaults written, as the settings save them): on
    expect((await readSettings(bridge({ "silverware.toolbar.favorites": DEFAULT_FAVORITES, "silverware.toolbar.favorites-touch": DEFAULT_TOUCH_FAVORITES }))).touchOn).toBe(true);
    // Gesture buttons without the Gestures module: no defaults for touch
    expect((await readSettings(bridge({ "silverware.toolbar.modules.gestures.enabled": false }))).touchFavorites).toBeUndefined();
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

  it("defines no default for the favourites, and the same key and modules as the code", () => {
    // The favourites have no default in config.define (left out, the toolbar's own apply: SilverBullet would copy a
    // default in, and a space's own could not be told); the page names them for the user
    for (const name of ["favorites", '\\["favorites-touch"\\]', '\\["favorites-touch-enabled"\\]']) {
      const definition = new RegExp(`\\n    ${name} = \\{([\\s\\S]*?)\\n    \\},`).exec(page)?.[1];
      expect(definition, name).toBeDefined();
      expect(definition, name).not.toContain("default =");
    }
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
