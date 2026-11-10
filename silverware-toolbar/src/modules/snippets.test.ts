import { describe, expect, it } from "vitest";
import { contextOf } from "../core/context.ts";
import { marked } from "../core/cursor.ts";
import { snippetChange, snippetsModule } from "./snippets.ts";

/** A snippet's text written over `from`..`to` of a page: the page after it and what is selected */
function write(snippet: string, page: string, from: number, to: number): { text: string; selected: string; at: number } {
  const change = snippetChange(snippet, contextOf(page, from, to));
  const { text, select } = marked(change.insert);
  const after = page.slice(0, change.from) + text + page.slice(change.to);
  const at = change.from + select!.from;
  return { text: after, selected: after.slice(at, change.from + select!.to), at };
}

describe("A text snippet", () => {
  it("is a kind of favourite with its text its field and no slots, its icon and label an item's own, its text required", () => {
    const [kind] = snippetsModule().itemKinds!();
    expect(kind!.type).toBe("snippet");
    expect(kind!.slots).toEqual([]);
    expect(kind!.fields!.map((f) => f.key)).toEqual(["text"]);
    expect(kind!.ownLook).toBe(true);
    expect(kind!.check!({ type: "snippet" })).toBeTruthy();
    expect(kind!.check!({ type: "snippet", text: "x" })).toBeUndefined();
  });

  it("is one action, so a gesture button's slot may hold it: its text written, its own character and label, else its text its name", () => {
    const [kind] = snippetsModule().itemKinds!();
    const action = kind!.action!({ type: "snippet", text: "%%{s}%%", icon: " 💬 ", label: " Comment " });
    expect(action.label).toBe("Comment");
    expect(action.icon).toContain("💬");
    expect(action.edit!(contextOf("a b", 2, 3))).toEqual(snippetChange("%%{s}%%", contextOf("a b", 2, 3)));
    expect(kind!.action!({ type: "snippet", text: "<b>" }).label).toBe("<b>");
    expect(kind!.action!({ type: "snippet", text: "x", icon: "<i>" }).icon).toContain("&lt;i&gt;");
  });

  it("writes the selection for {s}, which stays selected; nothing selected: the cursor there", () => {
    expect(write("%%{s}%%", "a word b", 2, 6)).toEqual({ text: "a %%word%% b", selected: "word", at: 4 });
    expect(write("%%{s}%%", "a  b", 2, 2)).toEqual({ text: "a %%%% b", selected: "", at: 4 });
  });

  it("puts the cursor at {c}, the selection written for {s} too", () => {
    expect(write("[{s}]({c})", "see this", 4, 8)).toEqual({ text: "see [this]()", selected: "", at: 11 });
  });

  it("without either replaces the selection, the cursor at its end; {{s}} and {{c}} as they are", () => {
    expect(write("Note: ", "a b", 2, 3)).toEqual({ text: "a Note: ", selected: "", at: 8 });
    expect(write("{{s}} {{c}}", "", 0, 0)).toEqual({ text: "{s} {c}", selected: "", at: 7 });
  });

  it("writes every {s}, the first one selected; only the first {c} counts", () => {
    expect(write("{s}={s}", "x", 0, 1)).toEqual({ text: "x=x", selected: "x", at: 0 });
    expect(write("{c}a{c}", "", 0, 0)).toEqual({ text: "a", selected: "", at: 0 });
  });
});
