import { describe, expect, it } from "vitest";
import { readGrids } from "./grid.ts";

const page = [
  "# Page",
  "",
  '<grid columns="1fr 2fr">',
  "<column>",
  "",
  "**Left** [[Target]]",
  "",
  "</column>",
  "<column span=2>",
  "",
  "![[cat.png|Cat|120]]",
  "",
  "</column>",
  "</grid>",
  "",
  "After.",
].join("\n");

describe("readGrids", () => {
  it("reads a grid's place, its attributes and its cells' content without the blank lines round it", () => {
    const [grid, ...rest] = readGrids(page);
    expect(rest).toEqual([]);
    expect(page.slice(grid!.from, grid!.to)).toBe(page.split("\n").slice(2, 14).join("\n"));
    expect(grid!.attributes).toEqual({ columns: "1fr 2fr" });
    expect(grid!.body.startsWith("<column>\n")).toBe(true);
    expect(grid!.body.endsWith("</column>")).toBe(true);
    expect(grid!.cells.map((cell) => [cell.content, cell.attributes, cell.closed])).toEqual([
      ["**Left** [[Target]]", {}, true],
      ["![[cat.png|Cat|120]]", { span: "2" }, true],
    ]);
    const [left] = grid!.cells;
    expect(page.slice(left!.contentFrom, left!.contentTo)).toBe("**Left** [[Target]]");
    expect(page.slice(left!.from, left!.to)).toBe("<column>\n\n**Left** [[Target]]\n\n</column>");
    expect(page.slice(left!.innerFrom, left!.innerTo)).toBe("\n**Left** [[Target]]\n\n");
  });

  it("reads the compact form typed by hand, a cell of several lines, an empty cell", () => {
    const text = "<grid>\n<column>\nOne\n- a\n- b\n</column>\n<column>\n</column>\n</grid>";
    const [grid] = readGrids(text);
    expect(grid!.cells.map((cell) => cell.content)).toEqual(["One\n- a\n- b", ""]);
    const empty = grid!.cells[1]!;
    expect([empty.contentFrom, empty.contentTo]).toEqual([empty.innerFrom, empty.innerFrom]);
  });

  it("ends a grid at the first </grid>, as SilverBullet's parser does, even in a fenced block within", () => {
    const text = "<grid>\n<column>\n```\n</grid>\n```\n</column>\n</grid>";
    const [grid] = readGrids(text);
    expect(text.slice(grid!.from, grid!.to)).toBe("<grid>\n<column>\n```\n</grid>");
  });

  it("does not close a cell at a </column> in a fenced block within it", () => {
    const text = "<grid>\n<column>\n```\n</column>\n```\n</column>\n</grid>";
    expect(readGrids(text)[0]!.cells.map((cell) => cell.content)).toEqual(["```\n</column>\n```"]);
  });

  it("runs a cell left open to the grid's end", () => {
    const text = "<grid>\n<column>\nOpen\n</grid>";
    const [cell] = readGrids(text)[0]!.cells;
    expect([cell!.content, cell!.closed]).toEqual(["Open", false]);
    expect(text.slice(cell!.innerTo)).toBe("</grid>");
  });

  it("takes no grid that is never closed, one in a fenced block, nor one running on from a paragraph", () => {
    expect(readGrids("<grid>\n<column>\nx\n</column>")).toEqual([]);
    expect(readGrids("```\n<grid>\n</grid>\n```")).toEqual([]);
    expect(readGrids("A paragraph\n<grid>\n</grid>")).toEqual([]);
    expect(readGrids("  <grid>\n</grid>")).toEqual([]);
  });

  it("takes a grid right after a heading, a closing fence or another grid", () => {
    expect(readGrids("# H\n<grid>\n</grid>")).toHaveLength(1);
    expect(readGrids("```\nx\n```\n<grid>\n</grid>")).toHaveLength(1);
    expect(readGrids("<grid>\n</grid>\n<grid>\n</grid>")).toHaveLength(2);
  });

  it("reads a page of CRLF line breaks, its content with LF", () => {
    const text = "<grid>\r\n<column>\r\n\r\nA\r\nB\r\n\r\n</column>\r\n</grid>\r\n";
    const [grid] = readGrids(text);
    expect(grid!.cells[0]!.content).toBe("A\nB");
    expect(grid!.body).toBe("<column>\r\n\r\nA\r\nB\r\n\r\n</column>");
  });

  it("reads an empty grid, and lines between cells as no cell's", () => {
    expect(readGrids("<grid>\n</grid>")[0]).toMatchObject({ body: "", cells: [] });
    expect(readGrids("<grid>\nstray\n<column>\nA\n</column>\n</grid>")[0]!.cells.map((cell) => cell.content)).toEqual(["A"]);
  });
});
