import { describe, expect, it } from "vitest";
import { pagesOperation } from "../modules/pages.ts";
import { removeOperation } from "../modules/remove.ts";
import { renameOperation, renameProblem } from "../modules/rename.ts";
import { memorySpace } from "../space/memory.ts";
import { minimalEdit } from "../space/space.ts";
import { metaPages, pagesWith, readCatalog, subtagsOf } from "./catalog.ts";
import { diffLines } from "./diff.ts";
import { History } from "./history.ts";
import { type Applied, applyPlan, makePlan, undoOperation } from "./plan.ts";

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

describe("meta", () => {
  it("tells SilverBullet's own pages by their meta tags", async () => {
    const space = memorySpace({ Lib: "---\ntags: meta/library\n---\n", Mine: "#meta-notes\n\n#metal", Tpl: "#meta" });
    expect([...metaPages(await readCatalog(space))].sort()).toEqual(["Lib", "Tpl"]);
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
    // Undo: an operation as any other, its review the pages going back
    const undo = await makePlan(space, await readCatalog(space), undoOperation(applied));
    expect(undo.changes.map((c) => c.page)).toEqual(["A", "A/Plan", "B"]);
    expect(undo.operation.undoes).toBe(applied);
    await applyPlan(space, undo);
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
    const undo = await makePlan(space, await readCatalog(space), undoOperation(again));
    expect(undo.skipped.map((s) => s.reason)).toEqual(["changed since it was written: left as it is"]);
    await applyPlan(space, undo);
    expect(space.pages.get("A/Plan")).toBe("#plans edited later");
  });
  it("reads hundreds of pages a few at a time, in their order", async () => {
    const pages = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`P/${String(i).padStart(3, "0")}`, `#many ${i}`]));
    const space = memorySpace(pages);
    let reading = 0;
    let most = 0;
    const read = space.read;
    space.read = async (page) => {
      most = Math.max(most, ++reading);
      await new Promise((resolve) => setTimeout(resolve, 0));
      reading--;
      return read(page);
    };
    const seen: number[] = [];
    const plan = await makePlan(space, await readCatalog(space), renameOperation("many", "lots", false), (done) => seen.push(done));
    expect(plan.changes.map((c) => c.page)).toEqual(Object.keys(pages));
    expect(most).toBeLessThanOrEqual(6);
    expect(seen.at(-1)).toBe(300);
  });
  it("keeps the changes applied, the last first, one undone taken off", () => {
    const history = new History();
    const op = renameOperation("a", "b", false);
    history.push({ operation: op, written: [], skipped: [] });
    expect(history.last).toBeUndefined();
    const first: Applied = { operation: op, written: [{ page: "x", before: "", after: "", changes: 1 }], skipped: [] };
    const second: Applied = { ...first };
    history.push(first);
    history.push(second);
    expect(history.last).toBe(second);
    history.remove(second);
    expect(history.last).toBe(first);
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
    await applyPlan(space, await makePlan(space, await readCatalog(space), pagesOperation(["A", "C"], ["review"], ["project/alpha"])));
    expect(space.pages.get("A")).toBe("---\ntags: [review]\n---\n- [ ] do #todo");
    expect(space.pages.get("C")).toBe("---\ntags:\n  - review\n---\nNothing here");
  });
  it("changes one page's tags", async () => {
    const space = pages();
    await applyPlan(space, await makePlan(space, await readCatalog(space), pagesOperation(["A/Plan"], ["draft"], ["project/alpha"])));
    expect(space.pages.get("A/Plan")).toBe("---\ntags:\n  - draft\n---\n#plan\n\ntext");
  });
  it("offers the subtags in the review, the operation made anew", () => {
    const op = renameOperation("project", "work", true, 2);
    expect(op.option?.on).toBe(true);
    expect(op.option?.toggled().option?.on).toBe(false);
    expect(op.shows).toBe("work");
    expect(removeOperation("project", false, 0).option).toBeUndefined();
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

describe("meta pages protected", () => {
  it("leaves meta pages out of the catalog, and a plan's guard leaves one alone as read", async () => {
    const space = memorySpace({ Lib: "---\ntags: meta/library\n---\nWrites #auto.", Car: "#auto" });
    const catalog = await readCatalog(space, { hideMeta: true });
    expect([...catalog.tags.keys()]).toEqual(["auto"]);
    expect(catalog.pages).toEqual(["Car"]);
    // A page the index had as no meta page, made one since: the guard reads its text
    const plan = await makePlan(space, await readCatalog(space), renameOperation("auto", "automobile", false), undefined, (text) => (text.includes("meta/library") ? "a meta page" : undefined));
    expect(plan.changes.map((c) => c.page)).toEqual(["Car"]);
    expect(plan.skipped).toEqual([{ page: "Lib", reason: "a meta page" }]);
  });
});
