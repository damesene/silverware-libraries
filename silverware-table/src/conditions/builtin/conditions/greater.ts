import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition<{ value: number }> => ({
  name: "greater",
  label: "Greater than",
  category: "Numbers",
  description: "Cells whose number is greater than a value",
  params: { value: { kind: "number", label: "Value", default: 0 } },
  test: (cell, { params }) => cell.number !== undefined && cell.number > params.value,
  // Numbers only, as the table compares (Excel's cellIs takes text as greater than any number, an empty cell as 0)
  excel: (params, at) => ({ type: "expression", formulas: [`AND(ISNUMBER(${at}),${at}>${params.value})`] }),
});
