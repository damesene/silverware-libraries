// Wrap in grid (docs/silverware-layout-grid.md, *Building a grid from the page*): the blocks the selection touches
// (none selected: the block at the cursor) put into a grid by a mode, the user asked the mode where it is not given (a
// toolbar's button gives it) and the number of columns. The blocks are read and the grid written by the page writer
// (`grids.put`, shared/markdown/gridbuild.ts); what is asked of the host is here.
import { readGrids } from "../../../shared/markdown/grid.ts";
import { blocksIn, type GridColumns, type GridMode, type GridPlace, type MoveMode } from "../../../shared/markdown/gridbuild.ts";
import { MAX_COLUMNS } from "./model/columns.ts";

/** What putting into a grid asks of the host */
export type PutHost = {
  /** The selection now (the cursor: from = to) */
  selection(): Promise<{ readonly from: number; readonly to: number }>;
  pageText(): Promise<string>;
  /** One of the options picked (its index), none where the user picked none */
  pick(label: string, options: readonly { readonly name: string; readonly description: string }[]): Promise<number | undefined>;
  /** The blocks of a range put into a grid (one edit); why not, as text */
  put(from: number, to: number, was: string, mode: GridMode, columns: GridColumns): Promise<string | undefined>;
  problem(message: string): void;
};

export const GRID_MODES: readonly { readonly mode: GridMode; readonly name: string; readonly description: string }[] = [
  { mode: "gallery", name: "Gallery", description: "Each block a cell of its own, as many to a row as there are columns" },
  { mode: "split", name: "Split", description: "The blocks in order, cut into columns by their number" },
];
// (2 to as many as a grid's menu offers)
const COLUMNS: readonly number[] = Array.from({ length: MAX_COLUMNS - 1 }, (_, i) => i + 2);

/** The blocks selected put into a grid: the mode asked where none is given, then the number of columns */
export async function wrapInGrid(host: PutHost, given?: { readonly mode?: GridMode; readonly from?: number; readonly to?: number }): Promise<void> {
  const [text, selected] = await Promise.all([host.pageText(), given?.from !== undefined && given.to !== undefined ? { from: given.from, to: given.to } : host.selection()]);
  const blocks = blocksIn(text, selected.from, selected.to, readGrids(text));
  if (!blocks.length) return host.problem("Silverware Layout: no block to wrap in a grid here (select paragraphs, list items, images…; not a grid)");
  let mode = given?.mode;
  if (!mode) {
    const picked = await host.pick(`Wrap ${blocks.length} block${blocks.length === 1 ? "" : "s"} in a grid`, GRID_MODES);
    if (picked === undefined) return;
    mode = GRID_MODES[picked]!.mode;
  }
  // (A gallery's first: as many to a row as fit, an image gallery's)
  const choices: readonly GridColumns[] = mode === "gallery" ? ["auto", ...COLUMNS] : COLUMNS;
  const options = choices.map((n) =>
    n === "auto"
      ? { name: "Auto", description: "As many to a row as fit, each as wide as the others" }
      : { name: `${n} columns`, description: mode === "gallery" ? `${n} to a row` : `${blocks.length} blocks cut into ${Math.min(n, blocks.length)}` },
  );
  const picked = await host.pick("How many columns", options);
  if (picked === undefined) return;
  const from = blocks[0]!.from;
  const to = blocks.at(-1)!.to;
  const problem = await host.put(from, to, text.slice(from, to), mode, choices[picked]!);
  if (problem) host.problem(`Silverware Layout: not wrapped in a grid: ${problem}`);
}

/** Whether a value is a mode (a toolbar button's parameter, a command's argument) */
export const isGridMode = (value: unknown): value is GridMode => value === "gallery" || value === "split";

/** What moving into a grid asks of the grids drawn (src/grid/grids.ts) */
export type MoveGrids = {
  pickPlace(into: boolean, cells: number, what: string): Promise<{ readonly grid: HTMLElement; readonly place: GridPlace } | undefined>;
  moveInto(source: { readonly from: number; readonly to: number; readonly was: string }, mode: MoveMode, picked: { readonly grid: HTMLElement; readonly place: GridPlace }): void;
};

export const MOVE_MODES: readonly { readonly mode: MoveMode; readonly name: string; readonly description: string }[] = [
  { mode: "together", name: "Together", description: "All of it in one cell: a new one, or added to a cell" },
  { mode: "each", name: "A cell each", description: "Each block a new cell of its own" },
];

/**
 * Move to grid (docs/silverware-layout-grid.md, *Moving text into a grid*): the blocks the selection touches (none
 * selected: the block at the cursor) moved into a grid of the page, together or a cell each (asked where there are
 * several and no mode is given), at the place the user picks in a grid; one edit
 */
export async function moveIntoGrid(host: Omit<PutHost, "put">, grids: MoveGrids, given?: { readonly mode?: MoveMode; readonly from?: number; readonly to?: number }): Promise<void> {
  const [text, selected] = await Promise.all([host.pageText(), given?.from !== undefined && given.to !== undefined ? { from: given.from, to: given.to } : host.selection()]);
  const all = readGrids(text);
  const blocks = blocksIn(text, selected.from, selected.to, all);
  if (!blocks.length) return host.problem("Silverware Layout: no block to move into a grid here (select paragraphs, list items, images…; not a grid)");
  const from = blocks[0]!.from;
  const to = blocks.at(-1)!.to;
  if (all.some((grid) => grid.from < to && grid.to > from)) return host.problem("Silverware Layout: the selection takes in a grid: select the text above it or below it");
  // (By the page's text: the host draws a grid only as it is scrolled to)
  if (!all.length) return host.problem("Silverware Layout: there is no grid on this page to move the text into (Wrap in grid makes one)");
  let mode = given?.mode ?? (blocks.length === 1 ? "together" : undefined);
  if (!mode) {
    const picked = await host.pick(`Move ${blocks.length} blocks to a grid`, MOVE_MODES);
    if (picked === undefined) return;
    mode = MOVE_MODES[picked]!.mode;
  }
  const what = blocks.length === 1 ? "the block" : `${blocks.length} blocks`;
  const picked = await grids.pickPlace(mode === "together", mode === "each" ? blocks.length : 1, what);
  if (picked) grids.moveInto({ from, to, was: text.slice(from, to) }, mode, picked);
}

/** Whether a value is a mode of moving into a grid (a toolbar button's parameter) */
export const isMoveMode = (value: unknown): value is MoveMode => value === "together" || value === "each";
