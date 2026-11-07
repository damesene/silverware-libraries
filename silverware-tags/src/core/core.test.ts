import { describe, expect, it } from "vitest";
import { pagesOperation } from "../modules/pages.ts";
import { removeOperation } from "../modules/remove.ts";
import { renameOperation, validateRename } from "../modules/rename.ts";
import { memorySpace, writerOf } from "../space/memory.ts";
import { indexCaughtUp, metaPages, pagesWith, readCatalog, subtagsOf } from "./catalog.ts";
import type { PageBuilder } from "../../../shared/pages/changes.ts";
import { undoneBy } from "./operation.ts";
import { applyPlan, makePlan, undoOperation } from "./plan.ts";

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
    const plan = await makePlan(writerOf(space), await readCatalog(space), renameOperation("project", "work", true));
    expect(plan.pages.map((c) => c.page)).toEqual(["A", "A/Plan", "B"]);
    // Nothing written until applied
    expect(space.pages.get("A")).toContain("project/alpha");
    const applied = await applyPlan(writerOf(space), plan);
    expect(applied.written).toHaveLength(3);
    expect(space.pages.get("A")).toBe("---\ntags: [work/alpha]\n---\n- [ ] do #todo");
    expect(space.pages.get("B")).toBe("#work/beta\n\nnote #idea");
    // Undo: an operation as any other, its review the pages going back
    const undo = await makePlan(writerOf(space), await readCatalog(space), undoOperation({ report: applied.report, label: applied.operation.label }));
    expect(undo.pages.map((c) => c.page)).toEqual(["A", "A/Plan", "B"]);
    expect(undoneBy(undo.operation)!.report).toBe(applied.report);
    await applyPlan(writerOf(space), undo);
    expect(space.pages.get("A")).toBe("---\ntags: [project/alpha]\n---\n- [ ] do #todo");
  });
  it("leaves a page changed since it was read, and one changed since it was written", async () => {
    const space = pages();
    const plan = await makePlan(writerOf(space), await readCatalog(space), renameOperation("plan", "plans", false));
    space.pages.set("A/Plan", "#plan edited");
    const applied = await applyPlan(writerOf(space), plan);
    expect(applied.written).toHaveLength(0);
    expect(applied.skipped[0]!.reason).toMatch(/changed since/);

    const again = await applyPlan(writerOf(space), await makePlan(writerOf(space), await readCatalog(space), renameOperation("plan", "plans", false)));
    space.pages.set("A/Plan", "#plans edited later");
    const undo = await makePlan(writerOf(space), await readCatalog(space), undoOperation({ report: again.report, label: again.operation.label }));
    expect(undo.skipped.map((s) => s.reason)).toEqual(["changed since it was written: left as it is"]);
    await applyPlan(writerOf(space), undo);
    expect(space.pages.get("A/Plan")).toBe("#plans edited later");
  });
  it("reads hundreds of pages a few at a time, in their order", async () => {
    const pages = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`P/${String(i).padStart(3, "0")}`, `#many ${i}`]));
    const space = memorySpace(pages);
    let reading = 0;
    let most = 0;
    // (The page writer reads them, through the space it is given)
    const store = space.platform.space;
    const read = store.read.bind(store);
    store.read = async (page) => {
      most = Math.max(most, ++reading);
      await new Promise((resolve) => setTimeout(resolve, 0));
      reading--;
      return read(page);
    };
    const seen: number[] = [];
    const plan = await makePlan(writerOf(space), await readCatalog(space), renameOperation("many", "lots", false), (done) => seen.push(done));
    expect(plan.pages.map((c) => c.page)).toEqual(Object.keys(pages));
    expect(most).toBeLessThanOrEqual(6);
    expect(seen.at(-1)).toBe(300);
  });
});

describe("operations", () => {
  it("changes a page listed twice once", async () => {
    const space = memorySpace({ A: "text" });
    const twice = { label: "Twice", pages: () => ["A", "A"], change: (p: PageBuilder) => p.editText((text) => ({ text: `${text}!`, changes: 1 })), done: () => "done" };
    await applyPlan(writerOf(space), await makePlan(writerOf(space), await readCatalog(space), twice));
    expect(space.pages.get("A")).toBe("text!");
  });
  it("deletes a tag with its subtags", async () => {
    const space = pages();
    await applyPlan(writerOf(space), await makePlan(writerOf(space), await readCatalog(space), removeOperation("project", true, 0, { from: "both", keepWord: false })));
    expect(space.pages.get("A")).toBe("- [ ] do #todo");
    expect(space.pages.get("A/Plan")).toBe("#plan\n\ntext");
    expect(space.pages.get("B")).toBe("note #idea");
  });
  it("tags pages: added into the frontmatter, removed from it and the tag lines", async () => {
    const space = pages();
    await applyPlan(writerOf(space), await makePlan(writerOf(space), await readCatalog(space), pagesOperation(["A", "C"], ["review"], ["project/alpha"])));
    expect(space.pages.get("A")).toBe("---\ntags: [review]\n---\n- [ ] do #todo");
    expect(space.pages.get("C")).toBe("---\ntags: [review]\n---\nNothing here");
  });
  it("changes one page's tags", async () => {
    const space = pages();
    await applyPlan(writerOf(space), await makePlan(writerOf(space), await readCatalog(space), pagesOperation(["A/Plan"], ["draft"], ["project/alpha"])));
    expect(space.pages.get("A/Plan")).toBe("---\ntags: [draft]\n---\n#plan\n\ntext");
  });
  it("offers the subtags in the review, the operation made anew", () => {
    const op = renameOperation("project", "work", true, 2);
    const subtags = op.options?.[0];
    expect(subtags && "on" in subtags && subtags.on).toBe(true);
    const again = subtags && "toggled" in subtags ? subtags.toggled().options?.[0] : undefined;
    expect(again && "on" in again && again.on).toBe(false);
    expect(op.shows).toBe("work");
    expect(removeOperation("project", false, 0).options?.map((o) => o.label)).toEqual(["Remove from", "In the text"]);
  });
  it("says what is wrong with a rename", () => {
    expect(validateRename("a", "a")).toBeDefined();
    expect(validateRename("a", "")).toBeDefined();
    expect(validateRename("a", "b")).toBeUndefined();
  });
});

describe("meta pages protected", () => {
  it("leaves meta pages out of the catalog, and a plan's guard leaves one alone as read", async () => {
    const space = memorySpace({ Lib: "---\ntags: meta/library\n---\nWrites #auto.", Car: "#auto" });
    const catalog = await readCatalog(space, { hideMeta: true });
    expect([...catalog.tags.keys()]).toEqual(["auto"]);
    expect(catalog.pages).toEqual(["Car"]);
    // A page the index had as no meta page, made one since: the guard reads its text
    const plan = await makePlan(writerOf(space), await readCatalog(space), renameOperation("auto", "automobile", false), undefined, (page) => (page.tagUses().some((use) => use.name === "meta/library") ? "a meta page" : undefined));
    expect(plan.pages.map((c) => c.page)).toEqual(["Car"]);
    expect(plan.skipped).toEqual([{ page: "Lib", reason: "a meta page" }]);
  });
});

describe("the index caught up", () => {
  it("waits until the index has the pages as written: the tags taken off gone, those given there", async () => {
    const s = memorySpace({ A: "#old" });
    const records = s.tagRecords;
    let calls = 0;
    // An index two reads behind the writes
    s.tagRecords = async () => (++calls < 3 ? [{ name: "old", page: "A", parent: "page" }] : records());
    s.pages.set("A", "#new");
    await indexCaughtUp(s, [{ page: "A", tagChanges: () => ({ gone: ["old"], added: ["new"] }) }]);
    expect(calls).toBe(3);
  });
});
