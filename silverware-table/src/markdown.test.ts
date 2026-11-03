import { describe, expect, it } from "vitest";
import {
  cellSourceOffset,
  escapeCell,
  findTables,
  locateBySource,
  locateByShape,
  minimalEdit,
  parseTable,
  serializeTable,
  splitRow,
  tablePlace,
  unescapeCell,
} from "./markdown.ts";
import { setCell } from "./ops.ts";

describe("splitRow", () => {
  it("splits cells and trims them", () => {
    expect(splitRow("| a | b |  c |")).toEqual(["a", "b", "c"]);
  });

  it("supports rows without outer pipes", () => {
    expect(splitRow("a | b")).toEqual(["a", "b"]);
  });

  it("keeps escaped pipes inside a cell", () => {
    expect(splitRow("| a \\| b | c |")).toEqual(["a \\| b", "c"]);
  });

  it("keeps an escaped pipe at the end of the last cell", () => {
    expect(splitRow("| a | b \\|")).toEqual(["a", "b \\|"]);
  });

  it("keeps empty cells", () => {
    expect(splitRow("| a |  | c |")).toEqual(["a", "", "c"]);
  });
});

describe("cellSourceOffset", () => {
  const table = "| Name | Qty |\n|---|---|\n| Pear |  3 |\n|apple||";

  it("points at the start of a cell's content", () => {
    expect(table.slice(cellSourceOffset(table, 0, 1))).toMatch(/^Qty/);
    expect(table.slice(cellSourceOffset(table, 1, 0))).toMatch(/^Pear/);
    expect(table.slice(cellSourceOffset(table, 1, 1))).toMatch(/^3 \|/);
  });

  it("moves into the cell, clamped to its content", () => {
    expect(table.slice(cellSourceOffset(table, 1, 0, 2))).toMatch(/^ar \|/);
    expect(table.slice(cellSourceOffset(table, 1, 0, 99))).toMatch(/^ \|  3/);
  });

  it("handles empty and missing cells", () => {
    expect(table.slice(cellSourceOffset(table, 2, 1))).toBe("|");
    expect(cellSourceOffset(table, 2, 5)).toBe(table.length);
  });

  it("skips the CR of CRLF lines", () => {
    const crlf = "| A |\r\n|---|\r\n| x |";
    expect(crlf.slice(cellSourceOffset(crlf, 1, 0))).toBe("x |");
  });
});

describe("findTables", () => {
  const page = [
    "# Title",
    "",
    "| A | B |",
    "|---|---|",
    "| 1 | 2 |",
    "",
    "```",
    "| X | Y |",
    "|---|---|",
    "```",
    "",
    "C | D",
    "--|--",
    "3 | 4",
    "text after",
  ].join("\n");

  it("finds tables outside fenced code with their ranges", () => {
    const tables = findTables(page);
    expect(tables.map((t) => t.text)).toEqual([
      "| A | B |\n|---|---|\n| 1 | 2 |",
      "C | D\n--|--\n3 | 4",
    ]);
    expect(tables.map((t) => t.ordinal)).toEqual([0, 1]);
    for (const t of tables) expect(page.slice(t.from, t.to)).toBe(t.text);
  });

  it("does not treat a horizontal rule after a line with a pipe as a table", () => {
    expect(findTables("a | b\n---\ntext")).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const text = "| A |\r\n|---|\r\n| 1 |\r\n";
    const [table] = findTables(text);
    expect(table?.text).toBe("| A |\r\n|---|\r\n| 1 |");
  });
});

describe("tablePlace", () => {
  const TABLE = "| A |\n|---|\n| 1 |";
  // The text with a new table "T" placed so
  const placed = (text: string, place?: Parameters<typeof tablePlace>[1]) => {
    const { at, before, after } = tablePlace(text, place);
    return text.slice(0, at) + before + "T" + after + text.slice(at);
  };

  it("goes after a table, an empty line between, one after it where text follows", () => {
    const text = `${TABLE}\n\nNext.\n`;
    expect(placed(text, { after: findTables(text)[0]! })).toBe(`${TABLE}\n\nT\n\nNext.\n`);
    expect(placed(TABLE, { after: findTables(TABLE)[0]! })).toBe(`${TABLE}\n\nT`);
  });

  it("goes at the page's end without a place, at its start alone", () => {
    expect(placed("Text.")).toBe("Text.\n\nT");
    expect(placed("")).toBe("T");
  });

  it("goes after the line of a position, one empty line before and after it", () => {
    const text = "First.\nSecond.\n";
    expect(placed(text, { position: 2 })).toBe("First.\n\nT\n\nSecond.\n");
    expect(placed("One.\n\nTwo.\n", { position: 1 })).toBe("One.\n\nT\n\nTwo.\n");
    // At the page's last line, and its end
    expect(placed("Only.", { position: 5 })).toBe("Only.\n\nT");
    expect(placed("Only.\n", { position: 6 })).toBe("Only.\n\nT");
  });

  it("goes on an empty line (what a slash command leaves) between empty lines it counts", () => {
    expect(placed("Text.\n\n\nMore.\n", { position: 7 })).toBe("Text.\n\nT\n\nMore.\n");
    expect(placed("\nMore.\n", { position: 0 })).toBe("T\n\nMore.\n");
  });

  it("goes after the table a position is in, never into it", () => {
    const text = `Intro.\n\n${TABLE}\nAfter.\n`;
    expect(placed(text, { position: text.indexOf("| 1") + 2 })).toBe(`Intro.\n\n${TABLE}\n\nT\n\nAfter.\n`);
  });
});

describe("parseTable / serializeTable", () => {
  it("round-trips an unchanged compact table byte for byte", () => {
    const text = "|A|B  |\n|:-|--:|\n| 1|2|\n|3 | |";
    expect(serializeTable(parseTable(text))).toBe(text);
  });

  it("reads alignment and pads short rows", () => {
    const table = parseTable("| A | B | C |\n|:--|:-:|--:|\n| 1 |");
    expect(table.align).toEqual(["left", "center", "right"]);
    expect(table.rows[1]?.cells).toEqual(["1", "", ""]);
  });

  it("rewrites only the changed row of a compact table", () => {
    const text = "|A|B|\n|-|-|\n|1|2|\n|3|4|";
    const changed = setCell(parseTable(text), 1, 1, "x");
    expect(serializeTable(changed)).toBe("|A|B|\n|-|-|\n| 1 | x |\n|3|4|");
  });

  it("lines up a formatted table as it shows: hidden tags take no room", () => {
    const table = { ...parseTable(`|A|B|\n|-|-|\n|1 <meta formulas.f='=2-1'>|x|\n|10|y|`), padded: true };
    expect(serializeTable(table)).toBe(['| A   | B   |', '| --- | --- |', `| 1 <meta formulas.f='=2-1'>  | x   |`, '| 10  | y   |'].join("\n"));
    // Read again, it is a formatted table
    expect(parseTable(serializeTable(table)).padded).toBe(true);
    // Padded by its text as written (another tool), it is one too
    expect(parseTable(['| A                          | B   |', '| -------------------------- | --- |', `| 1 <meta formulas.f='=2-1'> | x   |`, '| 10                         | y   |'].join("\n")).padded).toBe(true);
  });

  it("aligns a formatted table's columns up to the maximum width, a longer cell sticking out", () => {
    const long = "[https://example.com/a/very/long/path](https://example.com)";
    const table = { ...parseTable(`|ID|Link|Type|\n|:-|-|:-:|\n|01|${long}|A|\n|02|short|B|`), padded: true };
    expect(serializeTable(table, { cellWidth: 20 })).toBe(
      ["| ID  | Link  | Type |", "| :-- | ----- | :--: |", `| 01  | ${long} |  A   |`, "| 02  | short |  B   |"].join("\n"),
    );
    // No limit: the column as wide as the link
    expect(serializeTable(table).split("\n")[1]).toBe(`| :-- | ${"-".repeat(long.length)} | :--: |`);
  });

  it("writes a formatted table compact where a line of it padded would be longer than the line width, every row anew", () => {
    const long = "[https://example.com/a/very/long/path](https://example.com)";
    // Aligned before, its rows as they were: compact, none of them kept padded
    const text = ["| ID  | Link  | Type |", "| :-- | ----- | :--: |", "| 02  | short |  B   |"].join("\n");
    const table = parseTable(text);
    const grown = { ...table, rows: [...table.rows, { cells: ["01", long, "A"] }] };
    expect(serializeTable(grown, { lineWidth: 60 })).toBe(["| ID | Link | Type |", "|:---|---|:---:|", "| 02 | short | B |", `| 01 | ${long} | A |`].join("\n"));
    // Narrow enough: aligned
    expect(serializeTable(table, { lineWidth: 60 })).toBe(text);
    // No limit: aligned whatever its width
    expect(serializeTable(grown).split("\n")[1]).toBe(`| :-- | ${"-".repeat(long.length)} | :--: |`);
  });

  it("keeps an aligned table aligned", () => {
    const text = ["| Name  | Age |", "| ----- | --: |", "| Alice |  30 |", "| Bob   |   4 |"].join("\n");
    const table = parseTable(text);
    expect(table.padded).toBe(true);
    expect(serializeTable(table)).toBe(text);
    expect(serializeTable(setCell(table, 2, 0, "Roberta"))).toBe(
      ["| Name    | Age |", "| ------- | --: |", "| Alice   |  30 |", "| Roberta |   4 |"].join("\n"),
    );
  });

  it("keeps the indentation of a table in a list", () => {
    const text = "  | A |\n  |---|\n  | 1 |";
    expect(serializeTable(setCell(parseTable(text), 1, 0, "2"))).toBe("  | A |\n  |---|\n  | 2 |");
  });
});

describe("cell escaping", () => {
  it("escapes pipes and joins lines", () => {
    expect(escapeCell("a | b\nc")).toBe("a \\| b c");
  });

  it("does not escape an already escaped pipe twice", () => {
    expect(escapeCell("a \\| b")).toBe("a \\| b");
  });

  it("round-trips through the editor", () => {
    expect(escapeCell(unescapeCell("x \\| y"))).toBe("x \\| y");
  });
});

describe("locating a rendered table", () => {
  const page = "| A |\n|---|\n| 1 |\n\ntext\n\n| A |\n|---|\n| 1 |\n\n| B | C |\n|---|---|\n| 2 | 3 |";
  const [first, second, third] = findTables(page);

  it("picks the nearest table with the same source", () => {
    expect(locateBySource(page, second!.from + 2, "| A |\n|---|\n| 1 |")?.from).toBe(second!.from);
    expect(locateBySource(page, 0, "| A |\n|---|\n| 1 |")?.from).toBe(first!.from);
    expect(locateBySource(page, 0, "| Z |\n|---|\n| 1 |")).toBeUndefined();
  });

  it("finds a table by shape when the position is stale", () => {
    expect(locateByShape(page, 0, { rows: 2, columns: 2 })?.from).toBe(third!.from);
  });

  it("prefers matching header texts among tables of the same shape", () => {
    const text = "| A |\n|---|\n| 1 |\n\n| **B** |\n|---|\n| 1 |";
    const [, b] = findTables(text);
    expect(locateByShape(text, 0, { rows: 2, columns: 1, headers: ["B"] })?.from).toBe(b!.from);
  });
});

describe("minimalEdit", () => {
  it("replaces only the differing middle", () => {
    expect(minimalEdit("abcdef", "abXYef")).toEqual({ from: 2, to: 4, insert: "XY" });
  });

  it("handles pure insertions and deletions", () => {
    expect(minimalEdit("abc", "abxc")).toEqual({ from: 2, to: 2, insert: "x" });
    expect(minimalEdit("abxc", "abc")).toEqual({ from: 2, to: 3, insert: "" });
  });
});

describe("parseTable's memory", () => {
  it("gives the same table for the same text (tables are never changed), a new one once the text changes", () => {
    const text = "| A |\n|---|\n| 1 |";
    const table = parseTable(text);
    expect(parseTable(text)).toBe(table);
    expect(parseTable(`${text} `)).not.toBe(table);
    // Kept among the last ones parsed, then parsed anew
    for (let i = 0; i < 20; i++) parseTable(`| A |\n|---|\n| ${i} |`);
    expect(parseTable(text)).not.toBe(table);
    expect(parseTable(text)).toEqual(table);
  });
});
