import { describe, expect, it } from "vitest";
import type { Editor, Space } from "../platform.ts";
import { type PageBuilder, pageChanges } from "./changes.ts";
import { diffLines, minimalEdit } from "./diff.ts";
import { PageHistory } from "./history.ts";
import { PARTS } from "./parts.ts";
import { readGrids } from "../markdown/grid.ts";
import { pageWriter } from "./writer.ts";

/** A space of pages in memory, `open` the page in its editor; `edits` what the editor was asked */
function memory(pages: Record<string, string>, open?: string) {
  const map = new Map(Object.entries(pages));
  const edits: string[] = [];
  const editor: Editor = {
    documentName: () => {
      if (open === undefined) throw new Error("no page is open");
      return open;
    },
    text: () => map.get(open!) ?? "",
    replace: (from, to, insert) => {
      const text = map.get(open!) ?? "";
      map.set(open!, text.slice(0, from) + insert + text.slice(to));
      edits.push(`${from}-${to} ${insert}`);
    },
  };
  const space: Space = {
    read: (name) => {
      const text = map.get(name);
      if (text === undefined) throw new Error(`no page ${name}`);
      return text;
    },
    write: (name, text) => void map.set(name, text),
    list: () => [...map.keys()],
    remove: (name) => void map.delete(name),
    rename: (from, to) => {
      if (map.has(to)) return { problem: `${to} exists` };
      map.set(to, map.get(from)!);
      map.delete(from);
      if (open === from) open = to;
      return {};
    },
  };
  return { map, edits, writer: pageWriter({ editor, space }) };
}

describe("the page writer", () => {
  it("plans changes in the model's terms, writes nothing, then applies them", async () => {
    const { map, writer } = memory({ A: "---\ntitle: X # mine\nstatus: Todo\n---\n#bug here", B: "nothing" });
    const changes = pageChanges()
      .page("A", (p) => p.properties.set("status", "Done").tags.rename("bug", "defect"))
      .page("B", (p) => p.properties.set("due", "2026-11-10"))
      .build();
    const plan = await writer.plan(changes);
    expect(plan.pages.map((page) => [page.page, page.changes])).toEqual([["A", 2], ["B", 1]]);
    expect(plan.pages[0]!.tagChanges()).toEqual({ gone: ["bug"], added: ["defect"] });
    expect(map.get("A")).toContain("status: Todo");
    const report = await writer.apply(plan);
    expect(report.written).toHaveLength(2);
    expect(map.get("A")).toBe("---\ntitle: X # mine\nstatus: Done\n---\n#defect here");
    expect(map.get("B")).toBe('---\ndue: "2026-11-10"\n---\nnothing');
  });

  it("writes the page open through the editor, in one edit", async () => {
    const { edits, writer } = memory({ A: "one #a two" }, "A");
    await writer.write(pageChanges().page("A", (p) => p.tags.rename("a", "c")).build());
    expect(edits).toEqual(["5-6 c"]);
  });

  it("leaves a page alone where asked, and one whose changes cannot be made, saying why", async () => {
    const { writer } = memory({ Meta: "---\ntags: meta\n---\n#x", Odd: "---\ntags: [a,\n  b]\n---\n#x", Fine: "#x" });
    const changes = pageChanges()
      .page("Meta", (p) => p.tags.rename("x", "y"))
      .page("Odd", (p) => p.tags.add("z"))
      .page("Fine", (p) => p.tags.rename("x", "y"))
      .page("Gone", (p) => p.tags.rename("x", "y"))
      .build();
    const plan = await writer.plan(changes, { leaveAlone: (page) => (page.tagUses().some((use) => use.name === "meta") ? "a meta page" : undefined) });
    expect(plan.pages.map((page) => page.page)).toEqual(["Fine"]);
    expect(plan.skipped.map((skip) => skip.page)).toEqual(["Meta", "Odd", "Gone"]);
    expect(plan.skipped[0]!.reason).toBe("a meta page");
    expect(plan.skipped[2]!.reason).toMatch(/^could not be read/);
  });

  it("renames a page first, then writes it under its new name; undo puts both back", async () => {
    const { map, writer } = memory({ Old: "status: x", Taken: "" });
    const report = await writer.write(pageChanges().page("Old", (p) => p.rename("New").properties.set("status", "Done")).build());
    expect(report.written.map((page) => [page.page, page.renamedTo])).toEqual([["Old", "New"]]);
    expect([...map.keys()].sort()).toEqual(["New", "Taken"]);
    expect(map.get("New")).toBe("---\nstatus: Done\n---\nstatus: x");
    await writer.apply(await writer.planUndo(report));
    expect(map.get("Old")).toBe("status: x");
    expect(map.has("New")).toBe(false);
    // A name the space refuses: the page left alone, why said
    const refused = await writer.write(pageChanges().page("Old", (p) => p.rename("Taken")).build());
    expect(refused.skipped.map((skip) => skip.reason)).toEqual(["could not be renamed (Taken exists)"]);
  });

  it("reports a page renamed whose text the rename changed as renamed alone, so Undo gives its name back", async () => {
    const { map } = memory({ Old: "see [[Old]]" });
    // A platform following links: the page's link to itself renamed with it
    const rename = (from: string, to: string) => {
      map.set(to, map.get(from)!.split(`[[${from}]]`).join(`[[${to}]]`));
      map.delete(from);
      return {};
    };
    const renaming = pageWriter({ editor: { documentName: () => "", text: () => "", replace: () => undefined }, space: { read: (name) => map.get(name)!, write: (name, text) => void map.set(name, text), list: () => [...map.keys()], rename } });
    const report = await renaming.write(pageChanges().page("Old", (p) => p.rename("New").properties.set("status", "x")).build());
    expect(report.written.map((page) => [page.page, page.renamedTo, page.changes])).toEqual([["Old", "New", 1]]);
    expect(map.get("New")).toBe("see [[New]]");
    await renaming.apply(await renaming.planUndo(report));
    expect([...map.keys()]).toEqual(["Old"]);
  });

  it("refuses a key that is no property", async () => {
    const { writer } = memory({ A: "text" });
    const plan = await writer.plan(pageChanges().page("A", (p) => p.properties.set("tags", ["a"])).build());
    expect(plan.skipped.map((skip) => skip.reason)).toEqual(["tags are no property: change them as tags"]);
  });

  it("lets a user's script edit the text itself, its failure said", async () => {
    const { map, writer } = memory({ A: "abc", B: "x" });
    const report = await writer.write(
      pageChanges()
        .page("A", (p) => p.editText((text) => ({ text: text.toUpperCase(), changes: 1 })))
        .page("B", (p) =>
          p.editText(() => {
            throw new Error("broken");
          }),
        )
        .build(),
    );
    expect(map.get("A")).toBe("ABC");
    expect(report.skipped.map((skip) => skip.reason)).toEqual(["its edit failed (broken): left alone"]);
  });
  it("makes a page, refusing a name taken, and Undo takes it out again only as it was made", async () => {
    const { map, writer } = memory({ Taken: "mine" });
    const report = await writer.write(
      pageChanges()
        .create("Projects/db-tasks/Fix login", (p) => p.properties.set("status", "Todo").properties.set(["_database", "rank"], "a0").body("Steps"))
        .create("Taken", (p) => p.body("over it"))
        .build(),
    );
    expect(report.written.map((page) => [page.page, page.created])).toEqual([["Projects/db-tasks/Fix login", true]]);
    expect(report.skipped.map((skip) => [skip.page, skip.reason])).toEqual([["Taken", "exists already: left alone"]]);
    expect(map.get("Projects/db-tasks/Fix login")).toBe("---\nstatus: Todo\n_database:\n  rank: a0\n---\nSteps");
    expect(map.get("Taken")).toBe("mine");
    // Changed since it was made: Undo leaves it
    map.set("Projects/db-tasks/Fix login", map.get("Projects/db-tasks/Fix login") + " more");
    expect((await writer.apply(await writer.planUndo(report))).written).toEqual([]);
    expect(map.has("Projects/db-tasks/Fix login")).toBe(true);
    map.set("Projects/db-tasks/Fix login", "---\nstatus: Todo\n_database:\n  rank: a0\n---\nSteps");
    await writer.apply(await writer.planUndo(report));
    expect(map.has("Projects/db-tasks/Fix login")).toBe(false);
  });

  it("removes a page only as read, keeping its text for Undo, which makes it again where its name is free", async () => {
    const { map, writer } = memory({ Old: "---\nstatus: Done\n---\nnotes", Other: "x" });
    const plan = await writer.plan(pageChanges().page("Old", (p) => p.remove()).page("Other", (p) => p.remove()).build());
    map.set("Other", "changed");
    const report = await writer.apply(plan);
    expect(report.written.map((page) => [page.page, page.removed])).toEqual([["Old", true]]);
    expect(report.skipped.map((skip) => skip.page)).toEqual(["Other"]);
    expect(map.has("Old")).toBe(false);
    const undo = await writer.planUndo(report);
    map.set("Old", "someone else's");
    expect((await writer.apply(undo)).skipped.map((skip) => skip.reason)).toEqual(["its name was taken since it was removed: left as it is"]);
    map.delete("Old");
    await writer.apply(await writer.planUndo(report));
    expect(map.get("Old")).toBe("---\nstatus: Done\n---\nnotes");
    expect((await writer.plan(pageChanges().page("Other", (p) => p.remove().properties.set("x", 1)).build())).skipped).toHaveLength(1);
  });

  it("writes a key down a path of maps, keeping the rest of the map and of the page as written", async () => {
    const page = "---\ntitle: Mine # kept\n_database:\n  id: tasks\n  properties:\n    status: { type: select, options: [Todo, Done] }\nstatus: Todo\n---\nbody";
    const { map, writer } = memory({ Root: page, Odd: "---\n_database: &x\n  id: 1\n---\n", Flat: "---\n_database: 3\n---\n" });
    await writer.write(pageChanges().page("Root", (p) => p.properties.set(["_database", "properties", "due"], { type: "date", label: "Due" }).properties.set(["_database", "name"], "Tasks")).build());
    expect(map.get("Root")).toBe(
      "---\ntitle: Mine # kept\n_database:\n  id: tasks\n  properties:\n    status: { type: select, options: [Todo, Done] }\n    due: { type: date, label: Due }\n  name: Tasks\nstatus: Todo\n---\nbody",
    );
    await writer.write(pageChanges().page("Root", (p) => p.properties.remove(["_database", "properties", "status"])).build());
    expect(map.get("Root")).toContain("  properties:\n    due: { type: date, label: Due }\n  name: Tasks\nstatus: Todo\n");
    const refused = await writer.plan(pageChanges().page("Odd", (p) => p.properties.set(["_database", "rank"], "a0")).page("Flat", (p) => p.properties.set(["_database", "rank"], "a0")).build());
    expect(refused.skipped.map((skip) => skip.reason)).toEqual([
      expect.stringMatching(/^its frontmatter's _database is written in a form not read here/),
      `its frontmatter's _database.rank: "_database" holds no map: left alone`,
    ]);
  });

  it("sets a page's body, its frontmatter kept", async () => {
    const { map, writer } = memory({ A: "---\nstatus: x\n---\nold body", B: "no frontmatter" });
    await writer.write(pageChanges().page("A", (p) => p.body("new body")).page("B", (p) => p.body("replaced")).build());
    expect([map.get("A"), map.get("B")]).toEqual(["---\nstatus: x\n---\nnew body", "replaced"]);
  });
  it("leaves a key's lines whole: a list at the key's own indent, a quoted twin, comments where nothing changes", async () => {
    const { map, writer } = memory({
      List: "---\n_database:\n- a\n- b\nother: 1\n---\nbody",
      Twin: '---\n"_database":\n  rank: a\n---\n',
      Comments: "---\n_database: # mine\n  # note\n  rank: a # r\n---\n",
    });
    const report = await writer.write(
      pageChanges()
        .page("List", (p) => p.properties.set(["_database", "rank"], "x"))
        .page("Twin", (p) => p.properties.set(["_database", "rank"], "x"))
        .page("Comments", (p) => p.properties.remove(["_database", "missing"]))
        .build(),
    );
    expect(report.written).toEqual([]);
    expect(report.skipped.map((skip) => skip.page)).toEqual(["List", "Twin"]);
    expect([map.get("List"), map.get("Twin"), map.get("Comments")]).toEqual(["---\n_database:\n- a\n- b\nother: 1\n---\nbody", '---\n"_database":\n  rank: a\n---\n', "---\n_database: # mine\n  # note\n  rank: a # r\n---\n"]);
  });

  it("never replaces a key typed by hand in a form not read with a plain value, and keeps a page's line breaks", async () => {
    const { map, writer } = memory({ Mine: "---\nstatus:\n  nested: 1\n---\n", Crlf: "---\r\ntitle: x\r\n---\r\nbody" });
    const report = await writer.write(pageChanges().page("Mine", (p) => p.properties.set("status", "Done")).page("Crlf", (p) => p.properties.set(["_database", "rank"], "a0")).build());
    expect(report.skipped.map((skip) => skip.page)).toEqual(["Mine"]);
    expect(map.get("Mine")).toBe("---\nstatus:\n  nested: 1\n---\n");
    expect(map.get("Crlf")).toBe("---\r\ntitle: x\r\n_database:\r\n  rank: a0\r\n---\r\nbody");
  });

  it("puts a body after a closing fence with no line break after it, the frontmatter kept", async () => {
    const { map, writer } = memory({ A: "---\na: 1\n---" });
    await writer.write(pageChanges().page("A", (p) => p.body("hello")).build());
    expect(map.get("A")).toBe("---\na: 1\n---\nhello");
  });

  it("writes a key named as an object's own property as any key", async () => {
    const { map, writer } = memory({ A: "" });
    await writer.write(pageChanges().page("A", (p) => p.properties.set(["_database", "__proto__"], "x").properties.set(["_database", "constructor"], 1)).build());
    expect(map.get("A")).toBe("---\n_database:\n  __proto__: x\n  constructor: 1\n---\n");
  });

  it("makes no page of a name another has in another case", async () => {
    const { map, writer } = memory({ "Projects/Plan": "mine" });
    const report = await writer.write(pageChanges().create("projects/plan", (p) => p.body("x")).build());
    expect(report.written).toEqual([]);
    expect([...map.keys()]).toEqual(["Projects/Plan"]);
  });  it("takes a map off by its key, and leaves a key under none as it is", async () => {
    const { map, writer } = memory({ A: "---\n_database:\n  rank: a1\ntitle: x\n---\nbody", B: "---\n_database: { rank: a1 }\n---\n", C: "---\n_database: ~ # keep\n---\n" });
    const report = await writer.write(
      pageChanges()
        .page("A", (p) => p.properties.remove("_database"))
        .page("B", (p) => p.properties.remove("_database"))
        .page("C", (p) => p.properties.remove(["_database", "rank"]))
        .build(),
    );
    expect(report.written.map((page) => page.page)).toEqual(["A", "B"]);
    expect([map.get("A"), map.get("B"), map.get("C")]).toEqual(["---\ntitle: x\n---\nbody", "", "---\n_database: ~ # keep\n---\n"]);
  });

  it("refuses a value that is none of a page's, a key written twice or in quotes that do not read, and a page open in the editor to remove", async () => {
    const { writer } = memory({ A: "", Twice: "---\n_database:\n  rank: a1\n_database:\n  rank: b2\n---\n", Odd: '---\n"a\\x": 1\n---\n', Open: "x" }, "Open");
    const plan = await writer.plan(
      pageChanges()
        .page("A", (p) => p.properties.set(["_database"], { a: undefined, b: 1 } as never).properties.set("d", new Date(0) as never))
        .page("Twice", (p) => p.properties.set(["_database", "rank"], "c"))
        .page("Odd", (p) => p.properties.set(["_database", "rank"], "c"))
        .page("Open", (p) => p.remove())
        .build(),
    );
    expect(plan.pages).toEqual([]);
    expect(plan.skipped.map((skip) => skip.reason)).toEqual([
      "a: undefined is no value of a page",
      "its frontmatter has _database twice: left alone",
      "its frontmatter's _database is written in quotes: left alone",
      "open in the editor: open another page first",
    ]);
  });

  it("writes a page of CRLF line breaks with CRLF, its fences too", async () => {
    const { map, writer } = memory({ A: "line1\r\nline2", B: "---\r\na: 1\r\n---" });
    await writer.write(pageChanges().page("A", (p) => p.properties.set(["_database", "rank"], "a")).page("B", (p) => p.body("x")).build());
    expect(map.get("A")).toBe("---\r\n_database:\r\n  rank: a\r\n---\r\nline1\r\nline2");
    expect(map.get("B")).toBe("---\r\na: 1\r\n---\r\nx");
  });  it("writes a code block of a language and text anew, the one of its kind asked, and leaves a page whose block changed", async () => {
    const page = "# Tasks\n```silverware-database\nid: tasks\n```\ntext\n```silverware-database\nid: tasks\n```\n```silverware-database\n```\n";
    const { map, writer } = memory({ A: page, Crlf: "```silverware-database\r\nid: x\r\n```\r\n", End: "x\n```silverware-database" });
    const report = await writer.write(
      pageChanges()
        .page("A", (p) => p.codeBlocks.replace("silverware-database", "id: tasks", "id: tasks\nview: kanban", { occurrence: 1, of: 2 }).codeBlocks.replace("silverware-database", "", "id: new"))
        .page("Crlf", (p) => p.codeBlocks.replace("silverware-database", "id: x", "id: x\nview: list"))
        .build(),
    );
    expect(report.skipped).toEqual([]);
    expect(map.get("A")).toBe("# Tasks\n```silverware-database\nid: tasks\n```\ntext\n```silverware-database\nid: tasks\nview: kanban\n```\n```silverware-database\nid: new\n```\n");
    expect(map.get("Crlf")).toBe("```silverware-database\r\nid: x\r\nview: list\r\n```\r\n");
    const end = await writer.write(pageChanges().page("End", (p) => p.codeBlocks.replace("silverware-database", "", "id: b")).build());
    expect([end.skipped, map.get("End")]).toEqual([[], "x\n```silverware-database\nid: b\n"]);
    const gone = await writer.plan(pageChanges().page("A", (p) => p.codeBlocks.replace("silverware-database", "id: other", "x")).build());
    expect(gone.skipped.map((one) => one.reason)).toEqual(["its silverware-database block changed since it was read: left alone"]);
    // Counted as two alike where the page has one now (the other written since), and a block in a list item: left alone
    const more = await writer.plan(pageChanges().page("A", (p) => p.codeBlocks.replace("silverware-database", "id: tasks", "x", { occurrence: 0, of: 2 })).build());
    expect(more.skipped).toHaveLength(1);
    map.set("List", "- item\n  ```silverware-database\n  id: tasks\n  ```\n- next\n");
    const listed = await writer.plan(pageChanges().page("List", (p) => p.codeBlocks.replace("silverware-database", "  id: tasks", "  id: tasks\nview: b")).build());
    expect(listed.skipped.map((one) => one.reason)).toEqual(["its silverware-database block is indented (in a list item): it is written by hand only"]);
  });

  it("takes a code block out whole, one blank line left where one was on both sides; the one asked of those alike; Undo puts it back", async () => {
    const block = "```silverware-database\nid: tasks\n```\n";
    const { map, writer } = memory({
      A: `# A\n\n${block}\nAfter.\n`,
      Twice: `${block}\ntext\n\n${block}`,
      Tight: `before\n${block}after\n`,
      First: `${block}\nrest\n`,
      Crlf: "a\r\n\r\n```silverware-database\r\nid: tasks\r\n```\r\n\r\nb\r\n",
    });
    const report = await writer.write(
      pageChanges()
        .page("A", (p) => p.codeBlocks.remove("silverware-database", "id: tasks"))
        .page("Twice", (p) => p.codeBlocks.remove("silverware-database", "id: tasks", { occurrence: 1, of: 2 }))
        .page("Tight", (p) => p.codeBlocks.remove("silverware-database", "id: tasks"))
        .page("First", (p) => p.codeBlocks.remove("silverware-database", "id: tasks"))
        .page("Crlf", (p) => p.codeBlocks.remove("silverware-database", "id: tasks"))
        .build(),
    );
    expect(report.skipped).toEqual([]);
    expect(map.get("A")).toBe("# A\n\nAfter.\n");
    expect(map.get("Twice")).toBe(`${block}\ntext\n\n`);
    expect(map.get("Tight")).toBe("before\nafter\n");
    expect(map.get("First")).toBe("rest\n");
    expect(map.get("Crlf")).toBe("a\r\n\r\nb\r\n");
    const back = await writer.apply(await writer.planUndo(report));
    expect(back.skipped).toEqual([]);
    expect(map.get("A")).toBe(`# A\n\n${block}\nAfter.\n`);
    // A block changed since it was read: the page left alone
    const gone = await writer.plan(pageChanges().page("A", (p) => p.codeBlocks.remove("silverware-database", "id: other")).build());
    expect(gone.skipped.map((one) => one.reason)).toEqual(["its silverware-database block changed since it was read: left alone"]);
  });

  it("writes a grid's cell with a blank line before and after its content, the grid of those alike asked, and leaves a grid changed", async () => {
    const grid = "<grid>\n<column>\nOld\n</column>\n<column>\n\nKeep\n\n</column>\n</grid>";
    const body = "<column>\nOld\n</column>\n<column>\n\nKeep\n\n</column>";
    const { map, writer } = memory({ A: `# A\n\n${grid}\n\n${grid}\n`, Crlf: "<grid>\r\n<column>\r\nx\r\n</column>\r\n</grid>\r\n" });
    const report = await writer.write(
      pageChanges()
        .page("A", (p) => p.grids.replaceCell(body, 0, "New\n- a", { occurrence: 1, of: 2 }))
        .page("Crlf", (p) => p.grids.replaceCell("<column>\r\nx\r\n</column>", 0, "y\nz"))
        .build(),
    );
    expect(report.skipped).toEqual([]);
    expect(map.get("A")).toBe(`# A\n\n${grid}\n\n<grid>\n<column>\n\nNew\n- a\n\n</column>\n<column>\n\nKeep\n\n</column>\n</grid>\n`);
    expect(map.get("Crlf")).toBe("<grid>\r\n<column>\r\n\r\ny\r\nz\r\n\r\n</column>\r\n</grid>\r\n");
    // Its content as written already: nothing to write; emptied: one blank line left
    const same = await writer.plan(pageChanges().page("A", (p) => p.grids.replaceCell(body, 1, "Keep")).build());
    expect(same.pages).toEqual([]);
    await writer.write(pageChanges().page("A", (p) => p.grids.replaceCell(body, 1, "")).build());
    expect(map.get("A")!.startsWith(`# A\n\n<grid>\n<column>\nOld\n</column>\n<column>\n\n</column>\n</grid>`)).toBe(true);
    // A grid changed since it was read, a cell not there, two alike counted where one is: left alone
    const gone = await writer.plan(pageChanges().page("A", (p) => p.grids.replaceCell("<column>\nOther\n</column>", 0, "x")).build());
    expect(gone.skipped.map((one) => one.reason)).toEqual(["its grid changed since it was read: left alone"]);
    expect((await writer.plan(pageChanges().page("Crlf", (p) => p.grids.replaceCell("<column>\r\ny\r\nz\r\n</column>", 3, "x")).build())).skipped).toHaveLength(1);
  });

  it("sets a grid's attributes on its <grid> line, the others kept, one taken off, a name refused", async () => {
    const body = "<column>\nA\n</column>";
    const { map, writer } = memory({ A: `<grid columns="1fr 2fr">\r\n${body.replace(/\n/g, "\r\n")}\r\n</grid>\r\n` });
    await writer.write(pageChanges().page("A", (p) => p.grids.setAttributes(body, { width: "1100" })).build());
    expect(map.get("A")!.split("\r\n")[0]).toBe('<grid columns="1fr 2fr" width="1100">');
    await writer.write(pageChanges().page("A", (p) => p.grids.setAttributes(body, { width: null, columns: "3" })).build());
    expect(map.get("A")).toBe(`<grid columns="3">\r\n<column>\r\nA\r\n</column>\r\n</grid>\r\n`);
    const same = await writer.plan(pageChanges().page("A", (p) => p.grids.setAttributes(body, { columns: "3" })).build());
    expect(same.pages).toEqual([]);
    const bad = await writer.plan(pageChanges().page("A", (p) => p.grids.setAttributes(body, { "a b": "x" })).build());
    expect(bad.skipped.map((one) => one.reason)).toEqual(['"a b" is no attribute\'s name (letters, digits, -, _, : and . only, not first a digit)']);
  });

  it("writes an embed's size and metadata, the one of those alike asked, and leaves one changed", async () => {
    const { map, writer } = memory({ A: "x ![[cat.png]] y ![[cat.png]]\n" });
    await writer.write(pageChanges().page("A", (p) => p.embeds.set("![[cat.png]]", { width: "300", metadata: { view: "preview" } }, { occurrence: 1, of: 2 })).build());
    expect(map.get("A")).toBe("x ![[cat.png]] y ![[cat.png||300|{ view: preview }]]\n");
    const gone = await writer.plan(pageChanges().page("A", (p) => p.embeds.set("![[dog.png]]", { width: "1" })).build());
    expect(gone.skipped.map((one) => one.reason)).toEqual(["its embed changed since it was read: left alone"]);
    const same = await writer.plan(pageChanges().page("A", (p) => p.embeds.set("![[cat.png]]", {})).build());
    expect(same.pages).toEqual([]);
  });

  it("writes an embed as a link and a link as an embed, the one of those alike asked", async () => {
    const { map, writer } = memory({ A: "![[cat.png|Cat|300|{ view: icon }]] and [[doc.pdf]] [[doc.pdf]]\n" });
    await writer.write(pageChanges().page("A", (p) => p.embeds.toLink("![[cat.png|Cat|300|{ view: icon }]]")).build());
    expect(map.get("A")).toBe("[[cat.png|Cat]] and [[doc.pdf]] [[doc.pdf]]\n");
    await writer.write(pageChanges().page("A", (p) => p.links.toEmbed("[[doc.pdf]]", { occurrence: 1, of: 2 })).build());
    expect(map.get("A")).toBe("[[cat.png|Cat]] and [[doc.pdf]] ![[doc.pdf]]\n");
    const gone = await writer.plan(pageChanges().page("A", (p) => p.links.toEmbed("[[nope.pdf]]")).build());
    expect(gone.skipped.map((one) => one.reason)).toEqual(["its link changed since it was read: left alone"]);
  });

  it("puts a selection's blocks into a grid, the text as read alone", async () => {
    const text = "Top\n\nOne\n\nTwo\n\nThree\n";
    const { map, writer } = memory({ A: text });
    const from = text.indexOf("One");
    const to = text.indexOf("Three") + 5;
    await writer.write(pageChanges().page("A", (p) => p.grids.put(from, to, text.slice(from, to), "split", 2)).build());
    expect(map.get("A")).toBe("Top\n\n<grid>\n<column>\n\nOne\n\nTwo\n\n</column>\n<column>\n\nThree\n\n</column>\n</grid>\n");
    const stale = await writer.plan(pageChanges().page("A", (p) => p.grids.put(from, to, "something else", "gallery", 3)).build());
    expect(stale.skipped.map((one) => one.reason)).toEqual(["the text changed since it was read: left alone"]);
  });

  it("changes a grid's cells: one moved, one added, one taken out under it, all taken apart", async () => {
    const grid = '<grid columns="3">\n<column>\n\nA\n\n</column>\n<column>\n\nB\n\n</column>\n</grid>';
    const body = readGrids(grid)[0]!.body;
    const { map, writer } = memory({ A: `${grid}\n\nAfter\n` });
    const change = async (cells: Parameters<PageBuilder["grids"]["changeCells"]>[1]) => {
      const now = readGrids(map.get("A")!)[0]!.body;
      await writer.write(pageChanges().page("A", (p) => p.grids.changeCells(now, cells)).build());
    };
    await change({ kind: "move", cell: 0, by: 1 });
    expect(map.get("A")).toBe('<grid columns="3">\n<column>\n\nB\n\n</column>\n<column>\n\nA\n\n</column>\n</grid>\n\nAfter\n');
    await change({ kind: "add", after: 0 });
    expect(readGrids(map.get("A")!)[0]!.cells.map((cell) => cell.content)).toEqual(["B", "", "A"]);
    await change({ kind: "takeOut", cell: 2 });
    expect(map.get("A")).toBe('<grid columns="3">\n<column>\n\nB\n\n</column>\n<column>\n\n\n</column>\n</grid>\n\nA\n\nAfter\n');
    await change({ kind: "ungrid" });
    expect(map.get("A")).toBe("B\n\nA\n\nAfter\n");
    expect(body).toContain("<column>");
  });

  it("closes a grid's cell left open as it writes it", async () => {
    const { map, writer } = memory({ A: "<grid>\n<column>\nOpen\n</grid>" });
    await writer.write(pageChanges().page("A", (p) => p.grids.replaceCell("<column>\nOpen", 0, "Shut")).build());
    expect(map.get("A")).toBe("<grid>\n<column>\n\nShut\n\n</column>\n</grid>");
  });
});

describe("the builder", () => {
  it("has every section the parts make, each a part of its own", () => {
    const sections = PARTS.flatMap((one) => (one.section ? [one.section.name] : []));
    expect(sections).toEqual(["properties", "tags", "codeBlocks", "grids", "embeds", "links"]);
    pageChanges().page("A", (p) => {
      for (const name of sections) expect(Object.values(p[name]).every((method) => typeof method === "function"), name).toBe(true);
    });
  });
  it("keeps a page named twice as one, its changes in the order made, and is done once built", () => {
    const builder = pageChanges()
      .page("A", (p) => p.tags.add("x"))
      .page("B", (p) => p.tags.remove(["y", "z"], { from: "body", keepWord: true }))
      .page("A", (p) => p.properties.remove("old"));
    const changes = builder.build();
    expect(changes.map((page) => [page.page, page.changes.map((change) => change.kind)])).toEqual([
      ["A", ["addTags", "removeProperty"]],
      ["B", ["removeTags"]],
    ]);
    expect(Object.isFrozen(changes) && Object.isFrozen(changes[0]!.changes)).toBe(true);
    expect(() => builder.page("C", (p) => p.tags.add("x"))).toThrow(/built already/);
  });
});

describe("the history", () => {
  it("keeps the changes applied, the last first; an undo takes the change it undid off", async () => {
    const { map, writer } = memory({ A: "#a", B: "#b" });
    const history = new PageHistory(writer);
    const nothing = await writer.write(pageChanges().page("A", (p) => p.tags.rename("zz", "y")).build());
    history.record(nothing, "Nothing");
    expect(history.last).toBeUndefined();
    const first = await writer.write(pageChanges().page("A", (p) => p.tags.rename("a", "a2")).build());
    history.record(first, "First");
    const second = await writer.write(pageChanges().page("B", (p) => p.tags.rename("b", "b2")).build());
    history.record(second, "Second");
    expect(history.last?.label).toBe("Second");
    await history.undo();
    expect(map.get("B")).toBe("#b");
    expect(history.last?.label).toBe("First");
    expect(history.has(second)).toBe(false);
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
