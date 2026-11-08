import { describe, expect, it } from "vitest";
import { folderSearch, foundBy, pathOf } from "./folders.ts";
import { linkedDocument } from "./types/reference.ts";

describe("documents in folders", () => {
  it("read a name as its folder and its own name, by the host's separator; none, a name of no folder", () => {
    expect(pathOf("Silverware Demo/Projects/Website", "/")).toEqual({ folder: "Silverware Demo/Projects", leaf: "Website" });
    expect(pathOf("Website", "/")).toEqual({ leaf: "Website" });
    expect(pathOf("/Website", "/")).toEqual({ leaf: "/Website" });
    expect(pathOf("A/B", undefined)).toEqual({ leaf: "A/B" });
  });

  it("find names in the folder a search starts with (spaces in it kept), its words in what follows; else its words anywhere", () => {
    const names = ["Projects/Alpha", "Projects/Old/Beta", "Archive/Projects/Gamma", "My Projects/Delta", "Projects/My notes"];
    const found = (search: string) => names.filter((name) => foundBy(name, folderSearch(search, "/")));
    expect(found("Projects/")).toEqual(["Projects/Alpha", "Projects/Old/Beta", "Projects/My notes"]);
    expect(found("my projects/")).toEqual(["My Projects/Delta"]);
    expect(found("Projects/old b")).toEqual(["Projects/Old/Beta"]);
    expect(found("projects")).toEqual(names);
    // (Names of no folders: the whole search words, anywhere)
    expect(names.filter((name) => foundBy(name, folderSearch("Projects/", undefined)))).toEqual(names);
  });

  it("take a link's document out of its target, a heading or a place left out", () => {
    expect(["People/Ada#Bio", "People/Ada@12", "People/Ada", "#only"].map(linkedDocument)).toEqual(["People/Ada", "People/Ada", "People/Ada", "#only"]);
  });
});
