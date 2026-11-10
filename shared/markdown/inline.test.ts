import { describe, expect, it } from "vitest";
import { type InlineMark, inlineMarks } from "./inline.ts";

const kinds = (line: string) => inlineMarks(line).map((mark) => `${mark.kind}:${mark.name}`);
const at = (line: string, mark: InlineMark) => line.slice(mark.from, mark.to);

describe("inlineMarks", () => {
  // The cases checked in SilverBullet 2.12.1 (2026-11-10), each as its index read it
  it("finds what SilverBullet's index found in a task", () => {
    expect(kinds("Ask @jana about #budget [[Some Page]] #sales @ada")).toEqual(["mention:jana", "tag:budget", "link:Some Page", "tag:sales", "mention:ada"]);
    expect(kinds("One [x: #inattr] [y: '@inattr'] tail #real @real")).toEqual(["attribute:x", "attribute:y", "tag:real", "mention:real"]);
    expect(kinds("Two a#b mail@x.dev `#code @code` [[P#h]] [n: [[Linked]]]")).toEqual(["tag:b", "link:P#h", "attribute:n"]);
    expect(kinds("Four [Name: x] [a-b: y] [$s: z]")).toEqual(["attribute:Name", "attribute:$s"]);
  });

  it("gives an attribute's value as written, brackets inside counted, and where it is", () => {
    const line = "Bracket [v: a [b] c] end [due:: 2026-11-12]";
    const [v, due] = inlineMarks(line);
    expect(v).toMatchObject({ kind: "attribute", name: "v", value: "a [b] c" });
    expect(at(line, v!)).toBe("[v: a [b] c]");
    expect(due).toMatchObject({ name: "due", value: "2026-11-12" });
  });

  it("takes no attribute a link's text, an unclosed one, nor a name of other characters", () => {
    expect(kinds("[a: b](https://x.dev) [c: d [e: f")).toEqual([]);
    expect(kinds("[úkol: x] [a b: c] [: x]")).toEqual([]);
  });

  it("reads a wiki link's page, alias and embed", () => {
    const line = "see ![[Img.png]] and [[Page|the page]]";
    expect(inlineMarks(line)).toEqual([
      { kind: "link", name: "Img.png", embed: true, from: 4, to: 16 },
      { kind: "link", name: "Page", alias: "the page", embed: false, from: 21, to: 38 },
    ]);
  });

  it("reads mentions as SilverBullet does: not after a word, a dot, @, + or -; a possessive's 's left out", () => {
    expect(kinds("@ada, @jan.novak's @o'neil x@y a.@b +@c -@d")).toEqual(["mention:ada", "mention:jan.novak", "mention:o'neil"]);
  });

  it("finds nothing escaped, in inline code, a URL, HTML, a link's target or Space Lua", () => {
    expect(kinds(String.raw`\#no \@no ${"`"}#no${"`"} https://x.dev/#no <a href="#no"> [t](#no) ${"${"}x#no}`)).toEqual([]);
  });

  it("reads a tag in < > and from where it is asked", () => {
    expect(inlineMarks("# Heading #<two words>", 2)).toEqual([{ kind: "tag", name: "two words", from: 10, to: 22 }]);
  });
});
