// Where a point over a grid puts what is moved into it (Move into existing grid, docs/silverware-layout-grid.md *Moving text
// into a grid*): new cells before or after the cell nearest it (the half it is in; only near the cell's edge where the
// text may go into the cell too), or into that cell where its blocks meet (the boundary nearest it). Pure, on boxes
// measured by the picker (ui/placepicker.ts): what is put where, and where its mark is drawn.
import type { GridPlace } from "../../../../shared/markdown/gridbuild.ts";

export type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** A cell as drawn: its box, and its blocks' (each its offset in the cell's markdown) in order */
export type CellShape = { readonly box: Box; readonly blocks: readonly { readonly offset: number; readonly box: Box }[] };

/** A grid as drawn: its box, its cells, whether its cells stand side by side (else one under another), its gaps */
export type GridShape = { readonly box: Box; readonly cells: readonly CellShape[]; readonly sideBySide: boolean; readonly columnGap: number; readonly rowGap: number };

/** Where it goes, and its mark: a line between cells (`vertical` between cells side by side), or a line in a cell where the blocks meet */
export type PickedPlace = {
  readonly place: GridPlace;
  readonly mark: { readonly kind: "between"; readonly vertical: boolean; readonly from: number; readonly to: number; readonly at: number } | { readonly kind: "inside"; readonly cell: number; readonly at: number; readonly from: number; readonly to: number };
};

/** An offset past any cell's end: into a cell at its end */
export const CELL_END = Number.MAX_SAFE_INTEGER;
// How near a cell's edge a point puts new cells there where it may go into the cell too (px, and at most this share of it)
const EDGE_PX = 32;
const EDGE_SHARE = 0.25;
// How far outside a grid a point still picks in it (px)
export const NEAR_PX = 16;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);
const distance = (box: Box, x: number, y: number) => Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));

/** How far a point is from a box (0: over it); within `NEAR_PX` of a grid it picks in it */
export const distanceTo = (box: Box, x: number, y: number): number => distance(box, x, y);

/** What a point over a grid picks; `into`: whether it may go into a cell (else new cells alone) */
export function pickAt(grid: GridShape, x: number, y: number, into: boolean): PickedPlace {
  const { cells } = grid;
  if (!cells.length) {
    const middle = (grid.box.top + grid.box.bottom) / 2;
    return { place: { kind: "cells", at: 0 }, mark: { kind: "between", vertical: false, at: middle, from: grid.box.left, to: grid.box.right } };
  }
  let index = 0;
  cells.forEach((cell, i) => {
    if (distance(cell.box, x, y) < distance(cells[index]!.box, x, y)) index = i;
  });
  const box = cells[index]!.box;
  const [start, end, at] = grid.sideBySide ? [box.left, box.right, clamp(x, box.left, box.right)] : [box.top, box.bottom, clamp(y, box.top, box.bottom)];
  const size = end - start;
  const edge = into ? Math.min(EDGE_PX, size * EDGE_SHARE) : size / 2;
  const before = at - start < edge;
  const after = !before && (into ? end - at < edge : true);
  if (before || after) {
    const gap = (grid.sideBySide ? grid.columnGap : grid.rowGap) / 2;
    const [low, high] = grid.sideBySide ? [grid.box.left, grid.box.right] : [grid.box.top, grid.box.bottom];
    const line = clamp(before ? start - gap : end + gap, low, high);
    const [from, to] = grid.sideBySide ? [box.top, box.bottom] : [box.left, box.right];
    return { place: { kind: "cells", at: before ? index : index + 1 }, mark: { kind: "between", vertical: grid.sideBySide, at: line, from, to } };
  }
  return inside(cells[index]!, index, clamp(y, box.top, box.bottom));
}

/** Into a cell where its blocks meet nearest a height: before its first, between two, after its last (an empty cell: its middle) */
function inside(cell: CellShape, index: number, y: number): PickedPlace {
  const { box, blocks } = cell;
  const mark = (at: number) => ({ kind: "inside" as const, cell: index, at, from: box.left, to: box.right });
  if (!blocks.length) return { place: { kind: "cell", cell: index, at: CELL_END }, mark: mark((box.top + box.bottom) / 2) };
  const meets = [
    { offset: 0, at: blocks[0]!.box.top },
    ...blocks.slice(1).map((block, i) => ({ offset: block.offset, at: (blocks[i]!.box.bottom + block.box.top) / 2 })),
    { offset: CELL_END, at: blocks.at(-1)!.box.bottom },
  ];
  let nearest = meets[0]!;
  for (const one of meets) if (Math.abs(one.at - y) < Math.abs(nearest.at - y)) nearest = one;
  return { place: { kind: "cell", cell: index, at: nearest.offset }, mark: mark(nearest.at) };
}

/** Whether two picks are the same (a second tap on one confirms it) */
export const samePick = (a: PickedPlace | undefined, b: PickedPlace | undefined): boolean =>
  !!a && !!b && a.place.kind === b.place.kind && a.place.at === b.place.at && (a.place.kind === "cells" || (b.place.kind === "cell" && a.place.cell === b.place.cell));
