import { describe, expect, it } from "vitest";
import { joined, touchRowsJoined } from "./2-touch-rows-joined.ts";
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

describe("Version 2: favourites docked in one row", () => {
  const TOUCH = "silverware.toolbar.favorites-touch";
  const CLICK = "silverware.toolbar.favorites";

  it("joins the rows of the favourites for touch into one as the docked toolbar showed them: a separator between rows of items not pinned", () => {
    const rows = [
      [{ id: "actions.turnInto", pin: "left" }],
      [{ id: "formats.bold" }, { id: "formats.italic" }],
      [{ id: "formats.link" }],
      [{ id: "actions.emoji" }, { id: "actions.more", pin: "right" }],
    ];
    expect(joined(rows)).toEqual([
      [{ id: "actions.turnInto", pin: "left" }, { id: "formats.bold" }, { id: "formats.italic" }, { type: "separator" }, { id: "formats.link" }, { type: "separator" }, { id: "actions.emoji" }, { id: "actions.more", pin: "right" }],
    ]);
    // A Lua table handed over as an object (1, 2, …) too; one row, or not rows: nothing to join
    expect(joined({ 1: { 1: { id: "a" } }, 2: { 1: { id: "b" } } })).toEqual([[{ id: "a" }, { type: "separator" }, { id: "b" }]]);
    expect(joined([[{ id: "a" }, { id: "b" }]])).toBeUndefined();
    expect(joined(undefined)).toBeUndefined();
    expect(joined([[{ id: "a" }], "x"])).toBeUndefined();
  });

  it("joins Click's only where Click's toolbar is docked", async () => {
    const rows = [[{ id: "a" }], [{ id: "b" }]];
    expect(await touchRowsJoined.migrate(reader({ [TOUCH]: rows, [CLICK]: rows }))).toEqual({ [TOUCH]: [[{ id: "a" }, { type: "separator" }, { id: "b" }]] });
    expect(await touchRowsJoined.migrate(reader({ [CLICK]: rows, "silverware.toolbar.placement": "bottom" }))).toEqual({ [CLICK]: [[{ id: "a" }, { type: "separator" }, { id: "b" }]] });
    expect(await touchRowsJoined.migrate(reader({}))).toEqual({});
  });

  it("leaves rows written in the new model as they are: with the version, nothing runs", async () => {
    const rows = [[{ id: "a" }], [{ id: "b" }]];
    expect(await migrate(reader({ [TOUCH]: rows, [VERSION_PATH]: 2 }))).toEqual({});
    expect(await migrate(reader({ [TOUCH]: rows }))).toEqual({ [TOUCH]: [[{ id: "a" }, { type: "separator" }, { id: "b" }]], [VERSION_PATH]: 2 });
  });
});
