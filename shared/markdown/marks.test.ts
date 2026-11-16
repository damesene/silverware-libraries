import { describe, expect, it } from "vitest";
import { withMarksAround } from "./marks.ts";

describe("a range of markdown grown to take in its marks", () => {
  const range = (text: string, word: string) => ({ from: text.indexOf(word), to: text.indexOf(word) + word.length });

  it("takes in the marks round it the same on both sides, nested ones too", () => {
    const text = "Some **bold** and ***both*** and ~~gone~~ words";
    const grown = (word: string) => {
      const { from, to } = withMarksAround(text, range(text, word));
      return text.slice(from, to);
    };
    expect(grown("bold")).toBe("**bold**");
    expect(grown("both")).toBe("***both***");
    expect(grown("gone")).toBe("~~gone~~");
  });

  it("takes no two formats' ends round spaces, nor a word's own marks", () => {
    const two = "**x** and **y**";
    expect(withMarksAround(two, range(two, " and "))).toEqual(range(two, " and "));
    const name = "snake_case_name";
    expect(withMarksAround(name, range(name, "case"))).toEqual(range(name, "case"));
  });

  it("leaves a range alone where its marks are not the same both sides, or none is round it", () => {
    const text = "a **bold b ~~plain c";
    expect(withMarksAround(text, range(text, "bold"))).toEqual(range(text, "bold"));
    expect(withMarksAround(text, range(text, "plain"))).toEqual(range(text, "plain"));
  });
});
