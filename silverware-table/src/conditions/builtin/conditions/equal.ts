import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ value: string }> => ({
  name: "equal",
  label: "Equal to",
  category: "Text",
  description: "Cells that are a value: as numbers where both are, else as text, case ignored",
  params: { value: { kind: "text", label: "Value", default: "" } },
  test: (cell, { params }) => {
    const n = params.value.trim() === "" ? NaN : Number(params.value.replace(",", "."));
    if (cell.number !== undefined && Number.isFinite(n)) return cell.number === n;
    return normalize(cell.text) === normalize(params.value) || normalize(cell.value) === normalize(params.value);
  },
  excel: (params) => {
    const n = params.value.trim() === "" ? NaN : Number(params.value.replace(",", "."));
    return { type: "cellIs", attrs: { operator: "equal" }, formulas: [Number.isFinite(n) ? String(n) : excelText(params.value)] };
  },
});
