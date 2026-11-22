import { withNumbers } from "../arguments.ts";
import { ALL_RANGES, type FormulaFunction } from "../function.ts";

export default {
  name: "PRODUCT",
  syntax: "PRODUCT(number1, [number2], …)",
  description: "Multiplies the numbers.",
  category: "math",
  example: "=PRODUCT([@qty], [@price])",
  minArgs: 1,
  argument: ALL_RANGES,
  call: (args) => withNumbers(args, (ns) => ns.reduce((a, b) => a * b, 1)),
} satisfies FormulaFunction;
