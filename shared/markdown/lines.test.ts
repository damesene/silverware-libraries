import { describe, expect, it } from "vitest";
import { closesFence, fenceOf, fenceOpenAt, linesOf, linesUnder, nextFence } from "./lines.ts";

const TEXT = "# Title\n\nOne line\n- item a\n- item b\n\n```\ncode here\n```\nlast";

describe("linesOf", () => {
  it("gives the lines a selection touches, whole; one ending at a line's start leaves that line out", () => {
    const from = TEXT.indexOf("item a") + 2;
    const to = TEXT.indexOf("item b") + 1;
    expect(linesOf(TEXT, from, to).map((l) => l.text)).toEqual(["- item a", "- item b"]);
    const start = TEXT.indexOf("- item a");
    expect(linesOf(TEXT, start, TEXT.indexOf("- item b")).map((l) => l.text)).toEqual(["- item a"]);
  });

  it("gives a caret's line", () => {
    expect(linesOf(TEXT, 3, 3)).toEqual([{ from: 0, to: 7, text: "# Title" }]);
    expect(linesOf(TEXT, TEXT.length, TEXT.length)).toEqual([{ from: TEXT.length - 4, to: TEXT.length, text: "last" }]);
    // A text starting with an empty line, the caret on it
    expect(linesOf("\nabc", 0, 0)).toEqual([{ from: 0, to: 0, text: "" }]);
  });
});

describe("linesUnder", () => {
  it("gives a line with those indented more under it, blank lines among them, not those after", () => {
    const text = "a\n- [ ] task\n  - [ ] sub\n\n    deeper\n- [ ] next";
    const under = linesUnder(text, text.indexOf("task"));
    expect(text.slice(under.from, under.to)).toBe("- [ ] task\n  - [ ] sub\n\n    deeper");
    const last = linesUnder(text, text.length);
    expect(text.slice(last.from, last.to)).toBe("- [ ] next");
  });

  it("leaves a blank line at the end out", () => {
    const text = "- [ ] task\n  sub\n\n";
    const under = linesUnder(text, 0);
    expect(text.slice(under.from, under.to)).toBe("- [ ] task\n  sub");
  });
});

describe("Fences", () => {
  it("are three backticks or tildes or more, indented any amount; a backtick fence with a backtick after it is inline code", () => {
    expect(["```", "  ~~~~ lua", "````js", "```a``` b", "``", "text ```"].map(fenceOf)).toEqual(["```", "~~~~", "````", undefined, undefined, undefined]);
  });

  it("close only by the same character, as many or more, and nothing after", () => {
    expect(closesFence("````", "```")).toBe(true);
    expect(closesFence("~~~", "```")).toBe(false);
    expect(closesFence("``` x", "```")).toBe(false);
    expect(closesFence("```", "````")).toBe(false);
    expect(nextFence("```", undefined)).toBe("```");
    expect(nextFence("text", "```")).toBe("```");
    expect(nextFence("```", "```")).toBeUndefined();
  });

  it("tell whether a place is in a code block", () => {
    expect(fenceOpenAt(TEXT, TEXT.indexOf("code here"))).toBe("```");
    expect(fenceOpenAt(TEXT, TEXT.indexOf("last"))).toBeUndefined();
    expect(fenceOpenAt(TEXT, TEXT.indexOf("- item b"))).toBeUndefined();
  });
});
