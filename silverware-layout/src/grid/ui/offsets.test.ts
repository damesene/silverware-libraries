// @vitest-environment jsdom
// Where an element of a cell's rendering is in the cell's markdown: the lines it starts.
import { describe, expect, it } from "vitest";
import { markedLines } from "../../../../shared/markdown/parse.ts";
import { lineStarts } from "./offsets.ts";

describe("the lines a cell's rendering starts", () => {
  it("are the outermost of its marked elements on each line, none in a paragraph (a link starting its later line)", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One<br><a class="wiki-link" data-pos="4">Probe</a> two</span><ul data-pos="18"><li data-pos="18"><span class="p" data-pos="20">a</span></li></ul>';
    const starts = [...lineStarts(cell, markedLines("One\n[[Probe]] two\n- a"))];
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["UL@18"]);
  });

  it("are none of a page embedded in a paragraph, its offsets its own page's", () => {
    // SilverBullet 2.12.1's markdownToHtml of "![[Notes]]\n\n- a", Notes "Some text\n\n- x\n- y", expanded (probed 2026-11-17)
    const cell = document.createElement("div");
    cell.innerHTML =
      '<span class="p"><span class="p">Some text</span><br><ul data-pos="11"><li data-pos="11"><span class="p" data-pos="13">x</span></li><li data-pos="15"><span class="p" data-pos="17">y</span></li></ul></span><br><ul data-pos="12"><li data-pos="12"><span class="p" data-pos="14">a</span></li></ul>';
    const starts = [...lineStarts(cell, markedLines("![[Notes]]\n\n- a"))];
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["UL@12"]);
  });

  it("are its blocks and its lists' items, the outermost of those starting on one line standing for it", () => {
    const cell = document.createElement("div");
    cell.innerHTML =
      '<span class="p">Text</span><br><blockquote data-pos="6"> <ul data-pos="8"><li data-pos="8"><span class="p" data-pos="10">a</span></li><li data-pos="14"><span class="p" data-pos="16">b</span></li></ul></blockquote><ul data-pos="20"><li data-pos="20">c</li></ul>';
    const starts = [...lineStarts(cell, markedLines("Text\n\n> - a\n> - b\n- c"))];
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["BLOCKQUOTE@6", "LI@14", "UL@20"]);
  });
});
