import { describe, expect, it } from "vitest";
import type { Bridge } from "../bridge.ts";
import { MODULE_NAMES, missingBridgeFunctions, readSettings } from "../bridge.ts";
import { silverBulletSpace } from "./silverbullet.ts";

function bridge(pages: Record<string, string>, current: string) {
  let editor = pages[current] ?? "";
  const calls: string[] = [];
  const b: Bridge = {
    // As Space Lua hands a list over: a table of 1, 2, …
    listPages: () => ({ 1: { name: "A" }, 2: { name: "B" } }),
    queryTags: () => [{ name: "x", page: "A", parent: "task" }, { name: 3 }],
    readPage: (name) => pages[name] ?? "",
    writePage: (name, text) => {
      calls.push(`write ${name}`);
      pages[name] = text;
    },
    getCurrentPage: () => current,
    getText: () => editor,
    replaceRange: (from, to, text) => {
      calls.push(`replace ${from}-${to} ${text}`);
      editor = editor.slice(0, from) + text + editor.slice(to);
    },
    navigate: () => undefined,
    flash: () => undefined,
  };
  return { b, calls, editor: () => editor };
}

describe("SilverBullet's space", () => {
  it("reads pages and the index as Space Lua hands them over", async () => {
    const space = silverBulletSpace(bridge({}, "A").b);
    expect(await space.pageNames()).toEqual(["A", "B"]);
    expect(await space.tagRecords()).toEqual([{ name: "x", page: "A", parent: "task" }]);
  });
  it("writes the page open through the editor, in one edit, the others as files", async () => {
    const { b, calls, editor } = bridge({ A: "one #a two", B: "#b" }, "A");
    const space = silverBulletSpace(b);
    expect(await space.write("A", "one #c two", "one #a two")).toBe("written");
    expect(await space.write("B", "#d", "#b")).toBe("written");
    expect(calls).toEqual(["replace 5-6 c", "write B"]);
    expect(editor()).toBe("one #c two");
    // Changed since it was read: nothing written
    expect(await space.write("B", "#e", "#b")).toBe("changed");
  });
  it("needs the functions it works with, reads the modules turned off", async () => {
    expect(missingBridgeFunctions({})).toContain("listPages");
    const settings = await readSettings({ getConfig: (path: string, fallback: unknown) => (path === "silverware.tags.modules.remove.enabled" ? false : fallback) });
    expect([...settings.modules]).toEqual(MODULE_NAMES.filter((name) => name !== "remove"));
  });
});
