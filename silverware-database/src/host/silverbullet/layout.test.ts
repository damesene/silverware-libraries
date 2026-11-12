import { describe, expect, it } from "vitest";
import { layoutEntries, withLayout } from "./layout.ts";

describe("Silverware Layout's entries in a database's block", () => {
  it("read from its layout lines, as text, the others left out", () => {
    expect(layoutEntries("id: tasks\nview: board\nlayout.width: 1100\nboard.groupBy: status")).toEqual({ width: "1100" });
    expect(layoutEntries("id: tasks\nlayout.width: full")).toEqual({ width: "full" });
    expect(layoutEntries("id: tasks")).toEqual({});
  });

  it("written as lines of the block, the other lines as they were; null takes a line away", () => {
    const set = withLayout("id: tasks\nview: board", { width: "1100" });
    expect(layoutEntries(set)).toEqual({ width: "1100" });
    expect(set.startsWith("id: tasks\nview: board\nlayout.width: ")).toBe(true);
    expect(withLayout(withLayout("id: tasks\nview: board", { width: "full" }), { width: "900" })).toBe(withLayout("id: tasks\nview: board", { width: "900" }));
    expect(withLayout(set, { width: null })).toBe("id: tasks\nview: board");
  });
});
