import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, icons, levels }: Helpers): FormatDefinition => ({
  name: "arrows",
  label: "Arrows",
  category: "Icons",
  description: "An arrow before each number: down in red, right in yellow, up in green, below 33 %, below 67 % and from 67 % of the range, as Excel's icon sets",
  look: levels([
    { icon: icons.down, iconColor: palette.red },
    { icon: icons.right, iconColor: palette.yellow },
    { icon: icons.up, iconColor: palette.green },
  ], { percent: [33, 67] }),
  excel: () => ({ kind: "iconSet", set: "3Arrows" }),
});
