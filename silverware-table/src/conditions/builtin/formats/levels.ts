import type { Color, FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, gradient, levels }: Helpers): FormatDefinition<{ count: number; low: Color; high: Color; split: "equal" | "quantiles" }> => ({
  name: "levels",
  label: "Levels",
  description: "The numbers split into levels, each a color between two: equal ranges between the smallest and the largest, or as many cells in each",
  params: {
    count: { kind: "number", label: "Levels", integer: true, min: 2, max: 10, default: 5 },
    low: { kind: "color", label: "Lowest", default: palette.green },
    high: { kind: "color", label: "Highest", default: palette.red },
    split: { kind: "choice", label: "Split", values: ["equal", "quantiles"], labels: ["Equal ranges", "As many cells in each"], default: "equal" },
  },
  look: (cell, context) => levels(gradient([context.params.low, context.params.high], context.params.count).map((fill) => ({ fill })), context.params.split)(cell, context),
});
