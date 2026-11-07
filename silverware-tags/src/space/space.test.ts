import { describe, expect, it } from "vitest";
import type { Bridge } from "../bridge.ts";
import { MODULE_NAMES, missingBridgeFunctions, readSettings } from "../bridge.ts";
import { pageChanges } from "../../../shared/pages/changes.ts";
import { pageWriter } from "../../../shared/pages/writer.ts";
import { silverBulletPlatform, silverBulletSpace } from "./silverbullet.ts";

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
  it("gives the page writer the page open through the editor, written in one edit, the others as files", async () => {
    const pages = { A: "one #a two", B: "#b" };
    const { b, calls, editor } = bridge(pages, "A");
    const writer = pageWriter(silverBulletPlatform(b));
    const report = await writer.write(pageChanges().page("A", (p) => p.tags.rename("a", "c")).page("B", (p) => p.tags.rename("b", "d")).build());
    expect(report.written.map((page) => page.page)).toEqual(["A", "B"]);
    expect(calls).toEqual(["replace 5-6 c", "write B"]);
    expect(editor()).toBe("one #c two");
    // Changed since it was read: nothing written
    const plan = await writer.plan(pageChanges().page("B", (p) => p.tags.rename("d", "e")).build());
    pages.B = "#d changed";
    expect((await writer.apply(plan)).skipped.map((skip) => skip.reason)).toEqual(["changed since it was read: left alone"]);
  });
  it("needs the functions it works with, reads the modules turned off", async () => {
    expect(missingBridgeFunctions({})).toContain("listPages");
    const settings = await readSettings({ getConfig: (path: string, fallback: unknown) => (path === "silverware.tags.modules.remove.enabled" ? false : fallback) });
    expect([...settings.modules]).toEqual(MODULE_NAMES.filter((name) => name !== "remove"));
  });
});
