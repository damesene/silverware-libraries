// Where a point of a cell's rendering is in its markdown: the point's offset in its element's text followed through
// the markdown from where the element starts. The cases the user found wrong (a word found by its first occurrence:
// "is" in "This") among them.
import { describe, expect, it } from "vitest";
import { positionInCell } from "./position.ts";

describe("positionInCell", () => {
  const note = "# test\n\nThis is my note!";
  const paragraph = note.indexOf("This");
  const rendered = "This is my note!";

  it("follows a paragraph's text to the character, a word that is part of another not taken for it", () => {
    // " is my note!" selected: from the space after "This"
    expect(positionInCell(note, paragraph, rendered, 4)).toBe(paragraph + 4);
    // "is" alone: the second word, not the "is" in "This"
    expect(positionInCell(note, paragraph, rendered, 5)).toBe(paragraph + 5);
    expect(positionInCell(note, paragraph, rendered, 7)).toBe(paragraph + 7);
    // "my note!": from "my" to the end
    expect(positionInCell(note, paragraph, rendered, 8)).toBe(paragraph + 8);
    expect(positionInCell(note, paragraph, rendered, rendered.length)).toBe(note.length);
  });

  it("passes over the markdown's marks the rendering does not show", () => {
    const markdown = "Intro.\n\n**Left** with a [[Target]] link";
    const start = markdown.indexOf("**");
    const text = "Left with a Target link";
    expect(positionInCell(markdown, start, text, 0)).toBe(start + 2);
    expect(positionInCell(markdown, start, text, text.indexOf("with") + 2)).toBe(markdown.indexOf("with") + 2);
    expect(positionInCell(markdown, start, text, text.indexOf("Target") + 3)).toBe(markdown.indexOf("Target") + 3);
    expect(positionInCell(markdown, start, text, text.indexOf("link"))).toBe(markdown.indexOf(" link") + 1);
  });

  it("finds a list item's and a heading's text after their markers", () => {
    expect(positionInCell("- an item", 0, "an item", 3)).toBe(5);
    expect(positionInCell("## A heading", 0, "A heading", 2)).toBe(5);
  });

  it("reads a no-break space or a line break of the rendering as the markdown's space or line break", () => {
    expect(positionInCell("a  b\nc", 0, "a  b c", 5)).toBe(5);
  });

  it("gives where the element starts without a point, and stays within the markdown", () => {
    expect(positionInCell(note, paragraph, "", 0)).toBe(paragraph);
    expect(positionInCell(note, 999, "", 0)).toBe(note.length);
    expect(positionInCell(note, -4, "", 0)).toBe(0);
  });
});
