import type { FormatDefinition, Helpers, Style } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition<{ style: Style }> => ({
  name: "custom",
  label: "Own style",
  category: "Styles",
  description: "A fill, a text color, bold, italic, underline or strikethrough of your choice",
  params: { style: { kind: "style", label: "Style", default: { fill: palette.purple } } },
  style: ({ style }) => style,
});
