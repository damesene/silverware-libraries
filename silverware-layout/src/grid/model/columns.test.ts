import { describe, expect, it } from "vitest";
import { columnsOf, columnTemplate, DEFAULT_MAX_COLUMNS, dividedWidths, templateOf, validateColumns } from "./columns.ts";

describe("validateColumns", () => {
  it("takes a count of 1 to 12 and widths of fr, %, px or auto", () => {
    for (const value of ["1", "12", "1fr 2fr", "30% 70%", "200px 1fr auto", " 2 "]) expect(validateColumns(value), value).toBeUndefined();
  });

  it("says why not of others", () => {
    expect(validateColumns("")).toBe("no columns given");
    expect(validateColumns("0")).toBe("0 columns: from 1 to 12");
    expect(validateColumns("13")).toBe("13 columns: from 1 to 12");
    expect(validateColumns("1fr wide")).toBe('"wide" is no column\'s width (as 1fr, 30%, 200px or auto)');
  });
});

describe("columnTemplate", () => {
  it("makes a count equal columns, widths each, a share never wider than its content allows to shrink", () => {
    expect(columnTemplate("3", 2)).toBe("repeat(3, minmax(0, 1fr))");
    expect(columnTemplate("1fr 2fr", 2)).toBe("minmax(0, 1fr) minmax(0, 2fr)");
    expect(columnTemplate("200px 30% auto", 2)).toBe("200px 30% auto");
  });

  it("makes a column per cell where columns are none or not read, at most the default, one at least", () => {
    expect(columnTemplate(undefined, 2)).toBe("repeat(2, minmax(0, 1fr))");
    expect(columnTemplate("wide", 3)).toBe("repeat(3, minmax(0, 1fr))");
    expect(columnTemplate(undefined, 9)).toBe(`repeat(${DEFAULT_MAX_COLUMNS}, minmax(0, 1fr))`);
    expect(columnTemplate(undefined, 0)).toBe("repeat(1, minmax(0, 1fr))");
  });
});

describe("a divider between two columns dragged", () => {
  it("moves their shares, their sum kept, neither under a tenth of it", () => {
    expect(dividedWidths(300, 300, 50)).toEqual({ first: 350, second: 250 });
    expect(dividedWidths(300, 300, -500)).toEqual({ first: 60, second: 540 });
    expect(dividedWidths(300, 300, 500)).toEqual({ first: 540, second: 60 });
  });

  it("snaps to a usual ratio within 8 px, the nearest", () => {
    // 2 : 1 of 600 is 400
    expect(dividedWidths(300, 300, 95)).toEqual({ first: 400, second: 200, ratio: [2, 1] });
    expect(dividedWidths(400, 200, -96)).toEqual({ first: 300, second: 300, ratio: [1, 1] });
    expect(dividedWidths(300, 300, 20).ratio).toBeUndefined();
  });

  it("writes the widths as simply as they go: a count where even, the least whole shares, else shares of the narrowest", () => {
    expect(columnsOf([300, 300, 300])).toBe("3");
    expect(columnsOf([200, 400])).toBe("1fr 2fr");
    expect(columnsOf([150, 150, 300])).toBe("1fr 1fr 2fr");
    expect(columnsOf([240, 360])).toBe("2fr 3fr");
    expect(columnsOf([251, 349])).toBe("5fr 7fr");
    expect(columnsOf([100, 137, 900])).toBe("2fr 3fr 18fr");
    // (No whole shares of 24 at most give it: shares of the narrowest)
    expect(columnsOf([10, 2003])).toBe("1fr 200.3fr");
  });

  it("shows the widths dragged as shares of a template", () => {
    expect(templateOf([350, 250.123])).toBe("minmax(0, 350fr) minmax(0, 250.12fr)");
  });
});

describe("a divider snapping to other places (the text's edges)", () => {
  it("takes the nearest of the ratios and the others, named, within reach alone", () => {
    const text = { at: 380, name: "Page width" };
    expect(dividedWidths(300, 300, 76, [text])).toEqual({ first: 380, second: 220, name: "Page width" });
    // 2 : 1 (400) nearer than the text's edge at 395 from 401: the ratio
    expect(dividedWidths(300, 300, 101, [{ at: 395, name: "Page width" }])).toMatchObject({ first: 400, ratio: [2, 1] });
    // Out of reach (under a tenth): none
    expect(dividedWidths(300, 300, -260, [{ at: 30, name: "Page width" }]).name).toBeUndefined();
  });
});
