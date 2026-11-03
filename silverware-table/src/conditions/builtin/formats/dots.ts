import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, icons, levels }: Helpers): FormatDefinition => ({
  name: "dots",
  label: "Traffic light dots",
  description: "A dot before each number: red, yellow, green in three equal ranges",
  look: levels([
    { icon: icons.dot, iconColor: palette.red },
    { icon: icons.dot, iconColor: palette.yellow },
    { icon: icons.dot, iconColor: palette.green },
  ]),
  excel: () => ({ kind: "iconSet", set: "3TrafficLights1" }),
});
