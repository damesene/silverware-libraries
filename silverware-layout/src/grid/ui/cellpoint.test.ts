// @vitest-environment jsdom
// A blank line of a cell clicked: found by height, between what is drawn above it and the line after it. jsdom lays
// nothing out: the boxes are given.
import { afterEach, describe, expect, it } from "vitest";
import { blankLineAt, offsetInCell } from "./cellpoint.ts";
import { keepBlankLines } from "./view.ts";

/** Each element's box, by its top and bottom; text by the range round it */
function laidOut(boxes: Map<Element, readonly [number, number]>, text: readonly [number, number]): void {
  const rect = ([top, bottom]: readonly [number, number]) => ({ top, bottom, left: 0, right: 100, x: 0, y: top, width: 100, height: bottom - top, toJSON: () => ({}) }) as DOMRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return rect(boxes.get(this) ?? [0, 0]);
  };
  Range.prototype.getBoundingClientRect = () => rect(text);
}

const elementRect = Element.prototype.getBoundingClientRect;
const rangeRect = Range.prototype.getBoundingClientRect;
afterEach(() => {
  Element.prototype.getBoundingClientRect = elementRect;
  Range.prototype.getBoundingClientRect = rangeRect;
});

describe("a blank line clicked", () => {
  it("lies under the text drawn above it, an item's text left unwrapped too, not over it", () => {
    // An item's text, a blank line, a list nested in the item (its margin between)
    const content = "- first\n\n  - b";
    const cell = document.createElement("div");
    cell.innerHTML = '<ul><li>first<ul data-pos="11"><li data-pos="11">b</li></ul></li></ul>';
    keepBlankLines(document, cell, content);
    const nested = cell.querySelector('ul[data-pos="11"]')!;
    laidOut(new Map([[cell, [0, 100]], [nested, [50, 75]], [nested.firstElementChild!, [50, 75]]]), [0, 20]);
    // On the text: no blank line; under it, in the blank line or the margin: the blank line's start
    expect(blankLineAt(content, cell, 10)).toBeUndefined();
    expect(blankLineAt(content, cell, 22)).toBe(content.indexOf("\n\n") + 1);
    expect(blankLineAt(content, cell, 45)).toBe(content.indexOf("\n\n") + 1);
  });

  it("in a quote, after its empty first lines, lies within the quote: the blank line before the quote is the quote's", () => {
    // A blank line before the quote (put back), two empty lines of the quote (drawn as line breaks in it), its text
    const content = "Para\n\n>\n>\n> one";
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">Para</span><br><blockquote data-pos="6"><br><br> <span class="p" data-pos="12">one</span></blockquote>';
    keepBlankLines(document, cell, content);
    expect(cell.querySelectorAll(".swl-grid-blank")).toHaveLength(1);
    const quote = cell.querySelector("blockquote")!;
    laidOut(new Map<Element, readonly [number, number]>([[cell, [0, 120]], [cell.querySelector(".p")!, [0, 20]], [quote, [45, 120]], [quote.querySelector(".p")!, [95, 120]]]), [0, 0]);
    // The quote's lines, 25 high each: its first empty line (at 6, the caret past its mark), its second (at 8); the blank
    // line before it (5)
    expect(blankLineAt(content, cell, 60)).toBe(7);
    expect(blankLineAt(content, cell, 80)).toBe(9);
    expect(blankLineAt(content, cell, 30)).toBe(5);
  });
});

describe("a point in a page the cell embeds", () => {
  it("is at the embed, the page's text none of the cell's markdown to follow", () => {
    const content = "![[Notes]]\n\n- a";
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p"><span class="swl-embedded" data-swl-embedded="Notes" data-pos="0"><span class="p">Some text</span><br><ul><li><span class="p">x</span></li></ul></span></span><br><ul data-pos="12"><li data-pos="12"><span class="p" data-pos="14">a</span></li></ul>';
    const word = [...cell.querySelectorAll(".p")].find((one) => one.textContent === "x")!;
    expect(offsetInCell(content, cell, word, { node: word.firstChild!, offset: 1 })).toBe(0);
    // The cell's own item still followed through its markdown
    const own = cell.querySelector('span[data-pos="14"]')!;
    expect(offsetInCell(content, cell, own, { node: own.firstChild!, offset: 1 })).toBe(15);
  });
});

describe("a point after a page the cell embeds, in the same paragraph", () => {
  it("is followed through the cell's markdown, the page's text left out, its embed passed over", () => {
    const content = "x\n\nSee ![[Notes]] and more";
    const cell = document.createElement("div");
    cell.innerHTML =
      '<span class="p">x</span><br><br><span class="p" data-pos="3">See <span class="swl-embedded" data-swl-embedded="Notes" data-pos="7"><span class="p">Some text</span></span> and more</span>';
    const after = cell.querySelector('span[data-pos="3"]')!.lastChild!;
    // (Clicked between "mo" and "re")
    expect(offsetInCell(content, cell, after.parentElement!, { node: after, offset: " and mo".length })).toBe(content.indexOf("re"));
  });
});

describe("a point right after a page the cell embeds", () => {
  it("is past its embed, never in the embed's own text", () => {
    const content = "See ![[Meeting notes]] and more";
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">See <span class="swl-embedded" data-swl-embedded="Meeting notes" data-pos="4"><span class="p">Notes</span></span> and more</span>';
    const after = cell.querySelector(".p")!.lastChild!;
    expect(offsetInCell(content, cell, after.parentElement!, { node: after, offset: 0 })).toBe(content.indexOf(" and"));
    const tight = "![[Notes]]s more";
    cell.innerHTML = '<span class="p"><span class="swl-embedded" data-swl-embedded="Notes" data-pos="0"><span class="p">x</span></span>s more</span>';
    const s = cell.querySelector(".p")!.lastChild!;
    expect(offsetInCell(tight, cell, s.parentElement!, { node: s, offset: 1 })).toBe(tight.indexOf("s more") + 1);
  });
});
