import { describe, expect, it } from "vitest";
import { readCatalog } from "../core/catalog.ts";
import type { ModuleHost, TagAction, WorkspaceHost } from "../core/module.ts";
import { memorySpace, writerOf } from "../space/memory.ts";
import { pagesModule } from "./pages.ts";
import { removeManyOperation, removeModule } from "./remove.ts";
import { mergeOperation, validateMerge, renameOperation } from "./rename.ts";
import { applyPlan, makePlan } from "../core/plan.ts";

const space = memorySpace({ A: "#todo\n\n- [ ] do #todo/later", B: "- item #todo" });
const moduleHost = { space, catalog: () => readCatalog(space) } as unknown as ModuleHost;

async function windowHost() {
  const shown: unknown[] = [];
  const host = { catalog: await readCatalog(space), show: (view: string, state?: unknown) => void shown.push([view, state]) } as unknown as WorkspaceHost;
  return { host, shown };
}

const actionsOf = (actions: readonly TagAction[] | undefined) => Object.fromEntries((actions ?? []).map((a) => [a.id, a]));

describe("the built-in modules' actions on a tag, as data", () => {
  it("Remove gives its operation to review, its subtags offered", async () => {
    const { host } = await windowHost();
    const remove = actionsOf(removeModule(moduleHost).tagActions?.()).remove!;
    expect(remove.danger).toBe(true);
    const operation = await remove.run("todo", host);
    expect(operation && operation.label).toBe("Remove #todo");
    expect(operation && operation.options?.map((o) => o.label)).toEqual(["Remove from", "In the text", "Its subtags too (1)"]);
  });
  it("Add to pages and Remove from pages show the view by page; Remove only for a page's own tag", async () => {
    const { host, shown } = await windowHost();
    const actions = actionsOf(pagesModule(moduleHost).tagActions?.());
    expect(actions["pages.remove"]!.when!("todo", host.catalog)).toBe(true);
    expect(actions["pages.remove"]!.when!("todo/later", host.catalog)).toBe(false);
    await actions["pages.add"]!.run("todo", host);
    await actions["pages.remove"]!.run("todo", host);
    expect(shown).toEqual([
      ["pages", { add: ["todo"] }],
      ["pages", { checked: ["A"], remove: ["todo"] }],
    ]);
  });
});

describe("a rename into a subtag of its own", () => {
  it("leaves the tags under the target as they are: the two merge", async () => {
    const s = memorySpace({ P: "#a #a/x #a/y" });
    await applyPlan(writerOf(s), await makePlan(writerOf(s), await readCatalog(s), renameOperation("a", "a/x", true, 2)));
    expect(s.pages.get("P")).toBe("#a/x #a/x #a/x/y");
  });
});

describe("several tags at once", () => {
  it("merges tags into one, their subtags under it, one under the target left", async () => {
    const s = memorySpace({ P: "#Todo #to-do #todo", Q: "- [ ] x #to-do/later", R: "#todo/now" });
    await applyPlan(writerOf(s), await makePlan(writerOf(s), await readCatalog(s), mergeOperation(["Todo", "to-do", "todo"], "todo", true, 1)));
    expect(s.pages.get("P")).toBe("#todo #todo #todo");
    expect(s.pages.get("Q")).toBe("- [ ] x #todo/later");
    expect(s.pages.get("R")).toBe("#todo/now");
    expect(validateMerge("a/x", ["a", "b"])).toBeDefined();
    expect(validateMerge("a", ["a", "b"])).toBeUndefined();
  });
  it("merges a tag picked under the target into it", async () => {
    const s = memorySpace({ P: "#a #a/b", Q: "#a/b/c" });
    await applyPlan(writerOf(s), await makePlan(writerOf(s), await readCatalog(s), mergeOperation(["a", "a/b"], "a", true, 1)));
    expect(s.pages.get("P")).toBe("#a #a");
    expect(s.pages.get("Q")).toBe("#a/c");
  });
  it("deletes several tags", async () => {
    const s = memorySpace({ P: "Text #a and #b here, #c stays" });
    await applyPlan(writerOf(s), await makePlan(writerOf(s), await readCatalog(s), removeManyOperation(["a", "b"], false, 0, { from: "both", keepWord: false })));
    expect(s.pages.get("P")).toBe("Text and here, #c stays");
  });
});
