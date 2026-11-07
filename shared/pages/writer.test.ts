import { describe, expect, it } from "vitest";
import type { Editor, Space } from "../platform.ts";
import { pageChanges } from "./changes.ts";
import { diffLines, minimalEdit } from "./diff.ts";
import { PageHistory } from "./history.ts";
import { PARTS } from "./parts.ts";
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
});

describe("the builder", () => {
  it("has every section the parts make, each a part of its own", () => {
    const sections = PARTS.flatMap((one) => (one.section ? [one.section.name] : []));
    expect(sections).toEqual(["properties", "tags"]);
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
