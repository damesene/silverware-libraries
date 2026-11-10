import { describe, expect, it } from "vitest";
import { type Migration, migrate, MIGRATIONS, SETTINGS_VERSION, VERSION_PATH } from "./index.ts";

/** Settings as configured, by path */
const reader = (values: Record<string, unknown>) => async (path: string) => values[path];

describe("The settings' migrations", () => {
  it("run in the order of their versions, rising, the model's version the last one's", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(SETTINGS_VERSION).toBe(versions.at(-1) ?? 2);
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
