// @vitest-environment jsdom
// Where an element of a cell's rendering is in the cell's markdown: the lines it starts.
import { describe, expect, it } from "vitest";
import { markedLines } from "../../../../shared/markdown/parse.ts";
import { lineStarts } from "./offsets.ts";

describe("the lines a cell's rendering starts", () => {
  it("are the outermost of its marked elements on each line, a link starting a paragraph's later line too", () => {
    const cell = document.createElement("div");
    cell.innerHTML = '<span class="p">One<br><a class="wiki-link" data-pos="4">Probe</a> two</span><ul data-pos="18"><li data-pos="18"><span class="p" data-pos="20">a</span></li></ul>';
    const starts = lineStarts(cell, markedLines("One\n[[Probe]] two\n- a"));
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["A@4", "UL@18"]);
  });

  it("are its blocks and its lists' items, the outermost of those starting on one line standing for it", () => {
    const cell = document.createElement("div");
    cell.innerHTML =
      '<span class="p">Text</span><br><blockquote data-pos="6"> <ul data-pos="8"><li data-pos="8"><span class="p" data-pos="10">a</span></li><li data-pos="14"><span class="p" data-pos="16">b</span></li></ul></blockquote><ul data-pos="20"><li data-pos="20">c</li></ul>';
    const starts = lineStarts(cell, markedLines("Text\n\n> - a\n> - b\n- c"));
    expect(starts.map(({ element, offset }) => `${element.tagName}@${offset}`)).toEqual(["BLOCKQUOTE@6", "LI@14", "UL@20"]);
  });
});
