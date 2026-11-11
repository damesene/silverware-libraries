import { describe, expect, it } from "vitest";
import { allBlocks, type Block, readBlocks } from "./blocks.ts";

/** A block as its kind and text, its children nested: what a test compares */
const shape = (blocks: readonly Block[]): unknown[] =>
  blocks.map((block) => {
    switch (block.kind) {
      case "heading":
        return [`h${block.level} ${block.text}`, shape(block.children)];
      case "item":
        return [`${block.task ? `[${block.task.state}] ` : ""}${block.text}`, shape(block.children)];
      case "quote":
        return ["quote", shape(block.children)];
      case "table":
        return ["table", block.header, block.rows];
      case "code":
        return [`code ${block.language}`, block.text];
      case "rule":
        return ["rule"];
      default:
        return [block.kind, block.text];
    }
  });

describe("readBlocks", () => {
  it("nests a list's items, what is under an item its own, its lines as written dedented", () => {
    const blocks = readBlocks(["- [ ] A", "  - [x] A1", "", "    more", "", "  > a quote", "- B", "1. C"].join("\n"));
    expect(shape(blocks)).toEqual([
      ["[ ] A", [["[x] A1", [["paragraph", "more"]]], ["quote", [["paragraph", "a quote"]]]]],
      ["B", []],
      ["C", []],
    ]);
    expect(blocks[0]).toMatchObject({ kind: "item", list: "bullet", body: "- [x] A1\n\n  more\n\n> a quote", title: { from: 0, to: 1 }, lines: { from: 0, to: 6 } });
    expect(blocks[2]).toMatchObject({ list: "numbered", number: 1 });
    // A nested block's lines are the text's
    expect((blocks[0] as { children: readonly Block[] }).children[1]!.lines).toEqual({ from: 5, to: 6 });
  });

  it("gives an item its first paragraph's text, a line going on it lazily too, as SilverBullet does", () => {
    const blocks = readBlocks("- [ ] A\n  goes on\nlazily\n\n  para");
    expect(shape(blocks)).toEqual([["[ ] A\ngoes on\nlazily", [["paragraph", "para"]]]]);
    expect(blocks[0]).toMatchObject({ title: { from: 0, to: 3 }, body: "para" });
    // An item starting with no paragraph has no text, all it holds its body
    const code = readBlocks("- ```\n  code\n  ```\n  after");
    expect(shape(code)).toEqual([["", [["code ", "code"], ["paragraph", "after"]]]]);
    expect(code[0]).toMatchObject({ title: { from: 0, to: 0 }, body: "```\ncode\n```\nafter" });
    // A body in a quote without the quote's markers; a task not an item's first block a paragraph, its state kept
    const quoted = readBlocks("> - [ ] q\n>   more\n>\n>   para\n>\n>   [x] later");
    expect(shape(quoted)).toEqual([["quote", [["[ ] q\nmore", [["paragraph", "para"], ["paragraph", "[x] later"]]]]]]);
    expect(allBlocks(quoted)[1]).toMatchObject({ body: "para\n\n[x] later" });
  });

  it("reads a quote's blocks, HTML and a comment as blocks of their own", () => {
    expect(shape(readBlocks("> # T\n> - item\n\n<div>\n  x\n</div>\n\n<!-- hidden\n- [ ] no -->"))).toEqual([
      ["quote", [["h1 T", [["item", []]]]]],
      ["html", "<div>\nx\n</div>"],
      ["comment", " hidden\n- [ ] no "],
    ]);
  });

  it("takes an item indented less than the one before as one of the same level", () => {
    expect(shape(readBlocks("  - A\n    - A1\n- B"))).toEqual([
      ["A", [["A1", []]]],
      ["B", []],
    ]);
  });

  it("gives a heading its section: the blocks up to a heading of its level or above", () => {
    const blocks = readBlocks(["Intro", "# One", "text", "## One.a", "- item", "# Two", "end"].join("\n"));
    expect(shape(blocks)).toEqual([
      ["paragraph", "Intro"],
      ["h1 One", [["paragraph", "text"], ["h2 One.a", [["item", []]]]]],
      ["h1 Two", [["paragraph", "end"]]],
    ]);
    expect(blocks[1]!.lines).toEqual({ from: 1, to: 5 });
  });

  it("reads a table's header and cells, its dashes left out, an escaped bar kept in its cell", () => {
    expect(shape(readBlocks("| Name | Due |\n|---|:--:|\n| Call | 2026-11-12 |\n| a \\| b | |"))).toEqual([
      ["table", ["Name", "Due"], [["Call", "2026-11-12"], ["a | b", ""]]],
    ]);
  });

  it("makes a section reach as far as what it holds, a heading in it and one under an item too", () => {
    expect(readBlocks("# A\n## B\n# C")[0]!.lines).toEqual({ from: 0, to: 2 });
    expect(readBlocks("# A\ntext\n## B")[0]!.lines).toEqual({ from: 0, to: 3 });
    expect(shape(readBlocks("- A\n  # H\n  text\n  ## H2\n  more"))).toEqual([["A", [["h1 H", [["paragraph", "text"], ["h2 H2", [["paragraph", "more"]]]]]]]]);
  });

  it("reads setext headings, a heading's closing #s off, and leaves a frontmatter out", () => {
    expect(shape(readBlocks("Title\n===\nSub\nline\n---\n\nText\n\n---"))).toEqual([
      ["h1 Title", [["h2 Sub line", [["paragraph", "Text"], ["rule"]]]]],
    ]);
    expect(shape(readBlocks("## Done ##\n# C#"))).toEqual([["h2 Done", []], ["h1 C#", []]]);
    // A heading's own lines apart from its section's
    expect(readBlocks("Title\n===\ntext")[0]).toMatchObject({ title: { from: 0, to: 2 }, lines: { from: 0, to: 3 } });
    const page = readBlocks("---\ntags: [a]\nlist:\n- x\n---\n# T");
    expect(shape(page)).toEqual([["h1 T", []]]);
    expect(page[0]!.lines).toEqual({ from: 5, to: 6 });
    // A rule over a paragraph (no key under it) is no frontmatter
    expect(shape(readBlocks("---\ntext\n---"))).toEqual([["rule"], ["h2 text", []]]);
  });

  it("gives every block of a tree in the text's order", () => {
    const kinds = allBlocks(readBlocks("# H\n| a |\n|---|\n| 1 |\n- item\n\n  text\n> quoted")).map((block) => block.kind);
    expect(kinds).toEqual(["heading", "table", "item", "paragraph", "quote", "paragraph"]);
  });

  it("reads lines starting with | as a table only with its line of dashes", () => {
    expect(shape(readBlocks("| a | b |\n| c | d |"))).toEqual([["paragraph", "| a | b |\n| c | d |"]]);
  });

  it("keeps fenced code as written: its own indentation, its blank lines, an unclosed one to the end", () => {
    expect(shape(readBlocks("  ```\n    indented\n\n  x\n\n  ```"))).toEqual([["code ", "  indented\n\nx\n"]]);
    expect(shape(readBlocks("```\nopen\n- [ ] no"))).toEqual([["code ", "open\n- [ ] no"]]);
  });

  it("reads a text's CRLF line breaks as line breaks", () => {
    expect(shape(readBlocks("- [ ] A\r\n  - [x] B\r\n---\r\n"))).toEqual([["[ ] A", [["[x] B", []]]], ["rule"]]);
  });

  it("reads fenced code whole, nothing in it a block, and joins a paragraph's lines", () => {
    expect(shape(readBlocks("Two\nlines\n\n```lua\n- [ ] not a task\n```\n---"))).toEqual([
      ["paragraph", "Two\nlines"],
      ["code lua", "- [ ] not a task"],
      ["rule"],
    ]);
  });
});
