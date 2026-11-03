import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "notEmpty",
  label: "Not empty",
  category: "Cells",
  description: "Cells that are not empty",
  test: (cell) => cell.text.trim() !== "",
  excel: (_, at) => ({ type: "notContainsBlanks", formulas: [`LEN(TRIM(${at}))>0`] }),
});
