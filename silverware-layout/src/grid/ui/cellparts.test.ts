// @vitest-environment jsdom
// What a grid's cell draws besides its markdown's blocks: the blocks it draws, the space before one.
import { describe, expect, it } from "vitest";
import { drawnBlocks, spaceBefore } from "./cellparts.ts";

describe("the blocks a cell draws", () => {
  it("are its children but the space between them and the grid's grip", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One</span><br><div class="swl-grid-blank"></div><ul data-pos="6"><li>a</li></ul><br><button class="swl-grid-cell-grip"></button>';
    expect(drawnBlocks(cell).map((block) => block.tagName)).toEqual(["SPAN", "UL"]);
  });
});

describe("the space drawn before an element of a cell", () => {
  it("is the host's line breaks and the blank lines put back right before it, by kind, and what is drawn before them", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One</span><br><div class="swl-grid-blank"></div><br><ul data-pos="6"><li>a</li></ul><br><h1 data-pos="14">H</h1>';
    const { breaks, blanks, before, afterInline } = spaceBefore(cell.querySelector("ul")!);
    expect([breaks, blanks, before?.nodeName, afterInline]).toEqual([2, 1, "SPAN", true]);
    expect(spaceBefore(cell.querySelector("span")!)).toEqual({ breaks: 0, blanks: 0, before: undefined, afterInline: false });
    // After a block
    const heading = spaceBefore(cell.querySelector("h1")!);
    expect([heading.breaks, heading.before?.nodeName, heading.afterInline]).toEqual([1, "UL", false]);
  });

  it("is text the host left unwrapped too, inline, not the HTML's own white space", () => {
    const item = document.createElement("li");
    item.innerHTML = 'first<br>\n <ul data-pos="9"><li>b</li></ul>';
    const { breaks, before, afterInline } = spaceBefore(item.querySelector("ul")!);
    expect([breaks, before?.nodeName, before?.textContent, afterInline]).toEqual([1, "#text", "first", true]);
  });
});
