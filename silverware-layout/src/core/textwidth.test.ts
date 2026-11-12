import { describe, expect, it } from "vitest";
import { textWidthShown } from "./textwidth.ts";

const page = { amount: 1100, unit: "px" } as const;
const fallback = { amount: 90, unit: "%" } as const;

describe("The text's width shown", () => {
  it("the page's own, else the default's, else none (the theme's)", () => {
    expect(textWidthShown({ page, fallback, paneWidth: 1600, minPaneWidth: 600 })).toBe(page);
    expect(textWidthShown({ page: undefined, fallback, paneWidth: 1600, minPaneWidth: 600 })).toBe(fallback);
    expect(textWidthShown({ page: undefined, fallback: undefined, paneWidth: 1600, minPaneWidth: 600 })).toBeUndefined();
  });

  it("none in a pane narrower than the least laid out", () => {
    expect(textWidthShown({ page, fallback, paneWidth: 599, minPaneWidth: 600 })).toBeUndefined();
    expect(textWidthShown({ page, fallback, paneWidth: 600, minPaneWidth: 600 })).toBe(page);
  });
});
