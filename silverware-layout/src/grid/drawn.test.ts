// @vitest-environment jsdom
// What a grid drew in its cells, as the host drew it: none of a page a cell embeds.
import { describe, expect, it } from "vitest";
import { drawnIn } from "./drawn.ts";

describe("what a grid drew", () => {
  it("is its cells' media and links, none of a page a cell embeds", () => {
    const grid = document.createElement("div");
    grid.innerHTML =
      '<div class="swl-grid-cell"><span class="p"><a href="/Own" data-pos="2">Own</a></span><span class="p" data-pos="10"><span class="swl-embedded" data-swl-embedded="Notes" data-pos="10"><img src="x.png"><a href="/Other">Other</a></span></span></div>';
    expect(drawnIn(grid).map(({ kind, offset, element }) => `${kind}@${offset}:${element.textContent}`)).toEqual(["link@2:Own"]);
  });
});
