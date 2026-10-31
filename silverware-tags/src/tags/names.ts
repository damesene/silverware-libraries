// Tag names as SilverBullet reads them, and their hierarchy: a tag's name is
// what follows its `#` (or what is in its `#<…>`), "/" parts it into levels
// (`project/alpha` is under `project`), a convention SilverBullet shows
// nowhere. Names are compared as written: SilverBullet's index keeps them so.

// SilverBullet's tag (tagRegex, client/markdown_parser/constants.ts of 2.12.1
// and of main 2026-10-16): a name of characters that are not spaces nor
// punctuation, not of digits alone, not ending in a hyphen; or any text in < >
export const TAG_SOURCE = String.raw`#(?:(?:\d*[^\d\s!@#$%^&*(),.?":{}|<>\\';\/–—][^\s!@#$%^&*(),.?":{}|<>\\]*)|(?:<[^>\n]+>))(?<!-)`;
const WHOLE_RE = new RegExp(`^${TAG_SOURCE}$`);

/** A tag's name of its hashtag: what is in its < >, else after its # */
export function nameOfHashtag(hashtag: string): string {
  return hashtag.startsWith("#<") ? hashtag.slice(2, -1) : hashtag.slice(1);
}

/** A name as a hashtag: `#name`, or `#<name>` where `#name` would not read as all of it (spaces, punctuation) */
export function hashtagOf(name: string): string {
  const plain = `#${name}`;
  return WHOLE_RE.test(plain) ? plain : `#<${name}>`;
}

/** What is wrong with a name for a tag (nothing: undefined) */
export function nameProblem(name: string): string | undefined {
  if (!name.trim()) return "a tag needs a name";
  if (name !== name.trim()) return "a tag's name cannot start or end with a space";
  if (/[\n>]/.test(name)) return "a tag's name cannot hold a line break or >";
  if (name.split("/").some((part) => !part)) return "each level of a tag's name (between /) needs a name";
  return undefined;
}

/** The tag a typed name stands for: without a leading # or its < > */
export function cleanName(typed: string): string {
  const name = typed.trim();
  if (name.startsWith("#<") && name.endsWith(">")) return name.slice(2, -1).trim();
  return name.replace(/^#/, "").trim();
}

/**
 * Whether a tag is SilverBullet's own, marking its meta pages (libraries,
 * templates, its API): `meta` and every tag under it, as its `isMetaTag`
 * (plug-api/lib/tags.ts) tells them; shown apart, as its own tree shows meta
 * pages apart
 */
export function isMetaTag(tag: string): boolean {
  return tag === "meta" || tag.startsWith("meta/");
}

/** The tag `tag` is directly under (none at the top) */
export function parentOf(tag: string): string | undefined {
  const at = tag.lastIndexOf("/");
  return at > 0 ? tag.slice(0, at) : undefined;
}

/** Whether `tag` is `root` or under it at any level */
export function isWithin(tag: string, root: string): boolean {
  return tag === root || tag.startsWith(`${root}/`);
}

/**
 * `tag` renamed from `from` to `to`: the tag itself, and with `children` a tag
 * under it, its levels below kept (`project/alpha` → `work/project/alpha`);
 * any other: undefined
 */
export function renamedTag(tag: string, from: string, to: string, children: boolean): string | undefined {
  if (tag === from) return to;
  if (children && tag.startsWith(`${from}/`)) return to + tag.slice(from.length);
  return undefined;
}

/** A tag matched by a rule: the tag itself, with `children` the tags under it too */
export function matches(tag: string, name: string, children: boolean): boolean {
  return children ? isWithin(tag, name) : tag === name;
}
