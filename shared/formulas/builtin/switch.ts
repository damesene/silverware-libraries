import { compareValues } from "../compare.ts";
import { FormulaError, isError, single } from "../values.ts";
import type { FormulaFunction } from "../function.ts";

export default {
  name: "SWITCH",
  syntax: "SWITCH(value, case1, result1, [case2, result2], …, [default])",
  description: "The result of the first case equal to the value (compared as = compares), else the default; #N/A without one.",
  category: "logic",
  example: '=SWITCH([@status], "Done", "✓", "Doing", "…", "—")',
  minArgs: 3,
  maxArgs: 254,
  // (Its value decides; its cases are compared with it place by place where it is a list, its results and default chosen)
  argument: (at) => (at === 0 ? "value" : "branch"),
  call: ([value, ...rest]) => {
    const v = single(value!);
    if (isError(v)) return v;
    const pairs = Math.floor(rest.length / 2);
    for (let at = 0; at < pairs; at++) {
      const match = single(rest[at * 2]!);
      if (isError(match)) return match;
      if (compareValues(v, match) === 0) return single(rest[at * 2 + 1]!);
    }
    return rest.length % 2 === 1 ? single(rest[rest.length - 1]!) : new FormulaError("#N/A", "the value is none of SWITCH's cases: add a default last");
  },
} satisfies FormulaFunction;
