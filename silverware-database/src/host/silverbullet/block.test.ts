import { describe, expect, it } from "vitest";
import { BlockState, readBlock, writeBlock } from "./block.ts";

describe("a database's block", () => {
  it("reads one key a line, scalars as YAML has them, lists and maps as JSON", () => {
    const values = readBlock('id: tasks\nview: board\nboard.filter: {"status": "!=Done"}\ntable.widths: [240, 120]\ncount: 3\n# a note\nodd line');
    expect(Object.fromEntries(values)).toEqual({ id: "tasks", view: "board", "board.filter": { status: "!=Done" }, "table.widths": [240, 120], count: 3 });
  });

  it("writes the keys asked, keeping every other line as written, new keys at the end, a key taken off whole", () => {
    const body = "id: tasks\n# mine\nview: table\nodd line\nboard.groupBy: status";
    expect(writeBlock(body, { view: "board", "board.groupBy": undefined, "board.filter": { status: "!=Done" } })).toBe('id: tasks\n# mine\nview: board\nodd line\nboard.filter: {"status":"!=Done"}');
    expect(writeBlock("", { id: "tasks", view: "yes" })).toBe('id: tasks\nview: "yes"');
  });

  it("writes a key typed twice once, so a key taken off does not come back with its old value", () => {
    const body = "id: tasks\nboard.groupBy: status\nview: board\nboard.groupBy: owner";
    expect(writeBlock(body, { "board.groupBy": undefined })).toBe("id: tasks\nview: board");
    expect(writeBlock(body, { "board.groupBy": "priority" })).toBe("id: tasks\nboard.groupBy: priority\nview: board");
  });

  it("is a place's state: written through its writer, held as written only where it was", async () => {
    const writes: [string, string][] = [];
    let accept = true;
    const state = new BlockState("id: tasks", async (body, text) => (writes.push([body, text]), accept));
    await state.set({ view: "list" });
    expect([state.get("view"), state.keys()]).toEqual(["list", ["id", "view"]]);
    accept = false;
    await state.set({ view: "board" });
    expect(state.get("view")).toBe("list");
    await state.set({ view: "list" });
    expect(writes).toEqual([
      ["id: tasks", "id: tasks\nview: list"],
      ["id: tasks\nview: list", "id: tasks\nview: board"],
    ]);
  });
});
