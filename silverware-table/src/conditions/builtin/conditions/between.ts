import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition<{ from: number; to: number }> => ({
  name: "between",
  label: "Between",
  category: "Numbers",
  description: "Cells whose number is between two values, both included",
  params: { from: { kind: "number", label: "From", default: 0 }, to: { kind: "number", label: "To", default: 100 } },
  test: (cell, { params }) => cell.number !== undefined && cell.number >= Math.min(params.from, params.to) && cell.number <= Math.max(params.from, params.to),
  excel: (params) => ({ type: "cellIs", attrs: { operator: "between" }, formulas: [String(Math.min(params.from, params.to)), String(Math.max(params.from, params.to))] }),
});
