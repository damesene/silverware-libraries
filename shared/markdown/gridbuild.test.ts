// A grid built from a page's blocks by a mode and taken apart again: the blocks a selection touches, gallery's cell
// each, split's columns by number, the cells one under another again (items of one list one list again).
import { describe, expect, it } from "vitest";
import { readGrids } from "./grid.ts";
import { blocksIn, type GridPlace, gridOfBlocks, gridText, type MoveMode, movedIntoGrid, splitCounts, ungridded } from "./gridbuild.ts";

const apply = (text: string, edit: { from: number; to: number; insert: string } | undefined) => (edit ? text.slice(0, edit.from) + edit.insert + text.slice(edit.to) : text);

describe("the blocks a selection touches", () => {
  const text = "Intro\n\n- a\n- [ ] b\n  - nested\n\n# Head\n\n![[a.png]]\n\n<grid>\n<cell>\n\nIn\n\n</cell>\n</grid>\n\nEnd";

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
    // (A paragraph's lines are blocks each, as the editor shows them apart: `Three` and `Below` two cells)
    const blocks = blocksIn(text, text.indexOf("Two"), text.length);
    expect(apply(text, gridOfBlocks(text, blocks, "gallery", 2))).toBe(
      'Above\nOne\n\n<grid columns="2">\n<cell>\n\nTwo\n\n</cell>\n<cell>\n\nThree\n\n</cell>\n<cell>\n\nBelow\n\n</cell>\n</grid>',
    );
    // Auto: as many to a row as fit; a split asked for it cut into two
    const two = blocksIn(text, text.indexOf("Two"), text.indexOf("Three") + 1);
    expect(apply(text, gridOfBlocks(text, two, "gallery", "auto"))).toContain('<grid columns="auto">');
    expect(apply(text, gridOfBlocks(text, two, "split", "auto"))).toContain("<grid>\n<cell>\n\nTwo\n\n</cell>\n<cell>\n\nThree\n\n</cell>\n</grid>");
  });

  it("takes a paragraph's lines as blocks each, the lines a selection touches alone, and gives them back as they were", () => {
    const text = "![[a.png]]\n![[b.png]]\n![[c.png]]";
    // (The second line alone touched: it alone)
    expect(blocksIn(text, text.indexOf("b.png"), text.indexOf("b.png") + 2).map((block) => text.slice(block.from, block.to))).toEqual(["![[b.png]]"]);
    for (const mode of ["gallery", "split"] as const) {
      const built = apply(text, gridOfBlocks(text, blocksIn(text, 0, text.length), mode, 3));
      const grid = readGrids(built)[0]!;
      expect(grid.cells.map((cell) => cell.content), mode).toEqual(["![[a.png]]", "![[b.png]]", "![[c.png]]"]);
      expect(ungridded(grid), mode).toBe(text);
    }
    // Two lines in one column of a split: as they were, a line break between
    const two = apply(text, gridOfBlocks(text, blocksIn(text, 0, text.length), "split", 2));
    expect(readGrids(two)[0]!.cells.map((cell) => cell.content)).toEqual(["![[a.png]]\n![[b.png]]", "![[c.png]]"]);
  });

  it("joins two cells of a line of text each by a line break as it takes the grid apart (a blank line between them not kept)", () => {
    const text = "One\n\nTwo";
    const built = apply(text, gridOfBlocks(text, blocksIn(text, 0, text.length), "gallery", 2));
    expect(ungridded(readGrids(built)[0]!)).toBe("One\nTwo");
  });

  it("split: items of one list stay one list in a column, a numbered list's numbers as they were", () => {
    const text = "1. a\n2. b\n3. c\n4. d\n5. e\n\nAfter";
    const blocks = blocksIn(text, 0, text.indexOf("5. e") + 4);
    expect(apply(text, gridOfBlocks(text, blocks, "split", 2))).toBe(
      "<grid>\n<cell>\n\n1. a\n2. b\n3. c\n\n</cell>\n<cell>\n\n4. d\n5. e\n\n</cell>\n</grid>\n\nAfter",
    );
  });

  it("is taken apart into what it was made of, by either mode", () => {
    const text = "- a\n- b\n- c\n\nPara\n![[x.png]]\n\n## Heading\n\nAfter it";
    for (const mode of ["gallery", "split"] as const) {
      const built = apply(text, gridOfBlocks(text, blocksIn(text, 0, text.length), mode, 2));
      const grid = readGrids(built)[0]!;
      expect(built.slice(0, grid.from) + ungridded(grid) + built.slice(grid.to), mode).toBe(text);
    }
  });

  it("writes a grid's text in the form a cell is written, its attributes on its line", () => {
    // (An empty cell a blank line to type into)
    expect(gridText(["A", ""], { columns: "3" })).toBe('<grid columns="3">\n<cell>\n\nA\n\n</cell>\n<cell>\n\n\n</cell>\n</grid>');
  });
});

describe("blocks moved into a grid", () => {
  const grid = "<grid>\n<cell>\n\nA\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n</grid>";
  const move = (text: string, from: string, to: string, mode: MoveMode, place: GridPlace) => {
    const blocks = blocksIn(text, text.indexOf(from), text.indexOf(to) + to.length, readGrids(text));
    const moved = movedIntoGrid(text, blocks, readGrids(text)[0]!, mode, place);
    return "text" in moved ? moved.text : moved.problem;
  };

  it("each a cell of its own, before a cell or after the last; taken out, a blank line left between what was round them", () => {
    const text = `Top\n\nOne\n\n- two\n- three\n\nBottom\n\n${grid}\n`;
    expect(move(text, "One", "three", "each", { kind: "cells", at: 1 })).toBe(
      "Top\n\nBottom\n\n<grid>\n<cell>\n\nA\n\n</cell>\n<cell>\n\nOne\n\n</cell>\n<cell>\n\n- two\n\n</cell>\n<cell>\n\n- three\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n</grid>\n",
    );
    expect(move(text, "One", "One", "each", { kind: "cells", at: 2 })).toBe(
      "Top\n\n- two\n- three\n\nBottom\n\n<grid>\n<cell>\n\nA\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n<cell>\n\nOne\n\n</cell>\n</grid>\n",
    );
  });

  it("together: one new cell, or into a cell at a block's start or its end; the grid above them too", () => {
    const text = `${grid}\n\nOne\nTwo\n\nEnd`;
    expect(move(text, "One", "Two", "together", { kind: "cells", at: 0 })).toBe(
      "<grid>\n<cell>\n\nOne\nTwo\n\n</cell>\n<cell>\n\nA\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n</grid>\n\nEnd",
    );
    const b2 = readGrids(text)[0]!.cells[1]!.content.indexOf("B2");
    expect(move(text, "One", "Two", "together", { kind: "cell", cell: 1, at: b2 })).toBe("<grid>\n<cell>\n\nA\n\n</cell>\n<cell>\n\nB\n\nOne\nTwo\n\nB2\n\n</cell>\n</grid>\n\nEnd");
    expect(move(text, "Two", "Two", "together", { kind: "cell", cell: 0, at: Number.MAX_SAFE_INTEGER })).toBe(
      "<grid>\n<cell>\n\nA\n\nTwo\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n</grid>\n\nOne\n\nEnd",
    );
    expect(move(text, "End", "End", "together", { kind: "cell", cell: 0, at: 0 })).toBe("<grid>\n<cell>\n\nEnd\n\nA\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n</grid>\n\nOne\nTwo");
  });

  it("keeps a paragraph's lines round a line taken out together, CRLF as the page has it", () => {
    const text = `One\nTwo\nThree\n\n${grid}`.replace(/\n/g, "\r\n");
    expect(move(text, "Two", "Two", "each", { kind: "cells", at: 2 })).toBe(
      "One\nThree\n\n<grid>\n<cell>\n\nA\n\n</cell>\n<cell>\n\nB\n\nB2\n\n</cell>\n<cell>\n\nTwo\n\n</cell>\n</grid>".replace(/\n/g, "\r\n"),
    );
  });

  it("refuses a cell not there any more, or changed since it was drawn (its offset another's)", () => {
    const text = `${grid}\n\nOne`;
    expect(move(text, "One", "One", "together", { kind: "cell", cell: 5, at: 0 })).toBe("that cell changed since it was drawn");
    expect(move(text, "One", "One", "together", { kind: "cell", cell: 0, at: 0, was: "Other" })).toBe("that cell changed since it was drawn");
    expect(move(text, "One", "One", "together", { kind: "cell", cell: 0, at: 0, was: "A" })).toContain("<cell>\n\nOne\n\nA\n\n</cell>");
  });

  it("leaves a blank line where what was round them would run on into another kind: a grid or a heading after a paragraph's line", () => {
    const below = `Top\n# H\n${grid}`;
    const moved = move(below, "# H", "# H", "each", { kind: "cells", at: 0 });
    expect(moved.startsWith("Top\n\n<grid>")).toBe(true);
    expect(readGrids(moved)).toHaveLength(1);
    expect(move(`One\n\`\`\`\ncode\n\`\`\`\nBottom\n\n${grid}`, "```", "code\n```", "each", { kind: "cells", at: 0 }).startsWith("One\n\nBottom\n\n<grid>")).toBe(true);
    // (A list's item taken out of it: the list goes on)
    expect(move(`- a\n- b\n- c\n\n${grid}`, "- b", "- b", "each", { kind: "cells", at: 0 }).startsWith("- a\n- c\n\n<grid>")).toBe(true);
  });

  it("keeps an indented code block's first line's indent", () => {
    const text = `Para\n\n    code1\n    code2\n\n${grid}`;
    expect(move(text, "code1", "code2", "each", { kind: "cells", at: 0 })).toContain("<cell>\n\n    code1\n    code2\n\n</cell>");
  });
});
