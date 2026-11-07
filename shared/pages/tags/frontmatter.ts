// The frontmatter's tags, read and written in the page's own form, the rest of
// the frontmatter as written (its comments, its other keys): a key's forms are
// shared/pages/frontmatter.ts', what is the tags' own here. SilverBullet reads
// `tags` as a list or a string (`a, b`, `a b`, `#a #b`), a leading # dropped
// (plugs/index/frontmatter.ts). Forms kept: a block list (its indent and
// items as written), a list in brackets on one line, a string of names; a
// name the string cannot hold (a space in it) turns it into a block list.
// A form not read here (a list in brackets over several lines, an anchor) is
// `unreadable`: the page is left alone. A key made anew is in the form asked
// for (the setting): a list in brackets on one line by default (`tags: [a, b]`).

import { type FrontmatterEntry, readFrontmatter as readBlock, readKey, writeKey } from "../frontmatter.ts";

export type FrontmatterForm = "block" | "flow" | "string";

type Item = {
  readonly name: string;
  // As written (its quotes, a #, a comment after it), kept where its name stays
  readonly raw: string;
};

export type Frontmatter = {
  // The whole block, its fences included; its YAML (between the fences); where the body starts
  readonly range: { readonly from: number; readonly to: number } | undefined;
  readonly yaml?: { readonly from: number; readonly to: number };
  readonly bodyStart: number;
  // The `tags` key: its lines (from its start to the end of its value's last line, its line break included)
  readonly key: { readonly from: number; readonly to: number; readonly form: FrontmatterForm; readonly items: readonly Item[]; readonly indent: string; readonly separator: string; readonly hashes: boolean; readonly entry: FrontmatterEntry } | undefined;
  // Why its tags cannot be edited (they are not read either)
  readonly unreadable?: string;
};

/** The page's frontmatter and its tags */
export function readFrontmatter(text: string): Frontmatter {
  const block = readBlock(text);
  const { range, yaml, bodyStart } = block;
  if (!range) return { range, bodyStart, key: undefined };
  const { entry, unreadable } = readKey(text, block, "tags");
  if (unreadable) return { range, yaml, bodyStart, key: undefined, unreadable };
  if (!entry) return { range, yaml, bodyStart, key: undefined };
  const { from, to } = entry;
  if (entry.kind === "list" || entry.raw === "") {
    // A list (a key without a value: a block list of none), each item a name, its leading # off
    const items: Item[] = [];
    for (const item of entry.kind === "list" ? entry.items : []) {
      const name = item.text.replace(/^#/, "").trim();
      if (!name) return { range, yaml, bodyStart, key: undefined, unreadable: `its frontmatter's tags hold ${item.raw || "an empty item"}` };
      items.push({ name, raw: item.raw });
    }
    const form = entry.kind === "list" ? entry.form : "block";
    const indent = entry.kind === "list" && entry.form === "block" ? entry.indent : form === "block" ? "  " : "";
    return { range, yaml, bodyStart, key: { from, to, form, items, indent, separator: form === "flow" ? ", " : "", hashes: false, entry } };
  }
  // A string of names (its leading # kept: each name's is taken off below, so a string of hashtags, "#a #b", keeps its form)
  const string = entry.text.trim();
  if (!string) return { range, yaml, bodyStart, key: undefined, unreadable: `its frontmatter's tags are written as ${entry.raw}` };
  const parts = string.split(/,\s*|\s+/).filter((part) => part.replace(/^#/, ""));
  const separator = /,/.test(string) ? ", " : " ";
  const hashes = parts.length > 0 && parts.every((part) => part.startsWith("#"));
  return {
    range,
    yaml,
    bodyStart,
    key: { from, to, form: "string", items: parts.map((part) => ({ name: part.replace(/^#/, ""), raw: part })), indent: "", separator, hashes, entry },
  };
}

/**
 * The frontmatter's tags made `names` (in that order), as an edit of the text
 * (`from`, `to`, `insert`), its form kept; none where they are as written.
 * Empty: the key goes, and a frontmatter left empty with it.
 */
export function writeTags(text: string, frontmatter: Frontmatter, names: readonly string[], form: FrontmatterForm = "flow"): { from: number; to: number; insert: string } | undefined {
  const { key } = frontmatter;
  const current = key?.items.map((item) => item.name) ?? [];
  if (current.length === names.length && current.every((name, i) => name === names[i])) return undefined;
  if (!names.length) return writeKey(text, frontmatter, "tags", key?.entry, undefined);
  // A string of names where it can hold them (none with a space or a comma in it), else a list
  const fits = names.every((name) => !/[\s,]/.test(name));
  if (key?.form === "string" && fits) return writeKey(text, frontmatter, "tags", key.entry, names.map((name) => (key.hashes ? `#${name}` : name)).join(key.separator));
  if (!key && form === "string" && fits) return writeKey(text, frontmatter, "tags", undefined, names.join(", "));
  // (A string that cannot hold a name: a list in brackets on its line)
  const listForm = !key ? (form === "block" ? "block" : "flow") : key.form === "block" ? "block" : "flow";
  return writeKey(text, frontmatter, "tags", key?.entry, names, { form: listForm, rawItem: (name) => key?.items.find((item) => item.name === name)?.raw });
}

