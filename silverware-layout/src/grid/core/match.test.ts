import { describe, expect, it } from "vitest";
import { gridsOfBody } from "./match.ts";

const body = "<cell>\nA\n</cell>";
const text = `<grid columns="1">\n${body}\n</grid>\n\n<grid>\n<cell>\nB\n</cell>\n</grid>\n\n<grid columns="3">\n${body}\n</grid>`;

describe("the grid of a page a grid drawn is", () => {
  it("finds the grids of a body in the page's order, its line breaks LF or CRLF alike", () => {
    expect(gridsOfBody(text, body).map((grid) => grid.attributes.columns)).toEqual(["1", "3"]);
    expect(gridsOfBody(text.replace(/\n/g, "\r\n"), body)).toHaveLength(2);
  });

});
