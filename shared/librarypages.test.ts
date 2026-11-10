// Every plugin's pages a space installs (the library page and the pages of its
// `files:`) mention no one: an `@name` SilverBullet reads as a mention lists the
// page in its Mention Inbox, so outside code it is written `\@` (CLAUDE.md,
// *Working rules*).
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A mention as SilverBullet reads one (client/markdown_parser/parser.ts: `@` after none of a word's character, `.`, `@`, `+`,
// `-`, nor escaped; a name as its atMentionRegex starts one)
const MENTION = /(^|[^\w.@+\-\\])@(?=\d*[^\d\s!@#$%^&*(),.?":{}|<>\\/'’])/g;

/** A line's text outside its code spans (each span made spaces, so places stay) */
function outsideCode(line: string): string {
  return line.replace(/(`+)[\s\S]*?\1/g, (span) => " ".repeat(span.length));
}

/** The mentions of a page outside its frontmatter, its fenced blocks and its code spans, by line */
function mentionsIn(text: string): string[] {
  const found: string[] = [];
  let fence: string | undefined;
  let front = text.startsWith("---");
  text.split("\n").forEach((line, at) => {
    if (front) {
      if (at > 0 && line.trim() === "---") front = false;
      return;
    }
    const marks = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marks && marks[0] === fence[0] && marks.length >= fence.length) fence = undefined;
      return;
    }
    if (marks) {
      fence = marks;
      return;
    }
    if (MENTION.test(outsideCode(line))) found.push(`${at + 1}: ${line.trim().slice(0, 80)}`);
    MENTION.lastIndex = 0;
  });
  return found;
}

const PAGES = readdirSync(".", { withFileTypes: true })
  .filter((one) => one.isDirectory() && one.name.startsWith("silverware-"))
  .flatMap((dir) => readdirSync(dir.name).filter((name) => name.endsWith(".md")).map((name) => `${dir.name}/${name}`));

describe("the pages a space installs", () => {
  it("are found", () => expect(PAGES.length).toBeGreaterThan(10));

  it.each(PAGES)("%s mentions no one (an @ outside code written \\@)", (page) => {
    expect(mentionsIn(readFileSync(page, "utf8"))).toEqual([]);
  });

  it("tell a mention from code, an escape, an e-mail and a word before it", () => {
    expect(mentionsIn("Owner @ada.\n`@code` \\@escaped me@x.dev a-@b\n```\n@fenced\n```\n[@due] and =@tasks")).toEqual(["1: Owner @ada.", "6: [@due] and =@tasks"]);
  });
});
