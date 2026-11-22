import { flatten } from "../values.ts";
import { ALL_RANGES, type FormulaFunction } from "../function.ts";

export default {
  name: "COUNTA",
  syntax: "COUNTA(value1, [value2], …)",
  description: "How many of the values are not empty.",
  category: "math",
  example: "=COUNTA([name])",
  minArgs: 1,
  argument: ALL_RANGES,
  call: (args) => flatten(args).filter((v) => v !== null && v !== "").length,
} satisfies FormulaFunction;
