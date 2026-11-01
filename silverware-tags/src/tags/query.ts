// A search of pages by name and tags, as typed: `#a` the pages having the tag
// (or one under it: `#project` finds `#project/alpha`), `-#a` those not having
// it, the other words in the page's name; all of them together. A tag counts
// wherever the page uses it (its own tags, its text). Case is ignored, as a
// search ignores it (a change of tags never does).

export type PageQuery = {
  // Words of the page's name, lowercased
  readonly words: readonly string[];
  // Tags it has, tags it does not have
  readonly has: readonly string[];
  readonly not: readonly string[];
};

// `#<two words>`, `#name`, `-` before either; anything else a word
const TOKEN_RE = /(-?)#<([^>\n]*)>?|(-?)#(\S*)|(\S+)/g;

export function parsePageQuery(text: string): PageQuery {
  const words: string[] = [];
  const has: string[] = [];
  const not: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const tag = m[2] ?? m[4];
    if (tag === undefined) words.push(m[5]!.toLowerCase());
    else if (tag.trim()) (m[1] || m[3] ? not : has).push(tag.trim().toLowerCase());
  }
  return { words, has, not };
}

export const isEmptyQuery = (query: PageQuery): boolean => !query.words.length && !query.has.length && !query.not.length;

const within = (name: string, tag: string) => name === tag || name.startsWith(`${tag}/`);

/** Whether a page, with the tags it uses, is one the query finds */
export function pageMatches(query: PageQuery, page: string, tags: Iterable<string>): boolean {
  const name = page.toLowerCase();
  if (!query.words.every((word) => name.includes(word))) return false;
  if (!query.has.length && !query.not.length) return true;
  const names = [...tags].map((tag) => tag.toLowerCase());
  return query.has.every((tag) => names.some((n) => within(n, tag))) && !query.not.some((tag) => names.some((n) => within(n, tag)));
}

/** The tag being typed at the caret (`#pro`, `-#<two w`): where it is in the text and what of its name is typed */
export function tagAtCaret(text: string, caret: number): { readonly from: number; readonly to: number; readonly typed: string; readonly not: boolean } | undefined {
  for (const m of text.matchAll(TOKEN_RE)) {
    const from = m.index!;
    const to = from + m[0].length;
    if (caret < from || caret > to) continue;
    const tag = m[2] ?? m[4];
    if (tag === undefined) return undefined;
    return { from, to, typed: tag, not: !!(m[1] || m[3]) };
  }
  return undefined;
}
