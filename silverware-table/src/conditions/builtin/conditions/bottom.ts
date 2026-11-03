import type { ConditionDefinition } from "../../api.ts";

export default (): ConditionDefinition<{ count: number; percent: boolean }> => ({
  name: "bottom",
  label: "Bottom values",
  description: "The cells of the smallest numbers: a count of them, or a percentage of the cells with numbers",
  params: { count: { kind: "number", label: "How many", integer: true, min: 1, default: 10 }, percent: { kind: "boolean", label: "Percent", default: false } },
  test: (cell, { scope, params }) => {
    const rank = scope.rank(cell, true);
    const limit = params.percent ? Math.max(1, Math.floor((scope.numbers.length * params.count) / 100)) : params.count;
    return rank !== undefined && rank <= limit;
  },
  excel: (params) => ({ type: "top10", attrs: { rank: String(params.count), bottom: "1", ...(params.percent ? { percent: "1" } : {}) } }),
});
