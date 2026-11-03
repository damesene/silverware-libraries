import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ matches }: Helpers): ConditionDefinition<{ pattern: string }> => ({
  name: "matches",
  label: "Matches",
  description: "Cells a filter would show: words found anywhere, /regular expression/flags, =a|b (whole cells), >10, !… (not)",
  params: { pattern: { kind: "pattern", label: "Pattern", default: "" } },
  test: (cell, { params }) => matches(params.pattern)(cell.text),
});
