import { describe, expect, it } from "vitest";
import type { Style } from "./api.ts";
import { cellOf, type Placed, sampleOf } from "./index.ts";

const column = (values: readonly string[]): Placed[] =>
  values.map((v, i) => {
    const cell = cellOf(v, v, "x");
    return { row: i + 1, column: 0, cell, rowCells: { x: cell } };
  });
const styled = (cells: Placed[], pick: (v: string) => boolean): Map<string, Style> =>
  new Map(cells.filter((p) => pick(p.cell.text)).map((p) => [`${p.row}:${p.column}`, { bold: true }]));

describe("A rule's sample", () => {
  it("spans the numbers from the smallest to the largest, in their order, whatever the table's size", () => {
    const cells = column(Array.from({ length: 1000 }, (_, i) => String(1000 - i)));
    const sample = sampleOf(cells, new Map(), 5);
    expect(sample.map((s) => s.text)).toEqual(["1", "251", "501", "750", "1000"]);
  });

  it("shows every cell where there are few, the texts after the numbers, each once; empty cells not", () => {
    const sample = sampleOf(column(["b", "3", "", "a", "1", "b"]), new Map(), 8);
    expect(sample.map((s) => s.text)).toEqual(["1", "3", "b", "a"]);
  });

  it("keeps a third of its room for texts beside many numbers", () => {
    const sample = sampleOf(column([...Array.from({ length: 50 }, (_, i) => String(i)), "x", "y", "z"]), new Map(), 6);
    expect(sample.map((s) => s.text)).toEqual(["0", "16", "33", "49", "x", "y"]);
  });

  it("gives each cell its look, and has a cell the rule formats and one it does not where there are both", () => {
    const cells = column(Array.from({ length: 100 }, (_, i) => String(i)));
    // Only 42 formatted: not among the numbers at their places, put in
    const sample = sampleOf(cells, styled(cells, (v) => v === "42"), 4);
    expect(sample.map((s) => [s.text, !!s.style])).toEqual([
      ["0", false],
      ["33", false],
      ["42", true],
      ["66", false],
    ]);
    // Every cell formatted but 7: 7 put in
    const most = sampleOf(cells, styled(cells, (v) => v !== "7"), 4);
    expect(most.some((s) => s.text === "7" && !s.style)).toBe(true);
    expect(most).toHaveLength(4);
  });
});
