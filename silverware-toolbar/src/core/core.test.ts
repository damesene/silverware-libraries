// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Action } from "./action.ts";
import { contextOf, linesOf } from "./context.ts";
import { cursor, marked } from "./cursor.ts";
import { placeBy } from "./place.ts";
import { entriesOf, findEntries } from "./search.ts";

const TEXT = "# Title\n\nOne line\n- item a\n- item b\n\n```\ncode here\n```\nlast";

describe("The selection's context", () => {
  it("has the lines it touches, whole; one ending at a line's start leaves that line out", () => {
    const from = TEXT.indexOf("item a") + 2;
    const to = TEXT.indexOf("item b") + 1;
    expect(linesOf(TEXT, from, to).map((l) => l.text)).toEqual(["- item a", "- item b"]);
    // Whole lines selected (to the next line's start): that next line not selected
    const start = TEXT.indexOf("- item a");
    expect(linesOf(TEXT, start, TEXT.indexOf("- item b")).map((l) => l.text)).toEqual(["- item a"]);
    // A caret: its line
    expect(linesOf(TEXT, 3, 3)).toEqual([{ from: 0, to: 7, text: "# Title" }]);
  });

  it("is from before to, selected backwards too", () => {
    const back = contextOf(TEXT, 5, 2);
    expect([back.from, back.to]).toEqual([2, 5]);
  });
});

describe("The cursor marked in a text written", () => {
  it("is a caret or a text selected, the marks taken out; the last pair counts", () => {
    expect(marked(`[x](${cursor()})`)).toEqual({ text: "[x]()", select: { from: 4, to: 4 } });
    expect(marked(`[${cursor("url")}]`)).toEqual({ text: "[url]", select: { from: 1, to: 4 } });
    expect(marked(`${cursor()}a\n${cursor()}b`)).toEqual({ text: "a\nb", select: { from: 2, to: 2 } });
    expect(marked("plain")).toEqual({ text: "plain", select: undefined });
  });

  it("is an error when its marks are not in pairs", () => {
    expect(() => marked(cursor().slice(0, 1))).toThrow("not ended");
    expect(() => marked(cursor().slice(1))).toThrow("without its start");
  });
});

describe("Finding actions", () => {
  const action = (id: string, label: string, group: string, extra: Partial<Action> = {}): Action => ({ id, label, group, icon: "", ...extra });
  const actions = [
    action("formats.bold", "Bold", "Format", { keywords: ["strong"] }),
    action("formats.italic", "Italic", "Format", { keywords: ["emphasis"] }),
    action("actions.turnInto", "Turn into", "Turn into", {
      choices: [action("formats.bullet", "Bullet list", "Turn into"), action("formats.heading1", "Heading 1", "Turn into", { keywords: ["title"] })],
    }),
    action("formats.link", "Link", "Links"),
  ];
  const entries = entriesOf(actions);

  it("lists a list's choices in its place, under its label", () => {
    expect(entries.map((e) => [e.action.id, e.group])).toEqual([
      ["formats.bold", "Format"],
      ["formats.italic", "Format"],
      ["formats.bullet", "Turn into"],
      ["formats.heading1", "Turn into"],
      ["formats.link", "Links"],
    ]);
  });

  it("finds by every word typed starting a word of a label, group or keyword, ignoring case and diacritics; labels starting so first", () => {
    const ids = (q: string) => findEntries(entries, q).map((e) => e.action.id);
    expect(ids("")).toHaveLength(5);
    expect(ids("STRONG")).toEqual(["formats.bold"]);
    expect(ids("turn head")).toEqual(["formats.heading1"]);
    expect(ids("títle")).toEqual(["formats.heading1"]);
    // "li": Link's label starts so, before Bullet list's
    expect(ids("li")).toEqual(["formats.link", "formats.bullet"]);
    expect(ids("nothing")).toEqual([]);
    // Not inside a word, not by the id
    expect(ids("tal")).toEqual([]);
    expect(ids("formats")).toEqual([]);
  });
});

describe("Placing by the selection", () => {
  const view = { width: 1000, height: 800, top: 50 };
  const size = { width: 200, height: 40 };

  it("goes above the selection, centred on it, inside the window", () => {
    expect(placeBy({ left: 400, right: 600, top: 300, bottom: 320 }, size, view)).toEqual({ left: 400, top: 252, below: false });
    // Near the window's left edge: kept inside
    expect(placeBy({ left: 0, right: 20, top: 300, bottom: 320 }, size, view).left).toBe(8);
  });

  it("goes below where there is no room above, under the top of the page's view", () => {
    expect(placeBy({ left: 400, right: 600, top: 80, bottom: 100 }, size, view)).toEqual({ left: 400, top: 108, below: true });
  });

  it("goes under another element (the popup under the toolbar), above it where there is no room below", () => {
    expect(placeBy({ left: 400, right: 600, top: 300, bottom: 340 }, size, view, true)).toEqual({ left: 400, top: 348, below: true });
    expect(placeBy({ left: 400, right: 600, top: 740, bottom: 780 }, size, view, true)).toEqual({ left: 400, top: 692, below: false });
  });
});
