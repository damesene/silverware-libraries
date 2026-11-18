import { describe, expect, it } from "vitest";
import { areFiles, fileName, isImageTarget, isWebTarget, namesFile, readFile, readFiles, typedFiles, validateFileTarget, writeFile } from "./files.ts";
import { TypeRegistry } from "./registry.ts";

describe("files as kept", () => {
  it("read a wiki link to a file of the space or an address of the web, as written; a list of them, one alone, or none", () => {
    expect(readFile("[[Databases/db-ab12/files/sunset.jpg]]")).toEqual({ target: "Databases/db-ab12/files/sunset.jpg", web: false, written: "[[Databases/db-ab12/files/sunset.jpg]]" });
    expect(readFile(" https://example.com/cat.png ")).toEqual({ target: "https://example.com/cat.png", web: true, written: "https://example.com/cat.png" });
    // (A link's text after a bar kept as written; the file is what it names)
    expect(readFile("[[Docs/report.pdf|The report]]")).toEqual({ target: "Docs/report.pdf", web: false, written: "[[Docs/report.pdf|The report]]" });
    for (const none of ["Docs/report.pdf", "example.com/cat.png", "[[]]", "https://a b"]) expect(readFile(none), none).toBeUndefined();
    expect(readFiles(["[[a.png]]", "https://example.com/b.png"])?.map((one) => one.target)).toEqual(["a.png", "https://example.com/b.png"]);
    expect(readFiles("[[a.png]]")?.map((one) => one.target)).toEqual(["a.png"]);
    for (const empty of [null, undefined, "", []]) expect(readFiles(empty), String(empty)).toEqual([]);
    expect(readFiles(["[[a.png]]", "b.png"])).toBeUndefined();
    expect(readFiles(3)).toBeUndefined();
  });

  it("write a path as a wiki link, an address as it is; refuse a name no link can hold", () => {
    expect(writeFile(" Docs/report.pdf ")).toBe("[[Docs/report.pdf]]");
    expect(writeFile("https://example.com/cat.png")).toBe("https://example.com/cat.png");
    expect(validateFileTarget("Docs/my report (1).pdf")).toBeUndefined();
    expect(validateFileTarget("https://example.com/a#b")).toBeUndefined();
    expect(validateFileTarget("photo@2x.png")).toBe(`"photo@2x.png" cannot be linked: no "@" in a file's name`);
    for (const bad of ["a#b.png", "a|b.png", "a]b.png", "a$b.png", "a<b.png"]) expect(validateFileTarget(bad), bad).toContain("cannot be linked");
    expect(validateFileTarget(" ")).toBe("no file named");
  });

  it("tell a link to a file from a page's, as SilverBullet does: an extension other than .md, or an address", () => {
    for (const file of ["a.png", "Docs/report.PDF", "https://example.com/page", "Docs/a.pdf#page=2"]) expect(namesFile(file), file).toBe(true);
    for (const page of ["Notes", "Notes.md", "Notes#v1.2", "People/Ada@12", "v1.toolongext"]) expect(namesFile(page), page).toBe(false);
    expect(areFiles([["[[a.png]]", "https://example.com/b.jpg"], "[[c.pdf]]"])).toBe(true);
    expect(areFiles([["https://example.com/b.jpg"]])).toBe(false);
    expect(areFiles([["[[a.png]]", "[[Notes]]"]])).toBe(false);
    expect(areFiles([[]])).toBe(false);
    expect(areFiles([])).toBe(false);
  });

  it("tell an image the browser draws by its extension, and an address of the web from a path", () => {
    for (const image of ["a.PNG", "Photos/b.jpeg", "https://example.com/c.webp?size=2", "d.svg"]) expect(isImageTarget(image), image).toBe(true);
    for (const other of ["a.pdf", "png", "https://example.com/png", "Photos/b.jpeg.md"]) expect(isImageTarget(other), other).toBe(false);
    expect([isWebTarget(" https://example.com/a.png"), isWebTarget("Photos/a.png")]).toEqual([true, false]);
  });

  it("name a file by its last part: a path's name, an address's (decoded), else the address", () => {
    expect(fileName({ target: "Databases/db-ab12/files/sunset.jpg", web: false })).toBe("sunset.jpg");
    expect(fileName({ target: "report.pdf", web: false })).toBe("report.pdf");
    expect(fileName({ target: "https://example.com/pics/my%20cat.png?size=2#top", web: true })).toBe("my cat.png");
    expect(fileName({ target: "https://example.com", web: true })).toBe("https://example.com");
    expect(fileName({ target: "https://example.com/%E0%A4%A", web: true })).toBe("%E0%A4%A");
  });

  it("read text typed as links and addresses in their order, each once; a plain name refused, as it may hold a comma", () => {
    expect(typedFiles("[[a b, c.png]], https://example.com/d.png [[a b, c.png|again]]")).toEqual({ written: ["[[a b, c.png]]", "https://example.com/d.png"] });
    expect(typedFiles(" , ")).toEqual({ written: [] });
    expect(typedFiles("[[a.png]], b.png")).toEqual({ problem: `"b.png" is no file: name one as a link ([[folder/name.png]]) or an address of the web` });
    expect(typedFiles("[[photo@2x.png]]")).toEqual({ problem: `"photo@2x.png" cannot be linked: no "@" in a file's name` });
  });
});

describe("the files type", () => {
  const files = new TypeRegistry().named("files")!;

  it("is a list's, edited and drawn as files, never grouped by", () => {
    expect([files.label, files.editor, files.look, files.lists, files.groups]).toEqual(["Files & media", "files", "media", true, false]);
    expect(files.offered).toBeUndefined();
  });

  it("takes a list of files, each once, shown by their names; typed text made files", () => {
    expect(files.validate(["[[a.png]]", "https://example.com/b.png"], {})).toBeUndefined();
    expect(files.validate("[[a.png]]", {})).toBeUndefined();
    expect(files.validate(null, {})).toBeUndefined();
    expect(files.validate(["a.png"], {})).toBe("no list of files ([[folder/name.png]] or an address of the web)");
    expect(files.validate(["[[a.png]]", "[[a.png|again]]"], {})).toBe("one named twice");
    expect(files.text(["[[Photos/a.png]]", "https://example.com/pics/b.png"], {})).toBe("a.png, b.png");
    expect(files.text("plain", {})).toBe("plain");
    expect(files.parse("[[a.png]], https://example.com/b.png", {})).toEqual({ value: ["[[a.png]]", "https://example.com/b.png"] });
    expect(files.parse("", {})).toEqual({ value: null });
    expect(files.parse("a.png", {})).toHaveProperty("problem");
  });
});
