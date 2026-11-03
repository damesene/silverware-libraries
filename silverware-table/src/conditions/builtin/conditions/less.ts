import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition<{ value: number }> => ({
  name: "less",
  label: "Less than",
  category: "Numbers",
  description: "Cells whose number is less than a value",
  params: { value: { kind: "number", label: "Value", default: 0 } },
  test: (cell, { params }) => cell.number !== undefined && cell.number < params.value,
  excel: (params) => ({ type: "cellIs", attrs: { operator: "lessThan" }, formulas: [String(params.value)] }),
});
