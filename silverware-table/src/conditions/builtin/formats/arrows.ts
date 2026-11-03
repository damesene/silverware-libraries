import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, icons, levels }: Helpers): FormatDefinition => ({
  name: "arrows",
  label: "Arrows",
  description: "An arrow before each number: down in red, right in yellow, up in green, in three equal ranges",
  look: levels([
    { icon: icons.down, iconColor: palette.red },
    { icon: icons.right, iconColor: palette.yellow },
    { icon: icons.up, iconColor: palette.green },
  ]),
});
