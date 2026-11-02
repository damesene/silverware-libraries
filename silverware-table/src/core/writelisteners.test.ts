import { describe, expect, it } from "vitest";
import { mapPosition } from "./writelisteners.ts";

describe("a place followed through edits", () => {
  it("stays before an edit, moves past one by its change, goes to its start or end inside one", () => {
    const batch = [{ from: 10, to: 12, text: "abcde" }];
    expect([mapPosition(5, false, [batch]), mapPosition(20, false, [batch]), mapPosition(11, false, [batch]), mapPosition(11, true, [batch])]).toEqual([5, 23, 10, 15]);
    // At an insertion: before it, or with after past it
    const insert = [{ from: 10, to: 10, text: "xyz" }];
    expect([mapPosition(10, false, [insert]), mapPosition(10, true, [insert])]).toEqual([10, 13]);
  });

  it("goes through batches one after another, each in the text the ones before left", () => {
    expect(mapPosition(20, false, [[{ from: 0, to: 0, text: "12345" }], [{ from: 2, to: 3, text: "" }]])).toEqual(24);
  });
});
