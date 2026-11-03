import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition => ({
  name: "empty",
  label: "Empty",
  description: "Empty cells",
  test: (cell) => cell.text.trim() === "",
});
