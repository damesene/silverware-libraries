import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, icons, levels }: Helpers): FormatDefinition => ({
  name: "dots",
  label: "Traffic light dots",
  category: "Icons",
  description: "A dot before each number: red, yellow, green below 33 %, below 67 % and from 67 % of the range, as Excel's icon sets",
  look: levels([
    { icon: icons.dot, iconColor: palette.red },
    { icon: icons.dot, iconColor: palette.yellow },
    { icon: icons.dot, iconColor: palette.green },
  ], { percent: [33, 67] }),
  excel: () => ({ kind: "iconSet", set: "3TrafficLights1" }),
});
