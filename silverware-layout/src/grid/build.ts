// Put into grid (docs/silverware-layout-grid.md, *Building a grid from the page*): the blocks the selection touches
// (none selected: the block at the cursor) put into a grid by a mode, the user asked the mode where it is not given (a
// toolbar's button gives it) and the number of columns. The blocks are read and the grid written by the page writer
// (`grids.put`, shared/markdown/gridbuild.ts); what is asked of the host is here.
import { readGrids } from "../../../shared/markdown/grid.ts";
import { blocksIn, type GridMode } from "../../../shared/markdown/gridbuild.ts";

/** What putting into a grid asks of the host */
export type PutHost = {
  /** The selection now (the cursor: from = to) */
  selection(): Promise<{ readonly from: number; readonly to: number }>;
  pageText(): Promise<string>;
  /** One of the options picked (its index), none where the user picked none */
  pick(label: string, options: readonly { readonly name: string; readonly description: string }[]): Promise<number | undefined>;
  /** The blocks of a range put into a grid (one edit); why not, as text */
  put(from: number, to: number, was: string, mode: GridMode, columns: number): Promise<string | undefined>;
  problem(message: string): void;
};

export const GRID_MODES: readonly { readonly mode: GridMode; readonly name: string; readonly description: string }[] = [
  { mode: "gallery", name: "Gallery", description: "Each block a cell of its own, as many to a row as there are columns" },
  { mode: "split", name: "Split", description: "The blocks in order, cut into columns by their number" },
];
const COLUMNS = [2, 3, 4];

/** The blocks selected put into a grid: the mode asked where none is given, then the number of columns */
export async function putIntoGrid(host: PutHost, given?: { readonly mode?: GridMode; readonly from?: number; readonly to?: number }): Promise<void> {
  const [text, selected] = await Promise.all([host.pageText(), given?.from !== undefined && given.to !== undefined ? { from: given.from, to: given.to } : host.selection()]);
  const blocks = blocksIn(text, selected.from, selected.to, readGrids(text));
  if (!blocks.length) return host.problem("Silverware Layout: no block to put into a grid here (select paragraphs, list items, images…; not a grid)");
  let mode = given?.mode;
  if (!mode) {
    const picked = await host.pick(`Put ${blocks.length} block${blocks.length === 1 ? "" : "s"} into a grid`, GRID_MODES);
    if (picked === undefined) return;
    mode = GRID_MODES[picked]!.mode;
  }
  const options = COLUMNS.map((n) => ({ name: `${n} columns`, description: mode === "gallery" ? `${n} to a row` : `${blocks.length} blocks cut into ${Math.min(n, blocks.length)}` }));
  const picked = await host.pick("How many columns", options);
  if (picked === undefined) return;
  const from = blocks[0]!.from;
  const to = blocks.at(-1)!.to;
  const problem = await host.put(from, to, text.slice(from, to), mode, COLUMNS[picked]!);
  if (problem) host.problem(`Silverware Layout: not put into a grid: ${problem}`);
}

/** Whether a value is a mode (a toolbar button's parameter, a command's argument) */
export const isGridMode = (value: unknown): value is GridMode => value === "gallery" || value === "split";
