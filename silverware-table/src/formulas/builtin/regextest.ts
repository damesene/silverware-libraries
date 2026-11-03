import { toWhole } from "../arguments.ts";
import { FormulaError, isError, toText } from "../values.ts";
import type { FormulaFunction } from "../function.ts";

export default {
  name: "REGEXTEST",
  syntax: "REGEXTEST(text, pattern, [case_sensitivity])",
  description: "Whether text matches the regular expression pattern anywhere in it (^ and $ for its start and end), as Excel 365's: TRUE or FALSE; case_sensitivity 0 (the default) tells upper and lower case apart, 1 does not. A pattern that is no regular expression: #VALUE!.",
  category: "text",
  example: '=REGEXTEST([@code], "^[A-Z]{2}-\\d+$")',
  minArgs: 2,
  maxArgs: 3,
  call: ([text, pattern, sensitivity = 0]) => {
    const t = toText(text!);
    const p = toText(pattern!);
    const s = toWhole(sensitivity);
    if (isError(t)) return t;
    if (isError(p)) return p;
    if (isError(s)) return s;
    if (s !== 0 && s !== 1) return new FormulaError("#VALUE!", `case_sensitivity is ${s}: 0 tells case apart, 1 does not`);
    try {
      return new RegExp(p, s === 1 ? "iu" : "u").test(t);
    } catch (e) {
      return new FormulaError("#VALUE!", `"${p}" is no regular expression (${e instanceof Error ? e.message : String(e)})`);
    }
  },
} satisfies FormulaFunction;
