import { describe, expect, it } from "vitest";
import { readAttributes, validateAttributeName, writeAttributes } from "./attributes.ts";

describe("readAttributes", () => {
  it("reads HTML's forms: double and single quotes, unquoted, a name alone", () => {
    expect(readAttributes(` columns="1fr 2fr" gap=16 title='a "b"' wide`)).toEqual({ columns: "1fr 2fr", gap: "16", title: 'a "b"', wide: "" });
  });

  it("reads SilverBullet's smart quotes as double quotes", () => {
    expect(readAttributes(" columns=“1fr 2fr” view=„x“")).toEqual({ columns: "1fr 2fr", view: "x" });
  });

  it("takes a name's first value, any case as lower case, and skips what is no attribute", () => {
    expect(readAttributes(` Gap="1" gap="2" / 9x="3" ok`)).toEqual({ gap: "1", ok: "" });
  });

  it("reads a value left unclosed to the end, and spaces around =", () => {
    expect(readAttributes(` a = "x y`)).toEqual({ a: "x y" });
  });

  it("reads nothing of an empty text", () => {
    expect(readAttributes("")).toEqual({});
  });
});

describe("writeAttributes", () => {
  it("writes each double quoted, a quote and & as entities, read back the same", () => {
    const attributes = { columns: "1fr 2fr", title: 'say "hi" & go' };
    const text = writeAttributes(attributes);
    expect(text).toBe(` columns="1fr 2fr" title="say &quot;hi&quot; &amp; go"`);
    expect(readAttributes(text)).toEqual(attributes);
  });

  it("writes nothing of none", () => {
    expect(writeAttributes({})).toBe("");
  });
});

describe("validateAttributeName", () => {
  it("takes HTML's names, says why not of others", () => {
    expect(validateAttributeName("data-x")).toBeUndefined();
    expect(validateAttributeName("")).toBe("an attribute's name is empty");
    expect(validateAttributeName("a b")).toMatch(/no attribute's name/);
    expect(validateAttributeName("1a")).toMatch(/no attribute's name/);
  });
});
