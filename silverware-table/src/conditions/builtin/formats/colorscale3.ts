import type { Color, FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, mix }: Helpers): FormatDefinition<{ low: Color; middle: Color; high: Color }> => ({
  name: "colorScale3",
  label: "Color scale of three colors",
  description: "A fill from one color at the smallest number through a second in the middle to a third at the largest",
  params: {
    low: { kind: "color", label: "Smallest", default: palette.red },
    middle: { kind: "color", label: "Middle", default: palette.yellow },
    high: { kind: "color", label: "Largest", default: palette.green },
  },
  look: (cell, { scope, params }) => {
    const t = scope.position(cell);
    return t === undefined ? undefined : { fill: mix([params.low, params.middle, params.high], t) };
  },
});
