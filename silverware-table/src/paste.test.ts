import { describe, expect, it } from "vitest";
import { parseTable, serializeTable } from "./markdown.ts";
import { cellWrittenOver } from "../../shared/table/rules.ts";
import { moveCells, parseClipboardCells, pasteCells, planPaste } from "./paste.ts";
import { decode, encode } from "./store/markdown/codec.ts";
import { CELLS } from "./testing/formulas.ts";
import { NO_PINS } from "./view.ts";

describe("parseClipboardCells", () => {
  it("reads rows and cells as spreadsheets copy them", () => {
    expect(parseClipboardCells("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseClipboardCells("a\n\nb")).toEqual([["a"], [""], ["b"]]);
    expect(parseClipboardCells("a\t\tc")).toEqual([["a", "", "c"]]);
  });

  it("reads quoted cells with tabs, line breaks and quotes in them", () => {
    expect(parseClipboardCells('"two\nlines"\t"say ""hi"""\n')).toEqual([["two\nlines", 'say "hi"']]);
    // A quote that does not end the cell is text
    expect(parseClipboardCells('"5" kg\tx')).toEqual([['"5" kg', "x"]]);
  });

  it("leaves a single value to the field", () => {
    expect(parseClipboardCells("just text")).toBeUndefined();
    expect(parseClipboardCells("one value\n")).toBeUndefined();
    expect(parseClipboardCells("")).toBeUndefined();
  });
});

const TABLE = parseTable(
  ["| Name | Qty |", "|---|---|", "| Pear | 3 |", "| Apple | 10 |", `| Total | 13 <meta formulas.f='=SUM([qty])'> |`].join("\n"),
);

function paste(data: string[][], at: { row: number; column: number }, insert = false, pins = NO_PINS) {
  const plan = planPaste(decode(TABLE), pins, at, data, insert);
  if ("error" in plan) return plan;
  // As with the formulas module on: formula cells are its
  const pasted = pasteCells(decode(TABLE), plan, data, { keptBy: (cell) => (CELLS.formulaOf(cell) ? "formula cell" : undefined) });
  return { markdown: serializeTable(encode(pasted.table, TABLE)), skipped: pasted.skipped.get("formula cell") ?? 0, plan };
}

describe("pasting cells", () => {
  it("overwrites from the cell to the right and down, keeping formula cells", () => {
    const result = paste(
      [
        ["Fig", "2"],
        ["Plum", "5"],
        ["Kiwi", "7"],
      ],
      { row: 1, column: 0 },
    );
    expect(result).toMatchObject({ skipped: 1 });
    expect("markdown" in result && result.markdown).toBe(
      ["| Name | Qty |", "|---|---|", "| Fig | 2 |", "| Plum | 5 |", `| Kiwi | 13 <meta formulas.f='=SUM([qty])'> |`].join("\n"),
    );
  });

  it("keeps a header's name where nothing but spaces is pasted over it, and counts no blank value as one left", () => {
    const result = paste([["  ", "Count"]], { row: 0, column: 0 });
    expect("markdown" in result && result.markdown).toBe(["| Name | Count |", "|---|---|", "| Pear | 3 |", "| Apple | 10 |", `| Total | 13 <meta formulas.f='=SUM([qty])'> |`].join("\n"));
    expect(paste([[" "]], { row: 3, column: 1 })).toMatchObject({ skipped: 0 });
  });

  it("adds rows and columns where the table ends, before the rows pinned to the bottom", () => {
    const result = paste(
      [
        ["Fig", "2", "red"],
        ["Plum", "5", "blue"],
      ],
      { row: 2, column: 0 },
      false,
      { ...NO_PINS, bottom: 1 },
    );
    expect("markdown" in result && result.markdown).toBe(
      [
        "| Name | Qty | Column 3 |",
        "|---|---|---|",
        "| Pear | 3 | |",
        "| Fig | 2 | red |",
        "| Plum | 5 | blue |",
        `| Total | 13 <meta formulas.f='=SUM([qty])'> | |`,
      ].join("\n"),
    );
    expect("plan" in result && result.plan.newRows).toEqual({ at: 3, count: 1 });
    expect("plan" in result && result.plan.newColumns).toEqual({ at: 2, count: 1 });
  });

  it("inserts the rows as new at the cell's row with Shift, overwriting nothing", () => {
    const result = paste(
      [
        ["Fig", "2"],
        ["Plum", "5"],
      ],
      { row: 2, column: 0 },
      true,
    );
    expect("markdown" in result && result.markdown).toBe(
      [
        "| Name | Qty |",
        "|---|---|",
        "| Pear | 3 |",
        "| Fig | 2 |",
        "| Plum | 5 |",
        "| Apple | 10 |",
        `| Total | 13 <meta formulas.f='=SUM([qty])'> |`,
      ].join("\n"),
    );
  });

  it("names columns from a row pasted onto the header, keeping names left empty", () => {
    const result = paste(
      [
        ["Fruit", ""],
        ["Fig", "2"],
      ],
      { row: 0, column: 0 },
    );
    expect("markdown" in result && result.markdown).toBe(
      ["| Fruit | Qty |", "|---|---|", "| Fig | 2 |", "| Apple | 10 |", `| Total | 13 <meta formulas.f='=SUM([qty])'> |`].join("\n"),
    );
  });

  it("escapes pipes and puts line breaks in a cell on one line", () => {
    const result = paste([["a|b", "two\nlines"]], { row: 1, column: 0 });
    expect("markdown" in result && result.markdown).toContain("| a\\|b | two lines |");
  });

  it("says when new rows would have no place among the rows pinned to the bottom", () => {
    expect(paste([["x"], ["y"]], { row: 3, column: 0 }, false, { ...NO_PINS, bottom: 1 })).toEqual({
      error: "there are no rows below the rows pinned to the bottom to paste into",
    });
  });
});

describe("moving cells", () => {
  const RULES = { boundToContent: [{ owner: "formulas", key: "f" }], unique: [{ owner: "core", key: "cn" }] };

  it("takes a formula from the cell it leaves, even one whose result is empty, the name there staying", () => {
    const TABLE = parseTable("| A | B |\n|---|---|\n| 1 | <meta formulas.f='=\"\"' core.cn='x'> |\n| 2 | |");
    const plan = planPaste(decode(TABLE), NO_PINS, { row: 2, column: 1 }, [[""]], false);
    if ("error" in plan) throw new Error(plan.error);
    const moved = moveCells(decode(TABLE), [[{ row: 1, column: 1 }]], plan, (cell, over) => cellWrittenOver(cell, over, RULES));
    expect(serializeTable(encode(moved, TABLE))).toBe("| A | B |\n|---|---|\n| 1 | <meta core.cn='x'> |\n| 2 | <meta formulas.f='=\"\"'> |");
  });
});
