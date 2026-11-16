import { describe, expect, it } from "vitest";
import { readGridBody, readGrids } from "./grid.ts";

const page = [
  "# Page",
  "",
  '<grid columns="1fr 2fr">',
  "<cell>",
  "",
  "**Left** [[Target]]",
  "",
  "</cell>",
  "<cell span=2>",
  "",
  "![[cat.png|Cat|120]]",
  "",
  "</cell>",
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
    expect(grid!.body.startsWith("<cell>\n")).toBe(true);
    expect(grid!.body.endsWith("</cell>")).toBe(true);
    expect(grid!.cells.map((cell) => [cell.content, cell.attributes, cell.closed])).toEqual([
      ["**Left** [[Target]]", {}, true],
      ["![[cat.png|Cat|120]]", { span: "2" }, true],
    ]);
    const [left] = grid!.cells;
    expect(page.slice(left!.contentFrom, left!.contentTo)).toBe("**Left** [[Target]]");
    expect(page.slice(left!.from, left!.to)).toBe("<cell>\n\n**Left** [[Target]]\n\n</cell>");
    expect(page.slice(left!.innerFrom, left!.innerTo)).toBe("\n**Left** [[Target]]\n\n");
  });

  it("reads the compact form typed by hand, a cell of several lines, an empty cell", () => {
    const text = "<grid>\n<cell>\nOne\n- a\n- b\n</cell>\n<cell>\n</cell>\n</grid>";
    const [grid] = readGrids(text);
    expect(grid!.cells.map((cell) => cell.content)).toEqual(["One\n- a\n- b", ""]);
    const empty = grid!.cells[1]!;
    expect([empty.contentFrom, empty.contentTo]).toEqual([empty.innerFrom, empty.innerFrom]);
  });

  it("ends a grid at the first </grid>, as SilverBullet's parser does, even in a fenced block within", () => {
    const text = "<grid>\n<cell>\n```\n</grid>\n```\n</cell>\n</grid>";
    const [grid] = readGrids(text);
    expect(text.slice(grid!.from, grid!.to)).toBe("<grid>\n<cell>\n```\n</grid>");
  });

  it("does not close a cell at a </cell> in a fenced block within it", () => {
    const text = "<grid>\n<cell>\n```\n</cell>\n```\n</cell>\n</grid>";
    expect(readGrids(text)[0]!.cells.map((cell) => cell.content)).toEqual(["```\n</cell>\n```"]);
  });

  it("runs a cell left open to the grid's end", () => {
    const text = "<grid>\n<cell>\nOpen\n</grid>";
    const [cell] = readGrids(text)[0]!.cells;
    expect([cell!.content, cell!.closed]).toEqual(["Open", false]);
    expect(text.slice(cell!.innerTo)).toBe("</grid>");
  });

  it("takes no grid that is never closed, one in a fenced block, nor one running on from a paragraph", () => {
    expect(readGrids("<grid>\n<cell>\nx\n</cell>")).toEqual([]);
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
    const text = "<grid>\r\n<cell>\r\n\r\nA\r\nB\r\n\r\n</cell>\r\n</grid>\r\n";
    const [grid] = readGrids(text);
    expect(grid!.cells[0]!.content).toBe("A\nB");
    expect(grid!.body).toBe("<cell>\r\n\r\nA\r\nB\r\n\r\n</cell>");
  });

  it("reads a body alone (what SilverBullet hands a renderer), its cells' places counted from the body's start", () => {
    const body = "<cell>\n\nA [[x]]\n\n</cell>\n<cell>\nB\n</cell>";
    const cells = readGridBody(body);
    expect(cells.map((cell) => cell.content)).toEqual(["A [[x]]", "B"]);
    expect(cells.map((cell) => body.slice(cell.contentFrom, cell.contentTo))).toEqual(["A [[x]]", "B"]);
    expect(body.slice(cells[1]!.from, cells[1]!.to)).toBe("<cell>\nB\n</cell>");
    expect(readGridBody("")).toEqual([]);
  });

  it("reads an empty grid, and lines between cells as no cell's", () => {
    expect(readGrids("<grid>\n</grid>")[0]).toMatchObject({ body: "", cells: [] });
    expect(readGrids("<grid>\nstray\n<cell>\nA\n</cell>\n</grid>")[0]!.cells.map((cell) => cell.content)).toEqual(["A"]);
  });
});
