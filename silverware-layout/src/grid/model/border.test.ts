import { describe, expect, it } from "vitest";
import { borderAttribute, bordered } from "./border.ts";

describe("a grid's lines", () => {
  it("are asked for by border, but by a value meaning none", () => {
    expect(bordered({})).toBe(false);
    expect(bordered({ border: "1" })).toBe(true);
    expect(bordered({ border: "" })).toBe(true);
    expect(bordered({ border: "true" })).toBe(true);
    for (const off of ["0", "false", "None", " off "]) expect(bordered({ border: off })).toBe(false);
  });

  it("are written as HTML's table has them, taken off where none", () => {
    expect(borderAttribute(true)).toBe("1");
    expect(borderAttribute(false)).toBeNull();
  });
});
