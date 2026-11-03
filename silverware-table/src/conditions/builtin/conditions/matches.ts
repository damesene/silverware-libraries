import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ matches, excelText, plainPattern }: Helpers): ConditionDefinition<{ pattern: string }> => ({
  name: "matches",
  label: "Matches",
  description: "Cells a filter would show: words found anywhere, /regular expression/flags, =a|b (whole cells), >10, !… (not)",
  params: { pattern: { kind: "pattern", label: "Pattern", default: "" } },
  test: (cell, { params }) => matches(params.pattern)(cell.text),
  excel: (params, at) =>
    plainPattern(params.pattern)
      ? { type: "containsText", attrs: { operator: "containsText", text: params.pattern.trim() }, formulas: [`NOT(ISERROR(SEARCH(${excelText(params.pattern.trim())},${at})))`] }
      : "a pattern of a filter's syntax (a regular expression, =a|b, >10, !…) has no Excel form",
});
