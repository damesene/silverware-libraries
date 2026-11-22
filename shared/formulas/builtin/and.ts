import { isError } from "../values.ts";
import { booleans } from "../arguments.ts";
import { ALL_RANGES, type FormulaFunction } from "../function.ts";

export default {
  name: "AND",
  syntax: "AND(logical1, [logical2], …)",
  description: "TRUE if all of the values are true.",
  category: "logic",
  example: "=AND([@paid], [@sent])",
  minArgs: 1,
  argument: ALL_RANGES,
  call: (args) => {
    const bs = booleans(args);
    return isError(bs) ? bs : bs.every(Boolean);
  },
} satisfies FormulaFunction;
