import { describe, expect, it } from "vitest";
import { PAGE_KEYS, pageDates, referablePages, tasksOfPages, validatePageName } from "./pages.ts";

describe("what SilverBullet says of a page, in the platform's terms", () => {
  it("names the keys every page object has, and a page's dates", () => {
    for (const key of ["name", "tags", "created", "lastModified", "aliases"]) expect(PAGE_KEYS.has(key), key).toBe(true);
    expect(pageDates({ name: "A", created: "2026-11-01T09:00:00.000", lastModified: "2026-11-08T10:00:00.000" })).toEqual({ created: "2026-11-01T09:00:00.000", modified: "2026-11-08T10:00:00.000" });
    expect(pageDates({ name: "A", created: "" })).toEqual({});
  });

  it("counts the tasks of the pages asked for, by their `page` and `done`", () => {
    const objects = [
      { name: "outline", tags: ["task"], page: "db/A", done: true },
      { name: "review", tags: ["task"], page: "db/A", done: false },
      { name: "elsewhere", tags: ["task"], page: "Other", done: true },
    ];
    expect([...tasksOfPages(objects, new Set(["db/A", "db/B"]))]).toEqual([["db/A", { done: 1, total: 2 }]]);
  });

  it("refuses the names SilverBullet's isValidName does", () => {
    for (const name of ["x|y", "#tag", "[[x]]", ".hidden", "^up", "Fix v1.2", "a@b"]) expect(validatePageName(name), name).toBeDefined();
    expect(validatePageName("Fix login (2)")).toBeUndefined();
  });
});

describe("the pages a reference may name", () => {
  it("are the index's pages by name, meta ones (a tag meta or under it) left out", () => {
    const pages = [{ name: "Zeta" }, { name: "CONFIG", tags: ["meta"] }, { name: "Library/x", tags: ["meta/library"] }, { name: "Alpha", tags: ["project", "metal"] }, { tags: ["x"] }];
    expect(referablePages(pages)).toEqual(["Alpha", "Zeta"]);
  });
});
