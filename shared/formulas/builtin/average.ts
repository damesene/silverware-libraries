import { FormulaError } from "../values.ts";
import { withNumbers } from "../arguments.ts";
import { ALL_RANGES, type FormulaFunction } from "../function.ts";

export default {
  name: "AVERAGE",
  syntax: "AVERAGE(number1, [number2], …)",
  description: "The arithmetic mean of the numbers, or of the times.",
  category: "math",
  example: "=AVERAGE(B1:B3)",
  minArgs: 1,
  argument: ALL_RANGES,
  call: (args) =>
    withNumbers(args, (ns) =>
      ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : new FormulaError("#DIV/0!", "no numbers to average"),
      true,
    ),
} satisfies FormulaFunction;
