// The page writer's parts: each one form in a page's content, its kinds of
// change, what a plugin asks of it (its section of the builder, `p.properties`,
// `p.tags`) and how that is written in the text. The builder (changes.ts)
// makes its sections and the writer (writer.ts) writes the changes by this
// registry alone, so a part is added here, its types included, and nowhere
// else. Built in only for now (decided 2026-11-07); another plugin's part
// would be registered the same way, its types added to `PageChange` and
// `PageSections` (TypeScript's interface merging for the latter).
import type { PageBuilder } from "./changes.ts";
import { type FrontmatterValue, readFrontmatter, readKey, validateFrontmatterKey, writeKey, type YamlScalar } from "./frontmatter.ts";
import { addPageTags, applyEdits, type EditResult, removeTags, type RemoveHow, renameTags } from "./tags/edit.ts";
import type { FrontmatterForm } from "./tags/frontmatter.ts";
import { isWithin, matches, renamedTag } from "./tags/names.ts";
import type { TagContext } from "./tags/scan.ts";

/** A property's value: a scalar, or a list of them */
export type PropertyValue = YamlScalar | readonly YamlScalar[];

/** Where tags are taken off a page: its own tags (SilverBullet's page tags), the hashtags in its body, or both */
export type TagsFrom = "pageTags" | "body" | "both";

export type TagsRemoval = {
  // With the tags under each (`project` takes `project/alpha` too)
  readonly subtags?: boolean;
  readonly from?: TagsFrom;
  // A hashtag in the body leaves its word, only the # going (`#<two words>`: two words)
  readonly keepWord?: boolean;
};

/** One change of a page's content, of a kind a part below writes */
export type PageChange =
  | { readonly kind: "setProperty"; readonly key: string; readonly value: PropertyValue }
  | { readonly kind: "removeProperty"; readonly key: string }
  | { readonly kind: "renameTags"; readonly tags: readonly string[]; readonly into: string; readonly subtags: boolean }
  | { readonly kind: "removeTags"; readonly tags: readonly string[]; readonly subtags: boolean; readonly from: TagsFrom; readonly keepWord: boolean }
  | { readonly kind: "addTags"; readonly tags: readonly string[] }
  // A user's script editing the text itself (Silverware Tags' custom operations): the one way past the model
  | { readonly kind: "editText"; readonly edit: (text: string) => EditResult | Promise<EditResult> };

/** The builder's sections, one per part of a page's content (their parts below make them); every method gives the page's builder back */
export interface PageSections {
  readonly properties: {
    set(key: string, value: PropertyValue): PageBuilder;
    remove(key: string): PageBuilder;
  };
  readonly tags: {
    /** A tag renamed everywhere on the page (the page's own tags and its body); into a name it has, the two merge */
    rename(from: string, to: string, options?: { readonly subtags?: boolean }): PageBuilder;
    /** Several tags renamed into one */
    merge(tags: readonly string[], into: string, options?: { readonly subtags?: boolean }): PageBuilder;
    /** Tags taken off (by default from everywhere, the hashtag taken out of the body whole) */
    remove(tags: string | readonly string[], options?: TagsRemoval): PageBuilder;
    /** Tags given to the page as its own, those it has left out */
    add(tags: string | readonly string[]): PageBuilder;
  };
}

export type WriterOptions = {
  // How a page's tags are written where it has none yet
  readonly newTagsForm?: FrontmatterForm;
};

type Kind = PageChange["kind"];
type ChangeOf<K extends Kind> = Extract<PageChange, { kind: K }>;

/** A part: the kinds of change it writes, how, and the builder's section that makes them (none: a page's own method) */
export type Part = {
  readonly kinds: readonly Kind[];
  readonly section?: { readonly name: keyof PageSections; readonly make: (add: (change: PageChange) => PageBuilder) => unknown };
  readonly write: (text: string, change: PageChange, options: WriterOptions) => EditResult | Promise<EditResult>;
};

/** A part made with its types checked: its section gives only its kinds, its write gets only them */
function part<K extends Kind, N extends keyof PageSections>(definition: {
  readonly kinds: readonly K[];
  readonly section?: { readonly name: N; readonly make: (add: (change: ChangeOf<K>) => PageBuilder) => PageSections[N] };
  readonly write: (text: string, change: ChangeOf<K>, options: WriterOptions) => EditResult | Promise<EditResult>;
}): Part {
  return definition as unknown as Part;
}

const list = (tags: string | readonly string[]) => (typeof tags === "string" ? [tags] : [...tags]);

/** A property's change: the key written in the page's frontmatter in the form it has */
function propertyEdit(text: string, key: string, value: FrontmatterValue | undefined): EditResult {
  const problem = validateFrontmatterKey(key) ?? (key === "tags" ? "tags are no property: change them as tags" : undefined);
  if (problem) return { text, changes: 0, problem };
  const frontmatter = readFrontmatter(text);
  const { entry, unreadable } = readKey(text, frontmatter, key);
  if (unreadable) return { text, changes: 0, problem: `${unreadable}: left alone` };
  const edit = writeKey(text, frontmatter, key, entry, value);
  return edit ? { text: applyEdits(text, [edit]), changes: 1 } : { text, changes: 0 };
}

/**
 * A name renamed by a merge of `tags` into `into`: the first tag it is (or,
 * with subtags, is under) gives it its new name; tags under `into` where
 * `into` is under one of them stay as they are (`a` into `a/x`: `a/x/y` is
 * not moved on to `a/x/x/y`)
 */
function renamedBy(tags: readonly string[], into: string, subtags: boolean): (name: string) => string | undefined {
  return (name) => {
    for (const from of tags) {
      if (from === into) continue;
      if (isWithin(into, from) && isWithin(name, into)) return undefined;
      const to = renamedTag(name, from, into, subtags);
      if (to !== undefined) return to;
    }
    return undefined;
  };
}

// The hashtags of a page's body (every context but its own tags' lines)
const BODY: ReadonlySet<TagContext> = new Set(["paragraph", "item", "task", "table", "heading"]);

const removeHow = (from: TagsFrom, keepWord: boolean): RemoveHow =>
  from === "body" ? { frontmatter: false, contexts: BODY, keepWord } : from === "pageTags" ? { contexts: new Set<TagContext>(["page"]) } : { keepWord };

export const PARTS: readonly Part[] = [
  part({
    kinds: ["setProperty", "removeProperty"],
    section: {
      name: "properties",
      make: (add) => ({
        set: (key, value) => add({ kind: "setProperty", key, value: Array.isArray(value) ? [...value] : value }),
        remove: (key) => add({ kind: "removeProperty", key }),
      }),
    },
    write: (text, change) => propertyEdit(text, change.key, change.kind === "setProperty" ? change.value : undefined),
  }),
  part({
    kinds: ["renameTags", "removeTags", "addTags"],
    section: {
      name: "tags",
      make: (add) => ({
        rename: (from, to, options) => add({ kind: "renameTags", tags: [from], into: to, subtags: options?.subtags ?? false }),
        merge: (tags, into, options) => add({ kind: "renameTags", tags: [...tags], into, subtags: options?.subtags ?? false }),
        remove: (tags, options) =>
          add({ kind: "removeTags", tags: list(tags), subtags: options?.subtags ?? false, from: options?.from ?? "both", keepWord: options?.keepWord ?? false }),
        add: (tags) => add({ kind: "addTags", tags: list(tags) }),
      }),
    },
    write: (text, change, options) =>
      change.kind === "renameTags"
        ? renameTags(text, renamedBy(change.tags, change.into, change.subtags))
        : change.kind === "removeTags"
          ? removeTags(text, (name) => change.tags.some((tag) => matches(name, tag, change.subtags)), removeHow(change.from, change.keepWord))
          : addPageTags(text, change.tags, options.newTagsForm ?? "flow"),
  }),
  // A user's script editing the text itself: the page builder's own `editText`, no section
  part({ kinds: ["editText"], write: (text, change) => change.edit(text) }),
];

const partOf = new Map(PARTS.flatMap((one) => one.kinds.map((kind) => [kind, one] as const)));

/** One change applied to a page's text, by the part that writes its kind */
export async function written(text: string, change: PageChange, options: WriterOptions): Promise<EditResult> {
  const one = partOf.get(change.kind);
  if (!one) throw new Error(`no part writes a change of the kind ${change.kind}`);
  return one.write(text, change, options);
}
