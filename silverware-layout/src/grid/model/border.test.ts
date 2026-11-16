import { describe, expect, it } from "vitest";
import { borderAttribute, borderOf } from "./border.ts";

describe("a grid's lines", () => {
  it("are asked for by its border attribute: inner the lines between its cells alone, any other value but none all", () => {
    expect(borderOf({})).toBe("none");
    expect(borderOf({ border: "1" })).toBe("all");
    expect(borderOf({ border: "" })).toBe("all");
    expect(borderOf({ border: "true" })).toBe("all");
    expect(borderOf({ border: "inner" })).toBe("inner");
    expect(borderOf({ border: " Inner " })).toBe("inner");
    for (const off of ["0", "false", "None", " off "]) expect(borderOf({ border: off })).toBe("none");
  });

  it("are written as HTML's table has them, the lines between cells alone as inner, none taken off", () => {
    expect(borderAttribute("all")).toBe("1");
    expect(borderAttribute("inner")).toBe("inner");
    expect(borderAttribute("none")).toBeNull();
  });
});
