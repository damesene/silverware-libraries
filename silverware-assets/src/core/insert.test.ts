import { describe, expect, it } from "vitest";
import { cleanName, extensionOf, folderOf, joinedMarkdown, markdownOf, nameOf, pathIn, pathsApart, mappedPlace, placeIn, takesPaste, timestampName, validateFilePath, webMarkdownOf, webNameOf, webUrlOf } from "./insert.ts";

describe("a file inserted: its name and path", () => {
  const now = new Date(2026, 10, 15, 13, 9, 48);

  it("names a file of the clipboard or the camera by the date and time, as SilverBullet does; another keeps its own", () => {
    expect(timestampName(now)).toBe("2026-11-15_13-09-48");
    expect(nameOf({ name: "image.png", type: "image/png" }, "clipboard", now)).toBe("2026-11-15_13-09-48.png");
    expect(nameOf({ name: "", type: "image/jpeg" }, "camera", now)).toBe("2026-11-15_13-09-48.jpg");
    expect(nameOf({ name: "Report.pdf", type: "application/pdf" }, "drop", now)).toBe("Report.pdf");
    expect(nameOf({ name: "", type: "image/svg+xml" }, "upload", now)).toBe("2026-11-15_13-09-48.svg");
  });

  it("takes an extension of a MIME type where its subtype is none, bin where it gives none", () => {
    expect([extensionOf("image/png"), extensionOf("image/jpeg"), extensionOf("image/svg+xml"), extensionOf("video/quicktime"), extensionOf(""), extensionOf("application/x-weird+thing")]).toEqual(["png", "jpg", "svg", "mov", "bin", "bin"]);
  });

  it("puts it in its page's folder", () => {
    expect([folderOf("Notes/Daily/Today"), folderOf("Today")]).toEqual(["Notes/Daily", ""]);
    expect([pathIn("Notes", "a.png"), pathIn("", "a.png")]).toEqual(["Notes/a.png", "a.png"]);
  });

  it("says why SilverBullet would refuse a path, and offers a name it takes", () => {
    for (const path of ["Notes/a.png", "2026-11-15_13-09-48.png", "My file (1).pdf"]) expect(validateFilePath(path), path).toBeUndefined();
    expect(validateFilePath("")).toBe("the name is empty");
    expect(validateFilePath("a#b.png")).toBe('the name has a "#" in it');
    expect(validateFilePath(".hidden.png")).toBe("the name starts with a dot or ^");
    expect(validateFilePath("a//b.png")).toBe("the path has an empty part, or . or ..");
    expect(validateFilePath("x.png.md")).toBe("the name ends in .md after another extension");
    expect(cleanName("Q3 #draft @home.pdf", "pdf")).toBe("Q3 draft home.pdf");
    expect(cleanName(".env", "txt")).toBe("env.txt");
    expect(cleanName("###.png", "png")).toBe("file.png");
    expect(validateFilePath(cleanName("a|b<c>.png", "png"))).toBeUndefined();
  });

  it("takes the paths of a batch apart, case alike; one taken in the space kept both where asked", () => {
    const space = new Set(["notes/photo.jpg"]);
    const taken = (path: string) => space.has(path.toLowerCase());
    expect(pathsApart(["Notes/image.jpg", "Notes/image.jpg", "Notes/Image.JPG"], taken)).toEqual(["Notes/image.jpg", "Notes/image-1.jpg", "Notes/Image-2.JPG"]);
    expect(pathsApart(["Notes/photo.jpg"], taken)).toEqual(["Notes/photo.jpg"]);
    expect(pathsApart(["Notes/photo.jpg"], taken, () => true)).toEqual(["Notes/photo-1.jpg"]);
    expect(pathsApart(["README"], () => false, () => false)).toEqual(["README"]);
  });
});

describe("a file inserted: what is written", () => {
  it("writes a link in SilverBullet's link style, an embed its view where it is not the one configured", () => {
    expect(markdownOf("Notes/a.pdf", "link", "full", "wikilink")).toBe("[[Notes/a.pdf]]");
    expect(markdownOf("Notes/my a.pdf", "link", "full", "markdown")).toBe("[Notes/my a.pdf](Notes/my%20a.pdf)");
    expect(markdownOf("a.pdf", "full", "full", "wikilink")).toBe("![[a.pdf]]");
    expect(markdownOf("a.pdf", "card", "full", "markdown")).toBe("![[a.pdf|||{ view: card }]]");
  });

  it("puts several embeds a line each (a list's item's lines indented), links and what goes into a line a space apart", () => {
    const embeds = [
      { text: "![[a.png]]", embed: true },
      { text: "![[b.png]]", embed: true },
    ];
    expect(joinedMarkdown(embeds, false)).toBe("![[a.png]]\n![[b.png]]");
    expect(joinedMarkdown(embeds, false, "  ")).toBe("![[a.png]]\n  ![[b.png]]");
    expect(joinedMarkdown(embeds, true)).toBe("![[a.png]] ![[b.png]]");
    expect(joinedMarkdown([{ text: "[[a.pdf]]", embed: false }, { text: "[[b.pdf]]", embed: false }], false)).toBe("[[a.pdf]] [[b.pdf]]");
  });
});

describe("where files are put", () => {
  it("goes into a line with text beside it or a table's row, a space apart from the text right beside it; a list's item's lines indented after its marker", () => {
    const at = (text: string) => placeIn(text.replace("^", ""), text.indexOf("^"), text.indexOf("^"));
    expect(at("A\n^\nB")).toEqual({ inLine: false, indent: "", before: "", after: "" });
    expect(at("Some ^text")).toEqual({ inLine: true, indent: "", before: "", after: " " });
    expect(at("Last line^")).toEqual({ inLine: true, indent: "", before: " ", after: "" });
    expect(at("| a | ^ |")).toEqual({ inLine: true, indent: "", before: "", after: "" });
    expect(at("- ^")).toEqual({ inLine: false, indent: "  ", before: "", after: "" });
    expect(at("- [ ] ^")).toEqual({ inLine: false, indent: "      ", before: "", after: "" });
    expect(at("- item ^")).toEqual({ inLine: true, indent: "  ", before: "", after: "" });
  });
});

describe("a paste taken", () => {
  it("is files SilverBullet would upload (none with HTML; plain text beside them too) and a web page's image (HTML of the image alone); HTML with text is not", () => {
    expect(takesPaste({ files: 1, types: ["Files"], html: "" })).toBe(true);
    expect(takesPaste({ files: 1, types: ["text/html", "Files"], html: '<meta charset="utf-8"><img src="https://a.b/c.png" alt="c">' })).toBe(true);
    expect(takesPaste({ files: 1, types: ["text/html", "Files"], html: "<p>Some words <img src='c.png'></p>" })).toBe(false);
    expect(takesPaste({ files: 1, types: ["text/plain", "Files"], html: "" })).toBe(true);
    expect(takesPaste({ files: 1, types: ["text/plain", "text/html", "Files"], html: "<p>Text of a document</p><img src='x.png'>" })).toBe(false);
    expect(takesPaste({ files: 0, types: ["text/html"], html: "<img src='c.png'>" })).toBe(false);
  });
});

describe("where files go once uploaded, as the text was changed meanwhile", () => {
  it("stays before a change, moves with one before it, is none where the change took it in", () => {
    expect(mappedPlace("ab|cd", "ab|cd", 2, 2)).toEqual({ from: 2, to: 2 });
    expect(mappedPlace("Before\n\nAfter", "Before\n\nAfter typed", 6, 6)).toEqual({ from: 6, to: 6 });
    expect(mappedPlace("Before\n\nAfter", "Top\nBefore\n\nAfter", 6, 6)).toEqual({ from: 10, to: 10 });
    expect(mappedPlace("one two three", "one 2 three", 4, 7)).toBeUndefined();
    expect(mappedPlace("abc", "", 1, 1)).toBeUndefined();
  });
});

describe("an image of the web linked at its address", () => {
  it("is the one image a copy of a web page's image or a drag from one carries, an http(s) address alone", () => {
    expect(webUrlOf({ files: 1, html: '<meta charset="utf-8"><img src="https://a.b/c.png?x=1&amp;y=2" alt="">' })).toBe("https://a.b/c.png?x=1&y=2");
    expect(webUrlOf({ files: 1, html: "", uriList: "# a comment\nhttps://a.b/d.jpg" })).toBe("https://a.b/d.jpg");
    expect(webUrlOf({ files: 1, html: "<img src='data:image/png;base64,AAA'>" })).toBeUndefined();
    expect(webUrlOf({ files: 2, html: '<img src="https://a.b/c.png">' })).toBeUndefined();
    expect(webUrlOf({ files: 1, html: '<img src="https://a.b/1.png"><img src="https://a.b/2.png">' })).toBeUndefined();
    // (Its `src`, not a lazy page's `data-src`; its references read)
    expect(webUrlOf({ files: 1, html: '<img data-src="https://cdn/full.jpg" src="https://cdn/thumb.jpg?a=1&#38;b=2">' })).toBe("https://cdn/thumb.jpg?a=1&b=2");
    // (No image's extension: SilverBullet would draw it as no image, kept in the space then)
    expect(webUrlOf({ files: 1, html: '<img src="https://images.example.com/photo-123?w=800">' })).toBeUndefined();
  });

  it("is written as SilverBullet's image of a URL, its view in its metadata where it is not the one shown; a link by its name", () => {
    expect(webMarkdownOf("https://a.b/c d.png", "c d.png", "preview", "preview")).toBe("![](https://a.b/c%20d.png)");
    expect(webMarkdownOf("https://a.b/c.png", "c.png", "card", "preview")).toBe("![||{ view: card }](https://a.b/c.png)");
    expect(webMarkdownOf("https://a.b/(x).png", "(x).png", "link", "preview")).toBe("[(x).png](https://a.b/%28x%29.png)");
    expect(webNameOf("https://a.b/pics/c%20d.png?s=1")).toBe("c d.png");
    expect(webNameOf("https://a.b/")).toBe("image");
  });
});
