import { describe, expect, it } from "vitest";
import { type MarkdownNode, markedLines, parseBlocks } from "./parse.ts";

/** Each block as its kind (and what it has of its own) with its text's lines, or its blocks: what a test compares */
function shape(text: string, from = 0): unknown[] {
  const of = (nodes: readonly MarkdownNode[]): unknown[] =>
    nodes.map((node) => {
      switch (node.kind) {
        case "item":
          return [`item ${node.list}${node.number !== undefined ? ` ${node.number}` : ""}`, of(node.children)];
        case "quote":
          return ["quote", of(node.children)];
        case "comment":
          return ["comment", text.slice(node.body.from, node.body.to), of(node.children)];
        case "rule":
          return ["rule"];
        case "table":
          return ["table", node.rows.map((row) => row.map((cell) => text.slice(cell.from, cell.to)))];
        case "heading":
          return [`h${node.level}`, node.lines.map((line) => text.slice(line.from, line.to))];
        case "task":
          return [`task [${node.state}]${node.done ? " done" : ""}`, node.lines.map((line) => text.slice(line.from, line.to))];
        case "code":
          return [`code ${node.language ?? "indented"}`, node.lines.map((line) => text.slice(line.from, line.to))];
        case "html":
          return [node.inline ? "html" : "html raw", node.lines.map((line) => text.slice(line.from, line.to))];
        default:
          return [node.kind, node.lines.map((line) => text.slice(line.from, line.to))];
      }
    });
  return of(parseBlocks(text, from));
}

describe("parseBlocks", () => {
  it("reads a quote's and an item's blocks, their markers and indentation out of the lines' text", () => {
    expect(shape("> a #x\n> b\n>\n> - c\n>   d")).toEqual([
      ["quote", [["paragraph", ["a #x", "b"]], ["item bullet", [["paragraph", ["c", "d"]]]]]],
    ]);
    expect(shape("1. one\n2) two\n\n   more")).toEqual([
      ["item numbered 1", [["paragraph", ["one"]]]],
      ["item numbered 2", [["paragraph", ["two"]], ["paragraph", ["more"]]]],
    ]);
  });

  it("reads a line going on a paragraph lazily as its, as SilverBullet does", () => {
    expect(shape("> a\nlazy")).toEqual([["quote", [["paragraph", ["a", "lazy"]]]]]);
    expect(shape("- a\nlazy\n\nafter")).toEqual([["item bullet", [["paragraph", ["a", "lazy"]]]], ["paragraph", ["after"]]]);
  });

  it("reads a task as a list item's text starting with a state, of its own too; what is under it the item's", () => {
    expect(shape("- [ ] A\n  more\n\n  para\n  - [IN PROGRESS] B\n- [x] C")).toEqual([
      ["item bullet", [["task [ ]", ["A", "more"]], ["paragraph", ["para"]], ["item bullet", [["task [IN PROGRESS]", ["B"]]]]]],
      ["item bullet", [["task [x] done", ["C"]]]],
    ]);
    // An attribute is no state; a state outside a list's item no task
    expect(shape("- [due: x] text\n\n[ ] not")).toEqual([["item bullet", [["paragraph", ["[due: x] text"]]]], ["paragraph", ["[ ] not"]]]);
  });

  it("reads an item starting with a blank line, its next line not indented then none of its", () => {
    expect(shape("-\n#a")).toEqual([["item bullet", []], ["paragraph", ["#a"]]]);
    expect(shape("-\r\n  a")).toEqual([["item bullet", [["paragraph", ["a"]]]]]);
  });

  it("reads headings without their markers: ATX, closed, empty, setext", () => {
    expect(shape("# One #\n## C#\n#\nSet\next\n---")).toEqual([["h1", ["One"]], ["h2", ["C#"]], ["h1", [""]], ["h2", ["Set", "ext"]]]);
    expect(shape("    # code")).toEqual([["code indented", ["# code"]]]);
  });

  it("reads code: fenced with its language, indented, in a container, its indentation as written", () => {
    expect(shape("  ```js\n    x\n\n  y\n  ```\n\n    code\n      more")).toEqual([
      ["code js", ["  x", "", "y"]],
      ["code indented", ["code", "  more"]],
    ]);
    expect(shape("- ```\n  in item\n  ```\n> ```\n> quoted\n> ```")).toEqual([
      ["item bullet", [["code ", ["in item"]]]],
      ["quote", [["code ", ["quoted"]]]],
    ]);
    expect(shape("```\nopen\n- [ ] no")).toEqual([["code ", ["open", "- [ ] no"]]]);
    expect(shape("```\n```")).toEqual([["code ", []]]);
  });

  it("reads a table's cells, empty and escaped ones too, only with its line of dashes", () => {
    expect(shape("| a | b |\n|---|:-:|\n| #c |  |\nx | y \\| z")).toEqual([["table", [["a", "b"], ["#c", ""], ["x", "y \\| z"]]]]);
    expect(shape("| a |\n| b |")).toEqual([["paragraph", ["| a |", "| b |"]]]);
  });

  it("reads HTML as a block of its own, a comment's body as markdown", () => {
    expect(shape("<div>\n#h\n</div>\n\n<!-- a #c\n- [ ] t\n-->")).toEqual([
      ["html", ["<div>", "#h", "</div>"]],
      ["comment", " a #c\n- [ ] t\n", [["paragraph", ["a #c"]], ["item bullet", [["task [ ]", ["t"]]]]]],
    ]);
  });

  it("tells block-level HTML from raw, a link's definition from a paragraph, and gives a paragraph's elements", () => {
    expect(shape("<pre>\n#x\n</pre>\n\n<span>\na\n</span>\n\n[top]: #a\n\n[^1]: note")).toEqual([
      ["html raw", ["<pre>", "#x", "</pre>"]],
      ["html raw", ["<span>", "a", "</span>"]],
      ["definition", ["[top]: #a"]],
      ["paragraph", ["[^1]: note"]],
    ]);
    const text = "#a *x* `c`  \nb";
    const [paragraph] = parseBlocks(text);
    expect(paragraph?.kind === "paragraph" ? paragraph.inline.map((span) => text.slice(span.from, span.to)) : undefined).toEqual(["*x*", "`c`", "  \n"]);
  });

  it("reads no markdown in a marker comment (a baked section's), as SilverBullet does", () => {
    expect(shape("<!--#lua x-->\nbody\n<!--/lua-->")).toEqual([["comment", "#lua x", []], ["paragraph", ["body"]], ["comment", "/lua", []]]);
  });

  it("takes containers' markers off each line as CommonMark does: tab stops, lazy lines, an unclosed fence's end", () => {
    expect(shape("  \tcode\n      more")).toEqual([["code indented", ["code", "  more"]]]);
    expect(shape("- a\n  > b\n  c")).toEqual([["item bullet", [["paragraph", ["a"]], ["quote", [["paragraph", ["b", "c"]]]]]]]);
    expect(shape("- ```\n  a\n\nb")).toEqual([["item bullet", [["code ", ["a"]]]], ["paragraph", ["b"]]]);
    expect(shape("| a | b | \n|---|---|\n| 1 | 2 |  ")).toEqual([["table", [["a", "b"], ["1", "2"]]]]);
  });

  it("gives an item its lines from its content, its containers' markers and its content's indentation off", () => {
    const text = "> - [ ] q\n>   more\n>\n>     code";
    const [quote] = parseBlocks(text);
    const item = quote?.kind === "quote" ? quote.children[0] : undefined;
    expect(item?.kind === "item" ? item.lines.map((line) => text.slice(line.from, line.to)) : undefined).toEqual(["[ ] q", "more", "", "  code"]);
    expect(shape("-\n  a\n- b")).toEqual([["item bullet", [["paragraph", ["a"]]]], ["item bullet", [["paragraph", ["b"]]]]]);
  });

  it("reads rules, and from a place given on (after a frontmatter), the places the text's", () => {
    expect(shape("---\ntitle: x\n---\n***\ntext", 17)).toEqual([["rule"], ["paragraph", ["text"]]]);
    expect(parseBlocks("ab\ncd", 3)[0]).toMatchObject({ kind: "paragraph", from: 3, to: 5, lines: [{ from: 3, to: 5 }] });
  });

  it("reads a CRLF as a line break, the places the text's, no line's text holding its \\r", () => {
    expect(shape("- a\r\n-\r\n  b\r\n\r\n| x |\r\n|---|\r\n| #y |\r\n")).toEqual([
      ["item bullet", [["paragraph", ["a"]]]],
      ["item bullet", [["paragraph", ["b"]]]],
      ["table", [["x"], ["#y"]]],
    ]);
    expect(shape("<!-- a\r\n#c -->")).toEqual([["comment", " a\r\n#c ", [["paragraph", ["a", "#c "]]]]]);
  });
});

describe("markedLines", () => {
  /** Each line as its quotes' marks, an item's marker, where its text starts and whether it is empty past its marks */
  const marks = (text: string) => markedLines(text).map(({ from, quotes, item, content, empty }) => [from, quotes, item, content, empty]);

  it("gives each line's quote marks, where its text starts past them, and whether it holds nothing past them", () => {
    expect(marks("> one\n>\n> two")).toEqual([
      [0, [0], false, 2, false],
      [6, [6], false, 7, true],
      [8, [8], false, 10, false],
    ]);
    expect(marks("> > one\n>\n\ntwo")).toEqual([
      [0, [0, 2], false, 4, false],
      [8, [8], false, 9, true],
      [10, [], false, 10, true],
      [11, [], false, 11, false],
    ]);
  });

  it("gives a list item's marker, a quote in an item indented as deep as its content", () => {
    expect(marks("- a\n  - b\n    > - c\n    >\n    > - d")).toEqual([
      [0, [], true, 2, false],
      [4, [], true, 8, false],
      [10, [14], true, 18, false],
      [20, [24], false, 25, true],
      [26, [30], true, 34, false],
    ]);
    // An empty item's line: its marker, nothing past it, no blank line
    expect(marks("10. x\n\n-")).toEqual([
      [0, [], true, 4, false],
      [6, [], false, 6, true],
      [7, [], true, 8, true],
    ]);
  });

  it("reads a mark in a code block as its text", () => {
    expect(marks("> a\n>     >\n> b")[1]).toEqual([4, [4], false, 10, false]);
    expect(marks("- a\n\n  ```\n  >\n  ```")[3]).toEqual([11, [], false, 13, false]);
  });
});
