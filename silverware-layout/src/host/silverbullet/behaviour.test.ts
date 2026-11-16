// How SilverBullet's behaviour is allowed for (./behaviour.ts): the text a grid drawn is in, before the editor's text is the new one
import { describe, expect, it } from "vitest";
import { gridLike, textForDrawing } from "./behaviour.ts";

describe("the grid most like a body not in the text (the editor's text not the new one yet)", () => {
  const page = `<grid width="980" border="1">\n<cell>\n\n- [ ] one\n- [ ] two\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\n<grid>\n<cell>\n\nOther\n\n</cell>\n<cell>\n\nCells\n\n</cell>\n</grid>\n`;
  it("is the one a cell's text changed in: its attributes", () => {
    const toggled = "<cell>\n\n- [x] one\n- [ ] two\n\n</cell>\n<cell>\n\nRight\n\n</cell>";
    expect(gridLike(page, toggled)?.attributes).toEqual({ width: "980", border: "1" });
  });
  it("is none where none has as many cells or shares most of it", () => {
    expect(gridLike(page, "<cell>\n\nA\n\n</cell>")).toBeUndefined();
    expect(gridLike(page, "<cell>\n\nSomething else entirely\n\n</cell>\n<cell>\n\nand more of it\n\n</cell>")).toBeUndefined();
  });
});

describe("the text a grid is drawn from", () => {
  const page = `# A\n\n<grid width="980">\n<cell>\n\n- [ ] one\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n`;
  const toggled = "<cell>\n\n- [x] one\n\n</cell>\n<cell>\n\nRight\n\n</cell>";
  it("is the page's where it has the grid, else the page's with the grid most like it given the body drawn", async () => {
    expect(await textForDrawing(async () => page, toggled)).toBe(page.replace("- [ ] one", "- [x] one"));
    const now = page.replace("- [ ] one", "- [x] one");
    expect(await textForDrawing(async () => now, toggled)).toBe(now);
  });
  it("is read again a moment later where the page's text has no grid yet (a page opening)", async () => {
    let reads = 0;
    expect(await textForDrawing(async () => (++reads < 3 ? "" : page), toggled)).toContain("- [x] one");
    expect(reads).toBe(3);
  });
});
