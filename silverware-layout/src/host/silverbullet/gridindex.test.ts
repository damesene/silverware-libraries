import { describe, expect, it } from "vitest";
import { gridRelations, gridTagObjects } from "./gridindex.ts";

describe("a grid's links as SilverBullet's index keeps them", () => {
  it("makes a relation of each, as SilverBullet's index makes one of a link (2.12.1)", () => {
    const links = [
      { to: "Target", toTag: "page" as const, from: 40, end: 50, line: "  A [[Target]] link " },
      { to: "cat.png", toTag: "document" as const, from: 60, end: 80, alias: "Cat|120", line: "![[cat.png|Cat|120]]" },
    ];
    expect(gridRelations("Notes/Page", links, "2026-11-13T10:00:00")).toEqual([
      { ref: "Notes/Page@40", tag: "relation", kind: "mention", from: "Notes/Page", fromTag: "page", to: "Target", toTag: "page", page: "Notes/Page", range: [40, 50], snippet: "A [[Target]] link", pageLastModified: "2026-11-13T10:00:00" },
      { ref: "Notes/Page@60", tag: "relation", kind: "mention", from: "Notes/Page", fromTag: "page", to: "cat.png", toTag: "document", page: "Notes/Page", range: [60, 80], snippet: "![[cat.png|Cat|120]]", pageLastModified: "2026-11-13T10:00:00", alias: "Cat|120" },
    ]);
    expect(gridRelations("P", [])).toEqual([]);
    expect(gridRelations("P", [links[0]!])[0]).not.toHaveProperty("pageLastModified");
  });
});

describe("a grid's hashtags as SilverBullet's index keeps them", () => {
  it("makes a tag of each name and parent, and a paragraph of each holding some", () => {
    const tags = [
      { name: "idea", context: "paragraph" as const },
      { name: "idea", context: "page" as const },
      { name: "todo", context: "item" as const },
      { name: "urgent", context: "task" as const },
      { name: "h", context: "heading" as const },
    ];
    expect(gridTagObjects("P", tags, [{ from: 30, to: 45, text: "A note #idea", tags: ["idea"] }])).toEqual([
      { ref: "idea:page", tag: "tag", name: "idea", page: "P", parent: "page" },
      { ref: "todo:item", tag: "tag", name: "todo", page: "P", parent: "item" },
      { ref: "urgent:task", tag: "tag", name: "urgent", page: "P", parent: "task" },
      { ref: "h:header", tag: "tag", name: "h", page: "P", parent: "header" },
      { ref: "P@30", tag: "paragraph", text: "A note #idea", page: "P", pos: 30, range: [30, 45], tags: ["idea"], itags: ["idea"] },
    ]);
  });
});
