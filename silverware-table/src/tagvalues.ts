// An attribute of a cell's hidden tags (tags.ts) read and written by its name,
// whatever it is for: what the core gives a module for the data it keeps in
// cells, the attribute's name made by the core.
import { metaAttribute, unescapeMetaValue } from "./markdown.ts";
import { cellTags, withoutTags } from "./tags.ts";

// An attribute with its value, in quotes or apostrophes
const ATTRIBUTE_VALUE_RE = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The attributes of a tag, by name (lowercase), their values unescaped; an attribute's last value counts */
function attributes(tag: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of tag.matchAll(ATTRIBUTE_VALUE_RE)) found.set(match[1]!.toLowerCase(), unescapeMetaValue(match[2] ?? match[3] ?? ""));
  return found;
}

/** Every attribute of a cell's hidden tags by name (lowercase), its value unescaped: the last tag with one counts, in the order first found */
export function tagAttributes(cell: string): Map<string, string> {
  const found = new Map<string, string>();
  if (!cell.includes("<")) return found;
  for (const tag of cellTags(cell)) for (const [name, value] of attributes(tag)) found.set(name, value);
  return found;
}

/** The value of the attribute `name` in a cell's hidden tags (the last tag with it counts); undefined without it */
export function tagValue(cell: string, name: string): string | undefined {
  // No tag at all (most cells): asked for every cell of a table on every view
  if (!cell.includes("<")) return undefined;
  const wanted = name.toLowerCase();
  let value: string | undefined;
  for (const tag of cellTags(cell)) value = attributes(tag).get(wanted) ?? value;
  return value;
}

// A tag's attributes one by one, a value read whole (a name inside one is no attribute): its space, name and value as written
const TAG_ATTRIBUTE_RE = /(\s+)([^\s=/>]+)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;

/**
 * A hidden tag in today's form: each attribute written in double quotes (as
 * before 2026-10-22) written as metaAttribute writes it, the rest as written.
 * What a cell written anew carries over of the tags it had.
 */
export function currentTag(tag: string): string {
  const body = tag.slice("<meta".length, tag.length - 1);
  const written = body.replace(TAG_ATTRIBUTE_RE, (whole: string, space: string, name: string, value: string | undefined) => {
    const quoted = value && /^\s*=\s*"([^"]*)"$/.exec(value);
    return quoted ? `${space}${metaAttribute(name, unescapeMetaValue(quoted[1]!))}` : whole;
  });
  return written === body ? tag : `<meta${written}>`;
}

/**
 * The cell with the attribute `name` set to `value` (undefined: removed), in
 * the tag that has it, else in a tag of its own after the cell's other tags; a
 * tag left without attributes goes. The cell's text and the tags' other
 * attributes stay as written (whoever's they are, with or without a value).
 */
export function withTagValue(cell: string, name: string, value: string | undefined): string {
  const wanted = name.toLowerCase();
  let placed = value === undefined;
  const tags: string[] = [];
  for (const tag of cellTags(cell)) {
    if (!attributes(tag).has(wanted)) {
      tags.push(tag);
      continue;
    }
    // Every attribute but this one as written, this one in its place once (its first)
    const body = tag.slice("<meta".length, tag.length - 1).replace(/\/$/, "");
    let kept = "";
    for (const [whole, , attribute] of body.matchAll(TAG_ATTRIBUTE_RE)) {
      if (attribute!.toLowerCase() !== wanted) kept += whole;
      else if (!placed) {
        kept += ` ${metaAttribute(name, value!)}`;
        placed = true;
      }
    }
    if (kept.trim() !== "") tags.push(`<meta${kept}>`);
  }
  if (!placed) tags.push(`<meta ${metaAttribute(name, value!)}>`);
  return [withoutTags(cell), ...tags].filter((part) => part !== "").join(" ");
}
