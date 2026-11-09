import { describe, expect, it } from "vitest";
import { guessedType, labelOfKey, optionsOfValues } from "./loose.ts";

describe("keys outside the schema", () => {
  it("guess the type their values look like, a text where they agree on none", () => {
    expect(guessedType([true, false, null])).toEqual({ type: "checkbox" });
    expect(guessedType([3, 4.5])).toEqual({ type: "number" });
    expect(guessedType(["2026-11-08", "2026-12-01"])).toEqual({ type: "date" });
    // (Links to pages, in lists or alone: references; a list of other texts a multi-select)
    expect(guessedType([["[[A]]", "[[B]]"], "[[C]]"])).toEqual({ type: "reference" });
    expect(guessedType([["[[A]]", "b"]])).toEqual({ type: "select", params: { multiple: true } });
    expect(guessedType(["https://silverbullet.md"])).toEqual({ type: "url" });
    expect(guessedType([["a", "b"], ["c"]])).toEqual({ type: "select", params: { multiple: true } });
    // (Lists among single values: a text, none of them refused)
    expect(guessedType([["a", "b"], "c"])).toEqual({ type: "text" });
    expect(guessedType([3, "three"])).toEqual({ type: "text" });
    expect(guessedType([])).toEqual({ type: "text" });
  });

  it("make a select's options of the values, each once, a list's each", () => {
    expect(optionsOfValues([["web", "api"], "web", null, 3])).toEqual(["web", "api", "3"]);
  });

  it("make a property's label of a key", () => {
    expect(labelOfKey("due_date")).toBe("Due date");
    expect(labelOfKey("note")).toBe("Note");
    expect(labelOfKey("time-spent")).toBe("Time spent");
  });
});
