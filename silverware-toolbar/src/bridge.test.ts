import { describe, expect, it } from "vitest";
import { type Bridge, DEFAULT_SHORTCUT, missingBridgeFunctions, MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_NAMES, readSettings, readShortcut } from "./bridge.ts";
import initPage from "../silverware-toolbar-init.md?raw";
import { DEFAULT_FAVORITES, DEFAULT_TOUCH_FAVORITES } from "./core/favorites.ts";
import { defaultToolbars } from "./core/toolbars.ts";

const bridge = (config: Record<string, unknown>, extra: Partial<Bridge> = {}): Bridge => ({
  getSelection: () => ({ from: 0, to: 0, text: "" }),
  setSelection: () => undefined,
  replaceRange: () => undefined,
  getText: () => "",
  flash: () => undefined,
  getConfig: (path, fallback) => (path in config ? config[path] : fallback),
  ...extra,
});

/** One toolbar configured, used for both ways of working */
const one = (rows: unknown) => ({ "silverware.toolbar.favorites": [{ name: "Mine", useFor: ["click", "touch"], rows }] });
/** The rows of the first toolbar read */
const rowsOf = async (config: Record<string, unknown>) => (await readSettings(bridge(config))).toolbars[0]!.rows;

describe("Settings", () => {
  it("are the defaults where nothing is configured, every module on: a toolbar by the selection for Click, one docked for Touch", async () => {
    const settings = await readSettings(bridge({}));
    expect(settings.toolbars).toEqual(defaultToolbars());
    expect(settings.toolbars.map((list) => [list.name, list.useFor])).toEqual([["Float", ["click"]], ["Docked", ["touch"]]]);
    expect(settings.toolbars[0]!.rows).toEqual(DEFAULT_FAVORITES);
    expect(settings.toolbars[1]!.rows).toEqual(DEFAULT_TOUCH_FAVORITES);
    expect([...settings.modules]).toEqual([...MODULE_NAMES]);
    // Without the Gestures module the docked one shows none of them: the first for both
    expect((await readSettings(bridge({ "silverware.toolbar.modules.gestures.enabled": false }))).toolbars.map((list) => list.useFor)).toEqual([["click", "touch"], []]);
  });

  it("take what is configured, a module turned off left out; what is not valid is its default", async () => {
    const settings = await readSettings(bridge({ ...one([[{ id: "formats.bold" }]]), "silverware.toolbar.modules.clear.enabled": false }));
    expect(settings.toolbars).toEqual([{ name: "Mine", useFor: ["click", "touch"], placement: "selection", show: "selection", rows: [[{ id: "formats.bold" }]] }]);
    expect(settings.modules.has("clear")).toBe(false);
    expect((await readSettings(bridge(one([1, 2])))).toolbars).toEqual(defaultToolbars());
    // The rows of before (the model of 1): migrated to toolbars, said to be written back with the version
    const before = await readSettings(bridge({ "silverware.toolbar.favorites": [[{ id: "formats.bold" }]] }));
    expect(before.toolbars.map((toolbar) => [toolbar.name, toolbar.useFor, toolbar.rows])).toEqual([["Float", ["click"], [[{ id: "formats.bold" }]]], ["Docked", ["touch"], [[{ id: "formats.bold" }]]]]);
    expect(before.migrated["silverware.toolbar.version"]).toBe(2);
  });

  it("read lists leniently: a name taken, one without a name or rows, more than 5 left out; what each is used for normalized", async () => {
    const list = (name: unknown, useFor?: unknown) => ({ name, ...(useFor === undefined ? {} : { useFor }), rows: [[{ id: "formats.bold" }]] });
    const settings = await readSettings(bridge({ "silverware.toolbar.favorites": [list(" A ", ["click", "pen"]), list("a", ["touch"]), list(3), { name: "No rows" }, list("B", ["click", "touch"]), list("C"), list("D"), list("E"), list("F")] }));
    expect(settings.toolbars.map((one) => [one.name, one.useFor])).toEqual([["A", ["click"]], ["B", ["touch"]], ["C", []], ["D", []], ["E", []]]);
    // None used for a way of working: the first is
    expect((await readSettings(bridge({ "silverware.toolbar.favorites": [list("A"), list("B", ["touch"])] }))).toolbars.map((one) => one.useFor)).toEqual([["click"], ["touch"]]);
  });

  it("take a list handed over from Lua as an object of 1, 2, …", async () => {
    expect(await rowsOf({ "silverware.toolbar.favorites": { 1: { name: "Mine", useFor: { 1: "click" }, rows: { 1: { 1: { id: "formats.code" }, 2: { type: "separator" } }, 2: {} } } } })).toEqual([[{ id: "formats.code" }, { type: "separator" }], []]);
    expect(await rowsOf(one({ a: "formats.code" }))).toEqual(DEFAULT_FAVORITES);
  });

  it("leave out an item that is none: not an object, without its id, a show not known, an action's or a separator's property more", async () => {
    expect(await rowsOf(one([["formats.bold", { id: "formats.italic", show: "label" }, { show: "icon" }, { id: "formats.code", show: "big" }, { id: "x", shwo: "label" }, { type: "separator", id: "x" }, { type: "action", id: "formats.link" }]]))).toEqual([
      [{ id: "formats.italic", show: "label" }, { id: "formats.link" }],
    ]);
  });

  it("take an action's own icon and label, a width within 3 and 30, a pin; an empty one none, one not text the item none", async () => {
    const rows = [
      [
        { id: "formats.bold", icon: " ★ ", label: "Tučně", show: "label", width: 1, pin: "left" },
        { id: "formats.italic", icon: "", label: "  " },
        { id: "formats.code", label: 5 },
        { id: "formats.link", width: 99, pin: "middle" },
        { id: "formats.highlight", width: 99 },
      ],
    ];
    expect(await rowsOf(one(rows))).toEqual([[{ id: "formats.bold", icon: "★", label: "Tučně", show: "label", width: 3, pin: "left" }, { id: "formats.italic" }, { id: "formats.highlight", width: 30 }]]);
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
    expect(await rowsOf(one([[gesture, { type: "gesture", show: "big" }, { type: "" }]]))).toEqual([[gesture]]);
  });

  it("are the defaults when reading them fails, or without getConfig", async () => {
    const failing = bridge({}, { getConfig: () => Promise.reject(new Error("no config")) });
    expect((await readSettings(failing)).toolbars).toEqual(defaultToolbars());
    const { getConfig: _, ...without } = bridge({});
    expect((await readSettings(without)).toolbars).toEqual(defaultToolbars());
  });

  it("names what the init page did not hand over", () => {
    expect(missingBridgeFunctions({ getText: () => "" })).toEqual(["getSelection", "setSelection", "replaceRange", "flash"]);
  });
});

describe("The init page", () => {
  const page = initPage;

  it("defines no default for the toolbars, and the same key and modules as the code", () => {
    // The toolbars have no default in config.define (left out, the toolbar's own apply: SilverBullet would copy a
    // default in, and a space's own could not be told); the page names them for the user
    for (const name of ["favorites"]) {
      const definition = new RegExp(`\\n    ${name} = \\{([\\s\\S]*?)\\n    \\},`).exec(page)?.[1];
      expect(definition, name).toBeDefined();
      expect(definition, name).not.toContain("default =");
    }
    expect(/shortcut = \{[\s\S]*?default = "([^"]*)"/.exec(page)?.[1]).toBe(DEFAULT_SHORTCUT);
    expect(page).toContain(`config.get("silverware.toolbar.shortcut", "${DEFAULT_SHORTCUT}")`);
    for (const name of MODULE_NAMES) expect(page).toContain(`${name} = { type = "object"`);
  });

  it("names and describes each module as the init page's config.define does (the settings dialog shows them)", () => {
    for (const name of MODULE_NAMES) {
      const line = page.split("\n").find((l) => l.trimStart().startsWith(`${name} = { type = "object"`)) ?? "";
      expect(line).toContain(`description = "${MODULE_DESCRIPTIONS[name]}"`);
      expect(line).toContain(`label = "${MODULE_LABELS[name]}"`);
    }
  });

  it("read where and when each toolbar shows: Float by the selection after selecting text, Docked at the bottom always; unknown or none: by the selection, after selecting text", async () => {
    expect((await readSettings(bridge({}))).toolbars.map((list) => [list.name, list.placement, list.show])).toEqual([["Float", "selection", "selection"], ["Docked", "bottom", "always"]]);
    const read = await readSettings(bridge({ "silverware.toolbar.favorites": [{ name: "A", useFor: ["click"], placement: "top", show: "always", rows: [] }, { name: "B", placement: "auto", show: "mobile", rows: [] }] }));
    expect(read.toolbars.map((list) => [list.placement, list.show])).toEqual([["top", "always"], ["selection", "selection"]]);
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
