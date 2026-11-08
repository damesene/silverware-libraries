import { describe, expect, it } from "vitest";
import { placeStateRenamed } from "./placestate.ts";

const meta = (view: string) => (view === "calendar" ? ["dateBy", "endBy"] : []);

describe("a place's state as a property's key changes", () => {
  it("renames the key in a filter's conditions (their order kept), a sort, Group by, Color by and a view's own meta naming it", () => {
    const state = new Map<string, unknown>([
      ["id", "tasks"],
      ["view", "board"],
      ["board.filter", { done: "true", status: "!=Done", owner: "Ada" }],
      ["board.sort", [{ key: "status", direction: "asc" }, { key: "due", direction: "desc" }]],
      ["board.groupBy", "status"],
      ["list.colorBy", "status"],
      ["calendar.dateBy", "status"],
      ["calendar.scale", "status"],
      ["board.folded", ["status"]],
    ]);
    const renamed = placeStateRenamed(state, "status", "stav", meta);
    expect(renamed).toEqual({
      "board.filter": { done: "true", stav: "!=Done", owner: "Ada" },
      "board.sort": [{ key: "stav", direction: "asc" }, { key: "due", direction: "desc" }],
      "board.groupBy": "stav",
      "list.colorBy": "stav",
      "calendar.dateBy": "stav",
    });
    // (Its keys' order as written: the filter's renamed key in its place)
    expect(Object.keys(renamed!["board.filter"] as object)).toEqual(["done", "stav", "owner"]);
  });

  it("leaves a filter or a sort naming the new key already as it is (a condition would be lost), a view's name with a dot read", async () => {
    const state = new Map<string, unknown>([
      ["board.filter", { status: "Todo", stav: "x" }],
      ["board.sort", [{ key: "status", direction: "asc" }, { key: "stav", direction: "asc" }]],
      ["my.view.groupBy", "status"],
    ]);
    expect(placeStateRenamed(state, "status", "stav", meta)).toEqual({ "my.view.groupBy": "stav" });
  });

  it("renames the key among the properties a view hides, its order kept; where the new key is hidden already, the old one taken off", () => {
    expect(placeStateRenamed(new Map<string, unknown>([["table.hiddenProperties", ["due", "status", "owner"]]]), "status", "stav", meta)).toEqual({ "table.hiddenProperties": ["due", "stav", "owner"] });
    expect(placeStateRenamed(new Map<string, unknown>([["table.hiddenProperties", ["status", "stav"]]]), "status", "stav", meta)).toEqual({ "table.hiddenProperties": ["stav"] });
  });

  it("gives none where the state names the key nowhere (a value that only reads like it left alone)", () => {
    expect(placeStateRenamed(new Map<string, unknown>([["id", "tasks"], ["board.groupBy", "due"], ["board.filter", { due: "status" }]]), "status", "stav", meta)).toBeUndefined();
  });
});
