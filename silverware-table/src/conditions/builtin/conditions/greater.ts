import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition<{ value: number }> => ({
  name: "greater",
  label: "Greater than",
  description: "Cells whose number is greater than a value",
  params: { value: { kind: "number", label: "Value", default: 0 } },
  test: (cell, { params }) => cell.number !== undefined && cell.number > params.value,
  excel: (params) => ({ type: "cellIs", attrs: { operator: "greaterThan" }, formulas: [String(params.value)] }),
});
