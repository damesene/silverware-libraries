import { FormulaError, isError, single, toBoolean } from "../values.ts";
import type { FormulaFunction } from "../function.ts";

export default {
  name: "IFS",
  syntax: "IFS(condition1, value1, [condition2, value2], …)",
  description: "The value of the first condition that is true; #N/A where none is (TRUE as the last condition gives a default).",
  category: "logic",
  example: '=IFS([@score] >= 90, "A", [@score] >= 75, "B", TRUE, "C")',
  minArgs: 2,
  maxArgs: 254,
  call: (args) => {
    if (args.length % 2 !== 0) return new FormulaError("#N/A", "IFS takes its conditions and values in pairs: one is missing its value");
    for (let at = 0; at < args.length; at += 2) {
      const condition = toBoolean(args[at]!);
      if (isError(condition)) return condition;
      if (condition) return single(args[at + 1]!);
    }
    return new FormulaError("#N/A", "no condition of IFS is true: add TRUE and a value last for every other case");
  },
} satisfies FormulaFunction;
