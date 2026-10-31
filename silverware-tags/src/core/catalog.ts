// The tags of the space as the index has them: for each tag the pages using
// it, by context. Read anew whenever a dialog opens or a change is applied
// (the index is the space's, it changes without telling).
import type { Space, TagRecord } from "../space/space.ts";
import { isMetaTag, matches } from "../tags/names.ts";

export type TagInfo = {
  readonly name: string;
  // Every page using it, and the pages by context (page, item, task, …)
  readonly pages: ReadonlySet<string>;
  readonly byContext: ReadonlyMap<string, ReadonlySet<string>>;
};

export type Catalog = {
  readonly tags: ReadonlyMap<string, TagInfo>;
  readonly pages: readonly string[];
};

export type CatalogOptions = {
  // SilverBullet's meta pages (a page whose own tag is meta or under it) left out: their tags, the pages themselves
  readonly hideMeta?: boolean;
};

export function catalogOf(records: readonly TagRecord[], pages: readonly string[], options: CatalogOptions = {}): Catalog {
  const hidden = options.hideMeta ? new Set(records.filter((r) => r.parent === "page" && isMetaTag(r.name)).map((r) => r.page)) : new Set<string>();
  const tags = new Map<string, { name: string; pages: Set<string>; byContext: Map<string, Set<string>> }>();
  for (const { name, page, parent } of records) {
    if (hidden.has(page)) continue;
    let info = tags.get(name);
    if (!info) tags.set(name, (info = { name, pages: new Set(), byContext: new Map() }));
    info.pages.add(page);
    let context = info.byContext.get(parent);
    if (!context) info.byContext.set(parent, (context = new Set()));
    context.add(page);
  }
  return { tags, pages: pages.filter((page) => !hidden.has(page)).sort((a, b) => a.localeCompare(b)) };
}

export async function readCatalog(space: Space, options: CatalogOptions = {}): Promise<Catalog> {
  const [records, pages] = await Promise.all([space.tagRecords(), space.pageNames()]);
  return catalogOf(records, pages, options);
}

/** How many pages use each tag */
export function pageCounts(catalog: Catalog): Map<string, number> {
  return new Map([...catalog.tags.values()].map((tag) => [tag.name, tag.pages.size]));
}

/** The pages using a tag (with `children`, or a tag under it), sorted */
export function pagesWith(catalog: Catalog, name: string, children: boolean): string[] {
  const pages = new Set<string>();
  for (const tag of catalog.tags.values()) if (matches(tag.name, name, children)) for (const page of tag.pages) pages.add(page);
  return [...pages].sort((a, b) => a.localeCompare(b));
}

/** The meta pages: those a meta tag is a page's tag of (SilverBullet's own: libraries, templates) */
export function metaPages(catalog: Catalog): Set<string> {
  const pages = new Set<string>();
  for (const tag of catalog.tags.values()) if (isMetaTag(tag.name)) for (const page of tag.byContext.get("page") ?? []) pages.add(page);
  return pages;
}

/** The tags under a tag (not itself) */
export function subtagsOf(catalog: Catalog, name: string): string[] {
  return [...catalog.tags.keys()].filter((tag) => tag.startsWith(`${name}/`)).sort();
}
