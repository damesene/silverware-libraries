import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "notEmpty",
  label: "Not empty",
  description: "Cells that are not empty",
  test: (cell) => cell.text.trim() !== "",
});
