// The hashtags in a page's grids as SilverBullet's index would find them there: each with its context, the paragraphs
// holding some with their places in the page.
import { describe, expect, it } from "vitest";
import { gridTags } from "./tags.ts";

describe("a grid's hashtags", () => {
  it("are found in each cell with their context, not outside a grid nor in code", () => {
    const text = "Outside #out\n\n<grid>\n<column>\n\nA note #idea and #idea\n\n- an item #todo\n- [ ] a task #urgent\n\n</column>\n<column>\n\n```\n#code\n```\n\n> quoted #q\n\n</column>\n</grid>\n";
    const { tags, paragraphs } = gridTags(text);
    expect(tags).toEqual([
      { name: "idea", context: "paragraph" },
      { name: "idea", context: "paragraph" },
      { name: "todo", context: "item" },
      { name: "urgent", context: "task" },
      { name: "q", context: "paragraph" },
    ]);
    expect(paragraphs).toEqual([
      { from: text.indexOf("A note"), to: text.indexOf("A note") + "A note #idea and #idea".length, text: "A note #idea and #idea", tags: ["idea"] },
      { from: text.indexOf("quoted"), to: text.indexOf("quoted") + "quoted #q".length, text: "quoted #q", tags: ["q"] },
    ]);
  });

  it("are none in a page without a grid", () => {
    expect(gridTags("Just #text")).toEqual({ tags: [], paragraphs: [] });
  });
});
