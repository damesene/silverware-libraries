import { describe, expect, it } from "vitest";
import { fileNameOfTitle, pathParts, renamable, takenBy, validateFileName, validateTitle } from "./rename.ts";

describe("a file's title and name", () => {
  it("cuts a path into its folder, its name and its extension", () => {
    expect(pathParts("Pics/2026/cat.photo.png")).toEqual({ folder: "Pics/2026/", name: "cat.photo", ext: ".png" });
    expect(pathParts("notes")).toEqual({ folder: "", name: "notes", ext: "" });
    // (A name starting with its only dot has no extension)
    expect(pathParts("a/.env")).toEqual({ folder: "a/", name: ".env", ext: "" });
  });

  it("says why a file's name cannot be given; none where it can", () => {
    expect(validateFileName("Kočka venku 2")).toBeUndefined();
    expect(validateFileName("  ")).toBe("a file needs a name");
    expect(validateFileName(" a")).toBe("a name does not start or end with a space");
    expect(validateFileName(".a")).toBe("a name does not start with a dot (SilverBullet reads no such file)");
    expect(validateFileName("a/b: c?")).toBe("a name holds none of / : ?");
  });

  it("says why a title cannot be written (what ends an alt text or a link); makes a name of one", () => {
    expect(validateTitle("Q3: final!")).toBeUndefined();
    expect(validateTitle("a | b [c]")).toBe("a title holds none of | [ ]");
    // (A backslash at its end escapes the bracket closing the alt text or the link)
    expect(validateTitle("C:\\ ")).toBe("a title does not end with \\");
    expect(fileNameOfTitle("Q3: final  draft?")).toBe("Q3 final draft");
    expect(fileNameOfTitle("...hidden")).toBe("hidden");
    expect(fileNameOfTitle("/:?")).toBe("");
  });

  it("renames a file of an extension of letters and digits alone, as SilverBullet does", () => {
    expect(["a.png", "b.tar.gz", "c", "d.my-ext", "e/.env"].map(renamable)).toEqual([true, true, false, false, false]);
  });

  it("finds a path another file has, its case aside, the file itself not", () => {
    expect(takenBy(["Pics/Dog.png", "Pics/cat.png"], "Pics/cat.png", "Pics/dog.png")).toBe("Pics/Dog.png");
    expect(takenBy(["Pics/cat.png"], "Pics/cat.png", "Pics/Cat.png")).toBeUndefined();
  });
});
