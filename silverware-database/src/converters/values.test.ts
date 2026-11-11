import { describe, expect, it } from "vitest";
import { joinedValues, plainText, readValue } from "./values.ts";

describe("plainText", () => {
  it("leaves attributes and the marks at the end out, those in a sentence as words, escapes as their characters", () => {
    expect(plainText("Ask @jana about #budget [due: x] and [[Page|the page]] today #sales @ada")).toBe("Ask jana about budget and the page today");
    expect(plainText(String.raw`Use \[a\] here`)).toBe("Use [a] here");
    expect(plainText("[[Project X]] @ada")).toBe("Project X ada");
    expect(plainText("  ")).toBe("");
  });
});

describe("readValue", () => {
  it("reads people, links, YAML, and a text YAML reads as none; nothing where empty", () => {
    expect(readValue("@ada, @bob")).toEqual({ kind: "people", names: ["ada", "bob"] });
    expect(readValue('"@Ada Lovelace"')).toEqual({ kind: "people", names: ["Ada Lovelace"] });
    expect(readValue("[[A]], [[B]]")).toEqual({ kind: "links", targets: ["A", "B"] });
    expect(readValue("12")).toEqual({ kind: "plain", value: 12 });
    expect(readValue("[a, 2]")).toEqual({ kind: "plain", value: ["a", "2"] });
    expect(readValue("a: b")).toEqual({ kind: "plain", value: "a: b" });
    expect(readValue(" ")).toBeUndefined();
  });

  it("joins two values of a key into one list, each once", () => {
    expect(joinedValues({ kind: "plain", value: "a" }, { kind: "plain", value: ["a", "b"] })).toEqual({ kind: "plain", value: ["a", "b"] });
    expect(joinedValues({ kind: "people", names: ["ada"] }, { kind: "plain", value: "x" })).toEqual({ kind: "plain", value: ["@ada", "x"] });
  });
});
