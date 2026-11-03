import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize }: Helpers): ConditionDefinition<{ value: string }> => ({
  name: "notEqual",
  label: "Not equal to",
  description: "Cells that are not a value (as Equal to compares them)",
  params: { value: { kind: "text", label: "Value", default: "" } },
  test: (cell, { params }) => {
    const n = params.value.trim() === "" ? NaN : Number(params.value.replace(",", "."));
    if (cell.number !== undefined && Number.isFinite(n)) return cell.number !== n;
    return normalize(cell.text) !== normalize(params.value) && normalize(cell.value) !== normalize(params.value);
  },
});
