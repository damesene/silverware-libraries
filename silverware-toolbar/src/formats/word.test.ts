import { describe, expect, it } from "vitest";
import type { Change } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { marked } from "../core/cursor.ts";
import { clearModule } from "../modules/clear.ts";
import { inlineModule } from "../modules/inline.ts";
import { wordAt } from "./word.ts";

/** The text with `|` the caret, an action of the inline or clear module run there: the text after it and its caret (`|`), or its selection (`[…]`) */
function run(withCaret: string, id: string, wordAtCaret = true): string {
  const at = withCaret.indexOf("|");
  const text = withCaret.replace("|", "");
  const context = contextOf(text, at, at);
  const actions = [...inlineModule({ wordAtCaret }).actions(), ...clearModule({ wordAtCaret }).actions()];
  const change = actions.find((a) => a.id === id)!.run!(context) as Change;
  const { text: insert, select: marks } = marked(change.insert);
  const out = text.slice(0, change.from) + insert + text.slice(change.to);
  const select = marks ? { from: change.from + marks.from, to: change.from + marks.to } : change.select!;
  return select.from === select.to ? out.slice(0, select.from) + "|" + out.slice(select.from) : `${out.slice(0, select.from)}[${out.slice(select.from, select.to)}]${out.slice(select.to)}`;
}

describe("A word at the caret as if selected", () => {
  it("is what white space separates around the caret, in it or touching it; none between spaces", () => {
    const word = (t: string) => {
      const at = t.indexOf("|");
      const text = t.replace("|", "");
      const w = wordAt(contextOf(text, at, at));
      return w && text.slice(w.from, w.to);
    };
    expect(word("say he|llo now")).toBe("hello");
    expect(word("say |hello now")).toBe("hello");
    expect(word("say hello| now")).toBe("hello");
    expect(word("say **he|llo**, now")).toBe("**hello**,");
    expect(word("say  |  now")).toBeUndefined();
  });

  it("takes a format on and off the word, the caret staying where it was in its text", () => {
    expect(run("say he|llo now", "formats.bold")).toBe("say **he|llo** now");
    expect(run("say **he|llo** now", "formats.bold")).toBe("say he|llo now");
    expect(run("say he|llo, now", "formats.italic")).toBe("say _he|llo,_ now");
    // Another format's markers in the word: kept inside, the caret by the letters
    expect(run("say _he|llo_ now", "formats.bold")).toBe("say **_he|llo_** now");
    expect(run("say **_he|llo_** now", "formats.bold")).toBe("say _he|llo_ now");
  });

  it("a link of the word puts the caret where its url goes, as for a selection", () => {
    expect(run("see No|tion here", "formats.link")).toBe("see [Notion](|) here");
  });

  it("in the format already (a link's text may hold spaces): the format the caret is in, taken off whole, its text selected as before", () => {
    expect(run("see [a li|nk](https://x.cz) here", "formats.link")).toBe("see [a link] here");
  });

  it("clears the word's formats", () => {
    expect(run("say **_he|llo_** now", "actions.clear")).toBe("say he|llo now");
  });

  it("off, or nothing to touch: a format at the caret is its markers to type into", () => {
    expect(run("say he|llo now", "formats.bold", false)).toBe("say he**|**llo now");
    expect(run("say | now", "formats.bold")).toBe("say **|** now");
  });
});
