import { describe, expect, it } from "vitest";
import { readGrids } from "../../../../shared/markdown/grid.ts";
import { gridInsertion } from "./insert.ts";

/** The text after the insertion, the cursor marked | */
function inserted(text: string, at: number, cells?: number): string {
  const edit = gridInsertion(text, at, cells);
  const after = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
  return `${after.slice(0, edit.cursor)}|${after.slice(edit.cursor)}`;
}

const GRID = "<grid>\n<column>\n\n|\n\n</column>\n<column>\n\n\n\n</column>\n</grid>";

describe("a new grid inserted", () => {
  it("puts two empty cells at an empty line, the cursor in the first, a blank line after where text follows", () => {
    expect(inserted("", 0)).toBe(`${GRID}\n`);
    expect(inserted("# A\n\n\n\nAfter", 5)).toBe(`# A\n\n${GRID}\n\nAfter`);
    expect(inserted("# A\n\n\nAfter", 5)).toBe(`# A\n\n${GRID}\n\nAfter`);
  });

  it("starts a block of its own after text on its line or a paragraph's line above", () => {
    expect(inserted("Some text", 9)).toBe(`Some text\n\n${GRID}\n`);
    expect(inserted("Para\n", 5)).toBe(`Para\n\n${GRID}\n`);
  });

  it("is read back as a grid of its cells, empty", () => {
    const edit = gridInsertion("Para\nmore", 4, 3);
    const text = "Para" + edit.insert + "\nmore";
    expect(readGrids(text).map((grid) => grid.cells.map((cell) => cell.content))).toEqual([["", "", ""]]);
  });
});
