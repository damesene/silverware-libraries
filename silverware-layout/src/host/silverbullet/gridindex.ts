// A grid's links as SilverBullet's index keeps a link (docs/silverware-layout-grid.md, *Indexing*): the relations its
// index makes of a link outside a grid (`plugs/index/relation.ts`, `emitTextualEdge`, 2.12.1), so its backlinks and its
// rename of a page or an attachment see the links in a grid too (probed 2026-11-13: a rename updated a grid's link
// indexed so). Only here: the shape is SilverBullet's. The links are the grid's to find (src/grid/core/links.ts).

/** A link found in a grid (src/grid/core/links.ts' `GridLink`, named here apart: the host knows no area) */
type Link = { readonly to: string; readonly toTag: "page" | "document"; readonly from: number; readonly end: number; readonly alias?: string; readonly line: string };

/** The index's objects for a page's grid links: a relation each, as SilverBullet's index makes one */
export function gridRelations(page: string, links: readonly Link[], lastModified?: unknown): Record<string, unknown>[] {
  return links.map((link) => ({
    ref: `${page}@${link.from}`,
    tag: "relation",
    kind: "mention",
    from: page,
    fromTag: "page",
    to: link.to,
    toTag: link.toTag,
    page,
    range: [link.from, link.end],
    snippet: link.line.trim(),
    ...(lastModified === undefined || lastModified === null ? {} : { pageLastModified: lastModified }),
    ...(link.alias ? { alias: link.alias } : {}),
  }));
}

/** A hashtag found in a grid and a paragraph holding some (src/grid/core/tags.ts' `GridTag`, `GridParagraph`) */
type Tag = { readonly name: string; readonly context: "page" | "paragraph" | "item" | "task" | "table" | "heading" };
type Paragraph = { readonly from: number; readonly to: number; readonly text: string; readonly tags: readonly string[] };

// A hashtag's parent as SilverBullet's index names it (2.12.1: a task's, an item's, else the page's; its main a table's
// and a heading's of their own)
const PARENT: Readonly<Record<Tag["context"], string>> = { page: "page", paragraph: "page", item: "item", task: "task", table: "table", heading: "header" };

/**
 * The index's objects for a page's grid hashtags, as SilverBullet's index makes them (`plugs/index/tags.ts`,
 * `paragraph.ts`, 2.12.1): a tag each of a name and a parent (`<name>:<parent>`, the same object SilverBullet makes of
 * one outside a grid), and a paragraph each holding some, its tags its own
 */
export function gridTagObjects(page: string, tags: readonly Tag[], paragraphs: readonly Paragraph[]): Record<string, unknown>[] {
  const named = new Map<string, Record<string, unknown>>();
  for (const tag of tags) {
    const parent = PARENT[tag.context];
    named.set(`${tag.name}:${parent}`, { ref: `${tag.name}:${parent}`, tag: "tag", name: tag.name, page, parent });
  }
  return [
    ...named.values(),
    ...paragraphs.map((paragraph) => ({ ref: `${page}@${paragraph.from}`, tag: "paragraph", text: paragraph.text, page, pos: paragraph.from, range: [paragraph.from, paragraph.to], tags: [...paragraph.tags], itags: [...paragraph.tags] })),
  ];
}
