import { describe, expect, it } from "vitest";
import { gridLinks, resolveFrom, targetOf } from "./links.ts";

describe("a link's target", () => {
  it("names a page without what names a place in it, a document by its path", () => {
    expect(targetOf("Projects/Atlas#Goals")).toEqual({ to: "Projects/Atlas", toTag: "page" });
    expect(targetOf("Notes.md")).toEqual({ to: "Notes", toTag: "page" });
    expect(targetOf("Pics/cat.PNG")).toEqual({ to: "Pics/cat.PNG", toTag: "document" });
    expect(targetOf("#only")).toBeUndefined();
  });

  it("resolves a markdown link from the page's folder", () => {
    expect(resolveFrom("A/B/Page", "../x.png")).toBe("A/x.png");
    expect(resolveFrom("A/Page", "./c/d.md")).toBe("A/c/d.md");
    expect(resolveFrom("A/Page", "/Root.md")).toBe("Root.md");
  });
});

describe("the links of a page's grids", () => {
  const text = [
    "[[Outside]] is SilverBullet's own",
    "",
    "<grid>",
    "<column>",
    "",
    "**Left** [[Target|the target]] and ![[cat.png|Cat|120]]",
    "`[[InCode]]` and [md](../Other.md) and [web](https://x.dev)",
    "",
    "```",
    "[[InFence]]",
    "```",
    "",
    "</column>",
    "</grid>",
  ].join("\n");

  it("finds wiki links, embeds and local markdown links in its cells, where they are in the page, none in code", () => {
    const links = gridLinks("Notes/Page", text);
    expect(links.map((link) => [link.to, link.toTag, text.slice(link.from, link.end), link.alias])).toEqual([
      ["Target", "page", "[[Target|the target]]", "the target"],
      ["cat.png", "document", "![[cat.png|Cat|120]]", "Cat|120"],
      ["Other", "page", "[md](../Other.md)", "md"],
    ]);
    expect(links[0]!.line).toBe("**Left** [[Target|the target]] and ![[cat.png|Cat|120]]");
  });

  it("finds none in a page without grids", () => {
    expect(gridLinks("P", "[[A]] ![[b.png]]")).toEqual([]);
  });
});
