// @vitest-environment jsdom
// A cell's blank lines as the editor shows them: those the host's rendering left out (next to a block, between a
// loose list's items) put back, those it kept (between paragraphs, as line breaks) left as they are.
import { describe, expect, it } from "vitest";
import { lineStarts } from "../ui/offsets.ts";
import { keepBlankLines } from "../ui/view.ts";
import { blankLinesBefore, blankLinesDrawn, blankLineStart, lineStartOf } from "./blanklines.ts";

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
  });

  it("finds where the line a place is on starts", () => {
    expect(lineStartOf("ab\ncd", 4)).toBe(3);
    expect(lineStartOf("ab\ncd", 3)).toBe(3);
    expect(lineStartOf("ab\ncd", 2)).toBe(0);
    expect(lineStartOf("ab", 0)).toBe(0);
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

  it("puts back a blank line before a list nested in an item inside that item's list, before its first item", () => {
    // (Probed alike: the outer list and its first item at 0, unmarked)
    const text = "- a\n\n  - b\n  - c";
    const cell = document.createElement("div");
    cell.innerHTML = '<ul><li><span class="p" data-pos="2">a</span><ul data-pos="7"><li data-pos="7"><span class="p" data-pos="9">b</span></li><li data-pos="13"><span class="p" data-pos="15">c</span></li></ul></li></ul>';
    keepBlankLines(document, cell, text);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(1);
    expect(cell.querySelector('li[data-pos="7"]')!.previousElementSibling?.className).toBe("swl-grid-blank");
  });
});

describe("the lines a cell's rendering starts", () => {
  it("are its blocks and its lists' items, the outermost of those starting on one line standing for it", () => {
    const cell = document.createElement("div");
    cell.innerHTML =
      '<span class="p">Text</span><br><blockquote data-pos="6"> <ul data-pos="8"><li data-pos="8"><span class="p" data-pos="10">a</span></li><li data-pos="14"><span class="p" data-pos="16">b</span></li></ul></blockquote><ul data-pos="20"><li data-pos="20">c</li></ul>';
    const starts = lineStarts(cell, "Text\n\n> - a\n> - b\n- c");
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["BLOCKQUOTE@6", "LI@14", "UL@20"]);
  });
});

describe("a blank line clicked", () => {
  it("is where the nth blank line above a place's line starts, the nearest first; none past them", () => {
    const text = "a\n\n\nb";
    expect(blankLineStart(text, 4, 1)).toBe(3);
    expect(blankLineStart(text, 4, 2)).toBe(2);
    expect(blankLineStart(text, 4, 3)).toBeUndefined();
    expect(blankLineStart(text, 0, 1)).toBeUndefined();
  });
});
