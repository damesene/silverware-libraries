// A cell's markdown read line by line, once for the same text.
import { describe, expect, it } from "vitest";
import { cellLines } from "./celllines.ts";

describe("a cell's lines", () => {
  it("are read once for the same markdown, whichever cell asks, again for another", () => {
    const lines = cellLines("a\n\nb");
    expect(lines.map(({ from }) => from)).toEqual([0, 2, 3]);
    expect(cellLines("a\n\nb")).toBe(lines);
    expect(cellLines("a\nb")).not.toBe(lines);
  });
});
