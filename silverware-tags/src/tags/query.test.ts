import { describe, expect, it } from "vitest";
import { pageMatches, parsePageQuery, tagAtCaret } from "./query.ts";

describe("a search of pages", () => {
  it("reads tags to have, tags not to have, words of the name", () => {
    expect(parsePageQuery("#Projekt -#hotovo  Plán #<two words> -#<x y>")).toEqual({ words: ["plán"], has: ["projekt", "two words"], not: ["hotovo", "x y"] });
    expect(parsePageQuery("# -#")).toEqual({ words: [], has: [], not: [] });
  });
  it("finds a page by its tags of any context, a subtag counting for its tag, case ignored", () => {
    const query = parsePageQuery("#project -#done plan");
    expect(pageMatches(query, "Work/Plan", ["project/alpha"])).toBe(true);
    expect(pageMatches(query, "Work/Plan", ["projects"])).toBe(false);
    expect(pageMatches(query, "Work/Plan", ["Project", "done/later"])).toBe(false);
    expect(pageMatches(query, "Work/Notes", ["project"])).toBe(false);
    expect(pageMatches(parsePageQuery(""), "Any", [])).toBe(true);
  });
  it("tells the tag typed at the caret", () => {
    expect(tagAtCaret("plan -#pro", 10)).toEqual({ from: 5, to: 10, typed: "pro", not: true });
    expect(tagAtCaret("#<two w", 7)).toEqual({ from: 0, to: 7, typed: "two w", not: false });
    expect(tagAtCaret("plan #a", 3)).toBeUndefined();
  });
});
