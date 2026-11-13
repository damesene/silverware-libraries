// The hashtags in a page's grids, where they are in the page (docs/silverware-layout-grid.md, *Indexing*): SilverBullet's
// index does not see into a grid, so what it would find there is found here, for the host to index as it indexes a
// hashtag (its tags known, completed, queried). Each cell's markdown read as SilverBullet reads a page's
// (shared/pages/tags/scan.ts: a task's, an item's, a table's, a heading's, a paragraph's), and its paragraphs holding
// one (not in a list's item), as its index keeps a paragraph with a hashtag. Pure.
import { readGrids } from "../../../../shared/markdown/grid.ts";
import { type MarkdownNode, parseBlocks } from "../../../../shared/markdown/parse.ts";
import { scanHashtags, type TagContext } from "../../../../shared/pages/tags/scan.ts";

/** A hashtag in a grid: its name, its context */
export type GridTag = { readonly name: string; readonly context: TagContext };

/** A paragraph in a grid holding hashtags: where it is in the page, its text, its hashtags' names */
export type GridParagraph = { readonly from: number; readonly to: number; readonly text: string; readonly tags: readonly string[] };

/** The hashtags of the page's grids, and their paragraphs, in the page's order */
export function gridTags(text: string): { readonly tags: readonly GridTag[]; readonly paragraphs: readonly GridParagraph[] } {
  const tags: GridTag[] = [];
  const paragraphs: GridParagraph[] = [];
  for (const grid of readGrids(text)) {
    for (const cell of grid.cells) {
      const markdown = text.slice(cell.contentFrom, cell.contentTo);
      const found = scanHashtags(markdown, 0);
      tags.push(...found.map((tag) => ({ name: tag.name, context: tag.context })));
      for (const paragraph of topParagraphs(parseBlocks(markdown))) {
        const own = found.filter((tag) => tag.from >= paragraph.from && tag.to <= paragraph.to);
        if (own.length) paragraphs.push({ from: cell.contentFrom + paragraph.from, to: cell.contentFrom + paragraph.to, text: markdown.slice(paragraph.from, paragraph.to), tags: [...new Set(own.map((tag) => tag.name))] });
      }
    }
  }
  return { tags, paragraphs };
}

/** The paragraphs not in a list's item (a quote's too), as SilverBullet's index reads them */
function topParagraphs(nodes: readonly MarkdownNode[]): Extract<MarkdownNode, { kind: "paragraph" }>[] {
  return nodes.flatMap((node) => (node.kind === "paragraph" ? [node] : node.kind === "quote" ? topParagraphs(node.children) : []));
}
