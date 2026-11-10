import { describe, expect, it } from "vitest";
import { addPageTags, pageTags, removePageTags, removeTags, renameTags, tagUses } from "./edit.ts";
import { readFrontmatter, writeTags } from "./frontmatter.ts";
import { hashtagOf } from "../../markdown/inline.ts";
import { cleanName, isMetaTag, isWithin, validateName, renamedTag } from "./names.ts";
import { scanHashtags } from "./scan.ts";

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
  it("tells SilverBullet's own tags", () => {
    expect([isMetaTag("meta"), isMetaTag("meta/library"), isMetaTag("metal"), isMetaTag("meta-notes")]).toEqual([true, true, false, false]);
  });
  it("reads a typed name and says what is wrong with one", () => {
    expect(cleanName(" #todo ")).toBe("todo");
    expect(cleanName("#<two words>")).toBe("two words");
    expect(validateName("")).toBeDefined();
    expect(validateName("a//b")).toBeDefined();
    expect(validateName("a/b")).toBeUndefined();
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
  it("leaves out an attribute's value, as SilverBullet does", () => {
    expect(names("- [ ] task [x: #no] #yes")).toEqual(["yes:task"]);
  });
  it("reads a task of a state of its own as a task, as SilverBullet does", () => {
    expect(names("- [IN PROGRESS] task #a")).toEqual(["a:task"]);
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
  it("quotes a string of tags YAML would read otherwise", () => {
    const string = "---\ntags: a b\n---\n";
    const write = (names: string[]) => {
      const edit = writeTags(string, readFrontmatter(string), names)!;
      return string.slice(0, edit.from) + edit.insert + string.slice(edit.to);
    };
    expect(write(["[x]", "b"])).toBe('---\ntags: "[x] b"\n---\n');
    expect(write(["@x"])).toBe('---\ntags: "@x"\n---\n');
    expect(write(["yes"])).toBe('---\ntags: "yes"\n---\n');
    expect(write(["a", "c"])).toBe("---\ntags: a c\n---\n");
    for (const names of [["[x]", "b"], ["@x"], ["yes"]]) expect(readFrontmatter(write(names)).key?.items.map((i) => i.name)).toEqual(names);
    // Dates and hex numbers, which YAML reads as a timestamp or a number
    expect(write(["2024-01-01"])).toBe('---\ntags: "2024-01-01"\n---\n');
    expect(write(["0x1F"])).toBe('---\ntags: "0x1F"\n---\n');
  });
  it("keeps a string of hashtags so", () => {
    const text = '---\ntags: "#a #b"\n---\n';
    expect(renameTags(text, (name) => (name === "a" ? "c" : undefined)).text).toBe('---\ntags: "#c #b"\n---\n');
  });
});

describe("editing", () => {
  it("renames everywhere, merging in the frontmatter", () => {
    const text = "---\ntags:\n  - old\n  - new\n---\n#old\n\n- [ ] do #old/sub\n- item #old";
    const result = renameTags(text, (name) => renamedTag(name, "old", "new", true));
    expect(result.text).toBe("---\ntags:\n  - new\n---\n#new\n\n- [ ] do #new/sub\n- item #new");
    expect(result.changes).toBe(4);
  });
  it("writes a new name in < > where it would run on into the text after it", () => {
    expect(renameTags("x #<my tag>foo y", (name) => (name === "my tag" ? "b" : undefined)).text).toBe("x #<b>foo y");
    expect(renameTags("x #<my tag>, y", (name) => (name === "my tag" ? "b" : undefined)).text).toBe("x #b, y");
  });
  it("adds page tags into the frontmatter, made where there is none", () => {
    expect(addPageTags("Hello", ["a", "b"]).text).toBe("---\ntags: [a, b]\n---\nHello");
    expect(addPageTags("---\ntitle: T\n---\nHello", ["a"]).text).toBe("---\ntitle: T\ntags: [a]\n---\nHello");
    // In the form the setting asks for: - lines, a string (a name with a space: in brackets then)
    expect(addPageTags("Hello", ["a", "b"], "block").text).toBe("---\ntags:\n  - a\n  - b\n---\nHello");
    expect(addPageTags("Hello", ["a", "b"], "string").text).toBe("---\ntags: a, b\n---\nHello");
    expect(addPageTags("Hello", ["a", "b c"], "string").text).toBe('---\ntags: [a, "b c"]\n---\nHello');
    // A name with a space quoted, on the same one line
    expect(addPageTags("Hello", ["two words"]).text).toBe('---\ntags: ["two words"]\n---\nHello');
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
  it("keeps the word where asked, only the # going; a page's own tags go whole", () => {
    const text = "---\ntags: [a, b]\n---\n#a #b\n\nAn #a and #<a b c> here.\n- [ ] do #a/x";
    const all = (n: string) => n === "a" || n === "a b c" || n === "a/x";
    expect(removeTags(text, all, { keepWord: true }).text).toBe("---\ntags: [b]\n---\n#b\n\nAn a and a b c here.\n- [ ] do a/x");
    // The text only: the frontmatter and the tag line stay
    expect(removeTags(text, all, { frontmatter: false, contexts: new Set(["paragraph", "task"]), keepWord: true }).text).toBe("---\ntags: [a, b]\n---\n#a #b\n\nAn a and a b c here.\n- [ ] do a/x");
    // Contexts as a list (a custom operation's); a frontmatter it cannot edit no matter where it is left as it is
    expect(removeTags("---\ntags: [a,\n b]\n---\n- [ ] do #a", all, { frontmatter: false, contexts: ["task"] }).text).toBe("---\ntags: [a,\n b]\n---\n- [ ] do");
    expect(removeTags("---\ntags: [a,\n b]\n---\n- [ ] do #a", all).problem).toBeDefined();
    // The page's own only: the text stays
    expect(removeTags(text, all, { contexts: new Set(["page"]) }).text).toBe("---\ntags: [b]\n---\n#b\n\nAn #a and #<a b c> here.\n- [ ] do #a/x");
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
