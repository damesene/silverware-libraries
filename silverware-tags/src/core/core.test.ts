import { describe, expect, it } from "vitest";
import { assignOperation } from "../modules/assign.ts";
import { pageTagsOperation } from "../modules/pagetags.ts";
import { removeOperation } from "../modules/remove.ts";
import { renameOperation, renameProblem } from "../modules/rename.ts";
import { memorySpace } from "../space/memory.ts";
import { minimalEdit } from "../space/space.ts";
import { pagesWith, readCatalog, subtagsOf } from "./catalog.ts";
import { diffLines } from "./diff.ts";
import { History } from "./history.ts";
import { applyPlan, makePlan, undoApplied } from "./plan.ts";

const pages = () =>
  memorySpace({
    A: "---\ntags: [project/alpha]\n---\n- [ ] do #todo",
    "A/Plan": "#project/alpha #plan\n\ntext",
    B: "#project/beta\n\nnote #idea",
    C: "Nothing here",
  });

describe("catalog", () => {
  it("reads the tags of the space by page and context", async () => {
    const catalog = await readCatalog(pages());
    expect([...catalog.tags.keys()].sort()).toEqual(["idea", "plan", "project/alpha", "project/beta", "todo"]);
    expect([...catalog.tags.get("todo")!.byContext.keys()]).toEqual(["task"]);
    expect(pagesWith(catalog, "project", true)).toEqual(["A", "A/Plan", "B"]);
    expect(subtagsOf(catalog, "project")).toEqual(["project/alpha", "project/beta"]);
    expect(catalog.pages).toEqual(["A", "A/Plan", "B", "C"]);
  });
});

describe("plans", () => {
  it("plans a rename, applies it and undoes it", async () => {
    const space = pages();
    const plan = await makePlan(space, await readCatalog(space), renameOperation("project", "work", true));
    expect(plan.changes.map((c) => c.page)).toEqual(["A", "A/Plan", "B"]);
    // Nothing written until applied
    expect(space.pages.get("A")).toContain("project/alpha");
    const applied = await applyPlan(space, plan);
    expect(applied.written).toHaveLength(3);
    expect(space.pages.get("A")).toBe("---\ntags: [work/alpha]\n---\n- [ ] do #todo");
    expect(space.pages.get("B")).toBe("#work/beta\n\nnote #idea");
    const undone = await undoApplied(space, applied);
    expect(undone.restored).toHaveLength(3);
    expect(space.pages.get("A")).toBe("---\ntags: [project/alpha]\n---\n- [ ] do #todo");
  });
  it("leaves a page changed since it was read, and one changed since it was written", async () => {
    const space = pages();
    const plan = await makePlan(space, await readCatalog(space), renameOperation("plan", "plans", false));
    space.pages.set("A/Plan", "#plan edited");
    const applied = await applyPlan(space, plan);
    expect(applied.written).toHaveLength(0);
    expect(applied.skipped[0]!.reason).toMatch(/changed since/);

    const again = await applyPlan(space, await makePlan(space, await readCatalog(space), renameOperation("plan", "plans", false)));
    space.pages.set("A/Plan", "#plans edited later");
    expect((await undoApplied(space, again)).skipped).toHaveLength(1);
    expect(space.pages.get("A/Plan")).toBe("#plans edited later");
  });
  it("keeps the changes applied, the last first", () => {
    const history = new History();
    const op = renameOperation("a", "b", false);
    history.push({ operation: op, written: [], skipped: [] });
    expect(history.last).toBeUndefined();
    history.push({ operation: op, written: [{ page: "x", before: "", after: "", changes: 1 }], skipped: [] });
    expect(history.pop()?.operation).toBe(op);
  });
});

describe("operations", () => {
  it("deletes a tag with its subtags", async () => {
    const space = pages();
    await applyPlan(space, await makePlan(space, await readCatalog(space), removeOperation("project", true)));
    expect(space.pages.get("A")).toBe("- [ ] do #todo");
    expect(space.pages.get("A/Plan")).toBe("#plan\n\ntext");
    expect(space.pages.get("B")).toBe("note #idea");
  });
  it("tags pages: added into the frontmatter, removed from it and the tag lines", async () => {
    const space = pages();
    await applyPlan(space, await makePlan(space, await readCatalog(space), assignOperation(["A", "C"], ["review"], ["project/alpha"])));
    expect(space.pages.get("A")).toBe("---\ntags: [review]\n---\n- [ ] do #todo");
    expect(space.pages.get("C")).toBe("---\ntags:\n  - review\n---\nNothing here");
  });
  it("sets a page's tags", async () => {
    const space = pages();
    await applyPlan(space, await makePlan(space, await readCatalog(space), pageTagsOperation("A/Plan", ["project/alpha", "plan"], ["plan", "draft"])));
    expect(space.pages.get("A/Plan")).toBe("---\ntags:\n  - draft\n---\n#plan\n\ntext");
  });
  it("says what is wrong with a rename", () => {
    expect(renameProblem("a", "a")).toBeDefined();
    expect(renameProblem("a", "")).toBeDefined();
    expect(renameProblem("a", "b")).toBeUndefined();
  });
});

describe("edits and diffs", () => {
  it("makes one edit of the part changed", () => {
    expect(minimalEdit("abcdef", "abXYef")).toEqual({ from: 2, to: 4, insert: "XY" });
    expect(minimalEdit("same", "same")).toBeUndefined();
  });
  it("shows the lines changed in runs", () => {
    expect(diffLines("a\nb\nc\nd", "a\nB\nc\nd\ne")).toEqual([
      { line: 2, removed: ["b"], added: ["B"] },
      { line: 5, removed: [], added: ["e"] },
    ]);
  });
});
