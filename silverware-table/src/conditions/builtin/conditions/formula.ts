import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition<{ formula: string }> => ({
  name: "formula",
  label: "Formula",
  category: "Formula",
  description: "Cells of the rows a formula of one row is true for (=[@due] < TODAY()); needs the formulas module",
  params: { formula: { kind: "text", label: "Formula", default: "" } },
  test: (cell, { params, formula }) => {
    if (!params.formula.trim()) return false;
    const value = formula(params.formula);
    return value === true || (typeof value === "number" && value !== 0) || (typeof value === "string" && value.toUpperCase() === "TRUE");
  },
  excel: () => "a formula condition reads columns by name, which Excel's conditional formatting cannot",
});
