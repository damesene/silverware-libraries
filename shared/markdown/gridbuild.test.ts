// A grid built from a page's blocks by a mode and taken apart again: the blocks a selection touches, gallery's cell
// each, split's columns by number, the cells one under another again (items of one list one list again).
import { describe, expect, it } from "vitest";
import { readGrids } from "./grid.ts";
import { blocksIn, gridOfBlocks, gridText, splitCounts, ungridded } from "./gridbuild.ts";

const apply = (text: string, edit: { from: number; to: number; insert: string } | undefined) => (edit ? text.slice(0, edit.from) + edit.insert + text.slice(edit.to) : text);

describe("the blocks a selection touches", () => {
  const text = "Intro\n\n- a\n- [ ] b\n  - nested\n\n# Head\n\n![[a.png]]\n\n<grid>\n<column>\n\nIn\n\n</column>\n</grid>\n\nEnd";

  it("are each paragraph, each item (what is nested in it with it), a heading, an image's line; no grid", () => {
    const blocks = blocksIn(text, 0, text.length, readGrids(text));
    expect(blocks.map((block) => text.slice(block.from, block.to))).toEqual(["Intro", "- a", "- [ ] b\n  - nested", "# Head", "![[a.png]]", "End"]);
    expect(blocks.map((block) => block.item)).toEqual([false, true, true, false, false, false]);
  });

  it("are those a selection touches in part, or the one the cursor is in", () => {
    const at = text.indexOf("- a") + 2;
    expect(blocksIn(text, at, text.indexOf("Head")).map((block) => text.slice(block.from, block.to))).toEqual(["- a", "- [ ] b\n  - nested", "# Head"]);
    expect(blocksIn(text, at, at).map((block) => text.slice(block.from, block.to))).toEqual(["- a"]);
  });
});

describe("a grid built of blocks", () => {
  it("splits blocks in order by their number, the first columns one more", () => {
    expect(splitCounts(10, 3)).toEqual([4, 3, 3]);
    expect(splitCounts(2, 3)).toEqual([1, 1]);
    expect(splitCounts(6, 2)).toEqual([3, 3]);
  });

  it("gallery: a cell each, N to a row; a blank line kept before and after it", () => {
    const text = "Above\nOne\n\nTwo\n\nThree\nBelow";
    // (The paragraph `Above\nOne` is one block: its lines one)
    const blocks = blocksIn(text, text.indexOf("Two"), text.length);
    expect(apply(text, gridOfBlocks(text, blocks, "gallery", 2))).toBe(
      'Above\nOne\n\n<grid columns="2">\n<column>\n\nTwo\n\n</column>\n<column>\n\nThree\nBelow\n\n</column>\n</grid>',
    );
  });

  it("split: items of one list stay one list in a column, a numbered list's numbers as they were", () => {
    const text = "1. a\n2. b\n3. c\n4. d\n5. e\n\nAfter";
    const blocks = blocksIn(text, 0, text.indexOf("5. e") + 4);
    expect(apply(text, gridOfBlocks(text, blocks, "split", 2))).toBe(
      "<grid>\n<column>\n\n1. a\n2. b\n3. c\n\n</column>\n<column>\n\n4. d\n5. e\n\n</column>\n</grid>\n\nAfter",
    );
  });

  it("is taken apart into what it was made of, by either mode", () => {
    const text = "- a\n- b\n- c\n\nPara\n\n![[x.png]]";
    for (const mode of ["gallery", "split"] as const) {
      const built = apply(text, gridOfBlocks(text, blocksIn(text, 0, text.length), mode, 2));
      const grid = readGrids(built)[0]!;
      expect(built.slice(0, grid.from) + ungridded(grid) + built.slice(grid.to), mode).toBe(text);
    }
  });

  it("writes a grid's text in the form a cell is written, its attributes on its line", () => {
    // (An empty cell a blank line to type into)
    expect(gridText(["A", ""], { columns: "3" })).toBe('<grid columns="3">\n<column>\n\nA\n\n</column>\n<column>\n\n\n</column>\n</grid>');
  });
});
