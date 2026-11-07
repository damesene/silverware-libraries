// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { pill } from "./values.ts";

describe("pills", () => {
  it("show an own color as picked where it reads, a too light or too dark one at a lightness that does, its hue kept", () => {
    const shown = (color: `#${string}`) => pill(document, "x", color).style.getPropertyValue("--swd-pill");
    expect(shown("#3a7bd5")).toBe("58, 123, 213");
    // Yellow at full light would be text on nearly its own ground: darkened, still yellow
    const [r, g, b] = shown("#ffff00").split(", ").map(Number);
    expect([r === g, b, r! < 200]).toEqual([true, 0, true]);
    expect(shown("#000010")).not.toBe("0, 0, 16");
  });

  it("show a palette's color by its place, none where the value is none of the options", () => {
    expect(pill(document, "x", 9).dataset.color).toBe("1");
    expect(pill(document, "x", undefined).classList.contains("swd-pill-none")).toBe(true);
  });
});
