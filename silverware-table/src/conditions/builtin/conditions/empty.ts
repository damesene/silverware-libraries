import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "empty",
  label: "Empty",
  description: "Empty cells",
  test: (cell) => cell.text.trim() === "",
  excel: (_, at) => ({ type: "containsBlanks", formulas: [`LEN(TRIM(${at}))=0`] }),
});
