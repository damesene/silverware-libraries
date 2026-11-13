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
