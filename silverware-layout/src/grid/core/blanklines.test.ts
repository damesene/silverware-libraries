// A cell's blank lines in its markdown: those right before a line (in a quote, its marks alone), where each starts, and
// those the host drew.
import { describe, expect, it } from "vitest";
import { markedLines } from "../../../../shared/markdown/parse.ts";
import { blankLinesAbove, blankLinesBefore, blankLinesDrawn } from "./blanklines.ts";

// (Of a text read line by line first, as a cell's is)
const countBefore = (text: string, at: number) => blankLinesBefore(markedLines(text), at);
const startsBefore = (text: string, at: number) => blankLinesAbove(markedLines(text), at).map((line) => line.from);
const caretsBefore = (text: string, at: number) => blankLinesAbove(markedLines(text), at).map((line) => line.content);

// A cell's text: paragraphs a blank line or more apart, a loose list, a heading (drawn in ui/view.test.ts)
const TEXT = "One\n\nTwo\n\n\nThree\n\n\n\nFour\n- item\n\n- item2\n\n# Head\n\nAfter";

describe("a cell's blank lines", () => {
  it("counts the blank lines right before a place's line", () => {
    expect(countBefore(TEXT, 5)).toBe(1);
    expect(countBefore(TEXT, 20)).toBe(3);
    expect(countBefore(TEXT, 25)).toBe(0);
    expect(countBefore(TEXT, 33)).toBe(1);
    expect(countBefore(TEXT, 0)).toBe(0);
    // Blank lines of spaces too; a text starting with them
    expect(countBefore("a\n  \n\t\nb", 7)).toBe(2);
    expect(countBefore("\n\nb", 2)).toBe(2);
  });

  it("counts a quote's blank lines, its marks alone, for a place in a quote as deep or shallower", () => {
    expect(countBefore("> one\n>\n> two", 10)).toBe(1);
    expect(startsBefore("> one\n>\n> two", 10)).toEqual([6]);
    // A caret put on it past its mark, in the quote; on a blank line out of a quote at its start
    expect(caretsBefore("> one\n>\n> two", 10)).toEqual([7]);
    expect(caretsBefore("a\n\nb", 3)).toEqual([2]);
    // A deeper quote's last empty lines, before a place out of that quote (the nested quote of the last at 14)
    expect(countBefore("> one\n>\ntwo", 8)).toBe(1);
    expect(countBefore("> > one\n> >\n> two", 14)).toBe(1);
    expect(countBefore("> one\n> >\n>\n> > two", 14)).toBe(2);
  });

  it("counts no blank line shallower than a place's quote: it lies before that quote, the quote's own", () => {
    expect(countBefore("> one\n\n> two", 9)).toBe(0);
    expect(countBefore("> one\n\n> two", 7)).toBe(1);
    expect(countBefore("Para\n\n>\n> one", 10)).toBe(1);
    expect(countBefore("> one\n> >\n>\n> > two", 16)).toBe(0);
  });

  it("reads a quote's marks in a list's item as deep as the item's content, an empty item's line no blank line", () => {
    const text = "- a\n  - b\n    > - c\n    >\n    > - d";
    expect(countBefore(text, text.indexOf("- d"))).toBe(1);
    const numbered = "10. x\n\n    > q\n    >\n    > r";
    expect(countBefore(numbered, numbered.indexOf("r"))).toBe(1);
    expect(countBefore("- a\n-\n- b", 6)).toBe(0);
  });

  it("reads a mark after four spaces as a code block's line in a quote, no blank line", () => {
    expect(countBefore("> a\n>     >\n> b", 14)).toBe(0);
    expect(countBefore("> a\n>    >\n> b", 13)).toBe(1);
  });

  it("counts those drawn: the line breaks, the first only ending an inline element's line", () => {
    expect(blankLinesDrawn(2, { nodeName: "SPAN" })).toBe(1);
    expect(blankLinesDrawn(1, { nodeName: "SPAN" })).toBe(0);
    expect(blankLinesDrawn(1, { nodeName: "H1" })).toBe(1);
    expect(blankLinesDrawn(0, { nodeName: "UL" })).toBe(0);
    // Text the host left unwrapped: inline
    expect(blankLinesDrawn(2, { nodeName: "#text" })).toBe(1);
    expect(blankLinesDrawn(0, undefined)).toBe(0);
  });
});

describe("a blank line clicked", () => {
  it("is one of the blank lines above a place's line, where each starts, the nearest first", () => {
    expect(startsBefore("a\n\n\nb", 4)).toEqual([3, 2]);
    expect(startsBefore("a\n\n\nb", 0)).toEqual([]);
    // A text starting with blank lines: the first at 0
    expect(startsBefore("\n\nb", 2)).toEqual([1, 0]);
  });
});
