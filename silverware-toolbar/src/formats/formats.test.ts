import { afterEach, describe, expect, it } from "vitest";
import type { Change } from "../core/action.ts";
import { contextOf } from "../core/context.ts";
import { marked } from "../core/cursor.ts";
import {
  BUILT_IN_PROBLEMS,
  blockFormatOf,
  canFormat,
  canTurn,
  clear,
  customFormatsAnew,
  defineCustomFormats,
  type Format,
  formatById,
  formatsIn,
  formatsOf,
  isOn,
  resetCustomFormats,
  toggle,
  turnInto,
} from "./index.ts";

/** A text with the selection marked by « and » (a caret by ‸), as a context */
function at(text: string) {
  const caret = text.indexOf("‸");
  if (caret >= 0) return contextOf(text.replace("‸", ""), caret, caret);
  const from = text.indexOf("«");
  const to = text.indexOf("»") - 1;
  return contextOf(text.replace("«", "").replace("»", ""), from, to);
}

/** The text after a change, the selection as the core sets it marked by « and » (a caret by ‸) */
function after(text: string, change: Change | undefined): string {
  if (!change) return "unchanged";
  const { text: insert, select: marks } = marked(change.insert);
  const out = text.slice(0, change.from) + insert + text.slice(change.to);
  const { from, to } = marks ? { from: change.from + marks.from, to: change.from + marks.to } : (change.select ?? { from: change.from, to: change.from + insert.length });
  return from === to ? `${out.slice(0, from)}‸${out.slice(from)}` : `${out.slice(0, from)}«${out.slice(from, to)}»${out.slice(to)}`;
}

const format = (name: string): Format => formatById(`formats.${name}`)!;
const BOLD = "bold";
const ITALIC = "italic";

afterEach(() => resetCustomFormats());

describe("Built-in formats", () => {
  it("are defined without a mistake, each by its id", () => {
    expect(BUILT_IN_PROBLEMS).toEqual([]);
    expect(formatsIn("inline").map((f) => f.id)).toEqual(["formats.bold", "formats.italic", "formats.strikethrough", "formats.highlight", "formats.code", "formats.link", "formats.wikiLink"]);
    expect(formatsIn("block").filter((f) => f.label).map((f) => f.name)).toEqual(["paragraph", "heading1", "heading2", "heading3", "bullet", "numbered", "task", "quote"]);
  });
});

describe("Inline formats", () => {
  const run = (text: string, name = BOLD) => {
    const context = at(text);
    return after(context.text, toggle(context, format(name)));
  };
  const on = (text: string, name = BOLD) => isOn(at(text), format(name));

  it("wrap the selection, the spaces at its ends left out, and unwrap it again, the markers around or in it", () => {
    expect(run("a «word »here")).toBe("a **«word»** here");
    expect(run("a **«word»** here")).toBe("a «word» here");
    expect(run("a «**word**» here")).toBe("a «word» here");
    expect(run("a __«word»__ here")).toBe("a «word» here");
  });

  it("give a caret an empty pair, the caret inside; a caret inside a pair takes it off", () => {
    expect(run("a ‸ b")).toBe("a **‸** b");
    expect(on("a **wo‸rd** b")).toBe(true);
    expect(run("a **wo‸rd** b")).toBe("a wo‸rd b");
    expect(on("a _wo‸rd_ b", ITALIC)).toBe(true);
    expect(on("a wo‸rd b")).toBe(false);
  });

  it("are on for a part inside a pair, and taken off that part only", () => {
    expect(on("a **wo«r»d** b")).toBe(true);
    expect(run("a **wo«r»d** b")).toBe("a **wo**«r»**d** b");
    expect(run("a **«wo»rd** b")).toBe("a «wo»**rd** b");
    expect(run("a **wo«rd»** b")).toBe("a **wo**«rd» b");
  });

  it("go line by line, a list's or a heading's marker left out", () => {
    expect(run("- «one\n- two»")).toBe("- **«one**\n- **two»**");
    expect(run("# Ti«tle»")).toBe("# Ti**«tle»**");
    // On when every part is: one wrapped, one not: wrapped both
    expect(run("- «**one**\n- two»")).toBe("- «**one**\n- **two»**");
  });

  it("over a paragraph's lines are one pair, and taken off again", () => {
    const once = run("Plain «paragraph one.\nPlain paragrap»h two");
    expect(once).toBe("Plain **«paragraph one.\nPlain paragrap»**h two");
    expect(on(once)).toBe(true);
    expect(run(once)).toBe("Plain «paragraph one.\nPlain paragrap»h two");
    expect(run(run(once, ITALIC), ITALIC)).toBe(once);
    // A blank line between: two paragraphs, a pair each
    expect(run("«one\n\ntwo»")).toBe("**«one**\n\n**two»**");
    // A paragraph after a list item: apart
    expect(run("- «one\nplain»")).toBe("- **«one**\n**plain»**");
  });

  it("over a paragraph's lines are read with the caret in them, and taken off whole; not across a blank line or a list item", () => {
    expect(on("Plain **paragraph one.\nPlain para‸grap**h two")).toBe(true);
    expect(on("Plain **paragraph ‸one.\nPlain paragrap**h two")).toBe(true);
    expect(run("Plain **paragraph one.\nPlain para‸grap**h two")).toBe("Plain paragraph one.\nPlain para‸graph two");
    expect(on("**one\n\ntw‸o**")).toBe(false);
    expect(on("- **one\n- tw‸o**")).toBe(false);
    expect(on("`one\ntw‸o`", "code")).toBe(true);
  });

  it("over lines of blocks apart (list items), toggled twice, are back as they were: the selection after the first holds the markers of the lines it goes past", () => {
    const once = run("- one «item\n- two it»em");
    expect(once).toBe("- one **«item**\n- **two it»**em");
    expect(on(once)).toBe(true);
    expect(run(once)).toBe("- one «item\n- two it»em");
  });

  it("tell italic's * from bold's **", () => {
    expect(on("a *«x»* b", ITALIC)).toBe(true);
    expect(on("a **«x»** b", ITALIC)).toBe(false);
    expect(run("a *«x»* b", ITALIC)).toBe("a «x» b");
  });

  it("leave code blocks, their fences, tables and rules alone", () => {
    expect(run("«intro\n```js\nlet a\n```\nend»")).toBe("**«intro**\n```js\nlet a\n```\n**end»**");
    expect(run("«text\n| a | b |\n|---|---|»")).toBe("**«text»**\n| a | b |\n|---|---|");
    expect(on("«| a |»")).toBe(false);
    expect(canFormat(at("```\nco‸de\n```"), format(BOLD))).toBe(false);
  });

  it("take two formatted spans for two, not one; turned on over them, made one", () => {
    expect(on("«_a_ b _c_»", ITALIC)).toBe(false);
    expect(run("«_a_ b _c_»", ITALIC)).toBe("_«a b c»_");
    expect(run("«`a` and `b`»", "code")).toBe("`«a and b»`");
    expect(run("«~~x~~ y»", "strikethrough")).toBe("~~«x y»~~");
    expect(run("«**a** b»")).toBe("**«a b»**");
  });

  it("read a format through another one between it and the text, and take only it off", () => {
    expect(run("**_«x»_**")).toBe("_«x»_");
    expect(run("~~**«x»**~~", "strikethrough")).toBe("**«x»**");
    expect(run("_**«x»**_")).toBe("_«x»_");
  });

  it("read italic in bold and italic (***x***), the text or the whole selected, and take only it off", () => {
    expect(on("a ***«x»*** b", ITALIC)).toBe(true);
    expect(on("a ***«x»*** b", BOLD)).toBe(true);
    expect(run("a ***«x»*** b", ITALIC)).toBe("a **«x»** b");
    expect(on("a «***x***» b", ITALIC)).toBe(true);
    expect(on("«*a **b** c*»", ITALIC)).toBe(true);
    expect(on("«_snake_case_»", ITALIC)).toBe(true);
  });

  it("keep code literal: no format inside it, the formats inside taken off when it is put on", () => {
    expect(canFormat(at("a `co«d»e` b"), format(BOLD))).toBe(false);
    expect(canFormat(at("a `co‸de` b"), format(BOLD))).toBe(false);
    // The code span selected whole: wrapped
    expect(run("a «`code`» b")).toBe("a **«`code`»** b");
    expect(run("a «**x** _y_» b", "code")).toBe("a `«x y»` b");
  });

  it("are all taken off by clearing, around and inside", () => {
    const cleared = (text: string) => {
      const context = at(text);
      return after(context.text, clear(context));
    };
    expect(cleared("a **_«mixed **bold** and `code`»_** b")).toBe("a «mixed bold and code» b");
    expect(cleared("a «plain» b")).toBe("unchanged");
    // A word's underscores, a code span's text and escaped markers kept
    expect(cleared("«snake_case_name and _it_»")).toBe("«snake_case_name and it»");
    expect(cleared("«see `a_b_c` and **x**»")).toBe("«see a_b_c and x»");
    expect(cleared("«``a`b`` c»")).toBe("«a`b c»");
    expect(cleared("«\\*lit\\* and *it*»")).toBe("«\\*lit\\* and it»");
    // Not into a code block
    expect(cleared("«x\n```\na_b_c\n```»")).toBe("unchanged");
  });
});

describe("Links", () => {
  const run = (text: string, name = "link") => {
    const context = at(text);
    return after(context.text, toggle(context, format(name)));
  };

  it("make the selection a link, the caret where the url goes; a url selected the target, the caret where its text goes", () => {
    expect(run("see «docs» now")).toBe("see [docs](‸) now");
    expect(run("«https://x.org»")).toBe("[‸](https://x.org)");
    expect(run("see ‸ now")).toBe("see [link](‸) now");
    // Line by line: the caret in the last one's url
    expect(run("«one\ntwo»")).toBe("[one]()\n[two](‸)");
  });

  it("are recognized selected whole, or the selection or caret in their text or url, and taken off, their text kept", () => {
    expect(isOn(at("a «[x](u)» b"), format("link"))).toBe(true);
    expect(run("a «[x](u)» b")).toBe("a «x» b");
    expect(run("a [No‸tion](https://x.cz) b")).toBe("a «Notion» b");
    expect(run("a [«Not»ion](https://x.cz) b")).toBe("a «Notion» b");
    expect(run("a [x](u‸rl) b")).toBe("a «x» b");
    expect(isOn(at("a «![pic](img.png)» b"), format("link"))).toBe(false);
    expect(isOn(at("a «text» [x](u)"), format("link"))).toBe(false);
  });

  it("toggle a wiki link: the text inside it, the whole of it, the caret in it; an alias left", () => {
    expect(run("go «Page» now", "wikiLink")).toBe("go «[[Page]]» now");
    expect(run("go [[«Page»]] now", "wikiLink")).toBe("go «Page» now");
    expect(run("go «[[Page]]» now", "wikiLink")).toBe("go «Page» now");
    expect(run("go [[Pa‸ge|alias]] now", "wikiLink")).toBe("go «alias» now");
    expect(run("go ‸ now", "wikiLink")).toBe("go [[‸]] now");
    // Literal: no bold inside its name
    expect(canFormat(at("go [[Pa«g»e]] now"), format(BOLD))).toBe(false);
  });
});

describe("Block formats", () => {
  const turn = (text: string, name: string) => {
    const context = contextOf(text, 0, text.length);
    const change = turnInto(context, format(name));
    return change ? text.slice(0, change.from) + marked(change.insert).text + text.slice(change.to) : "unchanged";
  };

  it("are read from a line's marker", () => {
    const of = (line: string) => blockFormatOf(contextOf(line, 0, line.length))?.name;
    expect(of("## Title")).toBe("heading2");
    expect(of("  - [x] done")).toBe("task");
    expect(of("12. item")).toBe("numbered");
    expect(of("> quote")).toBe("quote");
    expect(of("#hashtag")).toBe("paragraph");
    // A rule, a table's row: recognized, not turned
    expect(canTurn(contextOf("---", 0, 3))).toBe(false);
    expect(canTurn(contextOf("| a |", 0, 5))).toBe(false);
  });

  it("are turned into another, the text kept, a list's indentation kept, a numbered list counted", () => {
    expect(turn("one\ntwo", "bullet")).toBe("- one\n- two");
    expect(turn("- one\n  - two", "numbered")).toBe("1. one\n  1. two");
    expect(turn("- [x] done\n- [ ] not", "bullet")).toBe("- done\n- not");
    expect(turn("- one", "task")).toBe("- [ ] one");
    expect(turn("> a\n> b", "heading2")).toBe("## a\n## b");
    expect(turn("# Title", "quote")).toBe("> Title");
    // A heading is not indented
    expect(turn("  - a", "heading1")).toBe("# a");
  });

  it("count a numbered list at each depth anew; leave lines of the target as they are (a task done stays done)", () => {
    expect(turn("- a\n  - b\n  - c\n- d", "numbered")).toBe("1. a\n  1. b\n  2. c\n2. d");
    expect(turn("- [x] a\n- b", "task")).toBe("- [x] a\n- [ ] b");
  });

  it("leave fences and code alone; ```code``` in a line is no fence", () => {
    expect(canTurn(contextOf("```js\nx\n```", 3, 3))).toBe(false);
    expect(turn("```a``` b\nc", "bullet")).toBe("- ```a``` b\n- c");
  });

  it("tell a fence from another kind or a shorter one: the code block goes on", () => {
    // ~~~ inside a ``` block does not close it; ```` needs ```` or more
    expect(turn("```\n~~~\nx\n```\ny", "bullet")).toBe("```\n~~~\nx\n```\n- y");
    expect(turn("````\n```\nx\n````\ny", "bullet")).toBe("````\n```\nx\n````\n- y");
  });

  it("back into paragraphs when they all are the target already; empty lines, code, tables and rules left as they are", () => {
    expect(turn("- one\n- two", "bullet")).toBe("one\ntwo");
    expect(turn("one\n\ntwo", "quote")).toBe("> one\n\n> two");
    expect(turn("one\n```\ncode\n```\n| a |\n---", "bullet")).toBe("- one\n```\ncode\n```\n| a |\n---");
  });

  it("select the lines' text after turning", () => {
    const context = at("«one\ntwo»");
    expect(after(context.text, turnInto(context, format("bullet")))).toBe("- «one\n- two»");
  });
});

describe("Custom formats", () => {
  it("are block formats of a marker, offered in their order after the built-in ones, read before them", () => {
    const { formats, problems } = formatsOf([{ name: "callout", scope: "block", label: "Callout", marker: "> [!note] " }]);
    expect(problems).toEqual([]);
    defineCustomFormats(formats);
    expect(formatsIn("block").at(-1)?.id).toBe("formats.callout");
    const context = contextOf("one", 0, 3);
    const change = turnInto(context, format("callout"))!;
    expect(change.insert).toBe("> [!note] one");
    // Read before the quote
    expect(blockFormatOf(contextOf("> [!note] one", 0, 13))?.name).toBe("callout");
  });

  it("are inline formats of their own read, write and the line around the selection", () => {
    const { formats } = formatsOf((helpers: { cursor: () => string }) => [
      {
        name: "kbd",
        scope: "inline",
        label: "Key",
        read: (text: string, { before, after }: { before: { touching(x: RegExp): string | undefined }; after: { touching(x: RegExp): string | undefined } }) => {
          const whole = /^<kbd>(.*)<\/kbd>$/.exec(text);
          if (whole) return whole[1];
          const start = before.touching(/<kbd>[^<]*/);
          const end = after.touching(/[^<]*<\/kbd>/);
          return start && end ? { text: start.slice(5) + text + end.slice(0, -6), start, end } : undefined;
        },
        write: (text: string) => `<kbd>${text || helpers.cursor()}</kbd>`,
      },
    ]);
    defineCustomFormats(formats);
    const kbd = format("kbd");
    const context = at("press «Ctrl» now");
    expect(after(context.text, toggle(context, kbd))).toBe("press «<kbd>Ctrl</kbd>» now");
    expect(isOn(at("press <kbd>«Ctrl»</kbd> now"), kbd)).toBe(true);
    const inside = at("press <kbd>Ct‸rl</kbd> now");
    expect(after(inside.text, toggle(inside, kbd))).toBe("press «Ctrl» now");
    const caret = at("press ‸ now");
    expect(after(caret.text, toggle(caret, kbd))).toBe("press <kbd>‸</kbd> now");
  });

  it("replace a built-in one of their name in its place, its id kept", () => {
    defineCustomFormats(formatsOf([{ name: "bold", scope: "inline", label: "Strong", marker: "__" }]).formats);
    expect(formatsIn("inline")[0]?.label).toBe("Strong");
    const context = at("«x»");
    expect(toggle(context, format("bold"))?.insert).toBe("__x__");
  });

  it("number with a multiline write, by the helpers", () => {
    const { formats, problems } = formatsOf((helpers: { numberByIndent(items: readonly { indent: string }[]): number[] }) => ({
      name: "lettered",
      scope: "block",
      label: "Lettered",
      read: (text: string) => /^[a-z]\) /.exec(text) && text.slice(3),
      multiline: true,
      write: (items: readonly { text: string; indent: string }[]) => {
        const n = helpers.numberByIndent(items);
        return items.map(({ text, indent }, i) => `${indent}${String.fromCharCode(96 + n[i]!)}) ${text}`);
      },
    }));
    expect(problems).toEqual([]);
    defineCustomFormats(formats);
    const change = turnInto(contextOf("one\ntwo", 0, 7), format("lettered"))!;
    expect(change.insert).toBe("a) one\nb) two");
  });

  it("are refused with what is wrong; a function failing or giving the wrong thing fails the action", () => {
    const { formats, problems } = formatsOf([
      { name: "1st", scope: "block", marker: "x" },
      { name: "bad", scope: "page" },
      { name: "noMark", scope: "inline" },
      { name: "mark", scope: "inline", marker: "<u>" },
      { name: "broken", scope: "inline", label: "Broken", read: () => 42, write: (t: string) => t },
    ]);
    expect(problems).toEqual([
      'format 1st: its name "1st" is not letters, digits and _ starting with a letter',
      'format bad: its scope is not "block" or "inline"',
      "format noMark: it has neither a marker nor read and write",
      "format mark: its marker is not one sign written once or more (**, ==, ^), or a list of them",
    ]);
    defineCustomFormats(formats);
    expect(() => isOn(at("«x»"), format("broken"))).toThrow("broken's read gave a number");
  });

  it("are replaced by the definitions made after Space Lua loads again; a name defined twice is said", () => {
    const one = formatsOf({ name: "a", scope: "block", marker: "+ " }).formats;
    expect(defineCustomFormats(one)).toEqual([]);
    expect(defineCustomFormats(one)).toEqual(["a"]);
    customFormatsAnew();
    defineCustomFormats(formatsOf({ name: "b", scope: "block", marker: "* " }).formats);
    expect(formatById("formats.a")).toBeUndefined();
    expect(formatById("formats.b")).toBeDefined();
  });
});
