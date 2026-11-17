// @vitest-environment jsdom
// A cell's blank lines as the editor shows them: those the host's rendering left out (next to a block, between a
// loose list's items) put back, those it kept (between paragraphs, as line breaks) left as they are.
import { describe, expect, it } from "vitest";
import { lineStarts } from "../ui/offsets.ts";
import { keepBlankLines, spaceBefore } from "../ui/view.ts";
import { blankLinesBefore, blankLinesDrawn, blankLineStarts, lineStartOf } from "./blanklines.ts";

// SilverBullet 2.12.1's markdownToHtml of this text (probed 2026-11-14)
const TEXT = "One\n\nTwo\n\n\nThree\n\n\n\nFour\n- item\n\n- item2\n\n# Head\n\nAfter";
const HTML =
  '<span class="p">One</span><br><br><span class="p" data-pos="5">Two</span><br><br><br><span class="p" data-pos="11">Three</span><br><br><br><br><span class="p" data-pos="20">Four</span><br><ul data-pos="25"><li data-pos="25"><span class="p" data-pos="27">item</span></li><li data-pos="33"><span class="p" data-pos="35">item2</span></li></ul><h1 data-pos="42">Head</h1><br><span class="p" data-pos="50">After</span>';

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

  it("puts back those the rendering left out, before a heading after a list and between a loose list's items alone", () => {
    const cell = document.createElement("div");
    cell.innerHTML = HTML;
    keepBlankLines(document, cell, TEXT);
    const before = (selector: string) => cell.querySelector(selector)!.previousElementSibling?.className;
    expect(before("h1")).toBe("swl-grid-blank");
    expect(before('li[data-pos="33"]')).toBe("swl-grid-blank");
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(2);
    // Drawn again over the same: none more
    keepBlankLines(document, cell, TEXT);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(2);
  });

  // SilverBullet 2.12.1's markdownToHtml of a blank line before a block whose first line starts another one too (probed
  // 2026-11-17): a list and its first item at one offset, a quote and the list in it on one line
  const ONE_LINE = [
    {
      what: "a list after a paragraph",
      text: "Plan\n\n- a\n- b",
      html: '<span class="p">Plan</span><br><ul data-pos="6"><li data-pos="6"><span class="p" data-pos="8">a</span></li><li data-pos="10"><span class="p" data-pos="12">b</span></li></ul>',
      before: "ul",
    },
    {
      what: "a numbered list after a heading",
      text: "## Head\n\n1. one\n2. two",
      html: '<h2>Head</h2><ol data-pos="9"><li data-pos="9"><span class="p" data-pos="12">one</span></li><li data-pos="16"><span class="p" data-pos="19">two</span></li></ol>',
      before: "ol",
    },
    {
      what: "a quote holding a list",
      text: "Text\n\n> - a\n> - b",
      html: '<span class="p">Text</span><br><blockquote data-pos="6"> <ul data-pos="8"><li data-pos="8"><span class="p" data-pos="10">a</span></li><li data-pos="14"><span class="p" data-pos="16">b</span></li></ul></blockquote>',
      before: "blockquote",
    },
  ];

  it.each(ONE_LINE)("puts back a blank line once before $what, before the outermost block of its line", ({ text, html, before }) => {
    const cell = document.createElement("div");
    cell.innerHTML = html;
    keepBlankLines(document, cell, text);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(1);
    expect(cell.querySelector(before)!.previousElementSibling?.className).toBe("swl-grid-blank");
    expect(cell.querySelector(`${before} .swl-grid-blank`)).toBeNull();
    keepBlankLines(document, cell, text);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(1);
  });

  it("puts back a quote's blank line between a loose list's items, and none the rendering keeps (between paragraphs, after a heading)", () => {
    // SilverBullet 2.12.1's markdownToHtml (probed 2026-11-17): a quote at 0, unmarked
    const cases = [
      { text: "> - a\n>\n> - b", html: '<blockquote> <ul data-pos="2"><li data-pos="2"><span class="p" data-pos="4">a</span></li><li data-pos="10"><span class="p" data-pos="12">b</span></li></ul></blockquote>', blanks: 1 },
      { text: "> one\n>\n> two", html: '<blockquote> <span class="p" data-pos="2">one</span><br><br> <span class="p" data-pos="10">two</span></blockquote>', blanks: 0 },
      { text: "> # Head\n>\n> - a", html: '<blockquote> <h1 data-pos="2">Head</h1><br> <ul data-pos="13"><li data-pos="13"><span class="p" data-pos="15">a</span></li></ul></blockquote>', blanks: 0 },
      // A quote's first line empty, after a blank line: the blank line put back before the quote, its empty line drawn in it
      { text: "Para\n\n>\n> one", html: '<span class="p">Para</span><br><blockquote data-pos="6"><br> <span class="p" data-pos="10">one</span></blockquote>', blanks: 1 },
      // A quote's last line empty: drawn after it
      { text: "> one\n>\ntwo", html: '<blockquote> <span class="p" data-pos="2">one</span><br></blockquote><br><span class="p" data-pos="8">two</span>', blanks: 0 },
      { text: "> > one\n> >\n> two", html: '<blockquote> <blockquote data-pos="2"> <span class="p" data-pos="4">one</span><br> </blockquote><br> <span class="p" data-pos="14">two</span></blockquote>', blanks: 0 },
    ];
    for (const { text, html, blanks } of cases) {
      const cell = document.createElement("div");
      cell.innerHTML = html;
      keepBlankLines(document, cell, text);
      expect(cell.querySelectorAll(".swl-grid-blank"), text).toHaveLength(blanks);
    }
    const cell = document.createElement("div");
    cell.innerHTML = cases[0]!.html;
    keepBlankLines(document, cell, cases[0]!.text);
    expect(cell.querySelector('li[data-pos="10"]')!.previousElementSibling?.className).toBe("swl-grid-blank");
  });

  it.each([
    // SilverBullet 2.12.1's markdownToHtml (probed 2026-11-17): a block after a blank line in a list's item, nothing drawn between
    { what: "a code block", text: "- a\n\n  ```\n  code\n  ```", html: '<ul><li><span class="p" data-pos="2">a</span><pre data-pos="7">code</pre></li></ul>', block: "pre" },
    { what: "a paragraph", text: "- a\n\n  para2", html: '<ul><li><span class="p" data-pos="2">a</span><span class="p" data-pos="7">para2</span></li></ul>', block: 'span[data-pos="7"]' },
    { what: "a heading", text: "- a\n\n  # H", html: '<ul><li><span class="p" data-pos="2">a</span><h1 data-pos="7">H</h1></li></ul>', block: "h1" },
    { what: "a quote", text: "- a\n\n  > q", html: '<ul><li><span class="p" data-pos="2">a</span><blockquote data-pos="7"> <span class="p" data-pos="9">q</span></blockquote></li></ul>', block: "blockquote" },
  ])("puts back a blank line before $what in a list's item, before it", ({ text, html, block }) => {
    const cell = document.createElement("div");
    cell.innerHTML = html;
    keepBlankLines(document, cell, text);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(1);
    expect(cell.querySelector(block)!.previousElementSibling?.className).toBe("swl-grid-blank");
  });

  it("puts back a blank line before a list nested in an item, before that list", () => {
    // (Probed alike: the outer list and its first item at 0, unmarked)
    const text = "- a\n\n  - b\n  - c";
    const cell = document.createElement("div");
    cell.innerHTML = '<ul><li><span class="p" data-pos="2">a</span><ul data-pos="7"><li data-pos="7"><span class="p" data-pos="9">b</span></li><li data-pos="13"><span class="p" data-pos="15">c</span></li></ul></li></ul>';
    keepBlankLines(document, cell, text);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(1);
    expect(cell.querySelector('ul[data-pos="7"]')!.previousElementSibling?.className).toBe("swl-grid-blank");
  });
});

describe("the space drawn before an element of a cell", () => {
  it("is the host's line breaks and the blank lines put back right before it, by kind, and what is drawn before them", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One</span><br><div class="swl-grid-blank"></div><br><ul data-pos="6"><li>a</li></ul>';
    const { breaks, blanks, before } = spaceBefore(cell.querySelector("ul")!);
    expect([breaks, blanks, before?.tagName]).toEqual([2, 1, "SPAN"]);
    expect(spaceBefore(cell.querySelector("span")!)).toEqual({ breaks: 0, blanks: 0, before: undefined });
  });
});

describe("the lines a cell's rendering starts", () => {
  it("are the outermost of its marked elements on each line, a link starting a paragraph's later line too", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One<br><a class="wiki-link" data-pos="4">Probe</a> two</span><ul data-pos="18"><li data-pos="18"><span class="p" data-pos="20">a</span></li></ul>';
    const starts = lineStarts(cell, "One\n[[Probe]] two\n- a");
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["A@4", "UL@18"]);
  });

  it("are its blocks and its lists' items, the outermost of those starting on one line standing for it", () => {
    const cell = document.createElement("div");
    cell.innerHTML =
      '<span class="p">Text</span><br><blockquote data-pos="6"> <ul data-pos="8"><li data-pos="8"><span class="p" data-pos="10">a</span></li><li data-pos="14"><span class="p" data-pos="16">b</span></li></ul></blockquote><ul data-pos="20"><li data-pos="20">c</li></ul>';
    const starts = lineStarts(cell, "Text\n\n> - a\n> - b\n- c");
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["BLOCKQUOTE@6", "LI@14", "UL@20"]);
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
