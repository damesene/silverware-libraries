// A grid drawn anew taking over the rendering of the drawing it replaces (its images loaded, its files decorated):
// each cell of the same markdown whole (a cell moved too), and in a cell changed (the one written) each block of the
// same markdown (a paragraph, a list, an embed's line), the rest drawn anew. A write of one cell drew every other
// again: its images and previews flashed, the page under it jumped. Exchanged, not moved: whichever of the two
// drawings the host shows in the end (it may draw a grid twice and show the first) has a whole rendering, and knows
// what it drew (`Drawn`: told as drawn, never taken again from what another may have decorated since).
import type { Drawn } from "./drawn.ts";
import { isMarked, offsetOf, shiftOffsets } from "./ui/offsets.ts";
import { CELL_CONTROLS, drawnBlocks } from "./ui/cellparts.ts";

/** A grid drawn: its element, its cells' markdown, what it drew in them */
export type Drawing = { readonly element: HTMLElement; readonly contents: readonly string[]; readonly drawn: readonly Drawn[] };

/** A block of a cell's rendering: its element (a child of the cell), where its markdown starts in the cell's, its markdown */
type Block = { readonly element: Element; readonly at: number; readonly text: string };

const CELL = ":scope > .swl-grid-cell";
// A cell edited: its field is the editing's, never taken
const EDITING = "swl-grid-editing";

/**
 * The blocks of a cell drawn, by the offsets marked on its children (a paragraph, a list, a heading; the first's 0 may
 * be unmarked): each its markdown, from its offset to the next one's (the cell's end for the last), its blank lines
 * round it left out: those it draws (`drawnBlocks`: not the space between them, nor what the grid puts in the cell).
 * None where another is unmarked (another's drawing): the blocks then unknown
 */
export function blocksOf(cell: HTMLElement, content: string): Block[] {
  const found: { readonly element: Element; readonly at: number }[] = [];
  for (const child of drawnBlocks(cell)) {
    const at = isMarked(child) ? offsetOf(child) : found.length ? NaN : 0;
    if (!Number.isInteger(at) || at < 0 || at > content.length || at < (found.at(-1)?.at ?? 0)) return [];
    found.push({ element: child, at });
  }
  return found.map((block, i) => ({ ...block, text: content.slice(block.at, found[i + 1]?.at ?? content.length).trim() }));
}

/** Two nodes exchanged, each in the other's place (their parents the same or not) */
function exchange(a: Node, b: Node): void {
  const mark = (a.ownerDocument ?? document).createComment("");
  a.parentNode?.replaceChild(mark, a);
  b.parentNode?.replaceChild(a, b);
  mark.parentNode?.replaceChild(b, mark);
}

/**
 * The rendering of `old` taken over by `fresh` where its markdown is the same (what the grid puts in its cells besides
 * their rendering, `CELL_CONTROLS`, each drawing's own); what each drew after it, as the two drawings now hold it
 */
export function takeOver(fresh: Drawing, old: Drawing): { readonly fresh: Drawn[]; readonly old: Drawn[] } {
  const own = (node: Node): boolean => node instanceof Element && node.matches(CELL_CONTROLS);
  const oldCells = [...old.element.querySelectorAll<HTMLElement>(CELL)];
  const freshCells = [...fresh.element.querySelectorAll<HTMLElement>(CELL)];
  let here = [...fresh.drawn];
  let there = [...old.drawn];
  // Each old cell not edited, by its content (the first of those alike taken first)
  const byContent = new Map<string, number[]>();
  old.contents.forEach((content, index) => {
    if (oldCells[index] && !oldCells[index].classList.contains(EDITING)) byContent.set(content, [...(byContent.get(content) ?? []), index]);
  });
  const takenWhole = new Set<number>();
  const changed: number[] = [];
  freshCells.forEach((cell, index) => {
    const content = fresh.contents[index];
    const from = content === undefined ? undefined : byContent.get(content)?.shift();
    if (from === undefined) return void changed.push(index);
    takenWhole.add(from);
    const oldCell = oldCells[from]!;
    const kept = [...oldCell.childNodes].filter((node) => !own(node));
    const drawnAnew = [...cell.childNodes].filter((node) => !own(node));
    cell.replaceChildren(...kept, ...[...cell.childNodes].filter(own));
    oldCell.replaceChildren(...drawnAnew, ...[...oldCell.childNodes].filter(own));
    const mine = here.filter((one) => one.cell === index);
    const theirs = there.filter((one) => one.cell === from);
    here = [...here.filter((one) => one.cell !== index), ...theirs.map((one) => ({ ...one, cell: index }))];
    there = [...there.filter((one) => one.cell !== from), ...mine.map((one) => ({ ...one, cell: from }))];
  });
  // A cell changed: of the old cell at its place (not taken whole, not edited), its blocks of the same markdown
  for (const index of changed) {
    const content = fresh.contents[index];
    const oldContent = old.contents[index];
    const oldCell = oldCells[index];
    const cell = freshCells[index]!;
    if (content === undefined || oldContent === undefined || !oldCell || takenWhole.has(index) || oldCell.classList.contains(EDITING)) continue;
    const oldBlocks = new Map<string, Block[]>();
    for (const block of blocksOf(oldCell, oldContent)) oldBlocks.set(block.text, [...(oldBlocks.get(block.text) ?? []), block]);
    for (const block of blocksOf(cell, content)) {
      const kept = oldBlocks.get(block.text)?.shift();
      if (!kept) continue;
      exchange(kept.element, block.element);
      // Its offsets where its markdown starts now (a click, a task's box, a drop read them), the other's alike
      shiftOffsets(kept.element, block.at - kept.at);
      shiftOffsets(block.element, kept.at - block.at);
      // What each drew goes with it, its offset moved as its block is
      const within = (one: Block) => (drawn: Drawn) => drawn.cell === index && one.element.contains(drawn.element);
      const mine = here.filter(within(block));
      const theirs = there.filter(within(kept));
      here = [...here.filter((one) => !mine.includes(one)), ...theirs.map((one) => ({ ...one, offset: one.offset - kept.at + block.at }))];
      there = [...there.filter((one) => !theirs.includes(one)), ...mine.map((one) => ({ ...one, offset: one.offset - block.at + kept.at }))];
    }
  }
  return { fresh: here, old: there };
}
