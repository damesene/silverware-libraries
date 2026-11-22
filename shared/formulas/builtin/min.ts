import { extremeDate, withNumbers } from "../arguments.ts";
import { ALL_RANGES, type FormulaFunction } from "../function.ts";

export default {
  name: "MIN",
  syntax: "MIN(number1, [number2], …)",
  description: "The smallest of the numbers (0 if there are none), the shortest of the times, or the earliest of the dates.",
  category: "math",
  example: "=MIN([price])",
  minArgs: 1,
  argument: ALL_RANGES,
  call: (args) => extremeDate(args, false) ?? withNumbers(args, (ns) => (ns.length ? Math.min(...ns) : 0), true),
} satisfies FormulaFunction;
