import { describe, expect, it } from "vitest";
import { lookOf, readLook, sameLook, validateIcon, validateLook } from "./look.ts";

describe("an item's look", () => {
  it("takes one character as its icon: an emoji of several code points too, never text, white space or nothing", () => {
    for (const icon of ["🚀", "👍🏽", "🇨🇿", "👨‍👩‍👧", "★", "A"]) expect(validateIcon(icon)).toBeUndefined();
    for (const icon of ["", "ab", "🚀🚀", " ", "\n", "​", 7, undefined]) expect(validateIcon(icon)).toBeTypeOf("string");
  });

  it("takes a color of the palette by name, or #rrggbb", () => {
    expect([validateLook({ color: "blue" }), validateLook({ color: "#C0392B" }), validateLook({ icon: "🚀", color: "blue" }), validateLook({})]).toEqual([undefined, undefined, undefined, undefined]);
    expect(validateLook({ color: "navy" })).toBe('"navy" is no color');
  });

  it("reads what is kept leniently: what is no icon or color left out, none where nothing is left", () => {
    expect(readLook({ rank: "a0", icon: "🚀", color: "red" })).toEqual({ icon: "🚀", color: "red" });
    expect(readLook({ icon: "rocket", color: "red" })).toEqual({ color: "red" });
    expect(readLook({ icon: 3, color: "navy" })).toBeUndefined();
    expect(lookOf(undefined, undefined)).toBeUndefined();
    expect([sameLook(undefined, {}), sameLook({ icon: "🚀" }, { icon: "🚀", color: "red" })]).toEqual([true, false]);
  });
});
