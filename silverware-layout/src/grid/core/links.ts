// The links and embeds in a page's grids, where they are in the page (docs/silverware-layout-grid.md, *Indexing*):
// SilverBullet's index does not see into a grid (its custom syntax's body has no children), so what it would have
// found there is found here, for the host to index (its backlinks, its rename of a page or an attachment). Pure.
//
// Wiki links and embeds (`[[Page]]`, `![[cat.png|Cat|120]]`) as SilverBullet reads them (shared/markdown/inline.ts),
// and markdown links and images to a local target (`[x](Other.md)`, `![](cat.png)`), resolved from the page's folder
// as SilverBullet resolves them; a link's target named by its page (its `#header`, `@position` or `$anchor` left out)
// or document (a file of another extension). Not in a fenced code block or a code span.
import { readGrids } from "../../../../shared/markdown/grid.ts";
import { inlineMarks } from "../../../../shared/markdown/inline.ts";
import { nextFence } from "../../../../shared/markdown/lines.ts";

/** A link in a grid: what it points to (a page's name or a document's path), where it is in the page */
export type GridLink = {
  readonly to: string;
  readonly toTag: "page" | "document";
  readonly from: number;
  readonly end: number;
  readonly alias?: string;
  // The line it is on, as a snippet
  readonly line: string;
};

const MD_LINK = /!?\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const CODE_SPAN = /`+[^`\n]*`+/g;

/** A target's page or document: its path without what names a place in it, `.md` off a page */
export function targetOf(name: string): { readonly to: string; readonly toTag: "page" | "document" } | undefined {
  const path = name.split(/[#@$]/, 1)[0]!.replace(/^\//, "").trim();
  if (!path) return undefined;
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase();
  if (!ext || ext === "md") return { to: ext === "md" ? path.slice(0, -3) : path, toTag: "page" };
  return { to: path, toTag: "document" };
}

/** A markdown link's local URL resolved from the page's folder, as SilverBullet resolves one (`../x`, `./x`) */
export function resolveFrom(page: string, url: string): string {
  if (url.startsWith("/")) return url.slice(1);
  const parts = page.split("/").slice(0, -1);
  for (const part of url.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

/** The links of the page's grids, in the page's order */
export function gridLinks(page: string, text: string): GridLink[] {
  const links: GridLink[] = [];
  for (const grid of readGrids(text)) {
    for (const cell of grid.cells) {
      let fence: string | undefined;
      let at = cell.contentFrom;
      for (const raw of text.slice(cell.contentFrom, cell.contentTo).split("\n")) {
        const line = raw.replace(/\r$/, "");
        const before = fence;
        fence = nextFence(line, fence);
        if (before === undefined && fence === undefined) links.push(...linksOfLine(page, line, at));
        at += raw.length + 1;
      }
    }
  }
  return links;
}

/** A line's links, at `at` in the page */
function linksOfLine(page: string, line: string, at: number): GridLink[] {
  const found: GridLink[] = [];
  for (const mark of inlineMarks(line)) {
    if (mark.kind !== "link") continue;
    const target = targetOf(mark.name);
    if (target) found.push({ ...target, from: at + mark.from, end: at + mark.to, ...(mark.alias ? { alias: mark.alias } : {}), line });
  }
  // Markdown links to a local target, not in a code span
  const code = [...line.matchAll(CODE_SPAN)].map((m) => [m.index!, m.index! + m[0].length] as const);
  for (const m of line.matchAll(MD_LINK)) {
    const url = m[2]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || code.some(([from, to]) => m.index! >= from && m.index! < to)) continue;
    let decoded = url;
    try {
      decoded = decodeURI(url);
    } catch {
      // (A URL not encoded right: as written)
    }
    const target = targetOf(resolveFrom(page, decoded));
    if (target) found.push({ ...target, from: at + m.index!, end: at + m.index! + m[0].length, ...(m[1] ? { alias: m[1] } : {}), line });
  }
  return found.sort((a, b) => a.from - b.from);
}
