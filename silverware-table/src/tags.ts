// Hidden tags in cells: `<meta …>` after a cell's text, which SilverBullet does
// not show (verified) and other renderers drop. Modules keep their data in
// them (formulas: `f`; names: `n`, `cn`), read into a cell's attributes by the
// markdown codec, which writes them back (store/markdown/codec.ts); what an
// edit keeps of them is the model's rules (shared/table/rules.ts).

/**
 * What a hidden tag holds between "<meta" and its ">": anything but ">". A tag
 * ends at its first ">" as SilverBullet reads it, also inside a value in
 * quotes or apostrophes (verified: `<meta note='a > b'>` shows as text), so
 * values write ">" as &gt; and Silverware Table finds tags as SilverBullet does
 */
export const TAG_BODY = "[^>]*";

/** A hidden tag (<meta …>), as SilverBullet reads it; `flags` "gi" to find every one */
export function metaTagPattern(flags = "gi"): RegExp {
  return new RegExp(String.raw`<meta\b${TAG_BODY}>`, flags);
}

const TAG_RE = new RegExp(String.raw`\s*<meta\b${TAG_BODY}>`, "gi");
// An attribute with its value, so a "name=" inside a value (a formula's n=1) is no attribute
const ATTRIBUTE_RE = /([\w.:-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g;

/** A cell's hidden tags, as written */
export function cellTags(cell: string): string[] {
  return Array.from(cell.matchAll(TAG_RE), (match) => match[0].trim());
}

/** A cell's text without its hidden tags */
export function withoutTags(cell: string): string {
  return cell.replace(TAG_RE, "").trim();
}

export function attributesOf(tag: string): string[] {
  return Array.from(tag.matchAll(ATTRIBUTE_RE), (match) => match[1]!.toLowerCase());
}

