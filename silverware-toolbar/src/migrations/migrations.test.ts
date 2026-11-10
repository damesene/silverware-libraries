import { describe, expect, it } from "vitest";
import { toolbars } from "./2-toolbars.ts";
import { type Migration, migrate, MIGRATIONS, SETTINGS_VERSION, VERSION_PATH } from "./index.ts";

/** Settings as configured, by path */
const reader = (values: Record<string, unknown>) => async (path: string) => values[path];

describe("The settings' migrations", () => {
  it("run in the order of their versions, rising, the model's version the last one's", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(SETTINGS_VERSION).toBe(versions.at(-1));
  });

  it("run those newer than the space's version, each reading what those before wrote, the version written with what they changed", async () => {
    const seen: unknown[] = [];
    const list: Migration[] = [
      { version: 2, name: "a", migrate: async (read) => ({ x: `${String(await read("x"))}+2` }) },
      { version: 3, name: "b", migrate: async (read) => (seen.push(await read("x")), { y: 3 }) },
    ];
    expect(await migrate(reader({ x: "v" }), list)).toEqual({ x: "v+2", y: 3, [VERSION_PATH]: 3 });
    expect(seen).toEqual(["v+2"]);
    // Of version 2 already: only the later one
    expect(await migrate(reader({ x: "v", [VERSION_PATH]: 2 }), list)).toEqual({ y: 3, [VERSION_PATH]: 3 });
    // Of the last: none
    expect(await migrate(reader({ [VERSION_PATH]: 3 }), list)).toEqual({});
  });

  it("write nothing where nothing changes, the version alone not either; a migration that fails leaves the settings as they are", async () => {
    const none: Migration = { version: 2, name: "none", migrate: async () => ({}) };
    expect(await migrate(reader({}), [none])).toEqual({});
    const failing: Migration = { version: 3, name: "failing", migrate: async () => Promise.reject(new Error("no")) };
    const error = console.error;
    console.error = () => undefined;
    try {
      expect(await migrate(reader({}), [{ version: 2, name: "a", migrate: async () => ({ x: 1 }) }, failing])).toEqual({});
    } finally {
      console.error = error;
    }
  });
});

describe("Version 2: toolbars", () => {
  const FAVORITES = "silverware.toolbar.favorites";
  const gone = {
    "silverware.toolbar.favorites-touch": undefined,
    "silverware.toolbar.favorites-touch-enabled": undefined,
    "silverware.toolbar.placement": undefined,
    "silverware.toolbar.placement-touch": undefined,
    "silverware.toolbar.show": undefined,
    "silverware.toolbar.show-touch": undefined,
  };
  const click = [[{ id: "formats.bold" }], [{ id: "formats.code" }]];
  const touch = [[{ id: "actions.turnInto", pin: "left" }], [{ id: "formats.italic" }], [{ id: "formats.link" }, { id: "actions.more", pin: "right" }]];

  it("makes Click's and Touch's of before toolbars where and when they showed, a docked one's rows one line as it showed them; the keys of before out", async () => {
    const changes = await toolbars.migrate(reader({ [FAVORITES]: click, "silverware.toolbar.favorites-touch": touch, "silverware.toolbar.show": "writing", "silverware.toolbar.placement-touch": "top" }));
    expect(changes).toEqual({
      [FAVORITES]: [
        { name: "Float", useFor: ["click"], placement: "selection", show: "writing", rows: click },
        { name: "Docked", useFor: ["touch"], placement: "top", show: "writing", rows: [[{ id: "actions.turnInto", pin: "left" }, { id: "formats.italic" }, { type: "separator" }, { id: "formats.link" }, { id: "actions.more", pin: "right" }]] },
      ],
      ...gone,
    });
  });

  it("gives a finger Click's where it showed them (none of its own, or its own off: kept, for none); one toolbar for both where they showed alike", async () => {
    // None of its own: Click's, docked by finger as before
    const none = (await toolbars.migrate(reader({ [FAVORITES]: click })))[FAVORITES] as { name: string; useFor?: string[]; placement: string; rows: unknown[] }[];
    expect(none.map((one) => [one.name, one.useFor, one.placement])).toEqual([["Float", ["click"], "selection"], ["Docked", ["touch"], "bottom"]]);
    expect(none[1]!.rows).toEqual([[{ id: "formats.bold" }, { type: "separator" }, { id: "formats.code" }]]);
    // Its own turned off: Click's by finger, its own kept for none
    const off = (await toolbars.migrate(reader({ [FAVORITES]: click, "silverware.toolbar.favorites-touch": touch, "silverware.toolbar.favorites-touch-enabled": false })))[FAVORITES] as { name: string; useFor?: string[] }[];
    expect(off.map((one) => [one.name, one.useFor])).toEqual([["Float", ["click"]], ["Docked", ["touch"]], ["Touch", undefined]]);
    // Both by the selection, the same rows: one toolbar
    const alike = (await toolbars.migrate(reader({ [FAVORITES]: click, "silverware.toolbar.placement-touch": "selection", "silverware.toolbar.show-touch": "selection" })))[FAVORITES] as { name: string; useFor?: string[] }[];
    expect(alike.map((one) => [one.name, one.useFor])).toEqual([["Float", ["click", "touch"]]]);
  });

  it("migrates nothing where nothing of before is set; toolbars already: only the keys of before out", async () => {
    expect(await toolbars.migrate(reader({}))).toEqual({});
    const now = [{ name: "Mine", rows: [] }];
    expect(await toolbars.migrate(reader({ [FAVORITES]: now }))).toEqual({});
    expect(await toolbars.migrate(reader({ [FAVORITES]: now, "silverware.toolbar.placement": "top" }))).toEqual(gone);
    // Where and when alone set: the default rows, as Toolbars
    const where = (await toolbars.migrate(reader({ "silverware.toolbar.placement": "bottom" })))[FAVORITES] as { name: string; placement: string }[];
    expect(where.map((one) => [one.name, one.placement])).toEqual([["Docked", "bottom"], ["Docked 2", "bottom"]]);
  });
});
