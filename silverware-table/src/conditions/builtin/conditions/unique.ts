import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "unique",
  label: "Unique values",
  category: "Cells",
  description: "Cells whose value no other of the rule's cells has (case ignored); empty cells left out",
  test: (cell, { scope }) => cell.value.trim() !== "" && scope.count(cell) === 1,
  excel: () => ({ type: "uniqueValues" }),
});
