import { describe, expect, it } from "vitest";
import { gridOf, gridsOfBody } from "./match.ts";

const body = "<column>\nA\n</column>";
const text = `<grid columns="1">\n${body}\n</grid>\n\n<grid>\n<column>\nB\n</column>\n</grid>\n\n<grid columns="3">\n${body}\n</grid>`;

describe("the grid of a page a grid drawn is", () => {
  it("finds the grids of a body in the page's order, its line breaks LF or CRLF alike", () => {
    expect(gridsOfBody(text, body).map((grid) => grid.attributes.columns)).toEqual(["1", "3"]);
    expect(gridsOfBody(text.replace(/\n/g, "\r\n"), body)).toHaveLength(2);
  });

  it("takes the nth of those alike; past their count, the last; of a body not there, none", () => {
    expect(gridOf(text, body, 0)?.attributes.columns).toBe("1");
    expect(gridOf(text, body, 1)?.attributes.columns).toBe("3");
    expect(gridOf(text, body, 5)?.attributes.columns).toBe("3");
    expect(gridOf(text, "<column>\nGone\n</column>", 0)).toBeUndefined();
  });
});
