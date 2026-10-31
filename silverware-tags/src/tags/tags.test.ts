import { describe, expect, it } from "vitest";
import { addPageTags, pageTags, removePageTags, removeTags, renameTags, tagUses } from "./edit.ts";
import { readFrontmatter, writeTags } from "./frontmatter.ts";
import { cleanName, hashtagOf, isWithin, nameProblem, renamedTag } from "./names.ts";
import { scanHashtags } from "./scan.ts";
import { filterTree, tagTree } from "./tree.ts";

const names = (text: string) => scanHashtags(text, readFrontmatter(text).bodyStart).map((t) => `${t.name}:${t.context}`);

describe("names", () => {
  it("writes a name as a hashtag, in < > where it must", () => {
    expect(hashtagOf("project/alpha")).toBe("#project/alpha");
    expect(hashtagOf("two words")).toBe("#<two words>");
    expect(hashtagOf("2024")).toBe("#<2024>");
  });
  it("renames a tag and, with its subtags, those under it", () => {
    expect(renamedTag("project", "project", "work", false)).toBe("work");
    expect(renamedTag("project/alpha", "project", "work", false)).toBeUndefined();
    expect(renamedTag("project/alpha", "project", "work/project", true)).toBe("work/project/alpha");
    expect(renamedTag("projects", "project", "work", true)).toBeUndefined();
    expect(isWithin("a/b", "a")).toBe(true);
    expect(isWithin("ab", "a")).toBe(false);
  });
  it("reads a typed name and says what is wrong with one", () => {
    expect(cleanName(" #todo ")).toBe("todo");
    expect(cleanName("#<two words>")).toBe("two words");
    expect(nameProblem("")).toBeDefined();
    expect(nameProblem("a//b")).toBeDefined();
    expect(nameProblem("a/b")).toBeUndefined();
  });
});

describe("scanning", () => {
  it("finds hashtags with their context", () => {
    const text = "#a #b\n\nText with #c in it.\n\n- item #d\n- [ ] task #e\n  more #f\n\n# Heading #g\n\n| x #h |\n|---|\n\n> quote #i";
    expect(names(text)).toEqual(["a:page", "b:page", "c:paragraph", "d:item", "e:task", "f:task", "g:heading", "h:table", "i:paragraph"]);
  });
  it("leaves out code, links, URLs, HTML, entities, Lua and escapes", () => {
    const text = [
      "```js",
      "#notag",
      "```",
      "`#code` [[Page#Heading]] [text #yes here](http://x.y/#frag) https://a.b/#c <span id=\"#x\"> &#x27; ${'#lua'} \\#esc #real",
      "",
      "    #indented",
    ].join("\n");
    expect(names(text)).toEqual(["yes:paragraph", "real:paragraph"]);
  });
  it("takes a paragraph's leading lines of tags alone as the page's", () => {
    expect(names("#a\n#b\ntext #c\n#d")).toEqual(["a:page", "b:page", "c:paragraph", "d:paragraph"]);
    expect(names("text\n#a")).toEqual(["a:paragraph"]);
  });
  it("reads tags of several words and leaves out the frontmatter", () => {
    expect(names("---\ntags: [x]\n---\n#<two words> #x")).toEqual(["two words:page", "x:page"]);
  });
});

describe("frontmatter", () => {
  it("reads every form of tags", () => {
    expect(readFrontmatter("---\ntags:\n  - a\n  - \"b c\"\n---\n").key?.items.map((i) => i.name)).toEqual(["a", "b c"]);
    expect(readFrontmatter("---\ntags: [a, 'b']\n---\n").key?.items.map((i) => i.name)).toEqual(["a", "b"]);
    expect(readFrontmatter("---\ntags: a, b\n---\n").key?.items.map((i) => i.name)).toEqual(["a", "b"]);
    expect(readFrontmatter('---\ntags: "#a #b"\n---\n').key?.items.map((i) => i.name)).toEqual(["a", "b"]);
    expect(readFrontmatter("---\ntags: [a,\n  b]\n---\n").unreadable).toBeDefined();
  });
  it("writes tags in the page's own form, the rest as written", () => {
    const block = "---\ntitle: X # mine\ntags:\n  - a\n---\nbody";
    const fm = readFrontmatter(block);
    const edit = writeTags(block, fm, ["a", "b"])!;
    expect(block.slice(0, edit.from) + edit.insert + block.slice(edit.to)).toBe("---\ntitle: X # mine\ntags:\n  - a\n  - b\n---\nbody");
    const flow = "---\ntags: [a]\n---\n";
    const f = writeTags(flow, readFrontmatter(flow), ["a", "b c"])!;
    expect(flow.slice(0, f.from) + f.insert + flow.slice(f.to)).toBe('---\ntags: [a, "b c"]\n---\n');
  });
});

describe("editing", () => {
  it("renames everywhere, merging in the frontmatter", () => {
    const text = "---\ntags:\n  - old\n  - new\n---\n#old\n\n- [ ] do #old/sub\n- item #old";
    const result = renameTags(text, (name) => renamedTag(name, "old", "new", true));
    expect(result.text).toBe("---\ntags:\n  - new\n---\n#new\n\n- [ ] do #new/sub\n- item #new");
    expect(result.changes).toBe(4);
  });
  it("adds page tags into the frontmatter, made where there is none", () => {
    expect(addPageTags("Hello", ["a", "b"]).text).toBe("---\ntags:\n  - a\n  - b\n---\nHello");
    expect(addPageTags("---\ntitle: T\n---\nHello", ["a"]).text).toBe("---\ntitle: T\ntags:\n  - a\n---\nHello");
    // Those it has on a tag line are left out
    expect(addPageTags("#a\n\nHello", ["a"]).changes).toBe(0);
  });
  it("removes page tags from the frontmatter and the tag lines, not from the text", () => {
    const text = "---\ntags: [a, b]\n---\n#a\n\nText #a stays.";
    expect(removePageTags(text, ["a"]).text).toBe("---\ntags: [b]\n---\nText #a stays.");
    expect(removePageTags("---\ntags: [a]\n---\nx", ["a"]).text).toBe("x");
  });
  it("removes a tag everywhere with a space beside it", () => {
    expect(removeTags("Text #a here\n- [ ] do #a", (n) => n === "a").text).toBe("Text here\n- [ ] do");
    // Two side by side taking the same space
    expect(removeTags("x #a #a", (n) => n === "a").text).toBe("x");
  });
  it("leaves a page whose frontmatter it cannot read", () => {
    const result = renameTags("---\ntags: [a,\n b]\n---\n#a", () => "x");
    expect(result.changes).toBe(0);
    expect(result.problem).toBeDefined();
  });
  it("lists a page's tags and every use", () => {
    expect(pageTags("---\ntags: a\n---\n#b\n\n#c in text")).toEqual(["a", "b"]);
    expect(tagUses("- #x").map((u) => u.context)).toEqual(["item"]);
  });
});

describe("tree", () => {
  it("makes levels of names, counting what is under each", () => {
    const tree = tagTree(new Map([["project/alpha", 2], ["project/beta", 1], ["home", 4]]));
    expect(tree.map((n) => [n.name, n.own, n.total])).toEqual([["home", 4, 4], ["project", 0, 3]]);
    expect(filterTree(tree, "bet")[0]!.children.map((n) => n.name)).toEqual(["project/beta"]);
  });
});
