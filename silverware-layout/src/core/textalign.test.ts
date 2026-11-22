import { describe, expect, it } from "vitest";
import { textAlignShown } from "./textalign.ts";

const wide = { paneWidth: 1600, minPaneWidth: 600 };

describe("Where the text stands", () => {
  it("the page's own, else the default's, else centred (the host's own: none of ours)", () => {
    expect(textAlignShown({ page: "left", fallback: "center", panelOpen: false, ...wide })).toBe("left");
    expect(textAlignShown({ page: "center", fallback: "left", panelOpen: false, ...wide })).toBeUndefined();
    expect(textAlignShown({ page: undefined, fallback: "left", panelOpen: false, ...wide })).toBe("left");
    expect(textAlignShown({ page: undefined, fallback: undefined, panelOpen: true, ...wide })).toBeUndefined();
  });

  it("left while a panel is open: centred (a margin of ours, to move from) without one, at the left with one", () => {
    expect(textAlignShown({ page: "left-with-panel", fallback: undefined, panelOpen: false, ...wide })).toBe("center");
    expect(textAlignShown({ page: "left-with-panel", fallback: undefined, panelOpen: true, ...wide })).toBe("left");
    expect(textAlignShown({ page: undefined, fallback: "left-with-panel", panelOpen: true, ...wide })).toBe("left");
  });

  it("only left while a panel is open follows one: centred and left stay as they are", () => {
    expect(textAlignShown({ page: "center", fallback: "left-with-panel", panelOpen: true, ...wide })).toBeUndefined();
    expect(textAlignShown({ page: "left", fallback: undefined, panelOpen: false, ...wide })).toBe("left");
  });

  it("none in a pane narrower than the least laid out", () => {
    expect(textAlignShown({ page: "left", fallback: undefined, panelOpen: true, paneWidth: 599, minPaneWidth: 600 })).toBeUndefined();
  });
});
