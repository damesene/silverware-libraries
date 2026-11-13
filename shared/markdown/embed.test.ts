import { describe, expect, it } from "vitest";
import { embedAsLink, linkAsEmbed, readEmbeds, readLinks, readMetadata, readSize, writeEmbed, writeMetadata } from "./embed.ts";

describe("an embed's size and metadata", () => {
  it("reads a size as SilverBullet does", () => {
    expect(readSize("200")).toEqual({ width: "200" });
    expect(readSize("50%")).toEqual({ width: "50%" });
    expect(readSize("200x100")).toEqual({ width: "200", height: "100" });
    expect(readSize("x100")).toEqual({ height: "100" });
    expect(readSize("A cat")).toBeUndefined();
    expect(readSize("")).toBeUndefined();
  });

  it("reads metadata in braces, quoted values, SilverBullet's smart quotes", () => {
    expect(readMetadata('{ view: preview, caption: "a, b", zoom: 2 }')).toEqual({ view: "preview", caption: "a, b", zoom: "2" });
    expect(readMetadata("{ type: “preview” }")).toEqual({ type: "preview" });
    expect(readMetadata("{}")).toEqual({});
    expect(readMetadata("no braces")).toBeUndefined();
  });

  it("writes metadata back, quoting what needs it", () => {
    expect(writeMetadata({ view: "icon", caption: "a, b" })).toBe('{ view: icon, caption: "a, b" }');
    expect(writeMetadata({})).toBe("");
    expect(readMetadata(writeMetadata({ a: " spaced ", b: "x" }))).toEqual({ a: " spaced ", b: "x" });
  });
});

describe("readEmbeds", () => {
  it("reads wiki and markdown embeds: target, alt, size, metadata, as SilverBullet reads the first two segments", () => {
    const text = [
      "![[cat.png|A cat|200|{ view: preview }]] and ![A cat|150x80|{ view: icon }](Pics/cat.png)",
      "![[cat.png]] ![[cat.png|300]] ![[cat.png|Only alt]] ![](cat.png)",
    ].join("\n");
    expect(readEmbeds(text).map(({ style, target, alt, width, height, metadata }) => ({ style, target, alt, width, height, metadata }))).toEqual([
      { style: "wiki", target: "cat.png", alt: "A cat", width: "200", height: undefined, metadata: { view: "preview" } },
      { style: "markdown", target: "Pics/cat.png", alt: "A cat", width: "150", height: "80", metadata: { view: "icon" } },
      { style: "wiki", target: "cat.png", alt: "", width: undefined, height: undefined, metadata: {} },
      { style: "wiki", target: "cat.png", alt: "", width: "300", height: undefined, metadata: {} },
      { style: "wiki", target: "cat.png", alt: "Only alt", width: undefined, height: undefined, metadata: {} },
      { style: "markdown", target: "cat.png", alt: "", width: undefined, height: undefined, metadata: {} },
    ]);
    const [first] = readEmbeds(text);
    expect(text.slice(first!.from, first!.to)).toBe("![[cat.png|A cat|200|{ view: preview }]]");
  });

  it("reads none in fenced code or a code span, nor a link that is no embed", () => {
    expect(readEmbeds("```\n![[a.png]]\n```\n`![[b.png]]` [[c.png]] [d](e.png)")).toEqual([]);
  });
});

describe("writeEmbed", () => {
  const [wiki, md, plain] = readEmbeds("![[cat.png|A cat|200|{ view: preview }]] ![Md|150](cat.png) ![[cat.png]]");

  it("leaves an embed unchanged as it was written", () => {
    expect(writeEmbed(wiki!, {})).toBe(wiki!.text);
    expect(writeEmbed(wiki!, { width: "200" })).toBe(wiki!.text);
  });

  it("writes three segments where it has metadata, empty ones kept", () => {
    expect(writeEmbed(plain!, { metadata: { view: "icon" } })).toBe("![[cat.png|||{ view: icon }]]");
    expect(writeEmbed(md!, { metadata: { view: "icon" } })).toBe("![Md|150|{ view: icon }](cat.png)");
    expect(writeEmbed(wiki!, { width: "300", height: "100" })).toBe("![[cat.png|A cat|300x100|{ view: preview }]]");
  });

  it("writes as few segments as say it otherwise, and takes off what is null", () => {
    expect(writeEmbed(wiki!, { metadata: { view: null } })).toBe("![[cat.png|A cat|200]]");
    expect(writeEmbed(plain!, { width: "250" })).toBe("![[cat.png||250]]");
    expect(writeEmbed(wiki!, { width: null, metadata: { view: null } })).toBe("![[cat.png|A cat]]");
    expect(writeEmbed(md!, { alt: null, width: null })).toBe("![](cat.png)");
  });

  it("is read back as written", () => {
    const written = writeEmbed(plain!, { alt: "Cat", width: "50%", metadata: { view: "preview", caption: "a, b" } });
    const [again] = readEmbeds(written);
    expect(again).toMatchObject({ alt: "Cat", width: "50%", metadata: { view: "preview", caption: "a, b" } });
  });
});

describe("links and embeds written as each other", () => {
  it("reads a page's links, not its embeds nor what is in code", () => {
    const text = "See [[Docs/a.pdf|The doc]] and [b](b.zip), ![[c.png]] and ![d](d.png)\n`[[code]]`\n```\n[[fenced]]\n```\n[[Page]]";
    expect(readLinks(text).map(({ style, target, alias, text: written }) => [style, target, alias, written])).toEqual([
      ["wiki", "Docs/a.pdf", "The doc", "[[Docs/a.pdf|The doc]]"],
      ["markdown", "b.zip", "b", "[b](b.zip)"],
      ["wiki", "Page", "", "[[Page]]"],
    ]);
    expect(readLinks(text)[0]!.from).toBe(text.indexOf("[[Docs"));
  });

  it("writes a link as an embed, and an embed as a link keeping its alt text, not its size and metadata", () => {
    const [wiki, md] = readLinks("[[a.pdf|Doc]] [x](b%20c.zip)");
    expect([linkAsEmbed(wiki!), linkAsEmbed(md!)]).toEqual(["![[a.pdf|Doc]]", "![x](b%20c.zip)"]);
    const embeds = readEmbeds("![[cat.png|Cat|300|{ view: icon }]] ![[dog.png]] ![|200](Pics/my%20cat.png) ![A cat](cat.png)");
    expect(embeds.map(embedAsLink)).toEqual(["[[cat.png|Cat]]", "[[dog.png]]", "[my cat.png](Pics/my%20cat.png)", "[A cat](cat.png)"]);
  });
});
