import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ matches, excelText, excelFilter, plainPattern }: Helpers): ConditionDefinition<{ pattern: string }> => ({
  name: "matches",
  label: "Matches",
  category: "Text",
  description: "Cells a filter would show: words found anywhere, /regular expression/flags, =a|b (whole cells), >10, !… (not)",
  params: { pattern: { kind: "pattern", label: "Pattern", default: "" } },
  test: (cell, { params }) => matches(params.pattern)(cell.text),
  // Plain words as Excel's own "contains" (its dialog shows it so), the rest of a filter's syntax as a formula
  excel: (params, at) => {
    if (plainPattern(params.pattern)) {
      return { type: "containsText", attrs: { operator: "containsText", text: params.pattern.trim() }, formulas: [`NOT(ISERROR(SEARCH(${excelText(params.pattern.trim())},${at})))`] };
    }
    const formula = excelFilter(params.pattern, at);
    return formula ? { type: "expression", formulas: [formula] } : "an empty pattern";
  },
});
