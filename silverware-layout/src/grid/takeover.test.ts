// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { blocksOf, takeOver } from "./takeover.ts";
import { CELL_CONTROLS as CONTROLS } from "./ui/view.ts";

/** A grid drawn of cells' HTML, each cell marked with its index as the grids draw one */
function grid(...cells: string[]): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = cells.map((html, index) => `<div class="swl-grid-cell" data-swl-cell="${index}">${html}</div>`).join("");
  return element;
}

describe("a cell's blocks", () => {
  it("are its children by their offsets, the first's 0 unmarked, the host's line breaks and ours none", () => {
    const [cell] = grid('<span class="p">One</span><br><br><span class="p" data-pos="5">Two</span><div class="swl-grid-blank"></div><ul data-pos="10"><li>x</li></ul>').children;
    expect(blocksOf(cell as HTMLElement, "One\n\nTwo\n\n- x").map((block) => [block.at, block.text])).toEqual([
      [0, "One"],
      [5, "Two"],
      [10, "- x"],
    ]);
  });

  it("are none where a child is unmarked but the first (another's drawing): unknown then", () => {
    const [cell] = grid('<span class="p">One</span><span class="frame">drawn by another</span>').children;
    expect(blocksOf(cell as HTMLElement, "One")).toEqual([]);
  });
});

describe("taking over a drawing", () => {
  it("takes a block of a cell written whose markdown is the same, its offsets moved to where it starts now (a task's box clicked toggles its own)", () => {
    // `Note` grew by 8 characters: the list's block the same, 8 further on
    const old = grid('<span class="p">Note</span><ul data-pos="6"><li data-pos="6"><input type="checkbox" data-pos="8"> a</li><li data-pos="14"><input type="checkbox" data-pos="16"> b</li></ul>');
    const fresh = grid('<span class="p">Note abcdefg</span><ul data-pos="14"><li data-pos="14"><input type="checkbox" data-pos="16"> a</li><li data-pos="22"><input type="checkbox" data-pos="24"> b</li></ul>');
    const list = old.querySelector("ul")!;
    const box = list.querySelectorAll("input")[1]!;
    const drawn = takeOver(
      { element: fresh, contents: ["Note abcdefg\n\n- [ ] a\n- [ ] b"], drawn: [] },
      { element: old, contents: ["Note\n\n- [ ] a\n- [ ] b"], drawn: [{ cell: 0, kind: "embed", element: box, offset: 16 }] },
    );
    expect(fresh.querySelector("ul")).toBe(list);
    expect(box.getAttribute("data-pos")).toBe("24");
    expect(list.getAttribute("data-pos")).toBe("14");
    expect(drawn.fresh).toEqual([{ cell: 0, kind: "embed", element: box, offset: 24 }]);
    // (The paragraph changed: drawn anew; the old drawing given the fresh list, at its old offsets)
    expect(fresh.querySelector(".p")!.textContent).toBe("Note abcdefg");
    expect(old.querySelector("ul")!.getAttribute("data-pos")).toBe("6");
    expect(old.querySelectorAll("input")[1]!.getAttribute("data-pos")).toBe("16");
  });

  it("marks a block taken from the cell's start where it starts further on now", () => {
    const old = grid('<span class="p">Same</span>');
    const fresh = grid('<span class="p">New</span><br><br><span class="p" data-pos="5">Same</span>');
    const same = old.querySelector(".p")!;
    takeOver({ element: fresh, contents: ["New\n\nSame"], drawn: [] }, { element: old, contents: ["Same"], drawn: [] });
    expect(fresh.querySelectorAll(".p")[1]).toBe(same);
    expect(same.getAttribute("data-pos")).toBe("5");
  });

  it("takes a cell of the same markdown whole, wherever it was, each drawing keeping its own controls", () => {
    const old = grid('<span class="p">Left</span><button class="swl-grid-cell-grip"></button>', '<span class="p">Right</span><button class="swl-grid-cell-grip"></button>');
    const fresh = grid('<span class="p">Right</span><button class="swl-grid-cell-grip"></button>', '<span class="p">Left typed</span><button class="swl-grid-cell-grip"></button>');
    const right = old.querySelectorAll(".p")[1]!;
    const grip = fresh.querySelector(CONTROLS)!;
    takeOver({ element: fresh, contents: ["Right", "Left typed"], drawn: [] }, { element: old, contents: ["Left", "Right"], drawn: [] });
    expect(fresh.querySelector(".p")).toBe(right);
    expect(fresh.querySelector(CONTROLS)).toBe(grip);
    expect(fresh.querySelectorAll(".p")[1]!.textContent).toBe("Left typed");
  });
});
