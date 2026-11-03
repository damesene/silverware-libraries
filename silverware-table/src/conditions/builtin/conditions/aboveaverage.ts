import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "aboveAverage",
  label: "Above average",
  category: "Numbers",
  description: "Cells whose number is above the average of the rule's cells",
  test: (cell, { scope }) => cell.number !== undefined && scope.average !== undefined && cell.number > scope.average,
  excel: () => ({ type: "aboveAverage" }),
});
