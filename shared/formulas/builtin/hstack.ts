import { stacked } from "../grids.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "HSTACK",
  syntax: "HSTACK(array1, [array2], …)",
  description:
    "The arrays side by side, each keeping its columns' names; a shorter one padded with #N/A, e.g. HSTACK(tasks![name], tasks![due]) or a column calculated beside a table's.",
  category: "lookup",
  example: '=TEXTJOIN(" ", TRUE, TAKE(HSTACK(tasks![name], tasks![due]), 1))',
  minArgs: 1,
  grids: true,
  call: (arrays) => stacked(arrays, true, "HSTACK"),
} satisfies GridFunction;
