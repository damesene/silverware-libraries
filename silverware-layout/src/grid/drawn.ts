// What a grid drew in its cells that another may decorate (shared/rendered.ts: Silverware Assets, a file embedded or
// linked), and where each is in the page's text. Taken as a cell is drawn, before anything else touches it: the host's
// media (<img>, <video>, <audio>, <object>), the place its grid host draws for a file it draws none of
// (`[data-swl-embed]`), its links (<a href>), each with the offset of its markdown in the cell (the host's `data-pos`,
// 0 left out); matched later with the cell's markdown (its embeds and links read there) once the cell's place in the
// page is known.
import { readEmbeds, readLinks } from "../../../shared/markdown/embed.ts";
import type { Grid } from "../../../shared/markdown/grid.ts";
import type { RenderedItem } from "../../../shared/rendered.ts";

const MEDIA = "img, video, audio, object, [data-swl-embed]";
const LINKS = "a[href]";

/** An element drawn in a cell: which cell, what kind, its markdown's offset in the cell */
export type Drawn = { readonly cell: number; readonly kind: "embed" | "link"; readonly element: HTMLElement; readonly offset: number };

/** The media and links drawn in a grid's cells, as the host drew them */
export function drawnIn(grid: HTMLElement): Drawn[] {
  const drawn: Drawn[] = [];
  grid.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell").forEach((cell, index) => {
    for (const [kind, selector] of [["embed", MEDIA], ["link", LINKS]] as const) {
      for (const element of cell.querySelectorAll<HTMLElement>(selector)) drawn.push({ cell: index, kind, element, offset: Number(element.getAttribute("data-pos")) || 0 });
    }
  });
  return drawn;
}

/** An offset's embed or link among those read, exactly there or a character or two off (a rendering may mark the `!`'s neighbour) */
function at<T extends { readonly from: number }>(read: readonly T[], offset: number): T | undefined {
  return read.find((one) => one.from === offset) ?? read.find((one) => Math.abs(one.from - offset) <= 2);
}

/** The items of a grid drawn, its place in the page known (`grid` as the page's text has it); one not found in its cell's markdown left out */
export function itemsOf(element: HTMLElement, drawn: readonly Drawn[], grid: Grid): RenderedItem[] {
  const cells = [...element.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell")];
  const read = new Map<number, { readonly embeds: ReturnType<typeof readEmbeds>; readonly links: ReturnType<typeof readLinks> }>();
  const items: RenderedItem[] = [];
  for (const one of drawn) {
    const cell = grid.cells[one.cell];
    const room = cells[one.cell];
    if (!cell || !room || !one.element.isConnected) continue;
    if (!read.has(one.cell)) read.set(one.cell, { embeds: readEmbeds(cell.content), links: readLinks(cell.content) });
    const marks = read.get(one.cell)!;
    const found = one.kind === "embed" ? at(marks.embeds, one.offset) : at(marks.links, one.offset);
    if (!found) continue;
    items.push({ kind: one.kind, element: one.element, target: found.target, style: found.style, position: cell.contentFrom + found.from, room });
  }
  return items;
}
