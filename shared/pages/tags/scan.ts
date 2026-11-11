// The hashtags of a page's body, found as SilverBullet's parser finds them
// (`Hashtag`, an inline element wherever a `#` starts one): not in the
// frontmatter (frontmatter.ts reads it), fenced or indented code, nor where a
// line's marks leave none (shared/markdown/inline.ts: inline code, wiki links,
// attributes' values, a link's target, URLs, HTML, a `#` escaped). Each with
// its place in the text and its context, as SilverBullet's index tells them
// apart (plugs/index/tags.ts and frontmatter.ts): a page's tag line (a
// paragraph directly under the document of hashtags alone: its lines up to the
// first holding anything else), a paragraph (a quote's too), an item, a task,
// a table, a heading.
//
// A line-by-line reading, not a markdown parser: a line's block is what
// shared/markdown/blockline.ts `readLine` reads, its fences lines.ts', and what
// holds over lines (a list, a paragraph, code) is kept here. Behind
// `TagScanner`, so another (SilverBullet's own parser) could take its place.
import { readLine } from "../../markdown/blockline.ts";
import { inlineMarks } from "../../markdown/inline.ts";
import { closesFence, fenceOf, indentWidth, type Line, linesOf } from "../../markdown/lines.ts";

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

/** A line without the quote's markers it starts with: a fence in a quote (`> ````) is one */
const unquoted = (text: string) => text.replace(/^ {0,3}(?:>[ \t]?)*/, "");

/** The hashtags of the body (the text from `bodyStart`, after the frontmatter) */
export const scanHashtags: TagScanner = (text, bodyStart) => {
  const found: Hashtag[] = [];
  let fence: string | undefined;
  // Within a list (its items' lines and what is indented under them), until a line of the document's own
  let inList: TagContext | undefined;
  // Within a paragraph directly under the document, and whether its lines so far hold hashtags alone
  let paragraph: { tagsOnly: boolean } | undefined;
  let blankBefore = true;
  let indentedCode = false;
  for (const line of linesOf(text, bodyStart, text.length)) {
    // (A CRLF's `\r` none of the line's text: a marker alone, `-\r`, is a marker)
    const t = line.text.endsWith("\r") ? line.text.slice(0, -1) : line.text;
    if (fence) {
      if (closesFence(unquoted(t), fence)) fence = undefined;
      continue;
    }
    const open = fenceOf(unquoted(t));
    if (open) {
      fence = open;
      paragraph = undefined;
      continue;
    }
    const read = readLine(t);
    if (read.kind === "blank") {
      paragraph = undefined;
      blankBefore = true;
      indentedCode = false;
      continue;
    }
    // (Code: indented four or more, a tab four; a line's own indentation, whether there is any and a heading's: as written)
    const indent = read.indent.length;
    // An indented block after a blank line, outside a list, is code
    if (!inList && indentWidth(t) >= 4 && (blankBefore || indentedCode) && !paragraph) {
      indentedCode = true;
      blankBefore = false;
      continue;
    }
    indentedCode = false;
    let context: TagContext;
    if (read.kind === "task") context = inList = "task";
    else if (read.item) context = inList = "item";
    else if (inList && (indent > 0 || !blankBefore)) context = inList;
    else {
      inList = undefined;
      // (A heading indented by three spaces at most: more is a paragraph's text going on, or code)
      if (read.kind === "heading" && /^ {0,3}$/.test(read.indent)) context = "heading";
      else if (read.kind === "table") context = "table";
      else context = "paragraph";
    }
    const own: Hashtag[] = [];
    // (A heading's hashtags after its #s: those are its marker)
    const rest = inline(line, context === "heading" ? read.contentFrom : 0, own);
    // A paragraph directly under the document: its leading lines of hashtags alone are the page's tags
    if (context === "paragraph" && read.kind !== "quote" && indent < 4) {
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
function inline(line: Line, start: number, found: Hashtag[]): string {
  let rest = "";
  let at = 0;
  for (const mark of inlineMarks(line.text, start)) {
    if (mark.kind !== "tag") continue;
    found.push({ name: mark.name, from: line.from + mark.from, to: line.from + mark.to, context: "paragraph", line: { from: line.from, to: line.to } });
    rest += line.text.slice(at, mark.from);
    at = mark.to;
  }
  return rest + line.text.slice(at);
}
