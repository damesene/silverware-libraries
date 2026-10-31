// The edits of a page's text the operations are made of: tags renamed, removed,
// given to the page. Pure: text in, text out, with how many tags changed and
// why a page was left alone. Page tags are written into the frontmatter
// (frontmatter.ts); a page's tag lines are read as its tags too, as
// SilverBullet reads them.
import { type FrontmatterForm, readFrontmatter, writeTags } from "./frontmatter.ts";
import { hashtagBefore } from "./names.ts";
import { type Hashtag, scanHashtags, type TagContext, type TagScanner } from "./scan.ts";

export type TextEdit = { readonly from: number; readonly to: number; readonly insert: string };

export type EditResult = {
  readonly text: string;
  // How many tags changed (each occurrence)
  readonly changes: number;
  // Why the page was left alone (its text as it is)
  readonly problem?: string;
};

/** Edits applied (none overlapping) */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.from - a.from)) out = out.slice(0, edit.from) + edit.insert + out.slice(edit.to);
  return out;
}

/** A tag where it is used on a page: its frontmatter (`page`) or a hashtag's context */
export type TagUse = { readonly name: string; readonly context: TagContext };

/** Every tag of a page's text where it is used, the frontmatter's as the page's */
export function tagUses(text: string, scanner: TagScanner = scanHashtags): TagUse[] {
  const frontmatter = readFrontmatter(text);
  return [...(frontmatter.key?.items.map((item) => ({ name: item.name, context: "page" as const })) ?? []), ...scanner(text, frontmatter.bodyStart).map(({ name, context }) => ({ name, context }))];
}

/** The page's own tags (its frontmatter's, then its tag lines'), each once */
export function pageTags(text: string, scanner: TagScanner = scanHashtags): string[] {
  return [...new Set(tagUses(text, scanner).filter((use) => use.context === "page").map((use) => use.name))];
}

/** The frontmatter's tags alone (what Page tags removes from there) */
export function frontmatterTags(text: string): string[] {
  return readFrontmatter(text).key?.items.map((item) => item.name) ?? [];
}

const unchanged = (text: string, problem?: string): EditResult => ({ text, changes: 0, ...(problem ? { problem } : {}) });

/**
 * Every tag `rename` gives a new name renamed: in the frontmatter (a name
 * there twice once merged: once) and every hashtag of the body, whatever
 * its context
 */
export function renameTags(text: string, rename: (name: string) => string | undefined, scanner: TagScanner = scanHashtags): EditResult {
  const frontmatter = readFrontmatter(text);
  if (frontmatter.unreadable) return unchanged(text, `${frontmatter.unreadable}: left alone`);
  const edits: TextEdit[] = [];
  let changes = 0;
  const current = frontmatter.key?.items.map((item) => item.name) ?? [];
  const names = current.map((name) => rename(name) ?? name);
  changes += current.filter((name, i) => names[i] !== name).length;
  const front = writeTags(text, frontmatter, [...new Set(names)]);
  if (front) edits.push(front);
  for (const tag of scanner(text, frontmatter.bodyStart)) {
    const to = rename(tag.name);
    if (to === undefined || to === tag.name) continue;
    edits.push({ from: tag.from, to: tag.to, insert: hashtagBefore(to, text.slice(tag.to, tag.line.to)) });
    changes++;
  }
  return changes ? { text: applyEdits(text, edits), changes } : unchanged(text);
}

/**
 * Every tag `match` matches removed: from the frontmatter, and its hashtags
 * of the contexts `contexts` (all where undefined); a tag line left with no
 * tag goes, a hashtag in text goes with a space beside it
 */
export function removeTags(text: string, match: (name: string) => boolean, contexts?: ReadonlySet<TagContext>, scanner: TagScanner = scanHashtags): EditResult {
  const frontmatter = readFrontmatter(text);
  if (frontmatter.unreadable) return unchanged(text, `${frontmatter.unreadable}: left alone`);
  const edits: TextEdit[] = [];
  const current = frontmatter.key?.items.map((item) => item.name) ?? [];
  const kept = current.filter((name) => !match(name));
  let changes = current.length - kept.length;
  const front = writeTags(text, frontmatter, kept);
  if (front) edits.push(front);
  // By line: a line left with nothing goes whole
  const byLine = new Map<number, Hashtag[]>();
  for (const tag of scanner(text, frontmatter.bodyStart)) {
    if (!match(tag.name) || (contexts && !contexts.has(tag.context))) continue;
    const line = byLine.get(tag.line.from) ?? [];
    line.push(tag);
    byLine.set(tag.line.from, line);
    changes++;
  }
  for (const tags of byLine.values()) {
    const { line } = tags[0]!;
    // A removal reaching the line's end takes the spaces before it too (none left trailing)
    const lineEdits = merged(tags.map((tag) => withSpace(text, tag, line))).map((edit) => {
      if (edit.to !== line.to) return edit;
      let from = edit.from;
      while (from > line.from && /[ \t]/.test(text[from - 1]!)) from--;
      return { ...edit, from };
    });
    const left = applyEdits(text.slice(line.from, line.to), lineEdits.map((e) => ({ ...e, from: e.from - line.from, to: e.to - line.from })));
    if (!left.trim() && tags[0]!.context === "page") edits.push(lineRemoved(text, line, frontmatter.bodyStart));
    else edits.push(...lineEdits);
  }
  return changes ? { text: applyEdits(text, edits), changes } : unchanged(text);
}

/** A hashtag's removal with one space beside it (after it, else before it), so words around it stay apart */
function withSpace(text: string, tag: Hashtag, line: { readonly from: number; readonly to: number }): TextEdit {
  if (tag.to < line.to && /[ \t]/.test(text[tag.to]!)) return { from: tag.from, to: tag.to + 1, insert: "" };
  if (tag.from > line.from && /[ \t]/.test(text[tag.from - 1]!)) return { from: tag.from - 1, to: tag.to, insert: "" };
  return { from: tag.from, to: tag.to, insert: "" };
}

/** Removals that overlap made one (two hashtags side by side take the same space: `x #a #a`) */
function merged(edits: readonly TextEdit[]): TextEdit[] {
  const out: TextEdit[] = [];
  for (const edit of [...edits].sort((a, b) => a.from - b.from)) {
    const last = out[out.length - 1];
    if (last && edit.from <= last.to) out[out.length - 1] = { from: last.from, to: Math.max(last.to, edit.to), insert: "" };
    else out.push(edit);
  }
  return out;
}

/** A line removed with its line break; a blank line after it too where one is before it (no two blank lines left) */
function lineRemoved(text: string, line: { readonly from: number; readonly to: number }, bodyStart: number): TextEdit {
  const hasBreak = line.to < text.length;
  let to = hasBreak ? line.to + 1 : line.to;
  const from = hasBreak || line.from === bodyStart ? line.from : line.from - 1;
  const previous = line.from === bodyStart ? "" : text.slice(Math.max(bodyStart, text.lastIndexOf("\n", line.from - 2) + 1), line.from - 1);
  const blankBefore = !previous.trim();
  const next = /^[ \t]*(\n|$)/.exec(text.slice(to));
  if (hasBreak && blankBefore && next && to < text.length) to += next[0].length;
  return { from, to, insert: "" };
}

/** Tags given to the page: into its frontmatter (a key made anew in `form`), those it has (there or on a tag line) left out */
export function addPageTags(text: string, names: readonly string[], form: FrontmatterForm = "flow", scanner: TagScanner = scanHashtags): EditResult {
  const frontmatter = readFrontmatter(text);
  if (frontmatter.unreadable) return unchanged(text, `${frontmatter.unreadable}: left alone`);
  const has = new Set(pageTags(text, scanner));
  const added = [...new Set(names)].filter((name) => !has.has(name));
  if (!added.length) return unchanged(text);
  const current = frontmatter.key?.items.map((item) => item.name) ?? [];
  const edit = writeTags(text, frontmatter, [...current, ...added], form);
  return edit ? { text: applyEdits(text, [edit]), changes: added.length } : unchanged(text);
}

/** Tags taken off the page: from its frontmatter and its tag lines (a hashtag in its text stays) */
export function removePageTags(text: string, names: readonly string[], scanner: TagScanner = scanHashtags): EditResult {
  const off = new Set(names);
  return removeTags(text, (name) => off.has(name), new Set(["page"]), scanner);
}
