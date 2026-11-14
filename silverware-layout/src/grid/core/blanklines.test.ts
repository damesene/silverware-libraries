// @vitest-environment jsdom
// A cell's blank lines as the editor shows them: those the host's rendering left out (next to a block, between a
// loose list's items) put back, those it kept (between paragraphs, as line breaks) left as they are.
import { describe, expect, it } from "vitest";
import { keepBlankLines } from "../ui/view.ts";
import { blankLinesBefore, blankLinesDrawn, blankLineStart } from "./blanklines.ts";

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
