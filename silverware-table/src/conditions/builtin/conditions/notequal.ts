import type { ConditionDefinition, Helpers } from "../../api.ts";

export default ({ normalize, excelText }: Helpers): ConditionDefinition<{ value: string }> => ({
  name: "notEqual",
  label: "Not equal to",
  category: "Text",
  description: "Cells that are not a value (as Equal to compares them)",
  params: { value: { kind: "text", label: "Value", default: "" } },
  test: (cell, { params }) => {
    const n = params.value.trim() === "" ? NaN : Number(params.value.replace(",", "."));
    if (cell.number !== undefined && Number.isFinite(n)) return cell.number !== n;
    return normalize(cell.text) !== normalize(params.value) && normalize(cell.value) !== normalize(params.value);
  },
  // A number: every cell but that number's (an empty cell too: Excel's cellIs takes it as 0); text: Excel's own
  excel: (params, at) => {
    const n = params.value.trim() === "" ? NaN : Number(params.value.replace(",", "."));
    return Number.isFinite(n) ? { type: "expression", formulas: [`NOT(AND(ISNUMBER(${at}),${at}=${n}))`] } : { type: "cellIs", attrs: { operator: "notEqual" }, formulas: [excelText(params.value)] };
  },
});
