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
  it("is the blank lines the host drew (the first line break only ending an inline line) and those put back, and what is drawn before them", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One</span><br><div class="swl-grid-blank"></div><br><ul data-pos="6"><li>a</li></ul><br><h1 data-pos="14">H</h1>';
    const { drawn, blanks, before } = spaceBefore(cell.querySelector("ul")!);
    expect([drawn, blanks, before?.nodeName]).toEqual([1, 1, "SPAN"]);
    expect(spaceBefore(cell.querySelector("span")!)).toEqual({ drawn: 0, blanks: 0, before: undefined });
    // After a block, each line break a blank line
    const heading = spaceBefore(cell.querySelector("h1")!);
    expect([heading.drawn, heading.before?.nodeName]).toEqual([1, "UL"]);
  });

  it("is text the host left unwrapped too, inline, not the HTML's own white space", () => {
    const item = document.createElement("li");
    item.innerHTML = 'first<br>\n <ul data-pos="9"><li>b</li></ul>';
    const { drawn, before } = spaceBefore(item.querySelector("ul")!);
    expect([drawn, before?.nodeName, before?.textContent]).toEqual([0, "#text", "first"]);
  });

  it("is each line break a blank line where nothing is before them", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<br><br><ul data-pos="2"><li>a</li></ul>';
    expect(spaceBefore(cell.querySelector("ul")!)).toEqual({ drawn: 2, blanks: 0, before: undefined });
  });
});
