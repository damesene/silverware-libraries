import { describe, expect, it } from "vitest";
import { blockAt } from "./placed.ts";

const blocks = [
  { from: 10, to: 40, name: "first" },
  { from: 60, to: 90, name: "second" },
];

describe("the block an element shows of blocks written alike", () => {
  it("is the one its place falls in, its start and its end counted; none between them or without a place", () => {
    expect(blockAt(blocks, 60)?.name).toBe("second");
    expect(blockAt(blocks, 90)?.name).toBe("second");
    expect(blockAt(blocks, 40)?.name).toBe("first");
    expect(blockAt(blocks, 50)).toBeUndefined();
    expect(blockAt(blocks, undefined)).toBeUndefined();
  });

  it("is the one alone of its text whatever the place, none of none", () => {
    expect(blockAt([blocks[1]!], undefined)?.name).toBe("second");
    expect(blockAt([blocks[1]!], 0)?.name).toBe("second");
    expect(blockAt([], 10)).toBeUndefined();
  });
});
