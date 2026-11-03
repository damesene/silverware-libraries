import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "duplicate",
  label: "Duplicate values",
  category: "Cells",
  description: "Cells whose value another of the rule's cells has too (case ignored); empty cells left out",
  test: (cell, { scope }) => cell.value.trim() !== "" && scope.count(cell) > 1,
  excel: () => ({ type: "duplicateValues" }),
});
