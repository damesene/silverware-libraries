import type { Color, FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, gradient, levels }: Helpers): FormatDefinition<{ count: number; low: Color; high: Color; split: "equal" | "quantiles" }> => ({
  name: "levels",
  label: "Levels",
  description: "The numbers split into levels, each a color between two: as many cells in each, or equal ranges between the smallest and the largest (one far larger number leaves the others in the first levels)",
  params: {
    count: { kind: "number", label: "Levels", integer: true, min: 2, max: 10, default: 5 },
    low: { kind: "color", label: "Lowest", default: palette.green },
    high: { kind: "color", label: "Highest", default: palette.red },
    split: { kind: "choice", label: "Split", values: ["quantiles", "equal"], labels: ["As many cells in each", "Equal ranges of the numbers"], default: "quantiles" },
  },
  look: (cell, context) => levels(gradient([context.params.low, context.params.high], context.params.count).map((fill) => ({ fill })), context.params.split)(cell, context),
  excel: () => "levels have no Excel form",
});
