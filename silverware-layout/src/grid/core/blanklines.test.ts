// A cell's blank lines in its markdown: those right before a line (in a quote, its marks alone), where each starts, and
// those the host drew.
import { describe, expect, it } from "vitest";
import { blankLinesBefore as countIn, blankLinesDrawn, blankLineStarts as startsIn, cellLines, lineStartOf as lineStartIn, startsLine } from "./blanklines.ts";

// (Each asked of a text read line by line first, as a cell's is)
const blankLinesBefore = (text: string, at: number) => countIn(cellLines(text), at);
const blankLineStarts = (text: string, at: number) => startsIn(cellLines(text), at);
const lineStartOf = (text: string, at: number) => lineStartIn(cellLines(text), at);

// A cell's text: paragraphs a blank line or more apart, a loose list, a heading (drawn in ui/view.test.ts)
const TEXT = "One\n\nTwo\n\n\nThree\n\n\n\nFour\n- item\n\n- item2\n\n# Head\n\nAfter";

describe("a cell's blank lines", () => {
  it("counts the blank lines right before a place's line", () => {
    expect(blankLinesBefore(TEXT, 5)).toBe(1);
    expect(blankLinesBefore(TEXT, 20)).toBe(3);
    expect(blankLinesBefore(TEXT, 25)).toBe(0);
    expect(blankLinesBefore(TEXT, 33)).toBe(1);
    expect(blankLinesBefore(TEXT, 0)).toBe(0);
    // Blank lines of spaces too; a text starting with them
    expect(blankLinesBefore("a\n  \n\t\nb", 7)).toBe(2);
    expect(blankLinesBefore("\n\nb", 2)).toBe(2);
  });

  it("counts a quote's blank lines, its marks alone, for a place in a quote as deep or shallower", () => {
    expect(blankLinesBefore("> one\n>\n> two", 10)).toBe(1);
    expect(blankLineStarts("> one\n>\n> two", 10)).toEqual([6]);
    // A deeper quote's last empty lines, before a place out of that quote (the nested quote of the last at 14)
    expect(blankLinesBefore("> one\n>\ntwo", 8)).toBe(1);
    expect(blankLinesBefore("> > one\n> >\n> two", 14)).toBe(1);
    expect(blankLinesBefore("> one\n> >\n>\n> > two", 14)).toBe(2);
  });

  it("counts no blank line shallower than a place's quote: it lies before that quote, the quote's own", () => {
    expect(blankLinesBefore("> one\n\n> two", 9)).toBe(0);
    expect(blankLinesBefore("> one\n\n> two", 7)).toBe(1);
    expect(blankLinesBefore("Para\n\n>\n> one", 10)).toBe(1);
    expect(blankLinesBefore("> one\n> >\n>\n> > two", 16)).toBe(0);
  });

  it("reads a quote's marks in a list's item as deep as the item's content, an empty item's line no blank line", () => {
    const text = "- a\n  - b\n    > - c\n    >\n    > - d";
    expect(blankLinesBefore(text, text.indexOf("- d"))).toBe(1);
    const numbered = "10. x\n\n    > q\n    >\n    > r";
    expect(blankLinesBefore(numbered, numbered.indexOf("r"))).toBe(1);
    expect(blankLinesBefore("- a\n-\n- b", 6)).toBe(0);
  });

  it("tells a place where a line's own text starts, past its marks and indentation, from one in its text", () => {
    const lines = cellLines("> - a **b**\n  c");
    expect([0, 2, 4, 6].map((at) => startsLine(lines, at))).toEqual([true, true, true, false]);
    expect(startsLine(lines, 14)).toBe(true);
  });

  it("reads a mark after four spaces as a code block's line in a quote, no blank line", () => {
    expect(blankLinesBefore("> a\n>     >\n> b", 14)).toBe(0);
    expect(blankLinesBefore("> a\n>    >\n> b", 13)).toBe(1);
  });

  it("finds where the line a place is on starts", () => {
    expect(lineStartOf("ab\ncd", 4)).toBe(3);
    expect(lineStartOf("ab\ncd", 3)).toBe(3);
    expect(lineStartOf("ab\ncd", 2)).toBe(0);
    expect(lineStartOf("ab", 0)).toBe(0);
    // A text starting with a line break: at 0 its first (empty) line, after it the second
    expect(lineStartOf("\nab", 0)).toBe(0);
    expect(lineStartOf("\nab", 1)).toBe(1);
  });

  it("counts those drawn: the line breaks, the first only ending an inline element's line", () => {
    expect(blankLinesDrawn(2, { tagName: "SPAN" })).toBe(1);
    expect(blankLinesDrawn(1, { tagName: "SPAN" })).toBe(0);
    expect(blankLinesDrawn(1, { tagName: "H1" })).toBe(1);
    expect(blankLinesDrawn(0, { tagName: "UL" })).toBe(0);
    expect(blankLinesDrawn(0, undefined)).toBe(0);
  });
});

describe("a blank line clicked", () => {
  it("is one of the blank lines above a place's line, where each starts, the nearest first", () => {
    expect(blankLineStarts("a\n\n\nb", 4)).toEqual([3, 2]);
    expect(blankLineStarts("a\n\n\nb", 0)).toEqual([]);
    // A text starting with blank lines: the first at 0
    expect(blankLineStarts("\n\nb", 2)).toEqual([1, 0]);
  });
});
