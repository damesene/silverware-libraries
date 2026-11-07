// The hashtags of a page's body, found as SilverBullet's parser finds them
// (`Hashtag`, an inline element wherever a `#` starts one): not in the
// frontmatter (frontmatter.ts reads it), fenced or indented code, inline code,
// wiki links, a link's target, URLs, HTML tags and comments, entities, Space
// Lua's `${…}`, nor a `#` escaped. Each with its place in the text and its
// context, as SilverBullet's index tells them apart (plugs/index/tags.ts and
// frontmatter.ts): a page's tag line (a paragraph directly under the document
// of hashtags alone: its lines up to the first holding anything else), a
// paragraph (a quote's too), an item, a task, a table, a heading.
//
// A line-by-line reading, not a markdown parser: lists, quotes and code are
// told by their lines' starts. Behind `TagScanner`, so another (SilverBullet's
// own parser) could take its place.
import { nameOfHashtag, TAG_SOURCE } from "./names.ts";

export type TagContext = "page" | "paragraph" | "item" | "task" | "table" | "heading";

export type Hashtag = {
  readonly name: string;
  // The hashtag's text in the page's text, its # included
  readonly from: number;
  readonly to: number;
  readonly context: TagContext;
  // The line it is on (without its line break)
  readonly line: { readonly from: number; readonly to: number };
};

export type TagScanner = (text: string, bodyStart: number) => readonly Hashtag[];

const TAG_RE = new RegExp(TAG_SOURCE, "y");
const FENCE_RE = /^ {0,3}(?:>\s?)*\s*(`{3,}|~{3,})/;
const LIST_RE = /^(\s*)(?:[-*+]|\d{1,9}[.)])(?:\s+|$)/;
const TASK_RE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+\[[^\]\n]\](?:\s|$)/;
const HEADING_RE = /^ {0,3}#{1,6}(?=\s|$)/;
const QUOTE_RE = /^ {0,3}>/;
const TABLE_RE = /^\s*\|/;
const ENTITY_RE = /&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/y;
const URL_RE = /https?:\/\/[^\s<>]*/y;
const HTML_RE = /<\/?[A-Za-z][^>\n]*>|<![^>\n]*>/y;

type Line = { readonly from: number; readonly to: number; readonly text: string };

function linesOf(text: string, start: number): Line[] {
  const lines: Line[] = [];
  let from = start;
  while (from <= text.length) {
    const end = text.indexOf("\n", from);
    const to = end < 0 ? text.length : end;
    lines.push({ from, to, text: text.slice(from, to) });
    if (end < 0) break;
    from = end + 1;
  }
  return lines;
}

/** The hashtags of the body (the text from `bodyStart`, after the frontmatter) */
export const scanHashtags: TagScanner = (text, bodyStart) => {
  const found: Hashtag[] = [];
  let fence: { readonly char: string; readonly length: number } | undefined;
  // Within a list (its items' lines and what is indented under them), until a line of the document's own
  let inList: TagContext | undefined;
  // Within a paragraph directly under the document, and whether its lines so far hold hashtags alone
  let paragraph: { tagsOnly: boolean } | undefined;
  let blankBefore = true;
  let indentedCode = false;
  for (const line of linesOf(text, bodyStart)) {
    const { text: t } = line;
    if (fence) {
      const close = FENCE_RE.exec(t);
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length && !t.slice(close[0].length).trim()) fence = undefined;
      continue;
    }
    const open = FENCE_RE.exec(t);
    if (open) {
      fence = { char: open[1]![0]!, length: open[1]!.length };
      paragraph = undefined;
      continue;
    }
    const blank = !t.trim();
    if (blank) {
      paragraph = undefined;
      blankBefore = true;
      indentedCode = false;
      continue;
    }
    const indent = /^\s*/.exec(t)![0];
    const indented = indent.replace(/\t/g, "    ").length >= 4;
    // An indented block after a blank line, outside a list, is code
    if (!inList && indented && (blankBefore || indentedCode) && !paragraph) {
      indentedCode = true;
      blankBefore = false;
      continue;
    }
    indentedCode = false;
    let context: TagContext;
    if (TASK_RE.test(t)) context = inList = "task";
    else if (LIST_RE.test(t)) context = inList = "item";
    else if (inList && (indent.length > 0 || !blankBefore)) context = inList;
    else {
      inList = undefined;
      if (HEADING_RE.test(t)) context = "heading";
      else if (TABLE_RE.test(t)) context = "table";
      else if (QUOTE_RE.test(t)) context = "paragraph";
      else context = "paragraph";
    }
    const own: Hashtag[] = [];
    const start = context === "heading" ? HEADING_RE.exec(t)![0].length : 0;
    const rest = inline(text, line, start, own);
    // A paragraph directly under the document: its leading lines of hashtags alone are the page's tags
    if (context === "paragraph" && !QUOTE_RE.test(t) && indent.length < 4) {
      paragraph ??= { tagsOnly: true };
      if (paragraph.tagsOnly && own.length > 0 && !rest.trim()) context = "page";
      else paragraph.tagsOnly = false;
    } else paragraph = undefined;
    for (const tag of own) found.push({ ...tag, context });
    blankBefore = false;
  }
  return found;
};

/**
 * The hashtags of a line from `start` (in its own text) into `found`, their
 * context to be set; gives the line's text without them (what else it holds)
 */
function inline(text: string, line: Line, start: number, found: Hashtag[]): string {
  const t = line.text;
  let rest = t.slice(0, start);
  let i = start;
  const skipTo = (end: number) => {
    rest += t.slice(i, end);
    i = end;
  };
  while (i < t.length) {
    const c = t[i]!;
    if (c === "\\" && i + 1 < t.length) {
      skipTo(i + 2);
      continue;
    }
    if (c === "`") {
      const run = /`+/y;
      run.lastIndex = i;
      const ticks = run.exec(t)![0];
      const close = t.indexOf(ticks, i + ticks.length);
      skipTo(close < 0 ? i + ticks.length : close + ticks.length);
      continue;
    }
    if (t.startsWith("[[", i)) {
      const close = t.indexOf("]]", i + 2);
      if (close >= 0) {
        skipTo(close + 2);
        continue;
      }
    }
    if (t.startsWith("](", i)) {
      let depth = 0;
      let j = i + 1;
      for (; j < t.length; j++) {
        if (t[j] === "(") depth++;
        else if (t[j] === ")" && --depth === 0) break;
      }
      skipTo(Math.min(j + 1, t.length));
      continue;
    }
    if (t.startsWith("<!--", i)) {
      const close = t.indexOf("-->", i + 4);
      skipTo(close < 0 ? t.length : close + 3);
      continue;
    }
    if (t.startsWith("${", i)) {
      let depth = 0;
      let j = i + 1;
      for (; j < t.length; j++) {
        if (t[j] === "{") depth++;
        else if (t[j] === "}" && --depth === 0) break;
      }
      skipTo(Math.min(j + 1, t.length));
      continue;
    }
    const sticky = (re: RegExp) => {
      re.lastIndex = i;
      return re.exec(t)?.[0];
    };
    if (c === "<") {
      const tag = sticky(HTML_RE);
      if (tag) {
        skipTo(i + tag.length);
        continue;
      }
    }
    if (c === "&") {
      const entity = sticky(ENTITY_RE);
      if (entity) {
        skipTo(i + entity.length);
        continue;
      }
    }
    if (c === "h") {
      const url = sticky(URL_RE);
      if (url) {
        skipTo(i + url.length);
        continue;
      }
    }
    if (c === "#") {
      const tag = sticky(TAG_RE);
      if (tag) {
        found.push({ name: nameOfHashtag(tag), from: line.from + i, to: line.from + i + tag.length, context: "paragraph", line: { from: line.from, to: line.to } });
        i += tag.length;
        continue;
      }
    }
    skipTo(i + 1);
  }
  return rest;
}
