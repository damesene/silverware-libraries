import type { Color, FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, mix }: Helpers): FormatDefinition<{ low: Color; high: Color }> => ({
  name: "colorScale",
  label: "Color scale",
  description: "A fill from one color at the smallest number to another at the largest",
  params: { low: { kind: "color", label: "Smallest", default: palette.red }, high: { kind: "color", label: "Largest", default: palette.green } },
  look: (cell, { scope, params }) => {
    const t = scope.position(cell);
    return t === undefined ? undefined : { fill: mix([params.low, params.high], t) };
  },
});
