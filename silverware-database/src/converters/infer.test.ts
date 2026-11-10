import { describe, expect, it } from "vitest";
import type { Value } from "../model/database.ts";
import { inferProperty, type ReadValue } from "./infer.ts";

const plain = (...values: Value[]) => new Map(values.map((value, at): [number, ReadValue] => [at, { kind: "plain", value }]));
const infer = (read: Map<number, ReadValue>) => {
  const { property, values } = inferProperty("k", "K", read);
  return { type: property.type, params: property.params, values: [...values.values()] };
};

describe("inferProperty", () => {
  it("takes numbers, logical values, dates and days with a time", () => {
    expect(infer(plain(1, 2.5)).type).toBe("number");
    expect(infer(plain(true, false)).type).toBe("checkbox");
    expect(infer(plain("2026-11-12", "2026-11-13")).type).toBe("date");
    expect(infer(plain("2026-11-12", "2026-11-13 09:30"))).toMatchObject({ type: "datetime", values: ["2026-11-12", "2026-11-13 09:30"] });
  });

  it("makes values of different kinds a text", () => {
    expect(infer(plain(3, "three"))).toEqual({ type: "text", params: undefined, values: ["3", "three"] });
    expect(infer(plain("2026-02-30", "x")).type).toBe("text");
  });

  it("makes several values in any item a select of several options, one in others a list of one", () => {
    expect(infer(plain(["a", "b"], "c", 4))).toEqual({ type: "select", params: { multiple: true, options: ["a", "b", "c", "4"] }, values: [["a", "b"], ["c"], ["4"]] });
  });

  it("takes people and links as they were told, mixed with others a text", () => {
    const people = new Map<number, ReadValue>([
      [0, { kind: "people", names: ["ada"] }],
      [2, { kind: "people", names: ["bob", "cyd"] }],
    ]);
    expect(infer(people)).toEqual({ type: "person", params: { options: ["ada", "bob", "cyd"], multiple: true, anyone: true }, values: [["ada"], ["bob", "cyd"]] });
    expect(infer(new Map<number, ReadValue>([[0, { kind: "links", targets: ["A", "B"] }]]))).toMatchObject({ type: "reference", values: [["[[A]]", "[[B]]"]] });
    expect(infer(new Map<number, ReadValue>([[0, { kind: "people", names: ["ada"] }], [1, { kind: "plain", value: "x" }]]))).toMatchObject({ type: "text", values: ["@ada", "x"] });
  });
});
