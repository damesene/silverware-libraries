import { describe, expect, it } from "vitest";
import { similarTags } from "./similar.ts";
import { filterTree, tagTree } from "./tree.ts";

describe("tree", () => {
  it("makes levels of names, counting what is under each", () => {
    const tree = tagTree(new Map([["project/alpha", 2], ["project/beta", 1], ["home", 4]]));
    expect(tree.map((n) => [n.name, n.own, n.total])).toEqual([["home", 4, 4], ["project", 0, 3]]);
    expect(filterTree(tree, "bet")[0]!.children.map((n) => n.name)).toEqual(["project/beta"]);
  });
});

describe("similar tags", () => {
  it("groups tags likely one: case and separators, plurals, a typo at the same level", () => {
    const groups = similarTags(new Map([["todo", 9], ["Todo", 2], ["to-do", 1], ["idea", 5], ["ideas", 1], ["meeting", 4], ["meetnig", 1], ["work/alpha", 3], ["home/alpha", 2], ["cat", 1], ["car", 1]]));
    expect(groups).toEqual([
      { tags: ["todo", "Todo", "to-do"], reasons: ["form"] },
      { tags: ["idea", "ideas"], reasons: ["plural"] },
      { tags: ["meeting", "meetnig"], reasons: ["typo"] },
    ]);
  });
});
