import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "belowAverage",
  label: "Below average",
  description: "Cells whose number is below the average of the rule's cells",
  test: (cell, { scope }) => cell.number !== undefined && scope.average !== undefined && cell.number < scope.average,
});
