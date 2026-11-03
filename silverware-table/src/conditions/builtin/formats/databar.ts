import type { Color, FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition<{ color: Color }> => ({
  name: "dataBar",
  label: "Data bar",
  description: "A bar under each number, as long as its share of the largest",
  params: { color: { kind: "color", label: "Color", default: palette.blue } },
  look: (cell, { scope, params }) => {
    const share = scope.share(cell);
    return share === undefined ? undefined : { bar: { share, color: params.color } };
  },
});
