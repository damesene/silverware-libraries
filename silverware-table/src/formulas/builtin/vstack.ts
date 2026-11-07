import { stacked } from "../grids.ts";
import type { GridFunction } from "../function.ts";

export default {
  name: "VSTACK",
  syntax: "VSTACK(array1, [array2], …)",
  description:
    "The arrays one under another, their columns named as the first one's; a narrower one padded with #N/A, e.g. VSTACK(people![#Data], staff![#Data]) or a total row under a table's rows.",
  category: "lookup",
  example: "=COUNTA(UNIQUE(VSTACK(people![name], staff![name])))",
  minArgs: 1,
  grids: true,
  call: (arrays) => stacked(arrays, false, "VSTACK"),
} satisfies GridFunction;
