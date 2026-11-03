import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, gradient, levels }: Helpers): FormatDefinition => ({
  name: "heatMap",
  label: "Heat map",
  category: "Scales",
  description: "Ten levels from blue to red, as many cells in each",
  look: levels(gradient([palette.blue, palette.yellow, palette.red], 10).map((fill) => ({ fill })), "quantiles"),
  excel: () => "levels have no Excel form",
});
