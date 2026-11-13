import { describe, expect, it } from "vitest";
import { positionInCell, wordAt } from "./position.ts";

describe("wordAt", () => {
  it("gives the word around an offset, of any script", () => {
    expect(wordAt("Ahoj světe, jak", 7)).toBe("světe");
    expect(wordAt("one two", 3)).toBe("one");
    expect(wordAt("one two", 4)).toBe("two");
    expect(wordAt("a, b", 2)).toBe("");
  });
});

describe("positionInCell", () => {
  const markdown = "Intro.\n\n**Left** with a [[Target]] link";

  it("finds the word clicked in the markdown from where its element starts", () => {
    // The paragraph's element starts at 8; "with" clicked 2 characters in
    expect(positionInCell(markdown, 8, "with", 2)).toBe(markdown.indexOf("with") + 2);
    // A word in a link's rendering ("Target"), its element at the link
    expect(positionInCell(markdown, markdown.indexOf("[["), "Target", 0)).toBe(markdown.indexOf("Target"));
  });

  it("gives where the element starts where no word was clicked or it is not found", () => {
    expect(positionInCell(markdown, 8, "", 0)).toBe(8);
    expect(positionInCell(markdown, 8, "missing", 3)).toBe(8);
  });

  it("stays within the markdown", () => {
    expect(positionInCell(markdown, 999, "", 0)).toBe(markdown.length);
    expect(positionInCell(markdown, -4, "", 0)).toBe(0);
  });
});
